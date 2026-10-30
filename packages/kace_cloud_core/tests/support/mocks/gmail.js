import { jest } from '@jest/globals';

/**
 * Mocks '@googleapis/gmail' and 'google-auth-library' so tests never reach Google's real
 * OAuth/Gmail API endpoints.
 *
 * Reflects the real usage in src/mails/infrastructure/google/GmailClientService.js:
 *   - `new OAuth2Client(clientId, clientSecret)`, then `.setCredentials(...)`,
 *     `.getAccessToken()` and `.refreshAccessToken()`.
 *   - `gmail({ version: 'v1', auth: oauth2Client, }).users.messages.send({ userId, requestBody })`.
 *
 * MUST be called (and awaited) before dynamically importing the module under test.
 *
 * @example
 * const { send, oauth2Client, calls } = await mockGmail();
 * const { GmailClientService } = await import('../../src/mails/infrastructure/google/GmailClientService.js');
 * send.mockResolvedValue({ data: { id: 'sent-message-id' } });
 * oauth2Client.refreshAccessToken.mockResolvedValue({ credentials: { access_token: 'fresh' } });
 * // ...call code under test...
 * expect(calls.send[0]).toMatchObject({ userId: 'me' });
 *
 * @returns {{
 *   send: import('@jest/globals').jest.Mock,
 *   gmailFactory: import('@jest/globals').jest.Mock,
 *   oauth2Client: {
 *     setCredentials: import('@jest/globals').jest.Mock,
 *     getAccessToken: import('@jest/globals').jest.Mock,
 *     refreshAccessToken: import('@jest/globals').jest.Mock,
 *   },
 *   calls: { gmailFactory: object[], send: object[] },
 * }}
 */
export const mockGmail = () => {
    const calls = { gmailFactory: [], send: [] };

    const send = jest.fn((input) => {
        calls.send.push(input);
        return Promise.resolve({ data: { id: 'mock-message-id' } });
    });

    const gmailFactory = jest.fn((options) => {
        calls.gmailFactory.push(options);
        return { users: { messages: { send } } };
    });

    const oauth2Client = {
        setCredentials: jest.fn(),
        getAccessToken: jest.fn().mockResolvedValue({ token: 'mock-access-token' }),
        refreshAccessToken: jest.fn().mockResolvedValue({ credentials: { access_token: 'mock-access-token' } }),
    };

    class FakeOAuth2Client {
        constructor(clientId, clientSecret) {
            this.clientId = clientId;
            this.clientSecret = clientSecret;
            this.setCredentials = oauth2Client.setCredentials;
            this.getAccessToken = oauth2Client.getAccessToken;
            this.refreshAccessToken = oauth2Client.refreshAccessToken;
        }
    }

    jest.unstable_mockModule('@googleapis/gmail', () => ({ gmail: gmailFactory }));
    jest.unstable_mockModule('google-auth-library', () => ({ OAuth2Client: FakeOAuth2Client }));

    return { send, gmailFactory, oauth2Client, calls };
};
