import { Idp } from '../../src/auth-cognito/domain/Idp.js';
import { DomainError } from '../../src/shared/index.js';

describe('Idp authenticate method behavior', () => {
    let idpInstance;

    beforeEach(() => {
        idpInstance = new Idp();
    });

    it('should throw DomainError with message "authenticate method not implemented" when service account is provided', async () => {
        await expect(idpInstance.authenticate({ username: 'user', password: 'pass' })).rejects.toThrow(
            new DomainError('authenticate method not implemented')
        );
    });

    it('should throw DomainError with message "authenticate method not implemented" when service account is null', async () => {
        await expect(idpInstance.authenticate(null)).rejects.toThrow(
            new DomainError('authenticate method not implemented')
        );
    });
});
