import { jest } from '@jest/globals';
import AuthFailError from '@kace/core/src/shared/errors/AuthFailError.js';
import { AUTH_SESSION_COOKIE_STALE } from '@kace/error-codes';
import { HttpResponse } from '../../src/http_responses/HttpResponse.js';

const mockEvent = {
    headers: { origin: 'https://test.example.com' },
    tenantContext: { tenant: { apps_allowed_origins: { value: 'https://test.example.com' } } },
    tenant: { apps_debug: { value: 'false' }, apps_allowed_origins: { value: 'https://test.example.com' } },
    kContext: { awsRequestId: 'req-1' },
};

describe('HttpResponse AuthFailError data.code', () => {
    it('includes auth error code in response data', () => {
        const response = HttpResponse.badRequest({
            errors: new AuthFailError('session cookie stale', 401, AUTH_SESSION_COOKIE_STALE),
            event: mockEvent,
        });

        const body = JSON.parse(response.toJson().body);

        expect(body.data.code).toBe(AUTH_SESSION_COOKIE_STALE);
        expect(body.message).toBe('Authentication required');
        expect(body.errors).toEqual([
            {
                code: AUTH_SESSION_COOKIE_STALE,
                message: 'Authentication required',
            },
        ]);
    });

    it('does not reflect an untrusted origin for auth failures', () => {
        const response = HttpResponse.badRequest({
            errors: new AuthFailError('session cookie stale', 401, AUTH_SESSION_COOKIE_STALE),
            event: {
                ...mockEvent,
                headers: { origin: 'https://evil.example.com' },
            },
        }).toJson();

        expect(response.headers['Access-Control-Allow-Origin']).toBe('https://test.example.com');
        expect(response.headers['Access-Control-Allow-Credentials']).toBe('true');
    });

    it('does not emit credentialed CORS headers with wildcard origins', () => {
        const response = HttpResponse.badRequest({
            errors: new AuthFailError('session cookie stale', 401, AUTH_SESSION_COOKIE_STALE),
            event: {
                ...mockEvent,
                tenantContext: { tenant: { apps_allowed_origins: { value: '*' } } },
                tenant: { apps_debug: { value: 'false' }, apps_allowed_origins: { value: '*' } },
            },
        }).toJson();

        expect(response.headers['Access-Control-Allow-Origin']).toBe('*');
        expect(response.headers).not.toHaveProperty('Access-Control-Allow-Credentials');
    });
});
