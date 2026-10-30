const connection = {
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
};

import { schema, serviceName } from './env-config.js';
export { schema, serviceName };
const setSchema = (conn, done) => {
    conn.query('SET timezone="UTC";', done);
    conn.query(`CREATE SCHEMA IF NOT EXISTS ${schema};`, done);
    conn.query(`SET search_path TO ${schema};`, done);
};

export const development = {
    client: 'pg',
    pool: {
        min: 0,
        max: 1,
        idleTimeoutMillis: 30000,
        afterCreate: setSchema,
    },
    migrations: {
        tableName: 'knex_migrations',
        directory: './migrations',
    },
    seeds: {
        directory: './seeds',
    },
    connection: { ...connection },
    schema: schema,
};

export const production = {
    client: 'pg',
    pool: {
        min: 0,
        max: 1,
        idleTimeoutMillis: 30000,
        afterCreate: setSchema,
    },
    connection: { ...connection },
    migrations: {
        tableName: 'knex_migrations',
        directory: './node_modules/@kace/database/migrations',
    },
    seeds: {
        directory: './node_modules/@kace/database/seeds',
    },
    schema: schema,
};

export const testing = {
    client: 'sqlite3',
    connection: {
        filename: ':memory:',
    },
    useNullAsDefault: true,
    migrations: {
        tableName: 'knex_migrations',
        directory: './node_modules/@kace/database/migrations',
    },
    seeds: {
        directory: './node_modules/@kace/database/seeds',
    },
};

export const testSqlite = {
    client: 'sqlite3',
    connection: {
        filename: './test.sqlite',
    },
    useNullAsDefault: true,
    migrations: {
        tableName: 'knex_migrations',
        directory: './migrations',
    },
    seeds: {
        directory: './seeds',
    },
};

export const testPostgres = {
    client: 'pg',
    pool: {
        min: 2,
        max: 50,
        afterCreate: (conn, done) => {
            conn.query('SET timezone="UTC";', done);
            conn.query(`CREATE SCHEMA IF NOT EXISTS test_${schema};`, done);
            conn.query(`SET search_path TO test_${schema};`, done);
        },
    },
    migrations: {
        tableName: 'knex_migrations',
        directory: './migrations',
    },
    seeds: {
        directory: './seeds',
    },
    connection: {
        host: process.env.DB_TEST_HOST || process.env.DB_HOST,
        database: process.env.DB_TEST_DATABASE || process.env.DB_DATABASE,
        user: process.env.DB_TEST_USER || process.env.DB_USER,
        password: process.env.DB_TEST_PASSWORD || process.env.DB_PASSWORD,
        port: process.env.DB_TEST_PORT || process.env.DB_PORT,
    },
    schema: `test_${schema}`,
};

export const auxKnexInstance = {
    client: 'pg',
    connection: {
        host: process.env.DB_HOST,
        user: process.env.DB_AUXILIAR_USER,
        password: process.env.DB_AUXILIAR_PASSWORD,
        database: process.env.DB_DATABASE,
        port: process.env.DB_PORT,
    },
    searchPath: [process.env.DB_SCHEMA],
    pool: {
        min: 0,
        max: 1,
        idleTimeoutMillis: 30000,
    },
    schema: schema,
};

export const knexConfig = production;
export {
    globalUserId,
    globalRoleId,
    globalRoleIdZeroTrust,
    globalTesterUser,
} from './seeds/20241125105900_usuario_base.js';
