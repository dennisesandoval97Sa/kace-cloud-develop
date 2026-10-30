import { knexConfig } from '../../../knexfile.js';
import { KnexRepository } from '../../../../src/shared/index.js';
import { AdvancedSearch } from '../../../../src/shared/domain/services/AdvancedSearch.js';
import CasesMother from '../../../cases/domain/CasesMother.js';
import { KnexCaseRepository } from '../../../../src/cases/index.js';

// Los cuatro primeros `it` sembraban sus casos SIN esperar a `createCase`. De
// ahi salian dos fallos distintos:
//
// 1. El propio `it` buscaba antes de que sus inserts hubieran llegado, y
//    contaba 0 filas en vez de 2, 2 y 11.
// 2. Los inserts sobrevivian al `it` que los lanzo. `createCase` termina en
//    `saveHistory`, o sea un INSERT en `history_cases`, y ese INSERT seguia en
//    vuelo cuando el `beforeEach` del test siguiente lanzaba su
//    `TRUNCATE ... CASCADE`. Interbloqueo medido contra el log del servidor:
//    el INSERT tiene RowExclusiveLock sobre `history_cases_default` y pide
//    RowShareLock sobre `cases` -la comprobacion de la clave foranea-,
//    mientras el TRUNCATE ya tiene AccessExclusiveLock sobre `cases` -que
//    entra por el CASCADE- y pide el de la particion. Postgres mata al INSERT,
//    y jest apunta la rotura contra el `it` que estaba corriendo, no contra el
//    que dejo la promesa suelta.
describe('AdvancedSearchIntegration', () => {
    const repository = new KnexRepository(knexConfig);
    const caseRepository = new KnexCaseRepository(knexConfig);
    const advanceSearch = new AdvancedSearch(repository);

    it('get cases with all advances filters conditions', async () => {
        const dtoCriteria = {
            select: ['cases.alto_impacto', 'cases.vista', 'cases.external_code', 'cases.motivo_baja'],
            group_by: ['cases.external_code'],
            having: [{ column: 'cases.motivo_baja', operator: 'eq', value: 'cliente cancela' }],
        };
        const tableName = 'cases';

        for (let i = 0; i <= 10; i++) {
            const externalCode = i % 2 === 1 ? 1 : 0;
            if (i === 0) {
                await CasesMother.createCase(caseRepository, {
                    motivo_baja: 'cliente cancela',
                    external_code: externalCode.toString(),
                });
            } else {
                await CasesMother.createCase(caseRepository, { external_code: externalCode.toString() });
            }
        }

        const results = await advanceSearch.execute(dtoCriteria, tableName);

        const cases = results.data.items;

        expect(cases.length).toBe(1);
        expect(cases[0].motivo_baja).toBe('cliente cancela');
    });

    it('get cases with select and goup by conditions', async () => {
        const dtoCriteria = {
            select: ['cases.alto_impacto', 'cases.vista', 'cases.external_code', 'cases.motivo_baja'],
            group_by: ['cases.external_code'],
        };
        const tableName = 'cases';

        for (let i = 0; i <= 10; i++) {
            const externalCode = i % 2 === 1 ? 1 : 0;
            await CasesMother.createCase(caseRepository, { external_code: externalCode.toString() });
        }

        const results = await advanceSearch.execute(dtoCriteria, tableName);

        const cases = results.data.items;

        expect(cases.length).toBe(2);
    });

    it('get cases with select and distinct conditions', async () => {
        const dtoCriteria = {
            select: ['cases.alto_impacto', 'cases.vista', 'cases.external_code', 'cases.motivo_baja'],
            distinct: true,
        };
        const tableName = 'cases';

        for (let i = 0; i <= 10; i++) {
            const externalCode = i % 2 === 1 ? 1 : 0;
            await CasesMother.createCase(caseRepository, { external_code: externalCode.toString() });
        }

        const results = await advanceSearch.execute(dtoCriteria, tableName);

        const cases = results.data.items;

        expect(cases.length).toBe(2);
    });

    it('get cases with select condition', async () => {
        const dtoCriteria = {
            select: ['cases.alto_impacto', 'cases.vista', 'cases.external_code', 'cases.motivo_baja'],
        };
        const tableName = 'cases';

        for (let i = 0; i <= 10; i++) {
            const externalCode = i % 2 === 1 ? 1 : 0;
            await CasesMother.createCase(caseRepository, { external_code: externalCode.toString() });
        }

        const results = await advanceSearch.execute(dtoCriteria, tableName);

        const cases = results.data.items;
        expect(cases.length).toBe(11);
    });

    it('returns metadata.count with the total matching records, independent of limit/offset', async () => {
        const tableName = 'cases';
        const totalCases = 10;

        for (let i = 0; i < totalCases; i++) {
            await CasesMother.createCase(caseRepository, { external_code: i.toString() });
        }

        const paginated = await advanceSearch.execute({ limit: 3, offset: 0 }, tableName);

        expect(paginated.data.items.length).toBe(3);
        expect(paginated.metadata.count).toBe(totalCases);

        const offsetPage = await advanceSearch.execute({ limit: 50, offset: 6 }, tableName);

        expect(offsetPage.data.items.length).toBe(4);
        expect(offsetPage.metadata.count).toBe(totalCases);
    });

    it('returns metadata.count as the total when payload includes select', async () => {
        const tableName = 'cases';
        const totalCases = 7;

        for (let i = 0; i < totalCases; i++) {
            await CasesMother.createCase(caseRepository, { external_code: i.toString() });
        }

        const result = await advanceSearch.execute(
            {
                select: ['cases.id', 'cases.external_code'],
                limit: 2,
                offset: 0,
            },
            tableName
        );

        expect(result.data.items.length).toBe(2);
        expect(result.metadata.count).toBe(totalCases);
    });

    it('returns metadata.count as the number of groups when payload includes group_by', async () => {
        const tableName = 'cases';

        for (let i = 0; i < 10; i++) {
            const externalCode = i % 3;
            await CasesMother.createCase(caseRepository, { external_code: externalCode.toString() });
        }

        const result = await advanceSearch.execute(
            {
                select: ['cases.external_code'],
                group_by: ['cases.external_code'],
            },
            tableName
        );

        expect(result.metadata.count).toBe(3);
    });

    it('returns metadata.count as the number of distinct rows when payload includes distinct', async () => {
        const tableName = 'cases';

        for (let i = 0; i < 8; i++) {
            const externalCode = i % 2;
            await CasesMother.createCase(caseRepository, { external_code: externalCode.toString() });
        }

        const result = await advanceSearch.execute(
            {
                select: ['cases.external_code'],
                distinct: true,
            },
            tableName
        );

        expect(result.metadata.count).toBe(2);
    });

    it('returns metadata.count as a number, not a string', async () => {
        const tableName = 'cases';

        for (let i = 0; i < 3; i++) {
            await CasesMother.createCase(caseRepository, { external_code: i.toString() });
        }

        const result = await advanceSearch.execute({}, tableName);

        expect(typeof result.metadata.count).toBe('number');
        expect(result.metadata.count).toBe(3);
    });
});
