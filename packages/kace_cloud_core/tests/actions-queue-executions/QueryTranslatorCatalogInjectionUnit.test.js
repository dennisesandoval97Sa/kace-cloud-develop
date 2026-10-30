import knexLib from 'knex';
import { QueryTranslator } from '../../src/actions/domain/QueryTranslator/QueryTranslator.js';
import { CompositeRule } from '../../src/actions/domain/QueryTranslator/CompositeRule.js';
import { createCasesFieldCatalog } from '../../src/actions/domain/QueryTranslator/FieldCatalog.js';

describe('QueryTranslator with injected catalog', () => {
    let knex;
    beforeAll(() => {
        knex = knexLib({ client: 'pg', connection: { host: '127.0.0.1' } });
    });
    afterAll(async () => {
        await knex.destroy();
    });

    it('applies cases joins via catalog.describeJoins when clients referenced', () => {
        const catalog = createCasesFieldCatalog();
        const translator = new QueryTranslator({ catalog });
        const rules = CompositeRule.fromValue({
            id: 'c',
            combinator: 'and',
            rules: [{ id: 'r', field: 'clients.email', value: 'a@b', operator: '=', value_type: 'text' }],
        });

        const q = knex('cases').select('cases.id');
        translator.buildQuery(q, rules, { baseTable: 'cases' });

        const sql = q.toString();
        expect(sql).toContain('left join "clients"');
        expect(sql).toContain('clients.email');
    });

    it('does NOT apply joins for catalogs whose joinPlanner returns []', () => {
        const noJoinCatalog = createCasesFieldCatalog();
        // Sustituye el joinPlanner con uno que devuelve [] para probar el aislamiento.
        noJoinCatalog.joinPlanner = () => [];
        const translator = new QueryTranslator({ catalog: noJoinCatalog });
        const rules = CompositeRule.fromValue({
            id: 'c',
            combinator: 'and',
            rules: [{ id: 'r', field: 'cases.responsable_id', value: 'x', operator: '=', value_type: 'text' }],
        });

        const q = knex('cases').select('cases.id');
        translator.buildQuery(q, rules, { baseTable: 'cases' });

        const sql = q.toString();
        expect(sql).not.toMatch(/left join/i);
    });
});
