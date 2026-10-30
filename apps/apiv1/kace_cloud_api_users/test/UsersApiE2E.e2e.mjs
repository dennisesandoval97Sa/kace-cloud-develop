import { randomUUID } from 'node:crypto';
import { TestHelper } from '@kace/api-common/tests/helpers/TestHelper.js';
import { KnexUsersRepository } from '@kace/core/src/users/infrastructure/KnexUsersRepository.js';
import { User } from '@kace/core/src/users/domain/User.js';
import { AccountTypeEnum } from '@kace/core/src/shared/domain/enum/AccountTypeEnum.js';
import { StatusEnum } from '@kace/core/src/shared/domain/enum/StatusEnum.js';
import UsersMother from '@kace/core/tests/users/domain/UsersMother.js';
import { globalTesterUser } from '@kace/database/seeds/20241125105900_usuario_base.js';
import { globalConfigurationIdZeroTrust } from '@kace/database/seeds/20241125105901_configuration.js';
import { globalGroupId } from '@kace/database/seeds/20250128045401_rel_user_group.js';

/**
 * E2E del API REST de usuarios según docs/guides/E2E_API_REST_SERVICE_TEST_SPECIFICATION.md.
 *
 * ENTORNO: el test y el Lambda usan SOLO el bloque `DB_TEST_*` del `.env`. Ejecución:
 * `pnpm run api:e2e` en una terminal y `pnpm run test:e2e` en otra.
 *
 * El usuario autenticado es el `tester` sembrado (su `sub` de Cognito es su `login`): los
 * endpoints de sesión y de grupo activo actúan sobre él.
 */

const tenant = await TestHelper.getTenant();

const HTTP = {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
};

// Usuarios que siembra 20241125105900_usuario_base.js en cada reset (diez personas y Kace Bot).
const SEEDED_USERS_COUNT = 11;

// Grupos sembrados por 20250128045401_rel_user_group.js. Todos los usuarios sembrados son miembros
// del primero; el segundo ("New users") reutiliza el id de la configuración Zero Trust.
const ADMIN_GROUP_ID = globalGroupId;
const NEW_USERS_GROUP_ID = globalConfigurationIdZeroTrust;

// Campos de UsersMother.dto() que acepta schemaCreate; el resto lo rechaza o lo gestiona el servidor.
const CREATE_FIELDS = [
    'login',
    'nombres',
    'apellido1',
    'apellido2',
    'email',
    'telefono',
    'movil',
    'rol_id',
    'is_active',
    'account_type',
];

// users.search exige este filtro base exacto a quien no tiene UsersSearchAdvanced.
const SEARCH_BASE_FILTER = { field: 'usuarios.deleted_at', operator: 'null', value: 'null', type: 'AND' };

const createPayload = (overrides = {}) => {
    const dto = UsersMother.dto();
    const payload = Object.fromEntries(CREATE_FIELDS.map((field) => [field, dto[field]]));
    return { ...payload, group_ids: [ADMIN_GROUP_ID], ...overrides };
};

// schemaUpdate exige account_type incluso en una actualización parcial.
const updatePayload = (fields) => ({ account_type: AccountTypeEnum.ACTIVE_DIRECTORY.value, ...fields });

// UserSearcher ya desenvuelve la fila de COUNT(*), así que el total llega como string ('12').
const totalOf = (response) => Number(response.data.metadata.count);

const searchCriteria = ({ filter = [], ...overrides } = {}) => ({
    filter: [SEARCH_BASE_FILTER, ...filter],
    relationship: null,
    limit: 10,
    offset: 0,
    order: { field: 'created_at', direction: 'desc' },
    ...overrides,
});

const historyCriteria = () => ({
    filter: null,
    relationship: null,
    limit: 10,
    offset: 0,
    order: null,
});

describe('UsersController E2E tests', () => {
    const repository = new KnexUsersRepository(tenant.buildKnexConfig());
    const baseUrl = 'http://127.0.0.1:60051';

    // UsersMother.createUser() crea las filas padre con SQL sin esquema y, sin search_path, apunta a
    // `public`: el usuario se construye con el Mother y se guarda con el repositorio.
    const createUser = async (overrides = {}) => {
        const user = User.create(UsersMother.dto(overrides));
        await repository.save(user);
        return user;
    };
    const addMembership = (userId, groupId) =>
        repository.table('rel_usuarios_grupos').insert({ usuario_id: userId, grupo_id: groupId });
    const membershipsOf = (userId) =>
        repository.table('rel_usuarios_grupos').where({ usuario_id: userId }).orderBy('grupo_id').pluck('grupo_id');
    const findUserBy = (where) => repository.table().where(where).first();
    const countUsersBy = async (where) => {
        const [{ count }] = await repository.table().where(where).count('* as count');
        return Number(count);
    };
    const findTester = () => findUserBy({ email: globalTesterUser });
    // RoleDeleter no impide borrar un rol asignado: la fila sigue existiendo, con deleted_at.
    const createSoftDeletedRole = async () => {
        const id = randomUUID();
        await repository
            .table('roles')
            .insert({ id, descripcion: 'Rol borrado', status: 1, deleted_at: new Date(), deleted_by: randomUUID() });
        return id;
    };
    const createSoftDeletedGroup = async () => {
        const id = randomUUID();
        await repository
            .table('grupos')
            .insert({ id, nombre: 'Grupo borrado', status: 1, deleted_at: new Date(), deleted_by: randomUUID() });
        return id;
    };

    beforeAll(async () => {
        if (!process.env.DB_TEST_HOST || !process.env.DB_TEST_SCHEMA) {
            throw new Error('El E2E necesita DB_TEST_HOST y DB_TEST_SCHEMA en el .env.');
        }
        if (process.env.DB_TEST_HOST === process.env.DB_HOST && process.env.DB_TEST_SCHEMA === process.env.DB_SCHEMA) {
            throw new Error('DB_TEST_* apunta a la misma base y esquema que DB_*: el E2E la reiniciaría.');
        }
        if (
            tenant.db_host.value !== process.env.DB_TEST_HOST ||
            tenant.db_schema.value !== process.env.DB_TEST_SCHEMA
        ) {
            throw new Error('TestHelper.getTenant() no está resolviendo DB_TEST_*.');
        }

        // Si el Lambda lee otra base, la fila sembrada aquí no existe para él y todo falla con 404.
        await TestHelper.resetSchemaAndMigrate(tenant);
        const sentinel = await createUser();
        const response = await TestHelper.getRequest(`${baseUrl}/${sentinel.id.value}`);
        if (response.status !== HTTP.OK) {
            throw new Error(
                `El Lambda de SAM Local no ve la base DB_TEST_* (GET sentinel → ${response.status ?? response.code}). ` +
                    'Arráncalo con `pnpm run api:e2e`.'
            );
        }
    });

    afterAll(async () => {
        await repository.destroyConnection();
    });

    // ============================================================
    // CREATE OPERATION
    // ============================================================
    describe('POST / - Create User', () => {
        beforeEach(async () => {
            await TestHelper.resetSchemaAndMigrate(tenant);
        });

        it('should create a user, return its id and persist it with its group membership', async () => {
            // Arrange
            const payload = createPayload();

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response.status).toBe(HTTP.CREATED);
            const { id } = response.data.data;
            const persisted = await findUserBy({ id });
            expect(persisted).toMatchObject({
                login: payload.login,
                nombres: payload.nombres,
                apellido1: payload.apellido1,
                apellido2: payload.apellido2,
                email: payload.email,
                telefono: payload.telefono,
                movil: payload.movil,
                rol_id: payload.rol_id,
                is_active: payload.is_active,
                account_type: payload.account_type,
                grupo_activo: ADMIN_GROUP_ID,
                deleted_at: null,
            });
            expect(persisted.created_by).toBe((await findTester()).id);
            expect(await membershipsOf(id)).toEqual([ADMIN_GROUP_ID]);
        });

        it('should create one membership per group and default grupo_activo to the first group', async () => {
            // Arrange
            const payload = createPayload({ group_ids: [NEW_USERS_GROUP_ID, ADMIN_GROUP_ID] });

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response.status).toBe(HTTP.CREATED);
            const { id } = response.data.data;
            expect((await findUserBy({ id })).grupo_activo).toBe(NEW_USERS_GROUP_ID);
            expect(await membershipsOf(id)).toEqual([NEW_USERS_GROUP_ID, ADMIN_GROUP_ID].sort());
        });

        it('should replace a client-supplied id with a server-generated one', async () => {
            // Arrange
            const clientId = randomUUID();
            const payload = createPayload({ id: clientId });

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response.status).toBe(HTTP.CREATED);
            expect(response.data.data.id).not.toBe(clientId);
            expect(await findUserBy({ id: clientId })).toBeUndefined();
            expect((await findUserBy({ login: payload.login })).id).toBe(response.data.data.id);
        });

        it('should ignore client-supplied audit fields', async () => {
            // Arrange
            const forgedCreator = randomUUID();
            const payload = createPayload({ created_by: forgedCreator, created_at: '2000-01-01T00:00:00.000Z' });

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response.status).toBe(HTTP.CREATED);
            const persisted = await findUserBy({ id: response.data.data.id });
            expect(persisted.created_by).not.toBe(forgedCreator);
            expect(new Date(persisted.created_at).getUTCFullYear()).not.toBe(2000);
        });

        it('should return 400 when the payload is empty', async () => {
            // Act
            const response = await TestHelper.postRequest(baseUrl, {});

            // Assert
            expect(response).toHaveProperty('status', HTTP.BAD_REQUEST);
        });

        it.each(['login', 'account_type', 'group_ids', 'is_active', 'rol_id'])(
            'should return 400 when required field %s is missing',
            async (field) => {
                // Arrange
                const payload = createPayload();
                delete payload[field];

                // Act
                const response = await TestHelper.postRequest(baseUrl, payload);

                // Assert
                expect(response).toHaveProperty('status', HTTP.BAD_REQUEST);
                expect(await countUsersBy({})).toBe(SEEDED_USERS_COUNT);
            }
        );

        it('should return 400 when group_ids is empty', async () => {
            // Arrange
            const payload = createPayload({ group_ids: [] });

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response).toHaveProperty('status', HTTP.BAD_REQUEST);
            expect(await findUserBy({ login: payload.login })).toBeUndefined();
        });

        it('should return 400 and persist nothing when a group does not exist', async () => {
            // Arrange
            const payload = createPayload({ group_ids: [ADMIN_GROUP_ID, randomUUID()] });

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response).toHaveProperty('status', HTTP.BAD_REQUEST);
            expect(await findUserBy({ login: payload.login })).toBeUndefined();
        });

        it('should return 400 and persist nothing when grupo_activo is not one of group_ids', async () => {
            // Arrange
            const payload = createPayload({ group_ids: [ADMIN_GROUP_ID], grupo_activo: NEW_USERS_GROUP_ID });

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response).toHaveProperty('status', HTTP.BAD_REQUEST);
            expect(await findUserBy({ login: payload.login })).toBeUndefined();
        });

        it('should return 404 and persist nothing when rol_id does not exist', async () => {
            // Arrange
            const payload = createPayload({ rol_id: randomUUID() });

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response).toHaveProperty('status', HTTP.NOT_FOUND);
            expect(await findUserBy({ login: payload.login })).toBeUndefined();
        });

        it('should return 404 and persist nothing when rol_id is soft-deleted', async () => {
            // Arrange
            const payload = createPayload({ rol_id: await createSoftDeletedRole() });

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response).toHaveProperty('status', HTTP.NOT_FOUND);
            expect(await findUserBy({ login: payload.login })).toBeUndefined();
        });

        it('should return 400 when the email is not valid', async () => {
            // Arrange
            const payload = createPayload({ email: 'no-es-un-email' });

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response).toHaveProperty('status', HTTP.BAD_REQUEST);
        });

        it('should return 400 when nombres exceeds 100 characters', async () => {
            // Arrange
            const payload = createPayload({ nombres: 'N'.repeat(101) });

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response).toHaveProperty('status', HTTP.BAD_REQUEST);
        });

        it('should return 400 and persist nothing when telefono is not exactly 10 digits', async () => {
            // Arrange
            const payload = createPayload({ telefono: '12345' });

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response).toHaveProperty('status', HTTP.BAD_REQUEST);
            expect(await findUserBy({ login: payload.login })).toBeUndefined();
        });

        it('should return 400 when login is shorter than 3 characters', async () => {
            // Arrange
            const payload = createPayload({ login: 'ab' });

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response).toHaveProperty('status', HTTP.BAD_REQUEST);
            expect(await findUserBy({ login: 'ab' })).toBeUndefined();
        });

        it('should return 400 when is_active is outside the status catalog', async () => {
            // Arrange
            const payload = createPayload({ is_active: 3 });

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response).toHaveProperty('status', HTTP.BAD_REQUEST);
        });

        it('should accept accented letters and ñ in nombres', async () => {
            // Arrange
            const payload = createPayload({ nombres: 'José Ñandú' });

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response.status).toBe(HTTP.CREATED);
            expect((await findUserBy({ id: response.data.data.id })).nombres).toBe('José Ñandú');
        });

        it('should create a SERVICE account without password', async () => {
            // Arrange
            const payload = createPayload({ account_type: AccountTypeEnum.SERVICE.value });

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response.status).toBe(HTTP.CREATED);
            expect((await findUserBy({ id: response.data.data.id })).account_type).toBe(AccountTypeEnum.SERVICE.value);
        });

        it('should return 400 when a SERVICE account sends an empty password', async () => {
            // Arrange
            const payload = createPayload({ account_type: AccountTypeEnum.SERVICE.value, password: '' });

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response).toHaveProperty('status', HTTP.BAD_REQUEST);
        });

        it('should return 400 when the login already exists', async () => {
            // Arrange
            const existing = await createUser();
            const payload = createPayload({ login: existing.login.value });

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response).toHaveProperty('status', HTTP.BAD_REQUEST);
            expect(await countUsersBy({ login: existing.login.value })).toBe(1);
        });

        it('should create two different users concurrently', async () => {
            // Arrange
            const firstPayload = createPayload();
            const secondPayload = createPayload();

            // Act
            const responses = await Promise.all([
                TestHelper.postRequest(baseUrl, firstPayload),
                TestHelper.postRequest(baseUrl, secondPayload),
            ]);

            // Assert
            expect(responses.map((response) => response.status)).toEqual([HTTP.CREATED, HTTP.CREATED]);
            expect(await findUserBy({ login: firstPayload.login })).toBeDefined();
            expect(await findUserBy({ login: secondPayload.login })).toBeDefined();
        });
    });

    // ============================================================
    // READ OPERATION
    // ============================================================
    describe('GET /:id - Read User by ID', () => {
        beforeEach(async () => {
            await TestHelper.resetSchemaAndMigrate(tenant);
        });

        it('should fetch a user with every field', async () => {
            // Arrange
            const user = await createUser();

            // Act
            const response = await TestHelper.getRequest(`${baseUrl}/${user.id.value}`);

            // Assert
            expect(response.status).toBe(HTTP.OK);
            const { created_at: createdAt, ...data } = response.data.data;
            expect(data).toEqual({
                id: user.id.value,
                login: user.login.value,
                nombres: user.nombres.value,
                apellido1: user.apellido1.value,
                apellido2: user.apellido2.value,
                email: user.email.value,
                token: null,
                telefono: user.telefono.value,
                movil: user.movil.value,
                is_active: user.is_active.value,
                account_type: user.account_type.value,
                filters: null,
                external_id: null,
                codigos_externos: null,
                rol_id: user.rol_id.value,
                grupo_activo: null,
                data: null,
                ips_allowed: null,
                created_by: user.created_by.value,
                updated_at: null,
                updated_by: null,
                deleted_at: null,
                deleted_by: null,
                expiredCases: 0,
                intermediateCases: 0,
                notExpiredCases: 0,
                groups: [],
            });
            expect(new Date(createdAt).toISOString()).toBe(new Date(user.created_at.value).toISOString());
        });

        it('should return 404 when the user does not exist', async () => {
            // Act
            const response = await TestHelper.getRequest(`${baseUrl}/${randomUUID()}`);

            // Assert
            expect(response).toHaveProperty('status', HTTP.NOT_FOUND);
        });

        it('should return 400 when the id is not a UUID', async () => {
            // Act
            const response = await TestHelper.getRequest(`${baseUrl}/invalid-uuid-format`);

            // Assert
            expect(response).toHaveProperty('status', HTTP.BAD_REQUEST);
        });
    });

    // ============================================================
    // UPDATE OPERATION
    // ============================================================
    describe('POST /:id - Update User', () => {
        beforeEach(async () => {
            await TestHelper.resetSchemaAndMigrate(tenant);
        });

        it('should update a user and persist the changes', async () => {
            // Arrange
            const user = await createUser();
            const changes = { nombres: 'Nombre Nuevo', apellido1: 'Apellido Nuevo', telefono: '5512345678' };

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/${user.id.value}`, updatePayload(changes));

            // Assert
            expect(response.status).toBe(HTTP.OK);
            expect(await findUserBy({ id: user.id.value })).toMatchObject(changes);
        });

        it('should update only the provided fields', async () => {
            // Arrange
            const user = await createUser();

            // Act
            const response = await TestHelper.postRequest(
                `${baseUrl}/${user.id.value}`,
                updatePayload({ nombres: 'Solo Nombre' })
            );

            // Assert
            expect(response.status).toBe(HTTP.OK);
            expect(await findUserBy({ id: user.id.value })).toMatchObject({
                nombres: 'Solo Nombre',
                login: user.login.value,
                apellido1: user.apellido1.value,
                email: user.email.value,
                telefono: user.telefono.value,
            });
        });

        it('should keep the creation audit fields and stamp the update ones with the caller', async () => {
            // Arrange
            const user = await createUser();

            // Act
            await TestHelper.postRequest(`${baseUrl}/${user.id.value}`, updatePayload({ nombres: 'Auditado' }));

            // Assert
            const persisted = await findUserBy({ id: user.id.value });
            expect(persisted.created_by).toBe(user.created_by.value);
            expect(new Date(persisted.created_at).toISOString()).toBe(new Date(user.created_at.value).toISOString());
            expect(persisted.updated_at).not.toBeNull();
            expect(persisted.updated_by).toBe((await findTester()).id);
        });

        it('should return 400 and keep the original data when account_type is missing', async () => {
            // Arrange
            const user = await createUser();

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/${user.id.value}`, { nombres: 'Sin Tipo' });

            // Assert
            expect(response).toHaveProperty('status', HTTP.BAD_REQUEST);
            expect((await findUserBy({ id: user.id.value })).nombres).toBe(user.nombres.value);
        });

        it('should return 400 when is_active has an invalid type', async () => {
            // Arrange
            const user = await createUser();

            // Act
            const response = await TestHelper.postRequest(
                `${baseUrl}/${user.id.value}`,
                updatePayload({ is_active: 'activo' })
            );

            // Assert
            expect(response).toHaveProperty('status', HTTP.BAD_REQUEST);
        });

        it('should return 400 when nombres is empty', async () => {
            // Arrange
            const user = await createUser();

            // Act
            const response = await TestHelper.postRequest(
                `${baseUrl}/${user.id.value}`,
                updatePayload({ nombres: '' })
            );

            // Assert
            expect(response).toHaveProperty('status', HTTP.BAD_REQUEST);
        });

        it('should return 400 and keep the original data when telefono is not exactly 10 digits', async () => {
            // Arrange
            const user = await createUser();

            // Act
            const response = await TestHelper.postRequest(
                `${baseUrl}/${user.id.value}`,
                updatePayload({ telefono: '123' })
            );

            // Assert
            expect(response).toHaveProperty('status', HTTP.BAD_REQUEST);
            expect((await findUserBy({ id: user.id.value })).telefono).toBe(user.telefono.value);
        });

        it('should return 400 and keep the original login when it belongs to another user', async () => {
            // Arrange
            const user = await createUser();
            const other = await createUser();

            // Act
            const response = await TestHelper.postRequest(
                `${baseUrl}/${user.id.value}`,
                updatePayload({ login: other.login.value })
            );

            // Assert
            expect(response).toHaveProperty('status', HTTP.BAD_REQUEST);
            expect((await findUserBy({ id: user.id.value })).login).toBe(user.login.value);
        });

        it('should return 400 when the payload carries server-managed fields', async () => {
            // Arrange
            const user = await createUser();

            // Act
            const response = await TestHelper.postRequest(
                `${baseUrl}/${user.id.value}`,
                updatePayload({ nombres: 'Forjado', created_by: randomUUID() })
            );

            // Assert
            expect(response).toHaveProperty('status', HTTP.BAD_REQUEST);
            expect((await findUserBy({ id: user.id.value })).nombres).toBe(user.nombres.value);
        });

        it('should return 400 when the id is not a UUID', async () => {
            // Act
            const response = await TestHelper.postRequest(
                `${baseUrl}/invalid-uuid`,
                updatePayload({ nombres: 'Nadie' })
            );

            // Assert
            expect(response).toHaveProperty('status', HTTP.BAD_REQUEST);
        });

        it('should return 404 when the user does not exist', async () => {
            // Act
            const response = await TestHelper.postRequest(
                `${baseUrl}/${randomUUID()}`,
                updatePayload({ nombres: 'Nadie' })
            );

            // Assert
            expect(response).toHaveProperty('status', HTTP.NOT_FOUND);
        });

        it('should return 404 and keep the data when the user is soft-deleted', async () => {
            // Arrange
            const user = await createUser();
            await TestHelper.getRequest(`${baseUrl}/${user.id.value}/delete`);

            // Act
            const response = await TestHelper.postRequest(
                `${baseUrl}/${user.id.value}`,
                updatePayload({ nombres: 'Resucitado' })
            );

            // Assert
            expect(response).toHaveProperty('status', HTTP.NOT_FOUND);
            expect((await findUserBy({ id: user.id.value })).nombres).toBe(user.nombres.value);
        });

        it('should return 404 and keep the data when rol_id does not exist', async () => {
            // Arrange
            const user = await createUser();

            // Act
            const response = await TestHelper.postRequest(
                `${baseUrl}/${user.id.value}`,
                updatePayload({ rol_id: randomUUID() })
            );

            // Assert
            expect(response).toHaveProperty('status', HTTP.NOT_FOUND);
            expect((await findUserBy({ id: user.id.value })).rol_id).toBe(user.rol_id.value);
        });

        it('should return 404 and keep the data when grupo_activo does not exist', async () => {
            // Arrange
            const user = await createUser();

            // Act
            const response = await TestHelper.postRequest(
                `${baseUrl}/${user.id.value}`,
                updatePayload({ grupo_activo: randomUUID() })
            );

            // Assert
            expect(response).toHaveProperty('status', HTTP.NOT_FOUND);
            expect((await findUserBy({ id: user.id.value })).grupo_activo).toBeNull();
        });

        it('should return 404 and keep the data when rol_id changes to a soft-deleted role', async () => {
            // Arrange
            const user = await createUser();

            // Act
            const response = await TestHelper.postRequest(
                `${baseUrl}/${user.id.value}`,
                updatePayload({ rol_id: await createSoftDeletedRole() })
            );

            // Assert
            expect(response).toHaveProperty('status', HTTP.NOT_FOUND);
            expect((await findUserBy({ id: user.id.value })).rol_id).toBe(user.rol_id.value);
        });

        // The admin form re-sends every field: keeping the stored role or group must not block an edit.
        it('should update a user that keeps the role it had when the role was soft-deleted', async () => {
            // Arrange
            const rolId = await createSoftDeletedRole();
            const user = await createUser({ rol_id: rolId });

            // Act
            const response = await TestHelper.postRequest(
                `${baseUrl}/${user.id.value}`,
                updatePayload({ nombres: 'Sigue Editable', rol_id: rolId })
            );

            // Assert
            expect(response.status).toBe(HTTP.OK);
            expect(await findUserBy({ id: user.id.value })).toMatchObject({ nombres: 'Sigue Editable', rol_id: rolId });
        });

        it('should update a user that keeps the active group it had when the group was soft-deleted', async () => {
            // Arrange
            const groupId = await createSoftDeletedGroup();
            const user = await createUser({ grupo_activo: groupId });

            // Act
            const response = await TestHelper.postRequest(
                `${baseUrl}/${user.id.value}`,
                updatePayload({ nombres: 'Sigue Editable', grupo_activo: groupId })
            );

            // Assert
            expect(response.status).toBe(HTTP.OK);
            expect((await findUserBy({ id: user.id.value })).nombres).toBe('Sigue Editable');
        });
    });

    // ============================================================
    // DELETE OPERATION
    // ============================================================
    describe('GET /:id/delete - Delete User (Soft Delete)', () => {
        beforeEach(async () => {
            await TestHelper.resetSchemaAndMigrate(tenant);
        });

        it('should soft delete a user keeping the row and stamping who deleted it', async () => {
            // Arrange
            const user = await createUser();

            // Act
            const response = await TestHelper.getRequest(`${baseUrl}/${user.id.value}/delete`);

            // Assert
            expect(response.status).toBe(HTTP.OK);
            const row = await findUserBy({ id: user.id.value });
            expect(row.deleted_at).not.toBeNull();
            expect(row.deleted_by).toBe((await findTester()).id);
        });

        it('should return 404 when reading a deleted user', async () => {
            // Arrange
            const user = await createUser();
            await TestHelper.getRequest(`${baseUrl}/${user.id.value}/delete`);

            // Act
            const response = await TestHelper.getRequest(`${baseUrl}/${user.id.value}`);

            // Assert
            expect(response).toHaveProperty('status', HTTP.NOT_FOUND);
        });

        it('should return 400 when the id is not a UUID', async () => {
            // Act
            const response = await TestHelper.getRequest(`${baseUrl}/invalid-uuid/delete`);

            // Assert
            expect(response).toHaveProperty('status', HTTP.BAD_REQUEST);
        });

        it('should return 404 when the user does not exist', async () => {
            // Act
            const response = await TestHelper.getRequest(`${baseUrl}/${randomUUID()}/delete`);

            // Assert
            expect(response).toHaveProperty('status', HTTP.NOT_FOUND);
        });

        it('should return 404 and keep the original deletion when the user is already deleted', async () => {
            // Arrange
            const user = await createUser();
            const originalDeletion = { deleted_at: '2030-01-01T00:00:00.000Z', deleted_by: randomUUID() };
            await repository.table().where({ id: user.id.value }).update(originalDeletion);

            // Act
            const response = await TestHelper.getRequest(`${baseUrl}/${user.id.value}/delete`);

            // Assert
            expect(response).toHaveProperty('status', HTTP.NOT_FOUND);
            const row = await findUserBy({ id: user.id.value });
            expect(new Date(row.deleted_at).toISOString()).toBe(originalDeletion.deleted_at);
            expect(row.deleted_by).toBe(originalDeletion.deleted_by);
        });
    });

    // ============================================================
    // INDEX OPERATION
    // ============================================================
    describe('GET / - Index User (List with default criteria)', () => {
        beforeEach(async () => {
            await TestHelper.resetSchemaAndMigrate(tenant);
        });

        it('should return the 10 newest users while counting all of them', async () => {
            // Arrange
            const user = await createUser({ created_at: '2030-01-01T00:00:00.000Z' });

            // Act
            const response = await TestHelper.getRequest(baseUrl);

            // Assert
            expect(response.status).toBe(HTTP.OK);
            expect(response.data.data.items).toHaveLength(10);
            expect(response.data.data.items[0].id).toBe(user.id.value);
            expect(totalOf(response)).toBe(SEEDED_USERS_COUNT + 1);
        });

        it('should order items by created_at desc', async () => {
            // Arrange
            const older = await createUser({ created_at: '2030-01-01T00:00:00.000Z' });
            const newer = await createUser({ created_at: '2030-01-02T00:00:00.000Z' });

            // Act
            const response = await TestHelper.getRequest(baseUrl);

            // Assert
            expect(response.status).toBe(HTTP.OK);
            expect(response.data.data.items.slice(0, 2).map((item) => item.id)).toEqual([
                newer.id.value,
                older.id.value,
            ]);
        });

        it("should include each user's groups and case counters", async () => {
            // Arrange
            const user = await createUser({ created_at: '2030-01-01T00:00:00.000Z' });
            await addMembership(user.id.value, ADMIN_GROUP_ID);

            // Act
            const response = await TestHelper.getRequest(baseUrl);

            // Assert
            // A diferencia de GET /{id}, el listado devuelve los contadores envueltos en { count }.
            expect(response.status).toBe(HTTP.OK);
            expect(response.data.data.items[0]).toMatchObject({
                id: user.id.value,
                groups: [{ id: ADMIN_GROUP_ID, nombre: 'Administrators Group' }],
                expiredCases: { count: 0 },
                intermediateCases: { count: 0 },
                notExpiredCases: { count: 0 },
            });
        });

        it('should neither list nor count soft-deleted users', async () => {
            // Arrange
            const user = await createUser({ created_at: '2030-01-01T00:00:00.000Z' });
            await TestHelper.getRequest(`${baseUrl}/${user.id.value}/delete`);

            // Act
            const response = await TestHelper.getRequest(baseUrl);

            // Assert
            expect(response.status).toBe(HTTP.OK);
            expect(response.data.data.items.map((item) => item.id)).not.toContain(user.id.value);
            expect(totalOf(response)).toBe(SEEDED_USERS_COUNT);
        });
    });

    // ============================================================
    // SEARCH OPERATION
    // ============================================================
    describe('POST /search - Search User with custom criteria', () => {
        beforeEach(async () => {
            await TestHelper.resetSchemaAndMigrate(tenant);
        });

        it('should find a user by id', async () => {
            // Arrange
            const user = await createUser();
            const criteria = searchCriteria({
                filter: [{ field: 'id', operator: 'eq', value: user.id.value, type: 'AND' }],
            });

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/search`, criteria);

            // Assert
            expect(response.status).toBe(HTTP.OK);
            expect(response.data.data.items.map((item) => item.id)).toEqual([user.id.value]);
            expect(totalOf(response)).toBe(1);
        });

        it('should find users by a case-insensitive partial login', async () => {
            // Arrange
            const target = await createUser({ login: 'agente.busqueda@example.com' });
            await createUser({ login: 'otro.usuario@example.com' });
            const criteria = searchCriteria({
                filter: [{ field: 'login', operator: 'ilike', value: '%BUSQUEDA%', type: 'AND' }],
            });

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/search`, criteria);

            // Assert
            expect(response.status).toBe(HTTP.OK);
            expect(response.data.data.items.map((item) => item.id)).toEqual([target.id.value]);
        });

        it('should combine several filters with AND', async () => {
            // Arrange
            const target = await createUser({ nombres: 'Filtrado', is_active: StatusEnum.ACTIVE.value });
            await createUser({ nombres: 'Filtrado', is_active: StatusEnum.INACTIVE.value });
            const criteria = searchCriteria({
                filter: [
                    { field: 'nombres', operator: 'ilike', value: 'Filtrado', type: 'AND' },
                    { field: 'is_active', operator: 'eq', value: StatusEnum.ACTIVE.value, type: 'AND' },
                ],
            });

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/search`, criteria);

            // Assert
            expect(response.status).toBe(HTTP.OK);
            expect(response.data.data.items.map((item) => item.id)).toEqual([target.id.value]);
        });

        it('should return an empty list when nothing matches', async () => {
            // Arrange
            const criteria = searchCriteria({
                filter: [{ field: 'id', operator: 'eq', value: randomUUID(), type: 'AND' }],
            });

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/search`, criteria);

            // Assert
            expect(response.status).toBe(HTTP.OK);
            expect(response.data.data.items).toEqual([]);
            expect(totalOf(response)).toBe(0);
        });

        it('should paginate with limit and offset over a custom order', async () => {
            // Arrange
            const logins = ['paginacion-a', 'paginacion-b', 'paginacion-c', 'paginacion-d'];
            for (const login of logins) {
                await createUser({ login });
            }
            const criteria = searchCriteria({
                filter: [{ field: 'login', operator: 'ilike', value: 'paginacion-%', type: 'AND' }],
                limit: 2,
                offset: 1,
                order: { field: 'login', direction: 'asc' },
            });

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/search`, criteria);

            // Assert
            expect(response.status).toBe(HTTP.OK);
            expect(response.data.data.items.map((item) => item.login)).toEqual(['paginacion-b', 'paginacion-c']);
            expect(totalOf(response)).toBe(logins.length);
        });

        it('should not return soft-deleted users', async () => {
            // Arrange
            const user = await createUser();
            await TestHelper.getRequest(`${baseUrl}/${user.id.value}/delete`);
            const criteria = searchCriteria({
                filter: [{ field: 'id', operator: 'eq', value: user.id.value, type: 'AND' }],
            });

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/search`, criteria);

            // Assert
            expect(response.status).toBe(HTTP.OK);
            expect(response.data.data.items).toEqual([]);
            expect(totalOf(response)).toBe(0);
        });

        it('should return 400 when limit is not a number', async () => {
            // Act
            const response = await TestHelper.postRequest(
                `${baseUrl}/search`,
                searchCriteria({ limit: 'not-a-number' })
            );

            // Assert
            expect(response).toHaveProperty('status', HTTP.BAD_REQUEST);
        });

        it('should return 400 when the operator is not supported', async () => {
            // Arrange
            const criteria = searchCriteria({
                filter: [{ field: 'login', operator: 'contains', value: 'tester', type: 'AND' }],
            });

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/search`, criteria);

            // Assert
            expect(response).toHaveProperty('status', HTTP.BAD_REQUEST);
        });

        it('should return 403 when the base filter is missing and the user lacks advanced search', async () => {
            // Arrange
            const user = await createUser();
            const criteria = searchCriteria({
                filter: [{ field: 'id', operator: 'eq', value: user.id.value, type: 'AND' }],
            });
            criteria.filter = criteria.filter.filter((filter) => filter !== SEARCH_BASE_FILTER);

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/search`, criteria);

            // Assert
            expect(response).toHaveProperty('status', HTTP.FORBIDDEN);
        });

        it('should return 403 when a filter is outside the allowlist and the user lacks advanced search', async () => {
            // Arrange
            const user = await createUser();
            const criteria = searchCriteria({
                filter: [{ field: 'telefono', operator: 'eq', value: user.telefono.value, type: 'AND' }],
            });

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/search`, criteria);

            // Assert
            expect(response).toHaveProperty('status', HTTP.FORBIDDEN);
        });

        it('should filter by grupos_ids when the user has UsersSearchAdvanced', async () => {
            // Arrange
            await TestHelper.resetSchemaAndMigrate(tenant, { searchPermissionNames: ['UsersSearchAdvanced'] });
            const member = await createUser();
            await addMembership(member.id.value, NEW_USERS_GROUP_ID);
            const criteria = searchCriteria({
                filter: [{ field: 'grupos_ids', operator: 'eq', value: NEW_USERS_GROUP_ID, type: 'AND' }],
            });

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/search`, criteria);

            // Assert
            expect(response.status).toBe(HTTP.OK);
            expect(response.data.data.items.map((item) => item.id)).toEqual([member.id.value]);
            expect(totalOf(response)).toBe(1);
        });

        it('should not count soft-deleted members when filtering by grupos_ids', async () => {
            // Arrange
            await TestHelper.resetSchemaAndMigrate(tenant, { searchPermissionNames: ['UsersSearchAdvanced'] });
            const member = await createUser();
            const deletedMember = await createUser();
            await addMembership(member.id.value, NEW_USERS_GROUP_ID);
            await addMembership(deletedMember.id.value, NEW_USERS_GROUP_ID);
            await TestHelper.getRequest(`${baseUrl}/${deletedMember.id.value}/delete`);
            // Con búsqueda avanzada el filtro base no es obligatorio: el total no puede depender de él.
            const criteria = {
                ...searchCriteria(),
                filter: [{ field: 'grupos_ids', operator: 'eq', value: NEW_USERS_GROUP_ID, type: 'AND' }],
            };

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/search`, criteria);

            // Assert
            expect(response.status).toBe(HTTP.OK);
            expect(response.data.data.items.map((item) => item.id)).toEqual([member.id.value]);
            expect(totalOf(response)).toBe(1);
        });
    });

    // ============================================================
    // SEARCH BY NAME
    // ============================================================
    describe('POST /searchByName - Search User by name', () => {
        beforeEach(async () => {
            await TestHelper.resetSchemaAndMigrate(tenant);
        });

        it('should find users by a case-insensitive partial name in nombres or apellidos', async () => {
            // Arrange
            const byName = await createUser({ nombres: 'Zacarías', apellido1: 'Uno', apellido2: 'Dos' });
            const bySurname = await createUser({ nombres: 'Otro', apellido1: 'Uno', apellido2: 'Zacarías' });
            await createUser({ nombres: 'Ajeno', apellido1: 'Uno', apellido2: 'Dos' });

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/searchByName`, { name: 'zacar' });

            // Assert
            expect(response.status).toBe(HTTP.OK);
            expect(response.data.data.items.map((item) => item.id).sort()).toEqual(
                [byName.id.value, bySurname.id.value].sort()
            );
            expect(response.data.metadata.count).toBe(2);
        });

        it('should not return soft-deleted users', async () => {
            // Arrange
            const user = await createUser({ nombres: 'Zacarías' });
            await TestHelper.getRequest(`${baseUrl}/${user.id.value}/delete`);

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/searchByName`, { name: 'zacar' });

            // Assert
            expect(response.status).toBe(HTTP.OK);
            expect(response.data.data.items).toEqual([]);
            expect(response.data.metadata.count).toBe(0);
        });

        it('should return 400 when name is missing', async () => {
            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/searchByName`, {});

            // Assert
            expect(response).toHaveProperty('status', HTTP.BAD_REQUEST);
        });

        it('should return 400 when name exceeds 100 characters', async () => {
            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/searchByName`, { name: 'N'.repeat(101) });

            // Assert
            expect(response).toHaveProperty('status', HTTP.BAD_REQUEST);
        });
    });

    // ============================================================
    // SESSION ALIVE
    // ============================================================
    describe('POST /session/alive - Mark the session as alive', () => {
        beforeEach(async () => {
            await TestHelper.resetSchemaAndMigrate(tenant);
        });

        it('should mark the authenticated user as seen when user_id is omitted', async () => {
            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/session/alive`, {});

            // Assert
            expect(response.status).toBe(HTTP.OK);
            expect((await findTester()).last_seen_at).not.toBeNull();
        });

        it("should accept the authenticated user's own id", async () => {
            // Arrange
            const tester = await findTester();

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/session/alive`, { user_id: tester.id });

            // Assert
            expect(response.status).toBe(HTTP.OK);
            expect((await findTester()).last_seen_at).not.toBeNull();
        });

        it('should return 401 and touch nobody when user_id belongs to another user', async () => {
            // Arrange
            const other = await createUser();

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/session/alive`, { user_id: other.id.value });

            // Assert
            expect(response).toHaveProperty('status', HTTP.UNAUTHORIZED);
            expect((await findUserBy({ id: other.id.value })).last_seen_at).toBeNull();
            expect((await findTester()).last_seen_at).toBeNull();
        });

        it('should return 400 when user_id is not a UUID', async () => {
            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/session/alive`, { user_id: 'no-es-uuid' });

            // Assert
            expect(response).toHaveProperty('status', HTTP.BAD_REQUEST);
        });

        it('should return 404 when user_id does not exist', async () => {
            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/session/alive`, { user_id: randomUUID() });

            // Assert
            expect(response).toHaveProperty('status', HTTP.NOT_FOUND);
        });
    });

    // ============================================================
    // SESSION VALIDATE GROUP
    // ============================================================
    describe('GET /session/validate-group - Validate the active group membership', () => {
        beforeEach(async () => {
            await TestHelper.resetSchemaAndMigrate(tenant);
        });

        const setTesterActiveGroup = async (groupId) =>
            repository.table().where({ email: globalTesterUser }).update({ grupo_activo: groupId });

        it('should confirm the membership when the group is the active one and the user belongs to it', async () => {
            // Arrange
            await setTesterActiveGroup(ADMIN_GROUP_ID);

            // Act
            const response = await TestHelper.getRequest(
                `${baseUrl}/session/validate-group?group_id=${ADMIN_GROUP_ID}`
            );

            // Assert
            expect(response.status).toBe(HTTP.OK);
            expect(response.data.data).toEqual({ belongs_to_group: true, current_grupo_activo: ADMIN_GROUP_ID });
        });

        it('should deny the membership without changes when the group is not the active one', async () => {
            // Arrange
            await setTesterActiveGroup(ADMIN_GROUP_ID);

            // Act
            const response = await TestHelper.getRequest(
                `${baseUrl}/session/validate-group?group_id=${NEW_USERS_GROUP_ID}`
            );

            // Assert
            expect(response.status).toBe(HTTP.OK);
            expect(response.data.data).toEqual({ belongs_to_group: false, current_grupo_activo: ADMIN_GROUP_ID });
            expect((await findTester()).grupo_activo).toBe(ADMIN_GROUP_ID);
        });

        it('should clear the active group when the user no longer belongs to it', async () => {
            // Arrange
            await setTesterActiveGroup(NEW_USERS_GROUP_ID);

            // Act
            const response = await TestHelper.getRequest(
                `${baseUrl}/session/validate-group?group_id=${NEW_USERS_GROUP_ID}`
            );

            // Assert
            expect(response.status).toBe(HTTP.OK);
            expect(response.data.data).toEqual({ belongs_to_group: false, current_grupo_activo: null });
            expect((await findTester()).grupo_activo).toBeNull();
        });

        it('should deny the membership when group_id is missing', async () => {
            // Arrange
            await setTesterActiveGroup(ADMIN_GROUP_ID);

            // Act
            const response = await TestHelper.getRequest(`${baseUrl}/session/validate-group`);

            // Assert
            expect(response.status).toBe(HTTP.OK);
            expect(response.data.data).toEqual({ belongs_to_group: false, current_grupo_activo: ADMIN_GROUP_ID });
        });
    });

    // ============================================================
    // UPDATE ACTIVE GROUP
    // ============================================================
    describe('POST /update-active-group - Change the active group', () => {
        beforeEach(async () => {
            await TestHelper.resetSchemaAndMigrate(tenant);
        });

        it("should set the authenticated user's active group", async () => {
            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/update-active-group`, {
                grupo_activo: ADMIN_GROUP_ID,
            });

            // Assert
            expect(response.status).toBe(HTTP.OK);
            expect((await findTester()).grupo_activo).toBe(ADMIN_GROUP_ID);
        });

        it('should return 400 when grupo_activo is not a UUID', async () => {
            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/update-active-group`, {
                grupo_activo: 'no-es-uuid',
            });

            // Assert
            expect(response).toHaveProperty('status', HTTP.BAD_REQUEST);
            expect((await findTester()).grupo_activo).toBeNull();
        });

        it('should return 400 when the payload has an unknown field', async () => {
            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/update-active-group`, {
                grupo_activo: ADMIN_GROUP_ID,
                is_active: StatusEnum.INACTIVE.value,
            });

            // Assert
            expect(response).toHaveProperty('status', HTTP.BAD_REQUEST);
            expect((await findTester()).grupo_activo).toBeNull();
        });

        it('should return 403 and keep the active group when the user does not belong to the group', async () => {
            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/update-active-group`, {
                grupo_activo: NEW_USERS_GROUP_ID,
            });

            // Assert
            expect(response).toHaveProperty('status', HTTP.FORBIDDEN);
            expect((await findTester()).grupo_activo).toBeNull();
        });

        it('should return 404 and keep the active group when the group does not exist', async () => {
            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/update-active-group`, {
                grupo_activo: randomUUID(),
            });

            // Assert
            expect(response).toHaveProperty('status', HTTP.NOT_FOUND);
            expect((await findTester()).grupo_activo).toBeNull();
        });
    });

    // ============================================================
    // BULK UPDATE
    // ============================================================
    describe('POST /bulk-update - Update several users at once', () => {
        beforeEach(async () => {
            await TestHelper.resetSchemaAndMigrate(tenant);
        });

        it('should update every listed user', async () => {
            // Arrange
            const first = await createUser();
            const second = await createUser();

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/bulk-update`, {
                user_ids: [first.id.value, second.id.value],
                data: { is_active: StatusEnum.INACTIVE.value },
            });

            // Assert
            expect(response.status).toBe(HTTP.OK);
            expect((await findUserBy({ id: first.id.value })).is_active).toBe(StatusEnum.INACTIVE.value);
            expect((await findUserBy({ id: second.id.value })).is_active).toBe(StatusEnum.INACTIVE.value);
        });

        it('should return 400 and update nobody when a user does not exist', async () => {
            // Arrange
            const user = await createUser();

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/bulk-update`, {
                user_ids: [user.id.value, randomUUID()],
                data: { is_active: StatusEnum.INACTIVE.value },
            });

            // Assert
            expect(response).toHaveProperty('status', HTTP.BAD_REQUEST);
            expect((await findUserBy({ id: user.id.value })).is_active).toBe(StatusEnum.ACTIVE.value);
        });

        it('should return 400 and update nobody when a listed user is soft-deleted', async () => {
            // Arrange
            const user = await createUser();
            const deleted = await createUser();
            await TestHelper.getRequest(`${baseUrl}/${deleted.id.value}/delete`);

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/bulk-update`, {
                user_ids: [user.id.value, deleted.id.value],
                data: { is_active: StatusEnum.INACTIVE.value },
            });

            // Assert
            expect(response).toHaveProperty('status', HTTP.BAD_REQUEST);
            expect((await findUserBy({ id: user.id.value })).is_active).toBe(StatusEnum.ACTIVE.value);
        });

        it('should return 400 when user_ids is empty', async () => {
            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/bulk-update`, {
                user_ids: [],
                data: { is_active: StatusEnum.INACTIVE.value },
            });

            // Assert
            expect(response).toHaveProperty('status', HTTP.BAD_REQUEST);
        });

        it('should return 400 when data is empty', async () => {
            // Arrange
            const user = await createUser();

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/bulk-update`, {
                user_ids: [user.id.value],
                data: {},
            });

            // Assert
            expect(response).toHaveProperty('status', HTTP.BAD_REQUEST);
        });

        it('should return 400 and update nobody when data has an unknown field', async () => {
            // Arrange
            const user = await createUser();

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/bulk-update`, {
                user_ids: [user.id.value],
                data: { is_active: StatusEnum.INACTIVE.value, password: 'secreta' },
            });

            // Assert
            expect(response).toHaveProperty('status', HTTP.BAD_REQUEST);
            expect((await findUserBy({ id: user.id.value })).is_active).toBe(StatusEnum.ACTIVE.value);
        });

        it('should return 404 and update nobody when rol_id does not exist', async () => {
            // Arrange
            const user = await createUser();

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/bulk-update`, {
                user_ids: [user.id.value],
                data: { rol_id: randomUUID() },
            });

            // Assert
            expect(response).toHaveProperty('status', HTTP.NOT_FOUND);
            expect((await findUserBy({ id: user.id.value })).rol_id).toBe(user.rol_id.value);
        });

        it('should return 404 and update nobody when grupo_activo does not exist', async () => {
            // Arrange
            const user = await createUser();

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/bulk-update`, {
                user_ids: [user.id.value],
                data: { grupo_activo: randomUUID() },
            });

            // Assert
            expect(response).toHaveProperty('status', HTTP.NOT_FOUND);
            expect((await findUserBy({ id: user.id.value })).grupo_activo).toBeNull();
        });
    });

    // ============================================================
    // INTEGRATION ACTIVITY
    // ============================================================
    describe('POST /:id/integration-activity - Record integration activity', () => {
        beforeEach(async () => {
            await TestHelper.resetSchemaAndMigrate(tenant);
        });

        it('should record the reported timestamp', async () => {
            // Arrange
            const user = await createUser();
            const timestamp = new Date().toISOString();

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/${user.id.value}/integration-activity`, {
                timestamp,
            });

            // Assert
            expect(response.status).toBe(HTTP.OK);
            const { last_integration_active_at: recorded } = await findUserBy({ id: user.id.value });
            expect(new Date(recorded).toISOString()).toBe(timestamp);
        });

        it('should ignore a second report inside the staleness window', async () => {
            // Arrange
            const user = await createUser();
            const firstTimestamp = new Date().toISOString();
            await TestHelper.postRequest(`${baseUrl}/${user.id.value}/integration-activity`, {
                timestamp: firstTimestamp,
            });

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/${user.id.value}/integration-activity`, {
                timestamp: new Date(Date.now() + 5000).toISOString(),
            });

            // Assert
            expect(response.status).toBe(HTTP.OK);
            const { last_integration_active_at: recorded } = await findUserBy({ id: user.id.value });
            expect(new Date(recorded).toISOString()).toBe(firstTimestamp);
        });

        it('should return 400 when timestamp is not an ISO date', async () => {
            // Arrange
            const user = await createUser();

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/${user.id.value}/integration-activity`, {
                timestamp: 'ayer',
            });

            // Assert
            expect(response).toHaveProperty('status', HTTP.BAD_REQUEST);
        });

        it('should return 400 when the id is not a UUID', async () => {
            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/invalid-uuid/integration-activity`, {
                timestamp: new Date().toISOString(),
            });

            // Assert
            expect(response).toHaveProperty('status', HTTP.BAD_REQUEST);
        });

        it('should return 400 when the user does not exist', async () => {
            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/${randomUUID()}/integration-activity`, {
                timestamp: new Date().toISOString(),
            });

            // Assert
            expect(response).toHaveProperty('status', HTTP.BAD_REQUEST);
        });
    });

    // ============================================================
    // HISTORY
    // ============================================================
    describe('POST /:id/history - Search the change history', () => {
        beforeEach(async () => {
            await TestHelper.resetSchemaAndMigrate(tenant);
        });

        it('should return the changes made through the API with their author', async () => {
            // Arrange
            const user = await createUser();
            await TestHelper.postRequest(`${baseUrl}/${user.id.value}`, updatePayload({ nombres: 'Historiado' }));
            const tester = await findTester();

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/${user.id.value}/history`, historyCriteria());

            // Assert
            expect(response.status).toBe(HTTP.OK);
            expect(response.data.metadata.count).toBe(1);
            const [entry] = response.data.data.items;
            expect(entry.entity_id).toBe(user.id.value);
            expect(entry.changed_attributes).toMatchObject({ nombres: 'Historiado', updated_by: tester.id });
            expect(entry.creator_name).toBe(`${tester.nombres} ${tester.apellido1}`);
        });

        it('should return an empty history for a user without changes', async () => {
            // Arrange
            const user = await createUser();

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/${user.id.value}/history`, historyCriteria());

            // Assert
            expect(response.status).toBe(HTTP.OK);
            expect(response.data.data.items).toEqual([]);
            expect(response.data.metadata.count).toBe(0);
        });

        it('should return 400 when the search payload is invalid', async () => {
            // Arrange
            const user = await createUser();

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/${user.id.value}/history`, {
                ...historyCriteria(),
                limit: 'not-a-number',
            });

            // Assert
            expect(response).toHaveProperty('status', HTTP.BAD_REQUEST);
        });
    });

    // ============================================================
    // ROUTES USERS DOES NOT EXPOSE
    // ============================================================
    // Without their own resource, API Gateway routes these paths to POST /{id}, which rejects the id.
    describe('Routes users does not expose', () => {
        beforeEach(async () => {
            await TestHelper.resetSchemaAndMigrate(tenant);
        });

        it('should answer POST /advance-search as an update with an invalid id, returning no users', async () => {
            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/advance-search`, {
                filter: null,
                limit: 10,
                offset: 0,
            });

            // Assert
            expect(response).toHaveProperty('status', HTTP.BAD_REQUEST);
            expect(response.response.data.data).toEqual({ code: expect.any(String) });
        });

        it('should answer POST /session as an update with an invalid id', async () => {
            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/session`, {});

            // Assert
            expect(response).toHaveProperty('status', HTTP.BAD_REQUEST);
        });
    });

    // ============================================================
    // ERROR HANDLING AND EDGE CASES
    // ============================================================
    describe('Error handling and edge cases', () => {
        beforeEach(async () => {
            await TestHelper.resetSchemaAndMigrate(tenant);
        });

        it('should return 403 when the route does not exist', async () => {
            // Act
            const response = await TestHelper.getRequest(`${baseUrl}/${randomUUID()}/invalid`);

            // Assert
            expect(response).toHaveProperty('status', HTTP.FORBIDDEN);
        });

        it('should return 400 when a path segment is not a UUID', async () => {
            // Act
            const response = await TestHelper.getRequest(`${baseUrl}/123-456-789`);

            // Assert
            expect(response).toHaveProperty('status', HTTP.BAD_REQUEST);
        });

        it('should return 400 when nombres is a very long string', async () => {
            // Arrange
            const payload = createPayload({ nombres: 'A'.repeat(10000) });

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response).toHaveProperty('status', HTTP.BAD_REQUEST);
        });

        it('should create the user when the optional fields are omitted', async () => {
            // Arrange
            const payload = createPayload();
            delete payload.apellido2;
            delete payload.telefono;
            delete payload.movil;

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response.status).toBe(HTTP.CREATED);
            expect(await findUserBy({ id: response.data.data.id })).toMatchObject({
                apellido2: null,
                telefono: null,
                movil: null,
            });
        });

        it('should create the user when external_id is null', async () => {
            // Arrange
            const payload = createPayload({ external_id: null });

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response.status).toBe(HTTP.CREATED);
        });

        it('should return 400 when apellido2 is null', async () => {
            // Arrange
            const payload = createPayload({ apellido2: null });

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response).toHaveProperty('status', HTTP.BAD_REQUEST);
        });

        it('should store SQL injection in nombres as a literal and keep the table intact', async () => {
            // Arrange
            const injection = "'; DROP TABLE usuarios; --";
            const payload = createPayload({ nombres: injection });

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response.status).toBe(HTTP.CREATED);
            expect((await findUserBy({ id: response.data.data.id })).nombres).toBe(injection);
            expect(await countUsersBy({})).toBe(SEEDED_USERS_COUNT + 1);
        });

        it('should treat SQL injection in a search value as a literal', async () => {
            // Arrange
            await createUser();
            const criteria = searchCriteria({
                filter: [{ field: 'login', operator: 'ilike', value: "%'; DROP TABLE usuarios; --", type: 'AND' }],
            });

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/search`, criteria);

            // Assert
            expect(response.status).toBe(HTTP.OK);
            expect(response.data.data.items).toEqual([]);
            expect(await countUsersBy({})).toBe(SEEDED_USERS_COUNT + 1);
        });

        it('should return 400 when nombres carries an XSS payload', async () => {
            // Arrange
            const payload = createPayload({ nombres: "<script>alert('XSS')</script>" });

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response).toHaveProperty('status', HTTP.BAD_REQUEST);
            expect(await findUserBy({ login: payload.login })).toBeUndefined();
        });
    });

    // ============================================================
    // DATA INTEGRITY AND CONSISTENCY
    // ============================================================
    describe('Data integrity and consistency', () => {
        beforeEach(async () => {
            await TestHelper.resetSchemaAndMigrate(tenant);
        });

        it('should apply exactly one of two concurrent updates', async () => {
            // Arrange
            const user = await createUser();

            // Act
            const responses = await Promise.all([
                TestHelper.postRequest(`${baseUrl}/${user.id.value}`, updatePayload({ nombres: 'Primero' })),
                TestHelper.postRequest(`${baseUrl}/${user.id.value}`, updatePayload({ nombres: 'Segundo' })),
            ]);

            // Assert
            expect(responses.map((response) => response.status)).toEqual([HTTP.OK, HTTP.OK]);
            expect(['Primero', 'Segundo']).toContain((await findUserBy({ id: user.id.value })).nombres);
        });
    });
});
