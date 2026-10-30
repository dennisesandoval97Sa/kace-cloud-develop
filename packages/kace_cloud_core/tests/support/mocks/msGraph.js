import { jest } from '@jest/globals';

/**
 * Mocks '@microsoft/microsoft-graph-client' and '@azure/msal-node' so tests never reach
 * Microsoft's real Entra ID / Graph API endpoints.
 *
 * Reflects the real usage in src/mails/infrastructure/microsoft/MsGraphEmailService.js:
 *   - `new ConfidentialClientApplication({ auth: {...} })`, then
 *     `.acquireTokenByClientCredential({ scopes })` -> `{ accessToken }`.
 *   - `Client.init({ authProvider })` -> `.api(path).post(body)`.
 *
 * MUST be called (and awaited) before dynamically importing the module under test.
 *
 * @example
 * const { post, calls } = await mockMsGraph();
 * const { MsGraphEmailService } = await import('../../src/mails/infrastructure/microsoft/MsGraphEmailService.js');
 * post.mockResolvedValue(undefined);
 * // ...call code under test...
 * expect(calls.api[0]).toBe('/me/sendMail');
 * expect(calls.post[0].message.subject).toBe('Subject');
 *
 * @returns {{
 *   acquireTokenByClientCredential: import('@jest/globals').jest.Mock,
 *   api: import('@jest/globals').jest.Mock,
 *   post: import('@jest/globals').jest.Mock,
 *   calls: { acquireTokenByClientCredential: object[], api: string[], post: object[] },
 * }}
 */
export const mockMsGraph = () => {
    const calls = { acquireTokenByClientCredential: [], api: [], post: [] };

    const acquireTokenByClientCredential = jest.fn((tokenRequest) => {
        calls.acquireTokenByClientCredential.push(tokenRequest);
        return Promise.resolve({ accessToken: 'mock-access-token' });
    });

    class FakeConfidentialClientApplication {
        constructor(config) {
            this.config = config;
            this.acquireTokenByClientCredential = acquireTokenByClientCredential;
        }
    }

    const post = jest.fn((body) => {
        calls.post.push(body);
        return Promise.resolve(undefined);
    });

    const api = jest.fn((path) => {
        calls.api.push(path);
        return { post };
    });

    const Client = { init: jest.fn(() => ({ api })) };

    jest.unstable_mockModule('@azure/msal-node', () => ({
        ConfidentialClientApplication: FakeConfidentialClientApplication,
    }));
    jest.unstable_mockModule('@microsoft/microsoft-graph-client', () => ({ Client }));
    jest.unstable_mockModule('isomorphic-fetch', () => ({}));

    return { acquireTokenByClientCredential, api, post, calls };
};
