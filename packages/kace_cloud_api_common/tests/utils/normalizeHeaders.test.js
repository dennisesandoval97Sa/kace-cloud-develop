import { normalizeHeaders } from '../../src/utils/normalizeHeaders.js';

describe('normalizeHeaders', () => {
    it('returns an empty object for null', () => {
        expect(normalizeHeaders(null)).toEqual({});
    });

    it('returns an empty object for undefined', () => {
        expect(normalizeHeaders(undefined)).toEqual({});
    });

    it('lower-cases a capitalized header key', () => {
        expect(normalizeHeaders({ Referer: 'https://onescript.konecta.cloud/' })).toEqual({
            referer: 'https://onescript.konecta.cloud/',
        });
    });

    it('lower-cases the X-Tenant-ID header as sent by OneScript', () => {
        expect(normalizeHeaders({ 'X-Tenant-ID': 'tenant-123' })).toEqual({ 'x-tenant-id': 'tenant-123' });
    });

    it('lower-cases the X-Client-Fingerprint header', () => {
        expect(normalizeHeaders({ 'X-Client-Fingerprint': 'fp-123' })).toEqual({ 'x-client-fingerprint': 'fp-123' });
    });

    it('leaves already-lowercase keys untouched', () => {
        expect(normalizeHeaders({ authorization: 'Bearer token' })).toEqual({ authorization: 'Bearer token' });
    });

    it('preserves header values as-is', () => {
        expect(normalizeHeaders({ Host: 'natura.krosscloud-konecta.com' })).toEqual({
            host: 'natura.krosscloud-konecta.com',
        });
    });
});
