// HTTP header names are case-insensitive (RFC 7230 §3.2), but API Gateway/Lambda
// event payloads do not guarantee any particular casing for `event.headers` keys
// (e.g. "Referer" vs "referer"). Read headers through this instead of `event.headers.X`.
export function normalizeHeaders(headers) {
    if (!headers) return {};
    return Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
}
