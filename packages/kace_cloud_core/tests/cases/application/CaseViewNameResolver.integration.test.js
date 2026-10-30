import { jest } from '@jest/globals';
import { knexConfig } from '../../knexfile.js';
import { KnexCaseRepository } from '../../../src/cases/index.js';
import { CaseViewNameResolver } from '../../../src/cases/application/view-resolver/CaseViewNameResolver.js';
import { CASES_DEFAULT_VIEW } from '../../../src/cases/constants.js';

const CUSTOM_VIEW = 'view_custom_cases';

const buildGlobalConfig = ({ enable_custom_view = false, custom_view_name = '' } = {}) => ({
    settings: {
        layouts: {
            getConfig: jest.fn((app, module) => {
                if (app === 'admin' && module === 'cases') {
                    return { enable_custom_view, custom_view_name };
                }
                return null;
            }),
        },
    },
});

describe('CaseViewNameResolver Integration Test', () => {
    const caseRepository = new KnexCaseRepository(knexConfig);
    const connection = caseRepository.connection;

    // Las migraciones crean CASES_DEFAULT_VIEW, pero eso solo explica de donde
    // sale la vista la primera vez: los dos ultimos tests le hacen DROP VIEW y
    // no la recrean. Lo que la repone antes de cada test es el reset por test
    // (`tests/support/testDatabaseReset.js`), que guarda la definicion de las
    // vistas de la plantilla en el manifiesto y vuelve a crear las que faltan.
    // Este comentario decia que las migraciones bastaban y era falso: hasta que
    // el reset aprendio a reponerlas, el primer DROP dejaba la vista borrada
    // para todos los tests siguientes del archivo.

    afterEach(async () => {
        await connection.raw(`DROP VIEW IF EXISTS ${CUSTOM_VIEW}`);
    });

    it('returns the custom view when it is enabled and exists in DB', async () => {
        await connection.raw(`CREATE VIEW ${CUSTOM_VIEW} AS SELECT 1 AS id`);

        const resolver = new CaseViewNameResolver(connection);
        const globalConfig = buildGlobalConfig({ enable_custom_view: true, custom_view_name: CUSTOM_VIEW });

        const result = await resolver.resolve(globalConfig);

        expect(result).toBe(CUSTOM_VIEW);
    });

    it('falls back to default view when custom view is enabled but does not exist in DB', async () => {
        const resolver = new CaseViewNameResolver(connection);
        const globalConfig = buildGlobalConfig({ enable_custom_view: true, custom_view_name: CUSTOM_VIEW });

        const result = await resolver.resolve(globalConfig);

        expect(result).toBe(CASES_DEFAULT_VIEW);
    });

    it('returns default view when custom view is disabled and default exists', async () => {
        const resolver = new CaseViewNameResolver(connection);
        const globalConfig = buildGlobalConfig({ enable_custom_view: false, custom_view_name: CUSTOM_VIEW });

        const result = await resolver.resolve(globalConfig);

        expect(result).toBe(CASES_DEFAULT_VIEW);
    });

    it('returns custom view and ignores default when both exist in DB', async () => {
        await connection.raw(`CREATE VIEW ${CUSTOM_VIEW} AS SELECT 1 AS id`);

        const resolver = new CaseViewNameResolver(connection);
        const globalConfig = buildGlobalConfig({ enable_custom_view: true, custom_view_name: CUSTOM_VIEW });

        const result = await resolver.resolve(globalConfig);

        expect(result).toBe(CUSTOM_VIEW);
    });

    it('throws CustomError when neither custom view nor default view exist in DB', async () => {
        await connection.raw(`DROP VIEW IF EXISTS ${CASES_DEFAULT_VIEW}`);

        const resolver = new CaseViewNameResolver(connection);
        const globalConfig = buildGlobalConfig({ enable_custom_view: true, custom_view_name: CUSTOM_VIEW });

        await expect(resolver.resolve(globalConfig)).rejects.toThrow(/No valid cases view found/);
    });

    it('throws CustomError when no custom view is configured and default does not exist in DB', async () => {
        await connection.raw(`DROP VIEW IF EXISTS ${CASES_DEFAULT_VIEW}`);

        const resolver = new CaseViewNameResolver(connection);
        const globalConfig = buildGlobalConfig({ enable_custom_view: false });

        await expect(resolver.resolve(globalConfig)).rejects.toThrow(/No valid cases view found/);
    });
});
