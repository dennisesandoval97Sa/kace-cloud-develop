import { JsonbWildcardSelectTranslator } from '../../../src/shared/criteria/JsonbWildcardSelectTranslator.js';
import { InvalidArgumentError } from '../../../src/shared/errors/InvalidArgumentError.js';

describe('JsonbWildcardSelectTranslator', () => {
    describe('hasWildcard', () => {
        it('returns false for expression without wildcard', () => {
            expect(JsonbWildcardSelectTranslator.hasWildcard(`aux_cases.data->>'nombre' as x`)).toBe(false);
        });

        it('returns true for expression with wildcard', () => {
            expect(JsonbWildcardSelectTranslator.hasWildcard(`aux_cases.data->'*'->>'nombre' as x`)).toBe(true);
        });

        it('returns false for null', () => {
            expect(JsonbWildcardSelectTranslator.hasWildcard(null)).toBe(false);
        });

        it('returns false for non-string', () => {
            expect(JsonbWildcardSelectTranslator.hasWildcard(42)).toBe(false);
        });
    });

    describe('translate', () => {
        it('returns original expression when no wildcard present', () => {
            const expr = `aux_cases.data->>'nombre' as x`;
            expect(JsonbWildcardSelectTranslator.translate(expr)).toBe(expr);
        });

        it("translates basic wildcard with text extraction: aux_cases.data->'*'->>'nombre' as x", () => {
            const expr = `aux_cases.data->'*'->>'nombre' as x`;
            const result = JsonbWildcardSelectTranslator.translate(expr);
            expect(result).toBe(`jsonb_path_query_first(aux_cases.data, '$.*."nombre"') #>> '{}' as x`);
        });

        it("translates wildcard with jsonb extraction: aux_cases.data->'*'->'obj' as x", () => {
            const expr = `aux_cases.data->'*'->'obj' as x`;
            const result = JsonbWildcardSelectTranslator.translate(expr);
            expect(result).toBe(`jsonb_path_query_first(aux_cases.data, '$.*."obj"') as x`);
        });

        it("translates deep path: aux_cases.data->'*'->'a'->>'b' as x", () => {
            const expr = `aux_cases.data->'*'->'a'->>'b' as x`;
            const result = JsonbWildcardSelectTranslator.translate(expr);
            expect(result).toBe(`jsonb_path_query_first(aux_cases.data, '$.*."a"."b"') #>> '{}' as x`);
        });

        it("translates wildcard + array index: aux_cases.data->'*'->0->>'code' as x", () => {
            const expr = `aux_cases.data->'*'->0->>'code' as x`;
            const result = JsonbWildcardSelectTranslator.translate(expr);
            expect(result).toBe(`jsonb_path_query_first(aux_cases.data, '$.*[0]."code"') #>> '{}' as x`);
        });

        it("translates wildcard + key + index: aux_cases.data->'*'->'items'->2->>'name' as x", () => {
            const expr = `aux_cases.data->'*'->'items'->2->>'name' as x`;
            const result = JsonbWildcardSelectTranslator.translate(expr);
            expect(result).toBe(`jsonb_path_query_first(aux_cases.data, '$.*."items"[2]."name"') #>> '{}' as x`);
        });

        it("translates wildcard + key + index without text: aux_cases.data->'*'->'telefonos'->0 as x", () => {
            const expr = `aux_cases.data->'*'->'telefonos'->0 as x`;
            const result = JsonbWildcardSelectTranslator.translate(expr);
            expect(result).toBe(`jsonb_path_query_first(aux_cases.data, '$.*."telefonos"[0]') as x`);
        });

        it('translates expression without alias', () => {
            const expr = `aux_cases.data->'*'->>'nombre'`;
            const result = JsonbWildcardSelectTranslator.translate(expr);
            expect(result).toBe(`jsonb_path_query_first(aux_cases.data, '$.*."nombre"') #>> '{}'`);
        });

        it('treats trailing #>> like text extraction (same as ->>)', () => {
            const expr = `aux_cases.data->'*'#>>'{a,b}' as x`;
            const result = JsonbWildcardSelectTranslator.translate(expr);
            expect(result).toBe(`jsonb_path_query_first(aux_cases.data, '$.*."{a,b}"') #>> '{}' as x`);
        });

        it('throws when wildcard is present but expression does not match the allowed pattern', () => {
            const expr = `aux_cases.data->'*'->'bad key'->>'nombre' as x`;
            expect(() => JsonbWildcardSelectTranslator.translate(expr)).toThrow(InvalidArgumentError);
        });
    });
});
