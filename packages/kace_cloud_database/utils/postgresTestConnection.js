export function postgresConnection() {
    const required = ['DB_TEST_HOST', 'DB_TEST_PORT', 'DB_TEST_USER', 'DB_TEST_PASSWORD', 'DB_TEST_DATABASE'];
    const missing = required.filter((name) => !process.env[name]);
    if (missing.length) {
        throw new Error(
            `PostgreSQL migration tests require ${missing.join(', ')}. Set them in the environment or root .env and run pnpm --filter @kace/database test:unit.`
        );
    }

    return {
        host: process.env.DB_TEST_HOST,
        port: Number(process.env.DB_TEST_PORT),
        user: process.env.DB_TEST_USER,
        password: process.env.DB_TEST_PASSWORD,
        database: process.env.DB_TEST_DATABASE,
    };
}
