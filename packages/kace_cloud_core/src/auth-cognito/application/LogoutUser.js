import { revokeToken } from '../infraestructure/idps/revokeToken';
import { Crypto, TenantContext, Helper } from '../../shared';
import { CognitoCredentials } from '../domain/CognitoCredentials.js';
import { FindLoginUser } from '@kace/core/src/auth-cognito/domain/FindLoginUser.js';

export class LogoutUser {
    /** @type {{ decodeToken: { sub: string }, clientFingerprint: string }} */
    #payload;
    /** @type {KnexAuthCognitoRepository} */
    #repository;

    constructor(payload, repository) {
        this.#payload = payload;
        this.#repository = repository;
    }

    async execute() {
        let user;
        if (this.#payload.user_id) {
            user = await this.#repository.findById({ value: this.#payload.user_id });
        } else {
            const credentials = new CognitoCredentials(this.#payload);
            const findUser = new FindLoginUser(this.#repository);
            const informationUser = await findUser.find(credentials.decodeToken.sub, credentials.decodeToken.email);
            user = informationUser?.user;
        }

        if (!user) {
            throw new Error('User not found for logout.');
        }
        if (user.cognito_hash_data.value === null) {
            return {
                message: 'No active session found for logout.',
            };
        }

        const updatedUser = {
            id: user.id.value,
            cognito_hash_data: null,
            session_key: null,
            session_id: null,
            session_key_rotated_at: null,
            grupo_activo: null,
            updated_at: new Date(),
            updated_by: user.id.value,
            last_integration_active_at: null,
            last_seen_at: null,
        };
        let revokeWarning = null;

        if (user.refresh_token.value) {
            const crypto = new Crypto(
                TenantContext.getTenant().secret_iv.value,
                TenantContext.getTenant().secret_key.value,
                TenantContext.getTenant().encryption_method.value
            );
            const decryptedToken = crypto.decryptData(user.refresh_token.value);
            const exists = await this.#repository.isTokenRevoked(this.#payload.id_token);
            if (!exists) {
                await this.#repository.saveRevokedToken({
                    id_token: this.#payload.id_token,
                });
            }
            try {
                await revokeToken(this.#payload.client_id, decryptedToken);
            } catch (error) {
                Helper.logError('Cognito revoke failed', error);
                revokeWarning = 'Session cleared locally, but token revocation in Cognito failed.';
            }

            updatedUser.refresh_token = null;
        }
        await this.#repository.update(updatedUser);

        return {
            message: 'Logout successful',
            userId: user.id,
            ...(revokeWarning && { warning: revokeWarning }),
        };
    }
}
