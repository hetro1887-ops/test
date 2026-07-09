import http from 'k6/http';
import { check, sleep } from 'k6';

// 10k Virtual Users load test configuration
export const options = {
  stages: [
    { duration: '2m', target: 2000 },  // Ramp-up to 2k users
    { duration: '5m', target: 5000 },  // Ramp-up to 5k users
    { duration: '10m', target: 10000 }, // Peak load: 10k users
    { duration: '5m', target: 2000 },  // Ramp-down
    { duration: '2m', target: 0 },     // Final cool-down
  ],
  thresholds: {
    http_req_duration: ['p(95)<300'], // 95% of requests must complete under 300ms
    http_req_failed: ['rate<0.01'],   // Error rate must be under 1%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const ML_URL = __ENV.ML_URL || 'http://localhost:8000';

export default function () {
  // --- Scenario 1: Load Dashboard ---
  const dashboardRes = http.get(`${BASE_URL}/dashboard`);
  check(dashboardRes, {
    'dashboard load status is 200': (r) => r.status === 200,
    'dashboard load time < 250ms': (r) => r.timings.duration < 250,
  });
  sleep(1);

  // --- Scenario 2: Query Transactions List ---
  // Simulates a tRPC call to transactions.list
  const trpcUrl = `${BASE_URL}/api/trpc/transactions.list?batch=1&input=%7B%220%22%3A%7B%22json%22%3A%7B%22page%22%3A1%2C%22pageSize%22%3A15%7D%7D%7D`;
  const txnsRes = http.get(trpcUrl);
  check(txnsRes, {
    'trpc transactions list is 200': (r) => r.status === 200,
    'trpc txn load time < 150ms': (r) => r.timings.duration < 150,
  });
  sleep(2);

  // --- Scenario 3: AI Copilot Message ---
  // Simulates a user typing to the copilot chat router
  const chatPayload = JSON.stringify({
    '0': {
      json: {
        message: 'What is my 90-day cash flow forecast?',
        history: [],
      },
    },
  });
  const chatParams = {
    headers: {
      'Content-Type': 'application/json',
    },
  };
  const chatRes = http.post(`${BASE_URL}/api/trpc/chat.send?batch=1`, chatPayload, chatParams);
  check(chatRes, {
    'copilot chat reply is 200': (r) => r.status === 200,
    'copilot reply time < 400ms': (r) => r.timings.duration < 400,
  });
  sleep(3);

  // --- Scenario 4: ML Service Inference load ---
  const mlPayload = JSON.stringify({
    description: 'STARBUCKS COFFEE SEATTLE WA',
    amount: 8.50,
  });
  const mlRes = http.post(`${ML_URL}/predict`, mlPayload, chatParams);
  check(mlRes, {
    'ml prediction is 200': (r) => r.status === 200,
    'ml inference time < 50ms': (r) => r.timings.duration < 50,
  });
  sleep(2);
}
