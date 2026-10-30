import { knexConfig } from '../../knexfile.js';
import TestHelper from '../../TestHelper.js';
import { JsonbWildcardSelectTranslator } from '../../../src/shared/criteria/JsonbWildcardSelectTranslator.js';
import { KnexCaseRepository } from '../../../src/cases/index.js';
import CasesMother from '../../cases/domain/CasesMother.js';
import { v4 as uuidv4 } from 'uuid';

const TABLE = 'aux_cases';

describe('JsonbWildcardSelectTranslator Integration (PostgreSQL)', () => {
    const db = knexConfig;

    let parentCaseId;

    beforeAll(async () => {
        const caseRepository = new KnexCaseRepository(db);
        const kase = await CasesMother.createCaseWithRelations(caseRepository, {});
        parentCaseId = kase.id.value;
    });

    const insertAuxCase = async (caseId, dataObj) => {
        const id = uuidv4();
        await db(TABLE).insert({
            id,
            caso_id: caseId,
            data: JSON.stringify(dataObj),
        });
        return id;
    };

    const selectWildcard = async (auxId, translatedExpr) => {
        const noAlias = translatedExpr.replace(/\s+as\s+\w+$/i, '');
        const rows = await db(TABLE).where({ id: auxId }).select(db.raw(noAlias));
        return rows[0] ? Object.values(rows[0])[0] : undefined;
    };

    it('extracts string value via wildcard: ->>\'nombre\' returns "John"', async () => {
        const id = await insertAuxCase(parentCaseId, { persona: { nombre: 'John', edad: 30, activo: true } });
        const expr = `${TABLE}.data->'*'->>'nombre' as v`;
        const translated = JsonbWildcardSelectTranslator.translate(expr);
        const val = await selectWildcard(id, translated);
        expect(val).toBe('John');
    });

    it('extracts number as text via wildcard: ->>\'edad\' returns "30"', async () => {
        const id = await insertAuxCase(parentCaseId, { persona: { nombre: 'John', edad: 30, activo: true } });
        const expr = `${TABLE}.data->'*'->>'edad' as v`;
        const translated = JsonbWildcardSelectTranslator.translate(expr);
        const val = await selectWildcard(id, translated);
        expect(val).toBe('30');
    });

    it('extracts boolean as text via wildcard: ->>\'activo\' returns "true"', async () => {
        const id = await insertAuxCase(parentCaseId, { persona: { nombre: 'John', edad: 30, activo: true } });
        const expr = `${TABLE}.data->'*'->>'activo' as v`;
        const translated = JsonbWildcardSelectTranslator.translate(expr);
        const val = await selectWildcard(id, translated);
        expect(val).toBe('true');
    });

    it("extracts object via wildcard (jsonb): ->'persona' returns object", async () => {
        const id = await insertAuxCase(parentCaseId, { client: { persona: { nombre: 'John' } } });
        const expr = `${TABLE}.data->'*'->'persona' as v`;
        const translated = JsonbWildcardSelectTranslator.translate(expr);
        const val = await selectWildcard(id, translated);
        const parsed = typeof val === 'string' ? JSON.parse(val) : val;
        expect(parsed).toEqual({ nombre: 'John' });
    });

    it("returns null when key does not exist: ->>'no_existe' returns null", async () => {
        const id = await insertAuxCase(parentCaseId, { persona: { nombre: 'John' } });
        const expr = `${TABLE}.data->'*'->>'no_existe' as v`;
        const translated = JsonbWildcardSelectTranslator.translate(expr);
        const val = await selectWildcard(id, translated);
        expect(val).toBeNull();
    });

    it("extracts array via wildcard (jsonb): ->'telefonos' returns jsonb array", async () => {
        const id = await insertAuxCase(parentCaseId, { persona: { telefonos: ['123', '456'] } });
        const expr = `${TABLE}.data->'*'->'telefonos' as v`;
        const translated = JsonbWildcardSelectTranslator.translate(expr);
        const val = await selectWildcard(id, translated);
        const parsed = typeof val === 'string' ? JSON.parse(val) : val;
        expect(parsed).toEqual(['123', '456']);
    });

    it("extracts array element with key + index: ->'generos'->0->>'code' returns \"01\"", async () => {
        const id = await insertAuxCase(parentCaseId, {
            persona: { generos: [{ code: '01' }, { code: '02' }] },
        });
        const expr = `${TABLE}.data->'*'->'generos'->0->>'code' as v`;
        const translated = JsonbWildcardSelectTranslator.translate(expr);
        const val = await selectWildcard(id, translated);
        expect(val).toBe('01');
    });

    it('extracts array element with direct index (jsonb): ->\'telefonos\'->1 returns "456"', async () => {
        const id = await insertAuxCase(parentCaseId, { persona: { telefonos: ['123', '456'] } });
        const expr = `${TABLE}.data->'*'->'telefonos'->1 as v`;
        const translated = JsonbWildcardSelectTranslator.translate(expr);
        const val = await selectWildcard(id, translated);
        expect(val).toBe('456');
    });
});
