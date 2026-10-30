// Carga parametrizable vía variables de entorno (k6 las lee con __ENV.X):
//   PERF_RPS         RPS sostenido del escenario principal (default 50)
//   PERF_DURATION    Duración del escenario principal (default 10m)
//   PERF_WARMUP_RPS  RPS de la fase de warm-up (default 10)
//   PERF_WARMUP      Duración del warm-up (default 30s)
const RATE = Number(__ENV.PERF_RPS ?? 50);
const DURATION = __ENV.PERF_DURATION ?? '10m';
const WARMUP_RATE = Number(__ENV.PERF_WARMUP_RPS ?? 10);
const WARMUP_DURATION = __ENV.PERF_WARMUP ?? '30s';

export const DEFAULT_THRESHOLDS = {
    http_req_duration: ['p(50)<500', 'p(95)<2000', 'p(99)<5000'],
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],
};

export const DEFAULT_OPTIONS = {
    scenarios: {
        constant_rps: {
            executor: 'constant-arrival-rate',
            rate: RATE,
            timeUnit: '1s',
            duration: DURATION,
            preAllocatedVUs: Math.max(RATE, 50),
            maxVUs: Math.max(RATE * 4, 200),
        },
    },
    thresholds: DEFAULT_THRESHOLDS,
    discardResponseBodies: true,
    // Fuerza que k6 incluya p50/p99 en el summary-export. Por defecto solo trae avg/min/med/max/p(90)/p(95).
    summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(50)', 'p(90)', 'p(95)', 'p(99)'],
};

export function withWarmup(options = DEFAULT_OPTIONS) {
    return {
        ...options,
        scenarios: {
            warmup: {
                executor: 'constant-arrival-rate',
                rate: WARMUP_RATE,
                timeUnit: '1s',
                duration: WARMUP_DURATION,
                preAllocatedVUs: Math.max(WARMUP_RATE, 10),
                maxVUs: Math.max(WARMUP_RATE * 4, 50),
                exec: 'default',
                startTime: '0s',
            },
            constant_rps: {
                ...options.scenarios.constant_rps,
                startTime: WARMUP_DURATION,
            },
        },
    };
}
