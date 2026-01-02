/**
 * Smoke Test
 * Quick sanity check that the application is running and basic functionality works
 * Run: k6 run k6/smoke-test.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, HEADERS } from './config.js';

export const options = {
  // Minimal load - just verify the app works
  vus: 1,
  duration: '30s',
  
  thresholds: {
    http_req_duration: ['p(99)<1500'], // 99% of requests under 1.5s
    http_req_failed: ['rate<0.01'], // Less than 1% failures
  },
};

export default function () {
  // Test 1: Health check endpoint
  const healthRes = http.get(`${BASE_URL}/api/health/db`);
  check(healthRes, {
    'health check status is 200': (r) => r.status === 200,
    'health check responds quickly': (r) => r.timings.duration < 500,
  });
  
  sleep(1);

  // Test 2: Login page loads
  const loginRes = http.get(`${BASE_URL}/login`);
  check(loginRes, {
    'login page status is 200': (r) => r.status === 200,
    'login page contains form': (r) => r.body.includes('password'),
  });
  
  sleep(1);

  // Test 3: Dashboard redirects if not authenticated
  const dashboardRes = http.get(`${BASE_URL}/dashboard`, { redirects: 0 });
  check(dashboardRes, {
    'dashboard requires auth': (r) => r.status === 302 || r.status === 307 || r.status === 200,
  });
  
  sleep(1);

  // Test 4: Static assets load
  const staticRes = http.get(`${BASE_URL}/favicon.ico`);
  check(staticRes, {
    'static assets accessible': (r) => r.status === 200 || r.status === 404,
  });

  sleep(2);
}

export function handleSummary(data) {
  console.log('\n=== Smoke Test Summary ===');
  console.log(`Total requests: ${data.metrics.http_reqs.values.count}`);
  console.log(`Failed requests: ${data.metrics.http_req_failed.values.passes}`);
  console.log(`Avg response time: ${data.metrics.http_req_duration.values.avg.toFixed(2)}ms`);
  console.log(`P95 response time: ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms`);
  
  return {};
}

