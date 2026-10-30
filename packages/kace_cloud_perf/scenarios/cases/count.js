import { get } from '../_shared/http.js';
import { DEFAULT_THRESHOLDS } from '../_shared/thresholds.js';

// Perfil de concurrencia (VUs = solicitudes simultáneas en vuelo). Overrides por env:
//   PERF_VUS_START (default 200)  PERF_VUS_PEAK (default 350)
//   PERF_RAMP (default 1m)        PERF_HOLD (default 3m, sostén en el pico)
const VUS_START = Number(__ENV.PERF_VUS_START ?? 200);
const VUS_PEAK = Number(__ENV.PERF_VUS_PEAK ?? 350);
const RAMP = __ENV.PERF_RAMP ?? '1m';
const HOLD = __ENV.PERF_HOLD ?? '3m';

export const options = {
    scenarios: {
        ramp_concurrency: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
                { duration: RAMP, target: VUS_START }, // 0 → 200 concurrentes
                { duration: RAMP, target: VUS_PEAK }, // 200 → 350 concurrentes
                { duration: HOLD, target: VUS_PEAK }, // sostiene 350
                { duration: '30s', target: 0 }, // baja
            ],
            gracefulRampDown: '10s',
        },
    },
    thresholds: DEFAULT_THRESHOLDS,
    discardResponseBodies: true,
    summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(50)', 'p(90)', 'p(95)', 'p(99)'],
};

export default function () {
    get('/cases-count'); // headers (Authorization id_token + X-Tenant-Id) los arma _shared/http.js
}
