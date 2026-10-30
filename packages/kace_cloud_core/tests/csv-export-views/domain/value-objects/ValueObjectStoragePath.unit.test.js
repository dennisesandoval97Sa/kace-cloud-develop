import { ValueObjectStoragePath } from '../../../../src/csv-export-views/domain/value-objects/ValueObjectStoragePath.js';

describe('ValueObjectStoragePath', () => {
    it('accepts a valid nested path made of word characters and separators', () => {
        const vo = new ValueObjectStoragePath('storage_path', 'exports/2026/file-01.csv');
        expect(vo.value).toBe('exports/2026/file-01.csv');
    });

    it('throws for a path with an invalid format (e.g. a leading slash)', () => {
        expect(() => new ValueObjectStoragePath('storage_path', '/leading-slash/file.csv')).toThrow(
            'storage_path: Invalid file path format'
        );
    });

    // BUG (documented, not fixed — task forbids touching src/): the constructor calls
    // `super(field, value)` without forwarding its own `nullable` parameter, so
    // ValueObjectString's constructor always runs with its OWN default `nullable = false`.
    // For any falsy value, ValueObjectString throws unconditionally *before* control ever
    // returns to ValueObjectStoragePath's own `if (!value && !nullable)` / `if (!value &&
    // nullable)` checks (lines 8 and 11 of the source). Both branches of both of those
    // `if`s are therefore dead code: `nullable: true` never actually makes a falsy
    // storage_path acceptable, even though CsvExportView's constructor relies on exactly
    // that ("new ValueObjectStoragePath('storage_path', storage_path, true)") to allow a
    // CsvExportView to be created before it has ever run (no storage_path yet).
    it('BUG: nullable=true does NOT allow a falsy value — it still throws inside the parent constructor', () => {
        expect(() => new ValueObjectStoragePath('storage_path', '', true)).toThrow(
            'storage_path: The value cannot be null'
        );
        expect(() => new ValueObjectStoragePath('storage_path', null, true)).toThrow(
            'storage_path: The value cannot be null'
        );
    });
});
