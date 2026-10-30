import { describe, it, expect } from '@jest/globals';
import { buildConnectionsFromEnv } from '../../src/config/env-config-provider.js';

const fullEnv = () => ({
    DB_SYNC_SOURCE_HOST: 'localhost',
    DB_SYNC_SOURCE_PORT: '5433',
    DB_SYNC_SOURCE_USER: 'lector',
    DB_SYNC_SOURCE_PASSWORD: 'secreto',
    DB_SYNC_TARGET_HOST: 'localhost',
    DB_SYNC_TARGET_PORT: '5434',
    DB_SYNC_TARGET_USER: 'escritor',
    DB_SYNC_TARGET_PASSWORD: 'otro',
});

const config = {
    source: { database: 'sura', schema: 'asistencia' },
    target: { database: 'staging', schema: 'staging_asistencia' },
};

describe('buildConnectionsFromEnv', () => {
    it('should build both connections from the environment and the config file', () => {
        const result = buildConnectionsFromEnv(config, fullEnv());

        expect(result.source).toEqual({
            client: 'pg',
            connection: {
                host: 'localhost',
                port: 5433,
                user: 'lector',
                password: 'secreto',
                database: 'sura',
            },
            pool: { min: 0, max: 2 },
        });
        expect(result.target.connection.database).toBe('staging');
        expect(result.target.connection.port).toBe(5434);
    });

    it('should default the port to 5432 when not provided', () => {
        const env = fullEnv();
        delete env.DB_SYNC_SOURCE_PORT;

        expect(buildConnectionsFromEnv(config, env).source.connection.port).toBe(5432);
    });

    it('should list every missing variable in a single error', () => {
        const env = fullEnv();
        delete env.DB_SYNC_SOURCE_HOST;
        delete env.DB_SYNC_TARGET_USER;

        expect(() => buildConnectionsFromEnv(config, env)).toThrow(
            'Missing environment variables: DB_SYNC_SOURCE_HOST, DB_SYNC_TARGET_USER'
        );
    });

    it('should treat an empty string as a missing variable', () => {
        const env = fullEnv();
        env.DB_SYNC_SOURCE_PASSWORD = '';

        expect(() => buildConnectionsFromEnv(config, env)).toThrow(
            'Missing environment variables: DB_SYNC_SOURCE_PASSWORD'
        );
    });

    it('should reject a non-numeric port instead of silently defaulting it', () => {
        const env = fullEnv();
        env.DB_SYNC_SOURCE_PORT = '543a';

        expect(() => buildConnectionsFromEnv(config, env)).toThrow(
            'Invalid DB_SYNC_SOURCE_PORT: "543a" is not a port number'
        );
    });

    it('should reject a port that is out of range', () => {
        const env = fullEnv();
        env.DB_SYNC_TARGET_PORT = '70000';

        expect(() => buildConnectionsFromEnv(config, env)).toThrow(
            'Invalid DB_SYNC_TARGET_PORT: "70000" is not a port number'
        );
    });

    it('should reject a fractional port', () => {
        const env = fullEnv();
        env.DB_SYNC_SOURCE_PORT = '5432.5';

        expect(() => buildConnectionsFromEnv(config, env)).toThrow(
            'Invalid DB_SYNC_SOURCE_PORT: "5432.5" is not a port number'
        );
    });

    it.each([
        'DB_SYNC_SOURCE_HOST',
        'DB_SYNC_SOURCE_USER',
        'DB_SYNC_SOURCE_PASSWORD',
        'DB_SYNC_TARGET_HOST',
        'DB_SYNC_TARGET_USER',
        'DB_SYNC_TARGET_PASSWORD',
    ])('should require %s', (variableName) => {
        const env = fullEnv();
        delete env[variableName];

        expect(() => buildConnectionsFromEnv(config, env)).toThrow(variableName);
    });
});
