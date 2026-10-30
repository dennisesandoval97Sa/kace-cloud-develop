import axios from 'axios';
import { ListPermissions } from '@kace/core/src/role/domain/ListPermissions.js';
import knex from 'knex';
import { Helper, ValueObjectUuid } from '@kace/core/src/shared/index.js';
import LocalTenantRepository from '@kace/core/src/tenant/infrastructure/local/LocalTenantRepository.js';
import { IdpCognito } from '@kace/core/src/auth-cognito/infraestructure/idps/IdpCognito.js';
import process from 'node:process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { KnexRoleRepository } from '@kace/core/src/role/infrastructure/persistence/KnexRoleRepository.js';
import { globalRoleId } from '@kace/database/seeds/20241125105900_usuario_base.js';

const defaultConfig = async () => {
    return {
        headers: {
            'X-Client-Fingerprint': process.env.APPS_CLIENT_FINGERPRINT,
            'Content-Type': 'application/json',
            Authorization: await TestHelper.authorizationToken(),
            'x-client-fingerprint': process.env.TEST_CLIENT_FINGERPRINT || 'test-fingerprint',
            'X-Tenant-Id': process.env.TEST_TENANT_ID || ValueObjectUuid.random(),
        },
    };
};

const SAFE_RESET_SCHEMA_PATTERN = /^(test_|tmp_|ci_|kace_test($|_)|.*_w\d+$)/;

function assertCanResetSchema(schemaName) {
    const allowReset = process.env.ALLOW_SCHEMA_RESET === 'true';
    const safeSchema = SAFE_RESET_SCHEMA_PATTERN.test(schemaName ?? '');

    if (!allowReset || !safeSchema) {
        throw new Error(
            `Refusing to reset schema "${schemaName}". Set ALLOW_SCHEMA_RESET=true and use a disposable test schema.`
        );
    }
}

export class TestHelper {
    static async getRequest(url, config) {
        const dftConfig = await defaultConfig();
        try {
            return await axios.get(url, { ...dftConfig, ...config });
        } catch (e) {
            Helper.logError(e?.response?.data ?? e);
            return e;
        }
    }

    static async postRequest(url, data, config) {
        const dftConfig = await defaultConfig();

        try {
            return await axios.post(url, data, { ...dftConfig, ...config });
        } catch (e) {
            Helper.logError(e?.response?.data ?? e);
            return e;
        }
    }

    static async setupAxiosInterceptors() {}

    /**
     * Resets the database schema for the specified tenant, applies migrations, seeds data,
     * and sets up initial roles and users.
     *
     * @param {Tenant} tenant - The tenant object containing configuration details for database connection.
     * @param {Object} [options] - Optional test-role permission overrides.
     * @param {string[]} [options.searchPermissionNames=[]] - Search permission names to grant to the test role.
     * @return {Promise<void>} Resolves when the schema has been reset, migrations and seeds are applied, and initial data is set up.
     */
    static async resetSchemaAndMigrate(tenant, { searchPermissionNames = [] } = {}) {
        const knexConfig = tenant.buildKnexConfig();
        /*
         * Remove searchPath so KnexRepository relies on schema-qualified names only,
         * mirroring production behavior behind RDS Proxy.
         */
        delete knexConfig.searchPath;
        knexConfig.migrations = {
            tableName: 'knex_migrations',
            directory: './node_modules/@kace/database/migrations',
        };
        knexConfig.seeds = {
            directory: './node_modules/@kace/database/seeds',
        };

        const schemaName = tenant.db_schema.value;
        assertCanResetSchema(schemaName);

        const db = knex(knexConfig);

        try {
            await db.raw(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
            Helper.logInfo(`Esquema "${schemaName}" eliminado (con CASCADE).`);

            await db.raw(`CREATE SCHEMA ${schemaName}`);
            Helper.logInfo(`Esquema "${schemaName}" recreado.`);

            await db.raw(`SET search_path TO ${schemaName}`);

            /*
             * knex's migrate.latest() imports every migration at once (Promise.all). Under Jest's
             * --experimental-vm-modules that concurrent linking fails with "request for 'dotenv' is
             * from a module not been linked", so load them one by one first and let knex hit the cache.
             */
            const [, pendingMigrations] = await db.migrate.list();
            for (const { file, directory } of pendingMigrations) {
                await import(pathToFileURL(path.resolve(directory, file)).href);
            }

            await db.migrate.latest();
            Helper.logInfo('Migraciones ejecutadas con éxito.');

            await db.seed.run();
            Helper.logInfo('Datos sembrados con éxito.');

            /*
             * Force search_path=public to detect unqualified queries,
             * mirroring production behavior behind RDS Proxy.
             */
            await db.raw('SET search_path TO public');

            const permissions = new ListPermissions().toPrimivites();

            permissions.agente.forEach((permiso) => {
                permiso.granted = true;
            });
            permissions.administrador.forEach((permiso) => {
                permiso.granted = true;
            });
            const requestedSearchPermissions = new Set(searchPermissionNames);
            permissions.search.forEach((permission) => {
                permission.granted = requestedSearchPermissions.has(permission.name);
            });
            const missingSearchPermissions = [...requestedSearchPermissions].filter(
                (name) => !permissions.search.some((permission) => permission.name === name)
            );
            if (missingSearchPermissions.length > 0) {
                throw new Error(`Unknown search permissions: ${missingSearchPermissions.join(', ')}`);
            }

            const roleRepository = new KnexRoleRepository(knexConfig);
            const rol = await roleRepository.find(new ValueObjectUuid('id', globalRoleId));
            rol.permisos = permissions;
            await roleRepository.update(rol);
        } catch (error) {
            console.error('FULL MIGRATION ERROR STACK:', error.stack || error); // eslint-disable-line no-console
            Helper.logError(error.message, error);
            Helper.logError('Error al reiniciar el esquema y ejecutar migraciones:', error);
            throw error;
        } finally {
            await db.destroy();
        }
    }

    /**
     * Retrieves a tenant using a randomly generated UUID.
     *
     * This method creates an instance of `LocalTenantRepository` to perform the retrieval.
     * The operation is asynchronous and resolves with the tenant's data if found.
     *
     * @return {Promise<Tenant>} A promise that resolves to the tenant object retrieved from the repository.
     */
    static async getTenant() {
        const repository = new LocalTenantRepository();
        return await repository.find(ValueObjectUuid.random());
    }

    static async authenticate() {
        const idp = new IdpCognito({
            region: process.env.AWS_COGNITO_REGION,
            clientId: process.env.AWS_COGNITO_APP_CLIENT_ID,
        });
        const serviceAccount = {
            username: process.env.TEST_APP_USER,
            password: process.env.TEST_APP_PASSWORD,
        };
        return await idp.authenticate(serviceAccount);
    }

    static async authorizationToken() {
        const tokens = await TestHelper.authenticate();
        return tokens.IdToken;
    }
}
