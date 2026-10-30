import { knexConfig } from '../knexfile.js';
import { KnexAuthCognitoRepository } from '../../src/auth-cognito/infraestructure/KnexAuthCognitoRepository.js';
import { KnexUsersRepository } from '../../src/users/infrastructure/KnexUsersRepository.js';
import { FindLoginUser } from '../../src/auth-cognito/domain/FindLoginUser.js';
import UsersMother from '../users/domain/UsersMother.js';
import { CustomError, StatusEnum } from '../../src/shared/index.js';

describe('FindLoginUser.find()', () => {
    // Se reutiliza la conexion compartida del archivo: la base de este test ya es un clon de
    // la plantilla migrada (tests/support/perFileDatabase.js), asi que no hay que correr
    // `migrate.latest()` (buscaba las migraciones en un `migrations/` inexistente en @kace/core
    // y moria con ENOENT) ni destruir la conexion, que cierra el afterAll global.
    const repository = new KnexAuthCognitoRepository(knexConfig);
    const usersRepository = new KnexUsersRepository(repository.connection);

    describe('when the user does not exist', () => {
        it('returns null without calling update', async () => {
            const service = new FindLoginUser(repository);

            const result = await service.find('login_inexistente', 'inexistente@example.com');

            expect(result).toBeNull();
        });
    });

    describe('when the user is soft-deleted (single legacy record)', () => {
        it('applies the deleted_ prefix, persists the mutation, and returns null for re-provisioning', async () => {
            const user = await UsersMother.createUser(usersRepository);
            const originalLogin = user.login.value;
            const originalEmail = user.email.value;
            const deletedBy = user.id.value;
            const deletedAt = new Date('2024-01-01T00:00:00.000Z').toISOString();

            await repository.connection('usuarios').where({ id: user.id.value }).update({
                deleted_at: deletedAt,
                deleted_by: deletedBy,
            });

            const service = new FindLoginUser(repository);
            const result = await service.find(originalLogin, originalEmail);

            // Returns null so AuthenticationUser can auto-provision (intentional)
            expect(result).toBeNull();

            // Verify prefix was applied in DB
            const updated = await repository.connection('usuarios').where({ id: user.id.value }).first();
            expect(updated.login).toMatch(/^deleted_\d+_/);
            expect(updated.email).toMatch(/^deleted_\d+_/);
            expect(updated.login).toContain(originalLogin);
            expect(updated.email).toContain(originalEmail);

            // deleted_at preserved, not refreshed
            const updatedDeletedAt = new Date(updated.deleted_at).toISOString();
            expect(updatedDeletedAt).toBe(deletedAt);
            expect(updated.deleted_by).toBe(deletedBy);

            // audit trail: updated_at and updated_by are set
            expect(updated.updated_at).not.toBeNull();
            expect(updated.updated_by).toBe(user.id.value);
        });
    });

    describe('when multiple legacy deleted users exist with the same login/email', () => {
        it('cleans all legacy records and finds the active user', async () => {
            // Create 2 deleted users + 1 active, all sharing the same login/email
            const sharedLogin = `shared_login_${Date.now()}`;
            const sharedEmail = `shared_${Date.now()}@example.com`;

            const deleted1 = await UsersMother.createUser(usersRepository, {
                login: sharedLogin,
                email: sharedEmail,
            });
            await repository
                .connection('usuarios')
                .where({ id: deleted1.id.value })
                .update({
                    deleted_at: new Date('2024-01-01').toISOString(),
                    deleted_by: deleted1.id.value,
                });

            const deleted2 = await UsersMother.createUser(usersRepository, {
                login: sharedLogin,
                email: sharedEmail,
            });
            await repository
                .connection('usuarios')
                .where({ id: deleted2.id.value })
                .update({
                    deleted_at: new Date('2024-06-01').toISOString(),
                    deleted_by: deleted2.id.value,
                });

            const activeUser = await UsersMother.createUser(usersRepository, {
                login: sharedLogin,
                email: sharedEmail,
            });

            const service = new FindLoginUser(repository);
            const result = await service.find(sharedLogin, sharedEmail);

            expect(result).not.toBeNull();
            expect(result.user.id.value).toBe(activeUser.id.value);

            // Both deleted records now have prefixed login/email
            const d1 = await repository.connection('usuarios').where({ id: deleted1.id.value }).first();
            const d2 = await repository.connection('usuarios').where({ id: deleted2.id.value }).first();
            expect(d1.login).toMatch(/^deleted_\d+_/);
            expect(d2.login).toMatch(/^deleted_\d+_/);
        });

        it('returns null when all matching users are deleted (allows re-provisioning)', async () => {
            const sharedLogin = `only_deleted_${Date.now()}`;
            const sharedEmail = `only_deleted_${Date.now()}@example.com`;

            const deleted1 = await UsersMother.createUser(usersRepository, {
                login: sharedLogin,
                email: sharedEmail,
            });
            await repository.connection('usuarios').where({ id: deleted1.id.value }).update({
                deleted_at: new Date().toISOString(),
                deleted_by: deleted1.id.value,
            });

            const service = new FindLoginUser(repository);
            const result = await service.find(sharedLogin, sharedEmail);

            expect(result).toBeNull();
        });
    });

    describe('when the user is inactive', () => {
        it('throws "Inactive user" (CustomError propagated, not wrapped)', async () => {
            const user = await UsersMother.createUser(usersRepository, {
                is_active: StatusEnum.INACTIVE.value,
            });

            const service = new FindLoginUser(repository);

            await expect(service.find(user.login.value, user.email.value)).rejects.toThrow(CustomError);
            await expect(service.find(user.login.value, user.email.value)).rejects.toThrow('Inactive user');
        });

        it('throws "Inactive user" when is_active = 2', async () => {
            const user = await UsersMother.createUser(usersRepository);
            await repository.connection('usuarios').where({ id: user.id.value }).update({ is_active: 2 });

            const service = new FindLoginUser(repository);

            await expect(service.find(user.login.value, user.email.value)).rejects.toThrow('Inactive user');
        });
    });

    describe('when the user has no role assigned (rol_id = null in DB)', () => {
        it('throws "User retrieval failed" because User constructor rejects null rol_id', async () => {
            const user = await UsersMother.createUser(usersRepository);
            await repository.connection('usuarios').where({ id: user.id.value }).update({ rol_id: null });

            const service = new FindLoginUser(repository);

            // The error originates from ValueObjectUuid rejecting null,
            // which cascades as QueryDBError → 'User retrieval failed'
            await expect(service.find(user.login.value, user.email.value)).rejects.toThrow('User retrieval failed');
        });
    });

    describe('happy path — active user with a role', () => {
        it('returns user, groups, and role permissions', async () => {
            const user = await UsersMother.createUser(usersRepository);

            const service = new FindLoginUser(repository);
            const result = await service.find(user.login.value, user.email.value);

            expect(result).not.toBeNull();
            expect(result.user).toBeDefined();
            expect(result.user.id.value).toBe(user.id.value);
            expect(Array.isArray(result.groups)).toBe(true);
        });
    });
});
