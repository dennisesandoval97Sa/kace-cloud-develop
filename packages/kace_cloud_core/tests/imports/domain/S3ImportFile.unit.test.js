import { S3ImportFile } from '../../../src/imports/domain/S3ImportFile.js';

const baseDto = () => ({
    file_path: 'imports/base-file.csv',
    target_table: 'usuarios',
    created_by: '99999999-9999-4999-8999-999999999999',
});

describe('S3ImportFile', () => {
    describe('constructor defaults', () => {
        it('fills in id/status/counters/created_at when the DTO omits them', () => {
            const before = Date.now();

            const file = S3ImportFile.create(baseDto());

            expect(file.id.value).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
            expect(file.status.value).toBe('pending');
            expect(file.upload_attempts.value).toBe(0);
            expect(file.total_records.value).toBe(0);
            expect(file.processed_records.value).toBe(0);
            expect(new Date(file.created_at.value).getTime()).toBeGreaterThanOrEqual(before);
        });

        it('keeps the explicit values when the DTO provides them instead of the defaults', () => {
            const explicitCreatedAt = new Date('2026-01-01T00:00:00.000Z');

            const file = S3ImportFile.create({
                ...baseDto(),
                id: '11111111-1111-4111-8111-111111111111',
                status: 'processing',
                upload_attempts: 3,
                total_records: 10,
                processed_records: 4,
                created_at: explicitCreatedAt,
            });

            expect(file.id.value).toBe('11111111-1111-4111-8111-111111111111');
            expect(file.status.value).toBe('processing');
            expect(file.upload_attempts.value).toBe(3);
            expect(file.total_records.value).toBe(10);
            expect(file.processed_records.value).toBe(4);
            expect(file.created_at.value).toBe(explicitCreatedAt.toISOString());
        });

        it.each([
            ['omitted entirely (default param kicks in)', {}, false],
            ['explicitly null (default param does not apply, "?? false" does)', { should_override_array: null }, false],
            ['explicitly true (neither fallback applies)', { should_override_array: true }, true],
        ])('resolves should_override_array when %s', (_label, overrides, expected) => {
            const file = S3ImportFile.create({ ...baseDto(), ...overrides });

            expect(file.should_override_array.value).toBe(expected);
        });
    });

    describe('error_details formatting', () => {
        it('returns the raw (empty) value object when there are no error details', () => {
            const file = S3ImportFile.create(baseDto());

            expect(file.error_details.value).toBeUndefined();
        });

        it('parses the "Error insertando/eliminando la fila N (id: X): detail" format, capturing the id', () => {
            const file = S3ImportFile.create(baseDto());
            file.error_details = 'Error insertando la fila 3 (id: abc-123): el campo es inválido';

            const formatted = file.error_details.value;

            expect(formatted).toEqual({
                generalErrors: [],
                insertErrors: [{ row_number: '3', id_record: 'abc-123', error_detail: 'el campo es inválido' }],
            });
        });

        it('parses the same format without the optional "(id: ...)" group, using null for id_record', () => {
            const file = S3ImportFile.create(baseDto());
            file.error_details = 'Error eliminando la fila 5: no se encontró el registro';

            const formatted = file.error_details.value;

            expect(formatted).toEqual({
                generalErrors: [],
                insertErrors: [{ row_number: '5', id_record: null, error_detail: 'no se encontró el registro' }],
            });
        });

        it('parses the legacy "Error insertando el registro con id X por detail" format', () => {
            const file = S3ImportFile.create(baseDto());
            file.error_details = 'Error insertando el registro con id xyz-789 por violación de unicidad';

            const formatted = file.error_details.value;

            expect(formatted).toEqual({
                generalErrors: [],
                insertErrors: [{ id_record: 'xyz-789', error_detail: 'violación de unicidad' }],
            });
        });

        it('falls back to generalErrors when a segment matches neither known pattern', () => {
            const file = S3ImportFile.create(baseDto());
            file.error_details = 'Archivo vacio (No se encontraron registros para insertar)';

            const formatted = file.error_details.value;

            expect(formatted).toEqual({
                generalErrors: ['Archivo vacio (No se encontraron registros para insertar)'],
                insertErrors: [],
            });
        });
    });

    describe('setters — change vs no-op branch', () => {
        it('updates file_path and records the change only when the value actually differs', () => {
            const file = S3ImportFile.create(baseDto());

            file.file_path = 'imports/updated-file.csv';
            expect(file.file_path.value).toBe('imports/updated-file.csv');
            expect(file.changedAttributes.file_path).toBe('imports/updated-file.csv');

            file.changedAttributes.file_path = undefined;
            delete file.changedAttributes.file_path;
            file.file_path = 'imports/updated-file.csv';
            expect(file.changedAttributes).not.toHaveProperty('file_path');
        });

        it('updates upload_attempts/total_records/processed_records only on an actual change', () => {
            const file = S3ImportFile.create(baseDto());

            file.upload_attempts = 2;
            expect(file.upload_attempts.value).toBe(2);
            expect(file.changedAttributes.upload_attempts).toBe(2);
            delete file.changedAttributes.upload_attempts;
            file.upload_attempts = 2;
            expect(file.changedAttributes).not.toHaveProperty('upload_attempts');

            file.total_records = 7;
            expect(file.total_records.value).toBe(7);
            expect(file.changedAttributes.total_records).toBe(7);
            delete file.changedAttributes.total_records;
            file.total_records = 7;
            expect(file.changedAttributes).not.toHaveProperty('total_records');

            file.processed_records = 1;
            expect(file.processed_records.value).toBe(1);
            expect(file.changedAttributes.processed_records).toBe(1);
            delete file.changedAttributes.processed_records;
            file.processed_records = 1;
            expect(file.changedAttributes).not.toHaveProperty('processed_records');
        });

        it('updates last_updated_at only when the ISO value actually differs', () => {
            const file = S3ImportFile.create(baseDto());

            file.last_updated_at = '2026-02-02T10:00:00.000Z';
            expect(file.last_updated_at.value).toBe('2026-02-02T10:00:00.000Z');
            expect(file.changedAttributes.last_updated_at).toBe('2026-02-02T10:00:00.000Z');

            delete file.changedAttributes.last_updated_at;
            file.last_updated_at = '2026-02-02T10:00:00.000Z';
            expect(file.changedAttributes).not.toHaveProperty('last_updated_at');
        });

        it('updates error_details only when the raw value actually differs', () => {
            const file = S3ImportFile.create(baseDto());

            file.error_details = 'boom';
            expect(file.changedAttributes.error_details).toBe('boom');

            delete file.changedAttributes.error_details;
            file.error_details = 'boom';
            expect(file.changedAttributes).not.toHaveProperty('error_details');
        });

        it('updates action_type only when the value actually differs', () => {
            const file = S3ImportFile.create(baseDto());

            file.action_type = 'DELETE';
            expect(file.action_type.value).toBe('DELETE');
            expect(file.changedAttributes.action_type).toBe('DELETE');

            delete file.changedAttributes.action_type;
            file.action_type = 'DELETE';
            expect(file.changedAttributes).not.toHaveProperty('action_type');
        });

        it('updates should_override_array only when the value actually differs', () => {
            const file = S3ImportFile.create(baseDto());

            file.should_override_array = true;
            expect(file.should_override_array.value).toBe(true);
            expect(file.changedAttributes.should_override_array).toBe(true);

            delete file.changedAttributes.should_override_array;
            file.should_override_array = true;
            expect(file.changedAttributes).not.toHaveProperty('should_override_array');
        });

        // BUG (documented, not fixed — task forbids touching src/): the `status` and
        // `target_table` setters build their replacement value object as
        // `new ValueObjectShortString50(value)`, i.e. passing the new value positionally as
        // `label` and leaving the VO's actual `value` argument `undefined`. ValueObjectString's
        // constructor then throws "<value>: The value cannot be null" for ANY non-empty value,
        // so these two setters are unusable whenever they would actually change something.
        it('BUG: the status setter throws instead of updating, because it drops the required VO value arg', () => {
            const file = S3ImportFile.create(baseDto());
            expect(file.status.value).toBe('pending');

            expect(() => {
                file.status = 'processing';
            }).toThrow('processing: The value cannot be null');
        });

        it('the status setter is still a no-op (does not throw) when the new value equals the current one', () => {
            const file = S3ImportFile.create(baseDto());

            expect(() => {
                file.status = 'pending';
            }).not.toThrow();
            expect(file.changedAttributes).not.toHaveProperty('status');
        });

        it('BUG: the target_table setter throws instead of updating, because it drops the required VO value arg', () => {
            const file = S3ImportFile.create(baseDto());
            expect(file.target_table.value).toBe('usuarios');

            expect(() => {
                file.target_table = 'aux_clientes';
            }).toThrow('aux_clientes: The value cannot be null');
        });

        it('the target_table setter is still a no-op (does not throw) when the new value equals the current one', () => {
            const file = S3ImportFile.create(baseDto());

            expect(() => {
                file.target_table = 'usuarios';
            }).not.toThrow();
            expect(file.changedAttributes).not.toHaveProperty('target_table');
        });
    });
});
