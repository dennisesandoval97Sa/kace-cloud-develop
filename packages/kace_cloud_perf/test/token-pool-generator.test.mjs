import { jest } from '@jest/globals';

const mockSend = jest.fn();
jest.unstable_mockModule('@aws-sdk/client-cognito-identity-provider', () => ({
    CognitoIdentityProviderClient: jest.fn(() => ({ send: mockSend })),
    InitiateAuthCommand: jest.fn((input) => ({ __type: 'InitiateAuthCommand', input })),
}));

const { generatePool, authenticateUser } = await import('../auth/token-pool-generator.mjs');

beforeEach(() => {
    mockSend.mockReset();
});

describe('authenticateUser', () => {
    it('returns idToken, refreshToken and expiresAt for a successful login', async () => {
        mockSend.mockResolvedValueOnce({
            AuthenticationResult: {
                IdToken: 'id-abc',
                RefreshToken: 'rt-abc',
                ExpiresIn: 3600,
            },
        });

        const result = await authenticateUser({
            client: { send: mockSend },
            clientId: 'client-123',
            username: 'user1',
            password: 'pw1',
        });

        expect(result.idToken).toBe('id-abc');
        expect(result.refreshToken).toBe('rt-abc');
        expect(result.username).toBe('user1');
        expect(result.expiresAt).toBeGreaterThan(Date.now());
    });

    it('throws a descriptive error when AuthenticationResult is missing', async () => {
        mockSend.mockResolvedValueOnce({});

        await expect(
            authenticateUser({
                client: { send: mockSend },
                clientId: 'client-123',
                username: 'user1',
                password: 'pw1',
            })
        ).rejects.toThrow(/no AuthenticationResult/i);
    });
});

describe('generatePool', () => {
    it('authenticates every user in the input list', async () => {
        mockSend
            .mockResolvedValueOnce({
                AuthenticationResult: { IdToken: 'a', RefreshToken: 'ra', ExpiresIn: 3600 },
            })
            .mockResolvedValueOnce({
                AuthenticationResult: { IdToken: 'b', RefreshToken: 'rb', ExpiresIn: 3600 },
            });

        const tokens = await generatePool({
            client: { send: mockSend },
            clientId: 'client-123',
            users: [
                { username: 'u1', password: 'p1' },
                { username: 'u2', password: 'p2' },
            ],
        });

        expect(tokens).toHaveLength(2);
        expect(tokens[0].idToken).toBe('a');
        expect(tokens[1].idToken).toBe('b');
    });
});
