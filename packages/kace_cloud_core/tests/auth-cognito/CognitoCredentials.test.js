import jwt from 'jsonwebtoken';
import { CognitoCredentials } from '../../src/auth-cognito/domain/CognitoCredentials.js';
import { SecurePasswordEncoder } from '../../src/shared/index.js';

describe('CognitoCredentials.hashSessionId', () => {
    const mockSecret = 'test-secret-for-jwt-signing';
    const email = 'a@b.com';
    const sub = 'user-1';
    const fingerprint = 'fp-xyz';

    function signIdToken({ sub, email }) {
        return jwt.sign({ sub, email }, mockSecret, { expiresIn: '1h' });
    }

    it('computes hash from email, sub, and fingerprint (no IP)', () => {
        const idToken = signIdToken({ sub, email });
        const creds = new CognitoCredentials({
            id_token: idToken,
            sourceIp: '198.51.100.5',
            clientFingerprint: fingerprint,
        });

        const input = `${email}:${sub}:${fingerprint}`;
        expect(SecurePasswordEncoder.verifyPassword(input, creds.hashSessionId)).toBe(true);
    });

    it('produces the same hash regardless of sourceIp value', () => {
        const idToken = signIdToken({ sub, email });
        const credsA = new CognitoCredentials({
            id_token: idToken,
            sourceIp: '1.1.1.1',
            clientFingerprint: fingerprint,
        });
        const credsB = new CognitoCredentials({
            id_token: idToken,
            sourceIp: '2.2.2.2',
            clientFingerprint: fingerprint,
        });

        const input = `${email}:${sub}:${fingerprint}`;
        expect(SecurePasswordEncoder.verifyPassword(input, credsA.hashSessionId)).toBe(true);
        expect(SecurePasswordEncoder.verifyPassword(input, credsB.hashSessionId)).toBe(true);
    });
});
