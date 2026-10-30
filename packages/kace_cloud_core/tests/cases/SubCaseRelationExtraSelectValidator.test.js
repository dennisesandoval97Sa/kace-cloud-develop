import { SubCaseRelationExtraSelectValidator } from '../../src/cases/application/subcase-relation-search/SubCaseRelationExtraSelectValidator.js';
import { InvalidArgumentError } from '../../src/shared/errors/InvalidArgumentError.js';

describe('SubCaseRelationExtraSelectValidator', () => {
    it('accepts plain table.column', () => {
        expect(() => SubCaseRelationExtraSelectValidator.validate(['cases.id'], null)).not.toThrow();
    });

    it('rejects SQL injection via json arrow and semicolon', () => {
        expect(() =>
            SubCaseRelationExtraSelectValidator.validate([`cases.id->>'' ; DROP TABLE cases; -- as foo`], null)
        ).toThrow(InvalidArgumentError);
    });

    it('rejects concatenation after quoted json key', () => {
        expect(() => SubCaseRelationExtraSelectValidator.validate([`cases.id->>'x'||pg_sleep(10)`], null)).toThrow(
            InvalidArgumentError
        );
    });

    it('accepts json_extract with path', () => {
        expect(() =>
            SubCaseRelationExtraSelectValidator.validate([`json_extract(cases.data, '$.name')`], null)
        ).not.toThrow();
    });

    it('accepts json operator chain with alias', () => {
        expect(() =>
            SubCaseRelationExtraSelectValidator.validate([`cases.data->'k'->>'name' as x`], null)
        ).not.toThrow();
    });

    it('accepts hash json path operators', () => {
        expect(() => SubCaseRelationExtraSelectValidator.validate([`cases.data#>'{a,b}'`], null)).not.toThrow();
    });

    it('accepts json array index segment', () => {
        expect(() =>
            SubCaseRelationExtraSelectValidator.validate(
                [`aux_cases.data->'genre'->0->>'code' as aux_cases_genre_first_code`],
                [{ table: 'aux_cases' }]
            )
        ).not.toThrow();
    });

    it('allows table from relationship for json expression', () => {
        expect(() =>
            SubCaseRelationExtraSelectValidator.validate([`aux_cases.col->'key'`], [{ table: 'aux_cases' }])
        ).not.toThrow();
    });

    it('rejects table not in allowlist', () => {
        expect(() => SubCaseRelationExtraSelectValidator.validate(['other_tbl.id'], null)).toThrow(/not allowed/);
    });

    it("accepts wildcard basic: aux_cases.data->'*'->>'nombre' as aux_nombre", () => {
        expect(() =>
            SubCaseRelationExtraSelectValidator.validate(
                [`aux_cases.data->'*'->>'nombre' as aux_nombre`],
                [{ table: 'aux_cases' }]
            )
        ).not.toThrow();
    });

    it("accepts wildcard with jsonb extraction: aux_cases.data->'*'->'nested' as aux_nested", () => {
        expect(() =>
            SubCaseRelationExtraSelectValidator.validate(
                [`aux_cases.data->'*'->'nested' as aux_nested`],
                [{ table: 'aux_cases' }]
            )
        ).not.toThrow();
    });

    it("accepts wildcard with deep path: aux_cases.data->'*'->'contact'->>'email' as email", () => {
        expect(() =>
            SubCaseRelationExtraSelectValidator.validate(
                [`aux_cases.data->'*'->'contact'->>'email' as email`],
                [{ table: 'aux_cases' }]
            )
        ).not.toThrow();
    });

    it("accepts wildcard + array index: aux_cases.data->'*'->0->>'code' as code", () => {
        expect(() =>
            SubCaseRelationExtraSelectValidator.validate(
                [`aux_cases.data->'*'->0->>'code' as code`],
                [{ table: 'aux_cases' }]
            )
        ).not.toThrow();
    });

    it("accepts wildcard + key + index: aux_cases.data->'*'->'items'->2->>'name' as name", () => {
        expect(() =>
            SubCaseRelationExtraSelectValidator.validate(
                [`aux_cases.data->'*'->'items'->2->>'name' as name`],
                [{ table: 'aux_cases' }]
            )
        ).not.toThrow();
    });

    it("accepts wildcard + index without text: aux_cases.data->'*'->'telefonos'->0 as tel", () => {
        expect(() =>
            SubCaseRelationExtraSelectValidator.validate(
                [`aux_cases.data->'*'->'telefonos'->0 as tel`],
                [{ table: 'aux_cases' }]
            )
        ).not.toThrow();
    });

    it("rejects wildcard with SQL injection: aux_cases.data->'*'->>'x'; DROP TABLE --", () => {
        expect(() =>
            SubCaseRelationExtraSelectValidator.validate(
                [`aux_cases.data->'*'->>'x'; DROP TABLE --`],
                [{ table: 'aux_cases' }]
            )
        ).toThrow(InvalidArgumentError);
    });

    it("rejects wildcard from non-allowed table: other.data->'*'->>'x'", () => {
        expect(() =>
            SubCaseRelationExtraSelectValidator.validate([`other.data->'*'->>'x'`], [{ table: 'aux_cases' }])
        ).toThrow(InvalidArgumentError);
    });
});
