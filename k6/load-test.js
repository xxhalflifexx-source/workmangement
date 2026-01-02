/**
 * Load Test
 * Simulates normal traffic with 50 concurrent users
 * Run: k6 run k6/load-test.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { BASE_URL, HEADERS, TEST_USER, thinkTime } from './config.js';

// Custom metrics
const loginDuration = new Trend('login_duration');
const apiDuration = new Trend('api_duration');
const pageLoadDuration = new Trend('page_load_duration');
const errorCount = new Counter('errors');

export const options = {
  stages: [
    { duration: '1m', target: 10 },  // Ramp up to 10 users
    { duration: '3m', target: 50 },  // Ramp up to 50 users
    { duration: '5m', target: 50 },  // Stay at 50 users
    { duration: '2m', target: 25 },  // Ramp down
    { duration: '1m', target: 0 },   // Ramp down to 0
  ],
  
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.05'], // 5% failure rate acceptable
    login_duration: ['p(95)<3000'],
    api_duration: ['p(95)<500'],
    page_load_duration: ['p(95)<2000'],
    errors: ['count<100'],
  },
};

export function setup() {
  // Verify app is running
  const res = http.get(`${BASE_URL}/api/health/db`);
  if (res.status !== 200) {
    throw new Error('Application is not healthy');
  }
  return {};
}

export default function () {
  // Simulate user session
  
  group('Page Loads', function () {
    // Load login page
    let res = http.get(`${BASE_URL}/login`);
    pageLoadDuration.add(res.timings.duration);
    check(res, { 'login page loads': (r) => r.status === 200 });
    
    sleep(thinkTime(1));
  });

  group('API Endpoints', function () {
    // Test health endpoint
    let res = http.get(`${BASE_URL}/api/health/db`);
    apiDuration.add(res.timings.duration);
    check(res, { 'health API works': (r) => r.status === 200 }) || errorCount.add(1);
    
    sleep(thinkTime(0.5));

    // Test user permissions endpoint (may require auth)
    res = http.get(`${BASE_URL}/api/user/permissions`);
    apiDuration.add(res.timings.duration);
    // May return 401 if not authenticated, which is expected
    check(res, { 
      'permissions API responds': (r) => r.status === 200 || r.status === 401 
    });
    
    sleep(thinkTime(0.5));
  });

  group('Static Resources', function () {
    // Simulate loading static resources
    const resources = [
      `${BASE_URL}/_next/static/chunks/main.js`,
      `${BASE_URL}/_next/static/chunks/webpack.js`,
    ];
    
    resources.forEach(url => {
      const res = http.get(url);
      check(res, { 'static resource loads': (r) => r.status === 200 || r.status === 404 });
    });
    
    sleep(thinkTime(1));
  });

  group('Dashboard Simulation', function () {
    // Try to access dashboard (will redirect if not authenticated)
    let res = http.get(`${BASE_URL}/dashboard`, { redirects: 5 });
    pageLoadDuration.add(res.timings.duration);
    check(res, { 
      'dashboard accessible': (r) => r.status === 200 
    });
    
    sleep(thinkTime(2));
  });

  group('Jobs Page Simulation', function () {
    // Try to access jobs page
    let res = http.get(`${BASE_URL}/jobs`, { redirects: 5 });
    pageLoadDuration.add(res.timings.duration);
    check(res, { 
      'jobs page accessible': (r) => r.status === 200 
    });
    
    sleep(thinkTime(2));
  });

  // Think time between iterations
  sleep(thinkTime(3));
}

export function teardown(data) {
  console.log('Load test completed');
}

export function handleSummary(data) {
  console.log('\n=== Load Test Summary ===');
  console.log(`Virtual Users: ${options.stages.reduce((max, s) => Math.max(max, s.target), 0)} peak`);
  console.log(`Total requests: ${data.metrics.http_reqs.values.count}`);
  console.log(`Failed requests: ${data.metrics.http_req_failed.values.rate * 100}%`);
  console.log(`Avg response time: ${data.metrics.http_req_duration.values.avg.toFixed(2)}ms`);
  console.log(`P95 response time: ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms`);
  console.log(`P99 response time: ${data.metrics.http_req_duration.values['p(99)'].toFixed(2)}ms`);
  
  if (data.metrics.api_duration) {
    console.log(`API P95: ${data.metrics.api_duration.values['p(95)'].toFixed(2)}ms`);
  }
  
  return {};
}

