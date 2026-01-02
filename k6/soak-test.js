/**
 * Soak Test (Endurance Test)
 * Test system stability over extended periods
 * Run: k6 run k6/soak-test.js
 * 
 * WARNING: This test runs for a long time (1+ hour)
 * Use for testing memory leaks, resource exhaustion, etc.
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Counter, Gauge } from 'k6/metrics';
import { BASE_URL, thinkTime, randomString } from './config.js';

// Custom metrics
const responseTrend = new Trend('response_over_time');
const cumulativeErrors = new Counter('cumulative_errors');
const activeUsers = new Gauge('active_users');

export const options = {
  stages: [
    { duration: '5m', target: 30 },   // Ramp up
    { duration: '1h', target: 30 },   // Sustained load for 1 hour
    { duration: '5m', target: 0 },    // Ramp down
  ],
  
  thresholds: {
    http_req_duration: ['p(95)<1000', 'p(99)<2000'],
    http_req_failed: ['rate<0.02'], // 2% failure rate over long period
    cumulative_errors: ['count<500'], // Total errors over test
  },
};

// Track performance over time
let checkpoints = [];

export function setup() {
  console.log('Starting soak test...');
  console.log('This test will run for approximately 1 hour 10 minutes');
  console.log('Watch for degradation in response times over time');
  
  return { 
    startTime: Date.now(),
    checkpointInterval: 5 * 60 * 1000, // 5 minutes
    lastCheckpoint: Date.now(),
  };
}

export default function (data) {
  const elapsed = Date.now() - data.startTime;
  activeUsers.add(__VU);

  const params = {
    timeout: '30s',
    tags: { 
      checkpoint: Math.floor(elapsed / data.checkpointInterval).toString() 
    },
  };

  // Simulate realistic user session
  group('User Session', function () {
    // 1. View dashboard
    let res = http.get(`${BASE_URL}/dashboard`, { ...params, redirects: 5 });
    responseTrend.add(res.timings.duration);
    if (!check(res, { 'dashboard ok': (r) => r.status < 500 })) {
      cumulativeErrors.add(1);
    }
    
    sleep(thinkTime(2));

    // 2. Check jobs
    res = http.get(`${BASE_URL}/jobs`, { ...params, redirects: 5 });
    responseTrend.add(res.timings.duration);
    if (!check(res, { 'jobs ok': (r) => r.status < 500 })) {
      cumulativeErrors.add(1);
    }
    
    sleep(thinkTime(3));

    // 3. View time clock
    res = http.get(`${BASE_URL}/time-clock`, { ...params, redirects: 5 });
    responseTrend.add(res.timings.duration);
    if (!check(res, { 'time-clock ok': (r) => r.status < 500 })) {
      cumulativeErrors.add(1);
    }
    
    sleep(thinkTime(2));

    // 4. API health check
    res = http.get(`${BASE_URL}/api/health/db`, params);
    responseTrend.add(res.timings.duration);
    check(res, { 'health ok': (r) => r.status === 200 });
    
    sleep(thinkTime(1));
  });

  // Log checkpoint every 5 minutes
  if (Date.now() - data.lastCheckpoint > data.checkpointInterval) {
    data.lastCheckpoint = Date.now();
    const minutes = Math.floor(elapsed / 60000);
    console.log(`Checkpoint at ${minutes} minutes`);
  }

  // Realistic think time between sessions
  sleep(thinkTime(5));
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000 / 60;
  console.log(`\nSoak test completed after ${duration.toFixed(1)} minutes`);
}

export function handleSummary(data) {
  console.log('\n=== Soak Test Summary ===');
  console.log('Long-running stability test');
  console.log(`Total requests: ${data.metrics.http_reqs.values.count}`);
  console.log(`Failed rate: ${(data.metrics.http_req_failed.values.rate * 100).toFixed(3)}%`);
  console.log(`Cumulative errors: ${data.metrics.cumulative_errors?.values.count || 0}`);
  console.log(`\nResponse Time Analysis:`);
  console.log(`  Min: ${data.metrics.http_req_duration.values.min.toFixed(2)}ms`);
  console.log(`  Avg: ${data.metrics.http_req_duration.values.avg.toFixed(2)}ms`);
  console.log(`  Med: ${data.metrics.http_req_duration.values.med.toFixed(2)}ms`);
  console.log(`  P95: ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms`);
  console.log(`  P99: ${data.metrics.http_req_duration.values['p(99)'].toFixed(2)}ms`);
  console.log(`  Max: ${data.metrics.http_req_duration.values.max.toFixed(2)}ms`);
  
  // Check for degradation (if max is much higher than p99, there might be issues)
  const degradationRatio = data.metrics.http_req_duration.values.max / data.metrics.http_req_duration.values['p(99)'];
  if (degradationRatio > 3) {
    console.log(`\n⚠️  Warning: Max response time is ${degradationRatio.toFixed(1)}x higher than P99`);
    console.log('    This may indicate occasional performance degradation');
  }
  
  return {};
}

