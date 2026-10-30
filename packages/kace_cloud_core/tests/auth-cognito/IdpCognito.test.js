import { IdpCognito } from '../../src/auth-cognito/infraestructure/idps/IdpCognito.js';

describe('IdpCognito Unit Tests', () => {
    it('should fail if clientId is not provide', async () => {
        try {
            new IdpCognito({ region: 'us-east-1' });
        } catch (error) {
            expect(error).toBeInstanceOf(Error);
            expect(error.message).toBe('InvalidConfig');
        }
    });

    it('should fail if region is not provide', async () => {
        try {
            new IdpCognito({ clientId: 'test-client-id' });
        } catch (error) {
            expect(error).toBeInstanceOf(Error);
            expect(error.message).toBe('InvalidConfig');
        }
    });
});
