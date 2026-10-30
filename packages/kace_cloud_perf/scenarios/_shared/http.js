import http from 'k6/http';
import { check } from 'k6';

const tokens = JSON.parse(open('../../auth/tokens.local.json'));

export function pickToken() {
    const idx = Math.floor(Math.random() * tokens.length);
    return tokens[idx].idToken;
}

export function buildHeaders(extra = {}) {
    return {
        Accept: 'application/json',
        'X-Tenant-Id': __ENV.PERF_TENANT_ID,
        Authorization: pickToken(),
        ...extra,
    };
}

export function get(path, params = {}) {
    const url = `${__ENV.PERF_API_BASE_URL}${path}`;
    const res = http.get(url, { headers: buildHeaders(), tags: { endpoint: path }, ...params });
    check(res, { 'status is 2xx': (r) => r.status >= 200 && r.status < 300 });
    return res;
}

export function post(path, body, params = {}) {
    const url = `${__ENV.PERF_API_BASE_URL}${path}`;
    const res = http.post(url, JSON.stringify(body), {
        headers: buildHeaders({ 'Content-Type': 'application/json' }),
        tags: { endpoint: path },
        ...params,
    });
    check(res, { 'status is 2xx': (r) => r.status >= 200 && r.status < 300 });
    return res;
}
