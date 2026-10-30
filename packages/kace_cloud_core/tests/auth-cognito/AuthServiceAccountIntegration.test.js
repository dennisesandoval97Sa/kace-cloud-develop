import { AuthServiceAccount } from '../../src/auth-cognito/application/AuthServiceAccount.js';
import { IdpCognito } from '../../src/auth-cognito/infraestructure/idps/IdpCognito.js';

// KACE-SKIP(decision-pendiente): IdpCognito abre un CognitoIdentityProviderClient real y
// los dos tests lanzan InitiateAuth contra cognito-idp.us-east-1.amazonaws.com con
// AWS_COGNITO_APP_CLIENT_ID y TEST_E2E_USERNAME/TEST_E2E_PASSWORD, que ni siquiera estan
// en el .env. Sin red o sin claves se paga el timeout. No hay mock de Cognito.
describe.skip('AuthServiceAccount suite test', () => {
    it('should return authenticated result when valid credentials are provided', async () => {
        const idp = new IdpCognito({
            region: 'us-east-1',
            clientId: process.env.AWS_COGNITO_APP_CLIENT_ID,
        });

        const authServiceAccount = new AuthServiceAccount(idp);
        const dto = {
            username: process.env.TEST_E2E_USERNAME,
            password: process.env.TEST_E2E_PASSWORD,
        };

        const result = await authServiceAccount.execute(dto);

        expect(result.AccessToken).not.toBeNull();
        expect(result.IdToken).not.toBeNull();
        expect(result.RefreshToken).not.toBeNull();
    });

    it('should propagate error when idp authentication fails', async () => {
        const idp = new IdpCognito({
            region: 'us-east-1',
            clientId: process.env.AWS_COGNITO_APP_CLIENT_ID,
        });

        const authServiceAccount = new AuthServiceAccount(idp);
        const dto = { username: 'user', password: 'pass' };

        try {
            await authServiceAccount.execute(dto);
        } catch (error) {
            expect(error).toBeInstanceOf(Error);
            expect(error.message).toBe('Incorrect username or password');
        }
    });
});
