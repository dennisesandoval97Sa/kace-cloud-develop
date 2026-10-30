const REQUIRED_VARIABLES = [
    'DB_SYNC_SOURCE_HOST',
    'DB_SYNC_SOURCE_USER',
    'DB_SYNC_SOURCE_PASSWORD',
    'DB_SYNC_TARGET_HOST',
    'DB_SYNC_TARGET_USER',
    'DB_SYNC_TARGET_PASSWORD',
];

// pg does not reject an invalid/NaN port: it silently falls back to its own default (5432). A typo in
// DB_SYNC_*_PORT would therefore connect to whatever Postgres happens to be listening on 5432 locally
// (often the operator's own dev database) instead of failing — the worst failure mode for a tool whose
// job is writing rows into a target database. Fail fast here instead.
const parsePort = (value, variable) => {
    if (value === undefined) {
        return 5432;
    }

    const port = Number(value);

    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error(`Invalid ${variable}: "${value}" is not a port number`);
    }

    return port;
};

const buildKnexConfig = ({ host, port, portVariable, user, password, database }) => ({
    client: 'pg',
    connection: {
        host,
        port: parsePort(port, portVariable),
        user,
        password,
        database,
    },
    // max >= 2 y DOS instancias Knex separadas (una por lado) no son negociables: TableSyncService
    // lee del origen DENTRO de una transacción abierta en el destino. Si ambos lados compartieran
    // una instancia con pool max 1, cada lectura de página esperaría por la conexión que retiene la
    // transacción → cuelgue de 60s con "Timeout acquiring a connection". Reproducido.
    pool: { min: 0, max: 2 },
});

/**
 * Builds the source and target Knex configurations from environment variables.
 *
 * Credentials come from the environment; database names come from the config file.
 *
 * @param {Object} config - Validated sync configuration.
 * @param {Object} [env=process.env] - Environment variables source.
 * @returns {{source: Object, target: Object}} Knex configurations for both sides.
 * @throws {Error} When any required variable is missing, or when a port variable is set but is not a
 *   valid port number (1-65535).
 */
export const buildConnectionsFromEnv = (config, env = process.env) => {
    const missing = REQUIRED_VARIABLES.filter((name) => !env[name]);

    if (missing.length > 0) {
        throw new Error(`Missing environment variables: ${missing.join(', ')}`);
    }

    return {
        source: buildKnexConfig({
            host: env.DB_SYNC_SOURCE_HOST,
            port: env.DB_SYNC_SOURCE_PORT,
            portVariable: 'DB_SYNC_SOURCE_PORT',
            user: env.DB_SYNC_SOURCE_USER,
            password: env.DB_SYNC_SOURCE_PASSWORD,
            database: config.source.database,
        }),
        target: buildKnexConfig({
            host: env.DB_SYNC_TARGET_HOST,
            port: env.DB_SYNC_TARGET_PORT,
            portVariable: 'DB_SYNC_TARGET_PORT',
            user: env.DB_SYNC_TARGET_USER,
            password: env.DB_SYNC_TARGET_PASSWORD,
            database: config.target.database,
        }),
    };
};
