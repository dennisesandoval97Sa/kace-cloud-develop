import { CustomError, Helper } from '../../shared/index.js';
import AuthFailError from '../../shared/errors/AuthFailError.js';

const MAX_DELETED_USER_DEPTH = 5;

export class FindLoginUser {
    /**
     *
     * @param {import('../infraestructure/KnexAuthCognitoRepository.js').KnexAuthCognitoRepository} repository
     */
    constructor(repository) {
        this.repository = repository;
    }

    /**
     * Finds a user for login using their login or email,
     * validating their status and retrieving their permissions and active groups.
     *
     * If the found user is soft-deleted (legacy record without `deleted_` prefix),
     * it applies the prefix mutation, persists the change, and recursively retries
     * the lookup. This lazy backfill clears stale records so that a genuinely new
     * Cognito user can be auto-provisioned by AuthenticationUser when `null` is
     * returned (intentional re-provisioning — see PR discussion).
     *
     * @param {string} login - The user's username (login).
     * @param {string} email - The user's email address.
     * @param {number} [depth=0] - Internal recursion depth counter (max {@link MAX_DELETED_USER_DEPTH}).
     * @returns {Promise<{user: any, groups: any[], [key: string]: any} | null>} Returns the user data, permissions, and groups, or null if the user does not exist or has been deleted.
     * @throws {CustomError} If the user is inactive or the recursion depth is exceeded.
     * @throws {Error} If an unexpected error occurs during the search.
     */
    async find(login, email, depth = 0) {
        try {
            if (depth > MAX_DELETED_USER_DEPTH) {
                throw new CustomError('Unresolvable deleted-user chain', 500);
            }

            const user = await this.repository.find(login, email);

            if (!user) return null;

            if (user.deleted_at.value !== null) {
                user.delete({ deleted_at: user.deleted_at.value, deleted_by: user.deleted_by.value });
                await this.repository.update({
                    id: user.id.value,
                    ...user.changedAttributes,
                    updated_at: new Date(),
                    updated_by: user.id.value,
                });
                return this.find(login, email, depth + 1);
            }

            if (!user.is_active.value || user.is_active.value === 2) {
                throw new CustomError('Inactive user', 404);
            }

            const permisions = await this.repository.findPermissionsByRolId(user.rol_id.value);
            const groups = await this.repository.findActiveGroupsByUserId(user.id);
            return {
                ...permisions,
                user: user,
                groups: groups,
            };
        } catch (error) {
            if (error instanceof CustomError || error instanceof AuthFailError) throw error;
            Helper.logError('Error finding login user', error);
            throw new Error('User retrieval failed');
        }
    }
}
