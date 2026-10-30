import { User, UserResponse, UserCollectionResponse } from '../../src/users';
import { v4 as uuidv4 } from 'uuid';
import UsersMother from './domain/UsersMother';
import { InvalidArgumentError, StatusEnum } from '../../src/shared/index.js';

describe('User Entity', () => {
    it('should create a user with valid data', () => {
        const user = User.create(UsersMother.systemUser());
        expect(user).toBeInstanceOf(User);
    });

    it('should update attributes and register the changes in changedAttributes', () => {
        const user = User.create(UsersMother.systemUser());
        const newRolId = uuidv4();
        const newData = {
            nombres: 'Updated Name',
            rol_id: newRolId,
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
        };
        user.update(newData);

        expect(user.nombres.value).toBe('Updated Name');
        expect(user.rol_id.value).toBe(newRolId);
        expect(user.changedAttributes).toEqual(newData);
    });

    it('should create a user with last_integration_active_at as null when not provided', () => {
        const user = User.create(UsersMother.systemUser());
        expect(user.last_integration_active_at.value).toBeNull();
    });

    it('should create a user with a valid last_integration_active_at timestamp', () => {
        const timestamp = new Date().toISOString();
        const user = User.create({ ...UsersMother.systemUser(), last_integration_active_at: timestamp });
        expect(user.last_integration_active_at.value).toBe(timestamp);
    });

    it('should track last_integration_active_at changes in changedAttributes', () => {
        const user = User.create(UsersMother.systemUser());
        const timestamp = new Date().toISOString();
        user.last_integration_active_at = timestamp;
        expect(user.changedAttributes.last_integration_active_at).toBe(timestamp);
    });

    it('should throw an error with invalid UUID', () => {
        const invalidData = { ...UsersMother.systemUser(), id: 'invalid-uuid' };

        expect(() => User.create(invalidData)).toThrow('Invalid value invalid-uuid for object uuid');
    });

    it('should return false if the user was deleted', async () => {
        const user = User.create(UsersMother.systemUser());
        user.delete({ deleted_at: new Date().toISOString(), deleted_by: uuidv4() });

        expect(user.isActive()).toBe(false);
    });

    it('should mutate email with deleted_ prefix when user is deleted', () => {
        const originalEmail = 'konecta@example.com';
        const user = User.create(UsersMother.systemUser());

        user.delete({ deleted_at: new Date().toISOString(), deleted_by: uuidv4() });

        expect(user.email.value).toMatch(/^deleted_\d+_konecta@example\.com$/);
        expect(user.email.value).not.toBe(originalEmail);
    });

    it('should mutate login with deleted_ prefix when user is deleted', () => {
        const originalLogin = 'usuario_sistema';
        const user = User.create(UsersMother.systemUser());

        user.delete({ deleted_at: new Date().toISOString(), deleted_by: uuidv4() });

        expect(user.login.value).toMatch(/^deleted_\d+_usuario_sistema$/);
        expect(user.login.value).not.toBe(originalLogin);
    });

    it('should register email and login mutations in changedAttributes on delete', () => {
        const user = User.create(UsersMother.systemUser());

        user.delete({ deleted_at: new Date().toISOString(), deleted_by: uuidv4() });

        expect(user.changedAttributes.email).toMatch(/^deleted_\d+_/);
        expect(user.changedAttributes.login).toMatch(/^deleted_\d+_/);
        expect(user.changedAttributes.deleted_at).toBeDefined();
        expect(user.changedAttributes.deleted_by).toBeDefined();
    });

    it('should preserve full UUID-based login with prefix (no truncation, within 100 char limit)', () => {
        const uuidLogin = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'; // 36 chars
        const user = User.create(UsersMother.systemUser({ login: uuidLogin }));

        user.delete({ deleted_at: new Date().toISOString(), deleted_by: uuidv4() });

        const mutatedLogin = user.login.value;
        expect(mutatedLogin).toMatch(/^deleted_\d+_/);
        expect(mutatedLogin).toContain(uuidLogin); // full UUID preserved
        expect(mutatedLogin.length).toBeLessThanOrEqual(100); // within ValueObjectLogin limit
    });

    it('should NOT double-prefix email and login if already deleted', () => {
        const user = User.create(UsersMother.systemUser());
        const deleteDto = { deleted_at: new Date().toISOString(), deleted_by: uuidv4() };

        user.delete(deleteDto);
        const emailAfterFirst = user.email.value;
        const loginAfterFirst = user.login.value;

        user.delete(deleteDto);

        expect(user.email.value).toBe(emailAfterFirst);
        expect(user.login.value).toBe(loginAfterFirst);
        expect((user.email.value.match(/deleted_/g) ?? []).length).toBe(1);
    });

    it('should return false if the user is not active', async () => {
        const user = User.create({ ...UsersMother.systemUser(), is_active: StatusEnum.INACTIVE.value });

        expect(user.isActive()).toBe(false);
    });

    it('should return true if the user is active', async () => {
        const user = User.create(UsersMother.systemUser());

        expect(user.isActive()).toBe(true);
    });

    describe('User Permissions', () => {
        const permissions = {
            administrador: [
                {
                    name: 'AnsCreate',
                    granted: true,
                    module_id: 'ans',
                    description: 'Create ans',
                },
                {
                    name: 'AnsRead',
                    granted: false,
                    module_id: 'ans',
                    description: 'Read ans',
                },
            ],
            agente: [
                {
                    name: 'CasesCreate',
                    granted: false,
                    module_id: 'cases',
                    description: 'Crear caso',
                },
            ],
        };
        const user = User.create({ ...UsersMother.systemUser(), permissions: permissions });

        it('should return true if the user has the permission', () => {
            const result = user.hasPermission('administrador', 'ans', 'AnsCreate');
            expect(result).toBe(true);
        });

        it('should return false if the user does not have the permission', () => {
            const result = user.hasPermission('administrador', 'ans', 'AnsRead');
            expect(result).toBe(false);
        });

        it('should throw an error if the role does not exist', () => {
            expect(() => {
                user.hasPermission('unknownRole', 'ans', 'AnsCreate');
            }).toThrow(InvalidArgumentError);
        });

        it('should return false if the permission does not exist in the module', () => {
            const hasPermission = user.hasPermission('agente', 'cases', 'CasesCreate');
            expect(hasPermission).toBe(false);
        });

        it('should hydrate a user with interaction bulk permissions from role permissions', () => {
            const interactionBulkPermissions = [
                'InteractionsBulkClose',
                'InteractionsBulkMove',
                'InteractionsBulkAssign',
                'InteractionsBulkUnassign',
            ];
            const userWithInteractionBulkPermissions = User.create({
                ...UsersMother.systemUser(),
                permissions: {
                    administrador: interactionBulkPermissions.map((name) => ({
                        name,
                        granted: true,
                        module_id: 'interactions',
                        description: 'Acción masiva de interacciones',
                    })),
                },
            });

            interactionBulkPermissions.forEach((permission) => {
                expect(
                    userWithInteractionBulkPermissions.hasPermission('administrador', 'interactions', permission)
                ).toBe(true);
            });
        });
    });
});

describe('User Responses Tests', () => {
    it('converts User object to JSON representation', () => {
        const user = User.create(UsersMother.systemUser());
        const userResponse = new UserResponse(user);

        const json = userResponse.toJson();

        expect(json).toEqual({
            data: {
                id: user.id.value,
                login: user.login.value,
                nombres: user.nombres.value,
                apellido1: user.apellido1.value,
                apellido2: user.apellido2.value,
                email: user.email.value,
                token: user.token.value,
                telefono: user.telefono.value,
                movil: user.movil.value,
                is_active: user.is_active.value,
                account_type: user.account_type.value,
                filters: user.filters.value,
                external_id: user.external_id.value,
                codigos_externos: user.codigos_externos.value,
                rol_id: user.rol_id.value,
                grupo_activo: user.grupo_activo.value,
                data: user.data.value,
                ips_allowed: user.ips_allowed.value,
                created_at: user.created_at.value,
                created_by: user.created_by.value,
                updated_at: user.updated_at.value,
                updated_by: user.updated_by.value,
                deleted_at: user.deleted_at.value,
                deleted_by: user.deleted_by.value,

                expiredCases: user.expiredCasesCount?.value,
                intermediateCases: user.intermediateCasesCount?.value,
                notExpiredCases: user.notExpiredCasesCount?.value,
                groups: user.groups || [],
            },
        });
    });

    it('returns an empty object if User is not provided', () => {
        const userResponse = new UserResponse(null);
        expect(userResponse.toJson()).toEqual({});
    });

    it('converts UserCollection to JSON representation', () => {
        const userCollection = [User.create(UsersMother.systemUser()), User.create(UsersMother.systemUser())];
        const userCollectionResponse = new UserCollectionResponse(userCollection, userCollection.length);

        const json = userCollectionResponse.toJson();

        expect(json).toEqual({
            data: {
                items: userCollection.map((user) => new UserResponse(user).toJson().data),
            },
            metadata: {
                count: userCollection.length,
            },
        });
    });
});

describe('User external_id clearing', () => {
    it('normalizes an emptied external_id to null and records the change', () => {
        const user = User.create({ ...UsersMother.systemUser(), external_id: 'test' });

        user.update({ external_id: '' });

        expect(user.external_id.value).toBeNull();
        expect(user.changedAttributes.external_id).toBeNull();
    });

    it('does not record a change when an already empty external_id is cleared again', () => {
        const user = User.create({ ...UsersMother.systemUser(), external_id: null });

        user.update({ external_id: '' });

        expect(user.changedAttributes).not.toHaveProperty('external_id');
    });

    it('still stores a non empty external_id as provided', () => {
        const user = User.create({ ...UsersMother.systemUser(), external_id: 'test' });

        user.update({ external_id: 'other' });

        expect(user.external_id.value).toBe('other');
        expect(user.changedAttributes.external_id).toBe('other');
    });
});
