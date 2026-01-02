/**
 * Spike Test
 * Test how the system handles sudden traffic surges
 * Run: k6 run k6/spike-test.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Counter } from 'k6/metrics';
import { BASE_URL, thinkTime } from './config.js';

// Custom metrics
const spikeRecoveryTime = new Trend('spike_recovery_time');
const errorsUnderSpike = new Counter('errors_under_spike');

export const options = {
  stages: [
    { duration: '30s', target: 10 },   // Normal load
    { duration: '10s', target: 200 },  // SPIKE! Sudden 20x increase
    { duration: '2m', target: 200 },   // Stay at spike
    { duration: '10s', target: 10 },   // Sudden drop
    { duration: '1m', target: 10 },    // Recovery period
    { duration: '30s', target: 0 },    // Ramp down
  ],
  
  thresholds: {
    http_req_duration: ['p(95)<3000'], // Relaxed for spike
    http_req_failed: ['rate<0.20'], // 20% failure acceptable during spike
    errors_under_spike: ['count<1000'],
  },
};

let spikeStart = 0;
let spikeEnd = 0;
let inSpike = false;

export function setup() {
  console.log('Starting spike test...');
  console.log('Watch for recovery behavior after the spike!');
  return { startTime: Date.now() };
}

export default function (data) {
  const elapsed = (Date.now() - data.startTime) / 1000;
  
  // Detect if we're in the spike phase (30s - 2m40s)
  const isSpike = elapsed > 30 && elapsed < 160;
  
  if (isSpike && !inSpike) {
    inSpike = true;
    spikeStart = Date.now();
    console.log(`Spike started at ${elapsed.toFixed(0)}s`);
  } else if (!isSpike && inSpike) {
    inSpike = false;
    spikeEnd = Date.now();
    console.log(`Spike ended at ${elapsed.toFixed(0)}s, duration: ${((spikeEnd - spikeStart) / 1000).toFixed(0)}s`);
  }

  const params = {
    timeout: '15s',
    tags: { spike_phase: isSpike ? 'during' : 'normal' },
  };

  group('Critical Path', function () {
    // Test the most important endpoints
    
    // 1. Health check
    let res = http.get(`${BASE_URL}/api/health/db`, params);
    const healthy = check(res, { 'health check ok': (r) => r.status === 200 });
    if (!healthy && isSpike) {
      errorsUnderSpike.add(1);
    }
    
    sleep(thinkTime(0.3));

    // 2. Dashboard load
    res = http.get(`${BASE_URL}/dashboard`, { ...params, redirects: 5 });
    const dashboardOk = check(res, { 'dashboard loads': (r) => r.status < 500 });
    if (!dashboardOk && isSpike) {
      errorsUnderSpike.add(1);
    }
    
    // Track recovery
    if (!isSpike && spikeEnd > 0 && res.status === 200) {
      const recoveryTime = Date.now() - spikeEnd;
      if (recoveryTime < 60000) { // Within 1 minute of spike end
        spikeRecoveryTime.add(recoveryTime);
      }
    }
    
    sleep(thinkTime(0.5));

    // 3. Jobs page
    res = http.get(`${BASE_URL}/jobs`, { ...params, redirects: 5 });
    check(res, { 'jobs loads': (r) => r.status < 500 });
  });

  // Minimal think time during spike
  sleep(isSpike ? thinkTime(0.2) : thinkTime(1));
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(`\nSpike test completed in ${duration.toFixed(0)} seconds`);
}

export function handleSummary(data) {
  console.log('\n=== Spike Test Summary ===');
  console.log('Simulated sudden traffic surge from 10 to 200 VUs');
  console.log(`Total requests: ${data.metrics.http_reqs.values.count}`);
  console.log(`Failed rate: ${(data.metrics.http_req_failed.values.rate * 100).toFixed(2)}%`);
  console.log(`Avg response time: ${data.metrics.http_req_duration.values.avg.toFixed(2)}ms`);
  console.log(`P95 response time: ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms`);
  console.log(`Max response time: ${data.metrics.http_req_duration.values.max.toFixed(2)}ms`);
  
  if (data.metrics.errors_under_spike) {
    console.log(`Errors during spike: ${data.metrics.errors_under_spike.values.count}`);
  }
  
  return {};
}

