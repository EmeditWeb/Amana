import tradeThroughput, { createTrades, settleTrades, options } from './trade-throughput.js';
import { BASE_URL } from './options.js';
import http from 'k6/http';
import { check } from 'k6';
import { Counter, Rate } from 'k6/metrics';

export { createTrades, options, settleTrades };
export default tradeThroughput;

const poolSaturationErrors = new Rate('pool_saturation_errors');
const selectOneDuration = new Counter('select_one_duration_ms');

export function selectOneBenchmark() {
  const res = http.get(`${BASE_URL}/health`);
  const ok = check(res, { 'status is 200': (r) => r.status === 200 });
  poolSaturationErrors.add(!ok);
  selectOneDuration.add(res.timings.duration);
  return res;
}
