import { JsonbPathHelper } from '../../src/shared/criteria/JsonbPathHelper';

describe('JsonbPathHelper - jsonExtract', () => {
    it('should extract a simple field without entity prefix', () => {
        const result = JsonbPathHelper.jsonExtract('case_auxiliar', 'creacionform');

        expect(result).toBe("case_auxiliar.data ->> 'creacionform'");
    });

    it('should strip entity prefix when field starts with the entity name (single level)', () => {
        const result = JsonbPathHelper.jsonExtract('case_auxiliar', 'case_auxiliar.creacionform');

        expect(result).toBe("case_auxiliar.data ->> 'creacionform'");
        expect(result).not.toContain("-> 'case_auxiliar'");
    });

    it('should strip entity prefix when field starts with the entity name (nested path)', () => {
        const result = JsonbPathHelper.jsonExtract('case_auxiliar', 'case_auxiliar.form1.fecha');

        expect(result).toBe("case_auxiliar.data -> 'form1' ->> 'fecha'");
        expect(result).not.toContain("-> 'case_auxiliar'");
    });

    it('should handle nested field without entity prefix', () => {
        const result = JsonbPathHelper.jsonExtract('case_auxiliar', 'form1.fecha');

        expect(result).toBe("case_auxiliar.data -> 'form1' ->> 'fecha'");
    });

    it('should handle deeply nested field without entity prefix', () => {
        const result = JsonbPathHelper.jsonExtract('aux_cases', 'form1.section.campo');

        expect(result).toBe("aux_cases.data -> 'form1' -> 'section' ->> 'campo'");
    });

    it('should strip aux_ prefixed entity from field', () => {
        const result = JsonbPathHelper.jsonExtract('aux_cases', 'aux_cases.my_field');

        expect(result).toBe("aux_cases.data ->> 'my_field'");
        expect(result).not.toContain("-> 'aux_cases'");
    });

    it('should strip aux_ prefixed entity from nested field', () => {
        const result = JsonbPathHelper.jsonExtract('aux_cases', 'aux_cases.form1.created_at');

        expect(result).toBe("aux_cases.data -> 'form1' ->> 'created_at'");
        expect(result).not.toContain("-> 'aux_cases'");
    });

    it('should not strip a part that only partially matches the entity name', () => {
        const result = JsonbPathHelper.jsonExtract('case_auxiliar', 'case_auxiliar_extra.field');

        expect(result).toBe("case_auxiliar.data -> 'case_auxiliar_extra' ->> 'field'");
    });

    it('should throw when entity is not provided', () => {
        expect(() => JsonbPathHelper.jsonExtract(null, 'form1.fecha')).toThrow('Entity is required');
    });

    it('should throw when field resolves to empty after stripping entity prefix', () => {
        expect(() => JsonbPathHelper.jsonExtract('case_auxiliar', 'case_auxiliar')).toThrow('Invalid JSON field');
    });
});
