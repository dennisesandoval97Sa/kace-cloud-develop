import http from 'k6/http';
import { check } from 'k6';
import { pickToken } from '../_shared/http.js';
import { DEFAULT_THRESHOLDS } from '../_shared/thresholds.js';

// Carga del dashboard completo: cada iteración golpea los 4 contadores que el frontal
// dispara al abrir el panel. Los tres "by-*" + el total ANS leen de matviews tras la
// optimización; este escenario los ejercita juntos para una baseline representativa.
//
// Perfil de concurrencia (overrides por env):
//   PERF_VUS_START (default 200)  PERF_VUS_PEAK (default 350)
//   PERF_RAMP (default 1m)        PERF_HOLD (default 3m)
//   PERF_RESPONSABLE_ID           responsable para /cases-count-by-responsable/{id}
const VUS_START = Number(__ENV.PERF_VUS_START ?? 200);
const VUS_PEAK = Number(__ENV.PERF_VUS_PEAK ?? 350);
const RAMP = __ENV.PERF_RAMP ?? '1m';
const HOLD = __ENV.PERF_HOLD ?? '3m';

const RESPONSABLE_ID = __ENV.PERF_RESPONSABLE_ID ?? '8a09ba2c-0231-4cc3-b02d-5b90054d6f90';

const ENDPOINTS = [
    { name: 'cases-count', path: '/cases-count' },
    { name: 'cases-count-by-group', path: '/cases-count-by-group' },
    { name: 'cases-count-by-responsable', path: '/cases-count-by-responsable' },
    { name: 'cases-count-by-responsable-id', path: `/cases-count-by-responsable/${RESPONSABLE_ID}` },
];

// Umbrales globales + p95 por endpoint para que el summary los desglose.
const thresholds = { ...DEFAULT_THRESHOLDS };
for (const e of ENDPOINTS) {
    thresholds[`http_req_duration{endpoint:${e.name}}`] = ['p(95)<2000'];
}

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
    thresholds,
    discardResponseBodies: true,
    summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(50)', 'p(90)', 'p(95)', 'p(99)'],
};

function buildHeaders() {
    return {
        Accept: 'application/json',
        'X-Tenant-Id': __ENV.PERF_TENANT_ID,
        Authorization: pickToken(),
        'x-client-fingerprint': __ENV.PERF_CLIENT_FINGERPRINT ?? '2292838579',
    };
}

function hit(endpoint) {
    const url = `${__ENV.PERF_API_BASE_URL}${endpoint.path}`;
    const res = http.get(url, { headers: buildHeaders(), tags: { endpoint: endpoint.name } });
    check(res, { [`${endpoint.name} status is 2xx`]: (r) => r.status >= 200 && r.status < 300 });
    return res;
}

export default function () {
    for (const endpoint of ENDPOINTS) {
        hit(endpoint);
    }
}
