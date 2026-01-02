/**
 * k6 Configuration and shared utilities
 * @see https://k6.io/docs/
 */

// Base URL for the application
export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Test user credentials (use environment variables in CI)
export const TEST_USER = {
  email: __ENV.TEST_USER_EMAIL || 'loadtest@example.com',
  password: __ENV.TEST_USER_PASSWORD || 'loadtest123',
};

// Thresholds for performance metrics
export const THRESHOLDS = {
  // HTTP request duration thresholds
  http_req_duration: ['p(95)<500', 'p(99)<1000'], // 95% < 500ms, 99% < 1s
  
  // HTTP request failure rate
  http_req_failed: ['rate<0.01'], // < 1% failure rate
  
  // Custom metric thresholds
  login_duration: ['p(95)<2000'], // Login should complete within 2s
  api_duration: ['p(95)<300'], // API calls should be fast
};

// Common headers
export const HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
};

/**
 * Generate random string for unique data
 */
export function randomString(length = 8) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generate random job data
 */
export function generateJobData() {
  return {
    title: `Load Test Job ${randomString()}`,
    description: `Created by k6 load test at ${new Date().toISOString()}`,
    priority: ['LOW', 'MEDIUM', 'HIGH'][Math.floor(Math.random() * 3)],
    status: 'NOT_STARTED',
  };
}

/**
 * Sleep with random jitter to simulate real user behavior
 */
export function thinkTime(baseSeconds = 1) {
  const jitter = Math.random() * baseSeconds;
  return baseSeconds + jitter;
}

