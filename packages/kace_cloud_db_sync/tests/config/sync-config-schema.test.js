import { describe, it, expect } from '@jest/globals';
import { validateSyncConfig } from '../../src/config/sync-config-schema.js';

const validConfig = () => ({
    source: { database: 'sura', schema: 'asistencia' },
    target: { database: 'staging', schema: 'staging_asistencia' },
    tables: [{ name: 'clientes' }],
});

describe('validateSyncConfig', () => {
    it('should accept a minimal configuration and default the batch size', () => {
        const result = validateSyncConfig(validConfig());

        expect(result.batchSize).toBe(500);
        expect(result.tables).toEqual([{ name: 'clientes' }]);
    });

    it('should accept optional per-table where and targetName', () => {
        const config = validConfig();
        config.tables = [{ name: 'casos', targetName: 'casos_prod', where: 'activo = true' }];

        const result = validateSyncConfig(config);

        expect(result.tables[0]).toEqual({ name: 'casos', targetName: 'casos_prod', where: 'activo = true' });
    });

    it('should accept a hyphenated table name', () => {
        const config = validConfig();
        config.tables = [{ name: 'one-script' }];

        expect(validateSyncConfig(config).tables[0].name).toBe('one-script');
    });

    it('should reject a table name that is not a valid identifier', () => {
        const config = validConfig();
        config.tables = [{ name: 'clientes; drop table usuarios' }];

        expect(() => validateSyncConfig(config)).toThrow(/Invalid sync config/);
    });

    it('should reject an empty table list', () => {
        const config = validConfig();
        config.tables = [];

        expect(() => validateSyncConfig(config)).toThrow(/Invalid sync config/);
    });

    it('should reject a missing source', () => {
        const config = validConfig();
        delete config.source;

        expect(() => validateSyncConfig(config)).toThrow(/Invalid sync config/);
    });

    it('should reject an undefined configuration', () => {
        expect(() => validateSyncConfig(undefined)).toThrow(/Invalid sync config/);
    });

    it('should reject unknown keys so typos surface immediately', () => {
        const config = validConfig();
        config.tables = [{ name: 'clientes', wher: 'activo = true' }];

        expect(() => validateSyncConfig(config)).toThrow(/Invalid sync config/);
    });

    it('should reject a non-positive batch size', () => {
        const config = validConfig();
        config.batchSize = 0;

        expect(() => validateSyncConfig(config)).toThrow(/Invalid sync config/);
    });
});
