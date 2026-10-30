import { KnexRepository, StatusEnum } from '../../shared/index';
import { CustomError } from '../../shared/errors/CustomError';
import { User } from '../../users/index.js';
import { Helper } from '../../shared/infrastructure/utils/Helper.js';
import { QueryDBError } from '../../shared/errors/QueryDBError.js';
import { v4 as uuid } from 'uuid';
import { SecurePasswordEncoder } from '../../shared/index';

export class KnexAuthCognitoRepository extends KnexRepository {
    constructor(config) {
        super(config, 'usuarios');
    }

    async save(user) {
        try {
            await this.table().insert({
                id: user.id.value,
                login: user.login.value,
                nombres: user.nombres.value,
                apellido1: user.apellido1.value,
                email: user.email.value,
                is_active: user.is_active.value,
                created_at: user.created_at.value,
                created_by: user.created_by.value,
                cognito_hash_data: user.cognito_hash_data.value,
                session_id: user.session_id.value,
                rol_id: user.rol_id.value,
                account_type: user.account_type.value,
            });
        } catch (error) {
            Helper.logError('Error saving auth cognito: ', error);
            throw new QueryDBError('save');
        }
    }

    /**
     * Updates a user record. Expects a plain object with `id` (string) and
     * the fields to update — never a `User` domain instance.
     *
     * @param {Object} dto - Plain object with `id` and updatable fields.
     */
    async update(dto) {
        try {
            await this.table().update(dto).where({ id: dto.id });
        } catch (error) {
            Helper.logError('Error updating auth cognito: ', error);
            throw new QueryDBError('update');
        }
    }

    /**
     *
     * @param {*} login
     * @param {*} email
     * @returns {Promise<User|null>}
     */
    async find(login, email) {
        try {
            let result = await this.table().where({ login: login }).first();

            if (!result) {
                result = await this.table().where({ email: email }).first();
            }

            return result ? new User(result) : null;
        } catch (error) {
            Helper.logError('Error finding auth cognito: ', error);
            throw new QueryDBError('find');
        }
    }

    async findPermissionsByRolId(rolId) {
        try {
            return await this.table('roles').select('permisos').where({ id: rolId }).first();
        } catch (error) {
            Helper.logError('Error finding permissions by role id: ', error);
            throw new QueryDBError('find');
        }
    }

    async findById(id) {
        try {
            const result = await this.table().where('usuarios.id', id.value).first();

            return result ? new User(result) : null;
        } catch (error) {
            Helper.logError('Error finding user', error);
            throw new QueryDBError('find');
        }
    }

    /**
     * Finds active groups by the user's ID.
     *
     * @param {ValueObjectUuid} userId - The user's unique identifier.
     * @returns {Promise<Array>} - A promise that resolves to an array of active groups.
     */
    async findActiveGroupsByUserId(userId) {
        try {
            const groupsData = await this.table('rel_usuarios_grupos')
                .join(`${this.qualifiedName('grupos')} as g`, 'rel_usuarios_grupos.grupo_id', 'g.id')
                .select('g.id', 'g.nombre', 'g.configuration_id')
                .where('rel_usuarios_grupos.usuario_id', userId.value)
                .whereNot('g.status', StatusEnum.INACTIVE.value)
                .whereNull('g.deleted_at');

            return groupsData;
        } catch (error) {
            Helper.logInfo(error);
            throw new CustomError(`Error finding active groups: ${error.message}`);
        }
    }

    async saveRevokedToken({ id_token }) {
        try {
            const tokenHash = SecurePasswordEncoder.prehashWithSHA256(JSON.stringify({ id_token }));
            const record = {
                id: uuid(),
                token_hash: tokenHash,
                revoked_at: new Date(),
            };

            await this.table('revoked_tokens').insert(record);
        } catch (error) {
            Helper.logError('Error saving revoked token:', error);
            throw new QueryDBError('saveRevokedToken');
        }
    }

    async isTokenRevoked(id_token) {
        try {
            const tokenHash = SecurePasswordEncoder.prehashWithSHA256(JSON.stringify({ id_token }));

            const result = await this.table('revoked_tokens').select('id').where({ token_hash: tokenHash }).first();

            return !!result;
        } catch (error) {
            Helper.logError('Error checking revoked token:', error);
            throw new QueryDBError('isTokenRevoked');
        }
    }

    /**
     * Retrieves the user ID and cached Cognito id_token for a given login in a single query.
     * Combines user resolution and token lookup to avoid a double DB hit.
     *
     * @param {string} login - The login/username to look up.
     * @returns {Promise<{user_id: string|null, id_token: string|null, cached_at: Date|null}>}
     */
    async findCachedTokenByLogin(login) {
        try {
            const result = await this.table()
                .select('id', 'cognito_id_token', 'cognito_id_token_cached_at')
                .where({ login })
                .whereNull('deleted_at')
                .where('is_active', 1)
                .first();

            return {
                user_id: result?.id || null,
                id_token: result?.cognito_id_token || null,
                cached_at: result?.cognito_id_token_cached_at || null,
            };
        } catch (error) {
            Helper.logError('Error finding cached Cognito token by login:', error);
            return { user_id: null, id_token: null, cached_at: null };
        }
    }

    /**
     * Persists a Cognito id_token in the `usuarios` table for later reuse.
     *
     * @param {string} userId - The user ID owning the token.
     * @param {string} idToken - The raw JWT id_token from Cognito.
     * @returns {Promise<void>}
     */
    async saveCachedToken(userId, idToken) {
        try {
            await this.table().where({ id: userId }).update({
                cognito_id_token: idToken,
                cognito_id_token_cached_at: new Date(),
            });
        } catch (error) {
            Helper.logError('Error saving cached Cognito token:', error);
            throw new QueryDBError('saveCachedToken');
        }
    }

    /**
     * Clears the cached token for a given user.
     *
     * @param {string} userId - The user ID whose cached token should be cleared.
     * @returns {Promise<void>}
     */
    async invalidateCachedToken(userId) {
        try {
            await this.table().where({ id: userId }).update({
                cognito_id_token: null,
                cognito_id_token_cached_at: null,
            });
        } catch (error) {
            Helper.logError('Error invalidating cached Cognito token:', error);
            throw new QueryDBError('invalidateCachedToken');
        }
    }
}
