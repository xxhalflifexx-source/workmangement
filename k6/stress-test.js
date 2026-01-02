/**
 * Stress Test
 * Push the system to its limits with 200+ concurrent users
 * Run: k6 run k6/stress-test.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Trend, Rate } from 'k6/metrics';
import { BASE_URL, HEADERS, thinkTime, randomString } from './config.js';

// Custom metrics
const requestDuration = new Trend('request_duration');
const errorRate = new Rate('error_rate');
const timeouts = new Counter('timeouts');

export const options = {
  stages: [
    { duration: '2m', target: 50 },   // Warm up
    { duration: '3m', target: 100 },  // Ramp to 100
    { duration: '5m', target: 200 },  // Peak at 200 users
    { duration: '3m', target: 200 },  // Stay at peak
    { duration: '2m', target: 100 },  // Ramp down
    { duration: '2m', target: 0 },    // Cool down
  ],
  
  thresholds: {
    http_req_duration: ['p(95)<2000', 'p(99)<5000'], // Relaxed for stress
    http_req_failed: ['rate<0.10'], // 10% failure acceptable under stress
    error_rate: ['rate<0.15'],
    timeouts: ['count<500'],
  },
};

export function setup() {
  console.log('Starting stress test...');
  console.log(`Target: ${BASE_URL}`);
  
  const res = http.get(`${BASE_URL}/api/health/db`, { timeout: '10s' });
  if (res.status !== 200) {
    console.warn('Warning: Health check failed, proceeding anyway');
  }
  
  return { startTime: Date.now() };
}

export default function (data) {
  const params = {
    timeout: '30s',
    tags: { name: 'stress_test' },
  };

  // Randomize user behavior
  const scenario = Math.random();

  if (scenario < 0.4) {
    // 40% - Browse pages
    group('Browse Pages', function () {
      const pages = ['/login', '/dashboard', '/jobs', '/time-clock', '/qc'];
      const page = pages[Math.floor(Math.random() * pages.length)];
      
      const res = http.get(`${BASE_URL}${page}`, { ...params, redirects: 5 });
      requestDuration.add(res.timings.duration);
      
      if (res.status === 0) {
        timeouts.add(1);
        errorRate.add(true);
      } else {
        errorRate.add(res.status >= 400);
        check(res, { 'page loads': (r) => r.status < 500 });
      }
      
      sleep(thinkTime(1));
    });
    
  } else if (scenario < 0.7) {
    // 30% - API calls
    group('API Calls', function () {
      // Health check
      let res = http.get(`${BASE_URL}/api/health/db`, params);
      requestDuration.add(res.timings.duration);
      errorRate.add(res.status >= 400);
      
      sleep(thinkTime(0.5));
      
      // User permissions
      res = http.get(`${BASE_URL}/api/user/permissions`, params);
      requestDuration.add(res.timings.duration);
      
      sleep(thinkTime(0.5));
    });
    
  } else if (scenario < 0.85) {
    // 15% - Heavy page loads (simulate form submissions)
    group('Heavy Operations', function () {
      // Simulate job list loading with pagination
      const page = Math.floor(Math.random() * 10) + 1;
      let res = http.get(`${BASE_URL}/jobs?page=${page}`, { ...params, redirects: 5 });
      requestDuration.add(res.timings.duration);
      
      if (res.status === 0) {
        timeouts.add(1);
        errorRate.add(true);
      } else {
        errorRate.add(res.status >= 400);
      }
      
      sleep(thinkTime(2));
    });
    
  } else {
    // 15% - Static resources
    group('Static Resources', function () {
      const resources = [
        '/_next/static/chunks/main.js',
        '/_next/static/chunks/pages/_app.js',
        '/favicon.ico',
      ];
      
      const resource = resources[Math.floor(Math.random() * resources.length)];
      const res = http.get(`${BASE_URL}${resource}`, params);
      requestDuration.add(res.timings.duration);
      
      sleep(thinkTime(0.5));
    });
  }

  // Minimal think time under stress
  sleep(thinkTime(0.5));
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(`\nStress test completed in ${duration.toFixed(0)} seconds`);
}

export function handleSummary(data) {
  const passed = data.metrics.http_req_failed.values.rate < 0.10;
  
  console.log('\n=== Stress Test Summary ===');
  console.log(`Status: ${passed ? 'PASSED' : 'FAILED'}`);
  console.log(`Peak VUs: 200`);
  console.log(`Total requests: ${data.metrics.http_reqs.values.count}`);
  console.log(`Failed rate: ${(data.metrics.http_req_failed.values.rate * 100).toFixed(2)}%`);
  console.log(`Avg response time: ${data.metrics.http_req_duration.values.avg.toFixed(2)}ms`);
  console.log(`P95 response time: ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms`);
  console.log(`P99 response time: ${data.metrics.http_req_duration.values['p(99)'].toFixed(2)}ms`);
  console.log(`Max response time: ${data.metrics.http_req_duration.values.max.toFixed(2)}ms`);
  
  if (data.metrics.timeouts) {
    console.log(`Timeouts: ${data.metrics.timeouts.values.count}`);
  }
  
  return {};
}

