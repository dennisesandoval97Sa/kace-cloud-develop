import { knexConfig } from '../knexfile.js';
import { createCasesFieldCatalog } from '../../src/actions/domain/QueryTranslator/FieldCatalog.js';
import { QueryTranslator } from '../../src/actions/domain/QueryTranslator/QueryTranslator.js';
import { RuleValueCalculator } from '../../src/actions/domain/QueryTranslator/RuleValueCalculator.js';
import { RuleValidator } from '../../src/actions/domain/QueryTranslator/RuleValidator.js';
import { Rule } from '../../src/actions/domain/QueryTranslator/Rule.js';
import { CompositeRule } from '../../src/actions/domain/QueryTranslator/CompositeRule.js';
import dayjs from 'dayjs';

describe('FieldCatalog.resolve', () => {
    const catalog = createCasesFieldCatalog();

    it('returns column descriptor for a known cases column', () => {
        const r = catalog.resolve('cases.responsable_id');
        expect(r).toEqual({ kind: 'column', table: 'cases', column: 'responsable_id' });
    });

    it('returns column descriptor for clasificaciones.id', () => {
        const r = catalog.resolve('clasificaciones.id');
        expect(r).toEqual({ kind: 'column', table: 'clasificaciones', column: 'id' });
    });

    it('remaps cases.estadoActual to estados.id', () => {
        const r = catalog.resolve('cases.estadoActual');
        expect(r).toEqual({ kind: 'column', table: 'estados', column: 'id' });
    });

    it('returns json-path descriptor for aux_cases nested path', () => {
        const r = catalog.resolve('aux_cases.foo.bar.baz');
        expect(r).toEqual({
            kind: 'jsonPath',
            table: 'aux_cases',
            jsonColumn: 'data',
            path: ['foo', 'bar', 'baz'],
        });
    });

    it('returns null for unknown prefix', () => {
        expect(catalog.resolve('unknownThing.foo')).toBeNull();
    });

    it('returns null for json path with unsafe segment', () => {
        expect(catalog.resolve('aux_cases.foo.bar$bad')).toBeNull();
    });

    it('returns null for cases.<unknownColumn>', () => {
        expect(catalog.resolve('cases.this_column_does_not_exist')).toBeNull();
    });
});

describe('FieldCatalog.columnExpression', () => {
    it('throws for a descriptor kind other than "column" or "jsonPath"', () => {
        // `resolve()` never itself produces any other `kind`, so this is a defensive
        // fallback exercised directly through the public `columnExpression` method.
        const catalog = createCasesFieldCatalog();
        expect(() => catalog.columnExpression({ kind: 'bogus' })).toThrow('Unsupported descriptor kind: bogus');
    });
});

describe('FieldCatalog.describeJoins (cases catalog)', () => {
    const knex = knexConfig;

    it('joins aux_clients when a rule references an aux_clients field', () => {
        const tr = new QueryTranslator({ catalog: createCasesFieldCatalog() });
        const q = knex('cases').select('id');
        tr.buildQuery(
            q,
            CompositeRule.fromValue({
                id: 'c',
                combinator: 'and',
                rules: [{ id: 'r', field: 'aux_clients.ciudad', value: 'Bogota', operator: '=', value_type: 'text' }],
            })
        );
        const sql = q.toSQL().sql.toLowerCase();
        expect(sql).toContain('left join "aux_clients"');
        expect(sql).toContain('"aux_clients"."cliente_id" = "cases"."cliente_id"');
    });

    it('joins aux_users when a rule references an aux_users field', () => {
        const tr = new QueryTranslator({ catalog: createCasesFieldCatalog() });
        const q = knex('cases').select('id');
        tr.buildQuery(
            q,
            CompositeRule.fromValue({
                id: 'c',
                combinator: 'and',
                rules: [{ id: 'r', field: 'aux_users.nivel', value: '1', operator: '=', value_type: 'text' }],
            })
        );
        const sql = q.toSQL().sql.toLowerCase();
        expect(sql).toContain('left join "aux_users"');
        expect(sql).toContain('"aux_users"."usuario_id" = "cases"."responsable_id"');
    });
});

describe('RuleValueCalculator.calculate with evaluationNow', () => {
    it('uses opts.evaluationNow when type is function', () => {
        const now = dayjs('2026-05-13T10:00:00Z');
        const ruleValue = { value: 'datetime' };
        const ruleType = { value: 'function' };
        const result = RuleValueCalculator.calculate(ruleValue, ruleType, null, { evaluationNow: now });
        expect(result).toBe(now.format('YYYY-MM-DDTHH:mm:ssZ'));
    });

    it('falls back to dayjs() when opts.evaluationNow is absent', () => {
        const before = Date.now();
        const result = RuleValueCalculator.calculate({ value: 'date' }, { value: 'function' });
        const after = Date.now();
        const parsed = dayjs(result, 'YYYY-MM-DD');
        expect(parsed.isValid()).toBe(true);
        expect(parsed.toDate().getTime()).toBeGreaterThanOrEqual(dayjs(before).startOf('day').toDate().getTime());
        expect(parsed.toDate().getTime()).toBeLessThanOrEqual(dayjs(after).endOf('day').toDate().getTime());
    });
});

describe('RuleValidator.validate with opts.evaluationNow', () => {
    it('passes evaluationNow to RuleValueCalculator for function values', () => {
        const fixedNow = dayjs('2026-05-13T10:00:00Z');
        const rule = Rule.fromValue({
            id: 'r',
            field: 'cases.created_at',
            value: 'datetime',
            operator: '<',
            value_type: 'date',
            type: 'function',
        });
        const composite = CompositeRule.fromValue({ id: 'c', combinator: 'and', rules: [rule.toJson()] });

        const context = { cases: { created_at: '2026-05-13T09:00:00Z' } };
        const result = RuleValidator.validate(composite, context, null, { evaluationNow: fixedNow });
        expect(result).toBe(true);
    });
});

// `cases`, `aux_cases`, `clasificaciones`, `estados` and `transiciones` all exist in the
// real migrated schema (see tests/knexfile.js — every test file gets its own cloned
// postgres database), so QueryTranslator.buildQuery() is exercised against the real query
// builder for those tables instead of an ad-hoc in-memory schema. buildQuery() never
// executes the query (only .toSQL() is inspected), so no seed data is needed.
describe('QueryTranslator operator coverage', () => {
    const knex = knexConfig;

    const buildRules = (rules) => CompositeRule.fromValue({ id: 'c', combinator: 'and', rules });

    it('translates EQUALS on cases column', () => {
        const tr = new QueryTranslator({ catalog: createCasesFieldCatalog() });
        const q = knex('cases').select('id');
        tr.buildQuery(
            q,
            buildRules([
                {
                    id: 'r',
                    field: 'cases.responsable_id',
                    value: 'abc',
                    operator: '=',
                    value_type: 'text',
                },
            ])
        );
        const sql = q.toSQL();
        expect(sql.sql.toLowerCase()).toContain('where');
        expect(sql.bindings).toContain('abc');
    });

    it('translates CONTAINS using LIKE and escapes wildcards in value', () => {
        const tr = new QueryTranslator({ catalog: createCasesFieldCatalog() });
        const q = knex('cases').select('id');
        tr.buildQuery(
            q,
            buildRules([
                {
                    id: 'r',
                    field: 'cases.alto_impacto',
                    value: '50%off',
                    operator: 'contains',
                    value_type: 'text',
                },
            ])
        );
        const sql = q.toSQL();
        expect(sql.sql.toLowerCase()).toContain('like');
        expect(sql.bindings.some((b) => String(b).includes('\\%'))).toBe(true);
    });

    it('translates IN with comma-split values', () => {
        const tr = new QueryTranslator({ catalog: createCasesFieldCatalog() });
        const q = knex('cases').select('id');
        tr.buildQuery(
            q,
            buildRules([
                {
                    id: 'r',
                    field: 'cases.alto_impacto',
                    value: 'a,b,c',
                    operator: 'in',
                    value_type: 'text',
                },
            ])
        );
        const sql = q.toSQL();
        expect(sql.sql.toLowerCase()).toMatch(/in \(/);
        expect(sql.bindings).toEqual(expect.arrayContaining(['a', 'b', 'c']));
    });

    it('translates BETWEEN', () => {
        const tr = new QueryTranslator({ catalog: createCasesFieldCatalog() });
        const q = knex('cases').select('id');
        tr.buildQuery(
            q,
            buildRules([
                {
                    id: 'r',
                    field: 'cases.sla_due_date',
                    value: '2026-01-01,2026-12-31',
                    operator: 'between',
                    value_type: 'date',
                },
            ])
        );
        const sql = q.toSQL();
        expect(sql.sql.toLowerCase()).toContain('between');
    });

    it('translates NULL and NOT NULL', () => {
        const tr = new QueryTranslator({ catalog: createCasesFieldCatalog() });
        const q = knex('cases').select('id');
        tr.buildQuery(
            q,
            buildRules([
                { id: 'r1', field: 'cases.responsable_id', value: '', operator: 'null', value_type: 'text' },
                { id: 'r2', field: 'cases.alto_impacto', value: '', operator: 'notNull', value_type: 'text' },
            ])
        );
        const sql = q.toSQL().sql.toLowerCase();
        expect(sql).toContain('is null');
        expect(sql).toContain('is not null');
    });

    it('translates IS_EMPTY and IS_NOT_EMPTY', () => {
        const tr = new QueryTranslator({ catalog: createCasesFieldCatalog() });
        const q = knex('cases').select('id');
        tr.buildQuery(
            q,
            buildRules([
                { id: 'r1', field: 'cases.alto_impacto', value: '', operator: 'isEmpty', value_type: 'text' },
                { id: 'r2', field: 'cases.alto_impacto', value: '', operator: 'isNotEmpty', value_type: 'text' },
            ])
        );
        const sql = q.toSQL().sql.toLowerCase();
        expect(sql).toContain("= ''");
        expect(sql).toContain("<> ''");
    });

    it('joins clasificaciones when a rule references it', () => {
        const tr = new QueryTranslator({ catalog: createCasesFieldCatalog() });
        const q = knex('cases').select('id');
        tr.buildQuery(
            q,
            buildRules([
                {
                    id: 'r',
                    field: 'clasificaciones.nivel1',
                    value: 'foo',
                    operator: '=',
                    value_type: 'text',
                },
            ])
        );
        const sql = q.toSQL().sql.toLowerCase();
        expect(sql).toContain('join "clasificaciones"');
        expect(sql).not.toContain('join "classification"');
    });

    it('filters by clasificaciones.id with EQUALS', () => {
        const tr = new QueryTranslator({ catalog: createCasesFieldCatalog() });
        const q = knex('cases').select('id');
        tr.buildQuery(
            q,
            buildRules([
                {
                    id: 'r',
                    field: 'clasificaciones.id',
                    value: 'abc-123',
                    operator: '=',
                    value_type: 'text',
                },
            ])
        );
        const sql = q.toSQL();
        expect(sql.sql.toLowerCase()).toContain('join "clasificaciones"');
        expect(sql.sql).toContain('clasificaciones.id = ?');
        expect(sql.bindings).toContain('abc-123');
    });

    it('filters by clasificaciones.id with IN', () => {
        const tr = new QueryTranslator({ catalog: createCasesFieldCatalog() });
        const q = knex('cases').select('id');
        tr.buildQuery(
            q,
            buildRules([
                {
                    id: 'r',
                    field: 'clasificaciones.id',
                    value: 'a,b,c',
                    operator: 'in',
                    value_type: 'text',
                },
            ])
        );
        const sql = q.toSQL();
        expect(sql.sql.toLowerCase()).toMatch(/in \(/);
        expect(sql.bindings).toEqual(expect.arrayContaining(['a', 'b', 'c']));
    });

    it('filters by clasificaciones.description alias via cases.clasificacion_id with IN (no join to clasificaciones)', () => {
        const tr = new QueryTranslator({ catalog: createCasesFieldCatalog() });
        const q = knex('cases').select('id');
        tr.buildQuery(
            q,
            buildRules([
                {
                    id: 'r',
                    field: 'clasificaciones.description',
                    value: '1,2,3',
                    operator: 'in',
                    value_type: 'text',
                },
            ])
        );
        const sql = q.toSQL();
        expect(sql.sql).toContain('cases.clasificacion_id');
        expect(sql.sql.toLowerCase()).toMatch(/in \(/);
        expect(sql.sql.toLowerCase()).not.toContain('join "clasificaciones"');
        expect(sql.bindings).toEqual(expect.arrayContaining(['1', '2', '3']));
    });
});
