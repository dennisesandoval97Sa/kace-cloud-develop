import { ValueObjectShortString50 } from '../../src/imports/domain/value-objects/ValueObjectShortString50.js';
import { ValueObjectFilePath } from '../../src/imports/domain/value-objects/ValueObjectFilePath.js';
import { S3ImportFile } from '../../src/imports/domain/S3ImportFile.js';
import { S3FileImport } from '../../src/imports/application/import/S3FileImport.js';
import { InvalidTargetTableError } from '../../src/imports/domain/errors/InvalidTargetTableError.js';
import { S3ImportsDashboard } from '../../src/imports/application/imports-dashboard/S3ImportsDashboard.js';
import { S3ImportsCollectionResponse } from '../../src/imports/application/S3ImportsCollectionResponse.js';
import { CsvValueNormalizer } from '../../src/imports/domain/services/CsvValueNormalizer.js';
import { CsvParserService } from '../../src/imports/infrastructure/csv/CsvParserService.js';
import { CsvRecordProcessorService } from '../../src/imports/domain/services/CsvRecordProcessorService.js';
import { jest } from '@jest/globals';
import { KnexUsersRepository } from '../../src/users/index.js';
import { knexConfig } from '@kace/database';
import { usersCsvFileStructureValidator } from '../../src/imports/domain/services/usersCsvFileStructureValidator.js';
import { usersCsvContentValidator } from '../../src/imports/domain/services/usersCsvContentValidator.js';
import { v4 as uuidv4 } from 'uuid';
import { buildAuxJsonFromCsv, flattenAuxRow } from '../../src/shared/domain/utilities/processAuxiliaryData.js';

const captureErrorMessage = (fn) => {
    try {
        fn();
    } catch (error) {
        return error.message;
    }
};

const validDto = {
    file_path: 'bucket/my-file.csv',
    status: 'pending',
    upload_attempts: 1,
    total_records: 100,
    processed_records: 90,
    last_updated_at: new Date(),
    created_at: new Date(),
    created_by: '07b10825-6cce-4150-a32c-7a9e4c7eddae',
    error_details: 'Error insertando el registro con id 123 por invalid email',
    target_table: 'usuarios',
};

describe('ValueObjectShortString50', () => {
    it('should create a valid value object', () => {
        const vo = new ValueObjectShortString50('target_table', 'usuarios');
        expect(vo.value).toBe('usuarios');
    });

    it('should throw error if string exceeds max length (50)', () => {
        const longValue = 'a'.repeat(51);
        const err = captureErrorMessage(() => new ValueObjectShortString50('target_table', longValue));
        expect(err).toBe('target_table: The value must be at most 50 characters long');
    });

    it('should allow null if nullable=true', () => {
        const vo = new ValueObjectShortString50('target_table', null, true);
        expect(vo.value).toBe(null);
    });

    it('should throw error if null and nullable=false', () => {
        const err = captureErrorMessage(() => new ValueObjectShortString50('target_table', null));
        expect(err).toBe('target_table: The value cannot be null');
    });
});

describe('ValueObjectFilePath', () => {
    it('should create a valid value object', () => {
        const vo = new ValueObjectFilePath('folder/data.csv');
        expect(vo.value).toBe('folder/data.csv');
    });

    it('should throw error if string is too short (less than 5)', () => {
        const err = captureErrorMessage(() => new ValueObjectFilePath('abc'));
        expect(err).toBe('file_path: The value must be at least 5 characters long');
    });

    it('should throw error if string exceeds max length (500)', () => {
        const longValue = 'a'.repeat(501);
        const err = captureErrorMessage(() => new ValueObjectFilePath(longValue));
        expect(err).toBe('file_path: The value must be at most 500 characters long');
    });

    it('should allow null if nullable=true', () => {
        const vo = new ValueObjectFilePath(null, true);
        expect(vo.value).toBe(null);
    });

    it('should throw error if null and nullable=false', () => {
        const err = captureErrorMessage(() => new ValueObjectFilePath(null));
        expect(err).toBe('file_path: The value cannot be null');
    });
});

describe('S3ImportFile Aggregate', () => {
    it('should create an instance with valid data', () => {
        const entity = S3ImportFile.create(validDto);
        expect(entity.file_path.value).toBe(validDto.file_path);
        expect(entity.status.value).toBe(validDto.status);
        expect(entity.total_records.value).toBe(validDto.total_records);
        expect(entity.target_table.value).toBe(validDto.target_table);
    });

    it('should throw if invalid total_records (negative)', () => {
        const invalidDto = { ...validDto, total_records: -1 };
        const err = captureErrorMessage(() => new S3ImportFile(invalidDto));
        expect(err).toBe('total_records: The value -1 must be a positive integer');
    });

    it('should update file_path and mark it as changed', () => {
        const entity = S3ImportFile.create(validDto);
        entity.file_path = 'bucket/new-file.csv';
        expect(entity.file_path.value).toBe('bucket/new-file.csv');
        expect(entity.changedAttributes.file_path).toBe('bucket/new-file.csv');
    });

    it('should format error_details correctly', () => {
        const entity = S3ImportFile.create(validDto);
        const formatted = entity.error_details.value;
        expect(formatted.insertErrors.length).toBe(1);
        expect(formatted.insertErrors[0].id_record).toBe('123');
        expect(formatted.insertErrors[0].error_detail).toBe('invalid email');
    });

    it('should allow null error_details and return null', () => {
        const entity = S3ImportFile.create({ ...validDto, error_details: null });
        expect(entity.error_details.value).toBe(null);
    });

    it('should default should_override_array to false when not provided', () => {
        const entity = S3ImportFile.create(validDto);
        expect(entity.should_override_array.value).toBe(false);
    });

    it('should store should_override_array as true when provided', () => {
        const entity = S3ImportFile.create({ ...validDto, should_override_array: true });
        expect(entity.should_override_array.value).toBe(true);
    });

    it('should update should_override_array via setter and mark it as changed', () => {
        const entity = S3ImportFile.create(validDto);
        entity.should_override_array = true;
        expect(entity.should_override_array.value).toBe(true);
        expect(entity.changedAttributes.should_override_array).toBe(true);
    });
});

describe('S3FileImport App Service', () => {
    const mockRepository = {
        getSchemaTables: jest.fn(),
        save: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should save a new S3ImportFile if target_table is valid', async () => {
        mockRepository.getSchemaTables.mockResolvedValue(['usuarios', 'clientes']);
        const service = new S3FileImport(mockRepository);

        const result = await service.execute(validDto);

        expect(mockRepository.getSchemaTables).toHaveBeenCalled();
        expect(mockRepository.save).toHaveBeenCalled();
        expect(mockRepository.save.mock.calls[0][0]).toBeInstanceOf(S3ImportFile);
        expect(mockRepository.save.mock.calls[0][0].target_table.value).toBe('usuarios');
        expect(typeof result).toBe('string');
        expect(result).toBe(mockRepository.save.mock.calls[0][0].id.value);
    });

    it('should throw InvalidTargetTableError if target_table is invalid', async () => {
        mockRepository.getSchemaTables.mockResolvedValue(['usuarios', 'clientes']);
        const service = new S3FileImport(mockRepository);
        await expect(service.execute({ ...validDto, target_table: 'invalid_table' })).rejects.toThrow(
            InvalidTargetTableError
        );
    });

    it('should throw InvalidTargetTableError when getSchemaTables resolves to null (falls back to an empty list)', async () => {
        mockRepository.getSchemaTables.mockResolvedValue(null);
        const service = new S3FileImport(mockRepository);

        await expect(service.execute(validDto)).rejects.toThrow(InvalidTargetTableError);
        expect(mockRepository.save).not.toHaveBeenCalled();
    });
});

describe('S3ImportsCollectionResponse', () => {
    const mockS3File = (overrides = {}) => ({
        id: { value: 'uuid-123' },
        file_path: { value: 'bucket/myfile.csv' },
        status: { value: 'READY' },
        upload_attempts: { value: 1 },
        total_records: { value: 100 },
        processed_records: { value: 90 },
        last_updated_at: { value: '2024-01-01T00:00:00Z' },
        error_details: { value: [{ id_record: 'abc', error_detail: 'invalid email' }] },
        target_table: { value: 'usuarios' },
        created_at: { value: '2023-12-31T00:00:00Z' },
        created_by: { value: 'user-abc' },
        ...overrides,
    });

    it('should return proper JSON structure via toJson()', () => {
        const files = [mockS3File(), mockS3File({ id: { value: 'uuid-456' } })];
        const response = new S3ImportsCollectionResponse(files);
        const json = response.toJson();

        expect(json.data.items.length).toBe(2);
        expect(json.data.items[0].file_path).toBe('bucket/myfile.csv');
        expect(json.data.items[1].id).toBe('uuid-456');
        expect(json.data.items[0].error_details).toEqual([{ id_record: 'abc', error_detail: 'invalid email' }]);
        expect(json.metadata).toEqual({});
    });
});

describe('S3ImportsDashboard App Service', () => {
    const mockRepository = {
        findImportsByUser: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should call repository and return a collection response', async () => {
        const fakeUserId = 'user-123';
        const mockS3File = {
            id: { value: '1' },
            file_path: { value: 'bucket/file1.csv' },
            status: { value: 'READY' },
            upload_attempts: { value: 1 },
            total_records: { value: 10 },
            processed_records: { value: 9 },
            last_updated_at: { value: '2024-01-01T00:00:00Z' },
            error_details: { value: null },
            target_table: { value: 'usuarios' },
            created_at: { value: '2023-12-31T00:00:00Z' },
            created_by: { value: 'user-123' },
        };

        mockRepository.findImportsByUser.mockResolvedValue([mockS3File]);

        const service = new S3ImportsDashboard(mockRepository);
        const result = await service.execute(fakeUserId);

        expect(result).toBeInstanceOf(S3ImportsCollectionResponse);

        const json = result.toJson();
        expect(json.data.items.length).toBe(1);
        expect(json.data.items[0].file_path).toBe('bucket/file1.csv');
        expect(json.data.items[0].status).toBe('READY');
    });
});

describe('CsvValueNormalizer', () => {
    it('should convert string "null" and empty string to null', () => {
        expect(CsvValueNormalizer.normalize('null')).toBe(null);
        expect(CsvValueNormalizer.normalize('')).toBe(null);
        expect(CsvValueNormalizer.normalize(undefined)).toBe(null);
    });

    it('should convert "true"/"false" to booleans', () => {
        expect(CsvValueNormalizer.normalize('true')).toBe(true);
        expect(CsvValueNormalizer.normalize('false')).toBe(false);
    });

    it('should parse integers and floats', () => {
        expect(CsvValueNormalizer.normalize('10')).toBe(10);
        expect(CsvValueNormalizer.normalize('10.5')).toBe(10.5);
    });

    it('should parse ISO date strings to Date objects', () => {
        const result = CsvValueNormalizer.normalize('2024-01-01T12:00:00.000Z');
        expect(result instanceof Date).toBe(true);
    });

    it('should strip quotes from strings', () => {
        expect(CsvValueNormalizer.normalize('"text"')).toBe('text');
    });

    it('should parse JSON objects', () => {
        const result = CsvValueNormalizer.normalize('{"key": "value"}');
        expect(result).toEqual({ key: 'value' });
    });

    it('should return original string if not matchable', () => {
        expect(CsvValueNormalizer.normalize('custom_value')).toBe('custom_value');
    });

    // BUG (documented, not fixed — task forbids touching src/): the "array-like" branch does
    // `JSON.parse(JSON.stringify(value))`, but `value` is already a STRING here, so
    // `JSON.stringify('[1,2,3]')` produces the JSON-encoded string `'"[1,2,3]"'`, and parsing
    // that back just returns the original string unchanged. The branch clearly intended to
    // parse the array (`JSON.parse(value)` on its own would do that), but as written it never
    // converts anything — the "normalized" value is byte-for-byte identical to the input.
    it('BUG: the array-like branch does not actually parse — it is a no-op round trip through JSON.stringify', () => {
        const result = CsvValueNormalizer.normalize('[1,2,3]');
        expect(result).toBe('[1,2,3]');
    });

    it('should NOT take the array-like path when only one of "[" / "]" is present', () => {
        expect(CsvValueNormalizer.normalize('a[b')).toBe('a[b');
        expect(CsvValueNormalizer.normalize('a]b')).toBe('a]b');
    });
});

describe('CsvParserService', () => {
    describe('detectDelimiter()', () => {
        it('should detect comma as default delimiter', () => {
            const sample = 'id,name\n1,Alice\n2,Bob';
            expect(CsvParserService.detectDelimiter(sample)).toBe(',');
        });

        it('should detect semicolon as delimiter', () => {
            const sample = 'id;name\n1;Alice\n2;Bob';
            expect(CsvParserService.detectDelimiter(sample)).toBe(';');
        });
    });

    describe('parse()', () => {
        it('should parse CSV content into array of objects (comma)', async () => {
            const content = 'id,name\n1,Alice\n2,Bob';
            const result = await CsvParserService.parse(content);
            expect(result.length).toBe(2);
            expect(result[0]).toEqual({ id: '1', name: 'Alice' });
        });

        it('should parse CSV content into array of objects (semicolon)', async () => {
            const content = 'id;name\n1;Alice\n2;Bob';
            const result = await CsvParserService.parse(content);
            expect(result.length).toBe(2);
            expect(result[1]).toEqual({ id: '2', name: 'Bob' });
        });

        it('should reject invalid CSV format', async () => {
            const invalid = null;
            await expect(CsvParserService.parse(invalid)).rejects.toThrow();
        });
    });
});

describe('CsvRecordProcessorService', () => {
    const usersRepository = new KnexUsersRepository(knexConfig);
    const mockRepo = {
        updateImport: jest.fn(),
        saveRecord: jest.fn(),
        updateRecord: jest.fn(),
    };

    const fileRecord = {
        id: { value: 'file-123' },
        upload_attempts: { value: 1 },
        target_table: { value: 'clasificaciones' },
    };

    const dummyNormalizer = (val) => val;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should complete successfully when all records are inserted', async () => {
        mockRepo.saveRecord.mockResolvedValue();
        const records = [{ id: '1' }, { id: '2' }];

        const result = await CsvRecordProcessorService.execute(
            records,
            fileRecord,
            mockRepo,
            dummyNormalizer,
            usersRepository
        );

        expect(mockRepo.saveRecord).toHaveBeenCalledTimes(2);
        expect(result.status).toBe('completed');
    });

    it('should return incompleted if some records fail', async () => {
        mockRepo.saveRecord.mockImplementationOnce(() => Promise.reject('Error - invalid format'));
        mockRepo.saveRecord.mockImplementationOnce(() => Promise.resolve());

        const records = [{ id: '1' }, { id: '2' }];

        const result = await CsvRecordProcessorService.execute(
            records,
            fileRecord,
            mockRepo,
            dummyNormalizer,
            usersRepository
        );

        expect(result.status).toBe('incompleted');
        expect(result.error_details).toMatch(/Error insertando la fila 2 \(id: 1\)/);
    });

    it('should reject processing if too many errors', async () => {
        mockRepo.saveRecord.mockImplementation(() => Promise.reject('Error - fail'));

        const records = Array.from({ length: 25 }, (_, i) => ({ id: `${i + 1}` }));

        const result = await CsvRecordProcessorService.execute(
            records,
            fileRecord,
            mockRepo,
            dummyNormalizer,
            usersRepository
        );

        expect(result.status).toBe('rejected');
        expect(result.error_details).toContain('Too many insert errors');
        expect(mockRepo.saveRecord).toHaveBeenCalledTimes(20);
    });

    it('calls repository.updateRecord (not saveRecord) for a DELETE action on a generic (non-usuarios/aux_) table', async () => {
        mockRepo.updateRecord.mockResolvedValue();
        const deleteFileRecord = {
            ...fileRecord,
            action_type: { value: 'DELETE' },
            created_by: { value: 'creator-1' },
        };
        const records = [{ id: '1' }];

        const result = await CsvRecordProcessorService.execute(
            records,
            deleteFileRecord,
            mockRepo,
            dummyNormalizer,
            usersRepository
        );

        expect(mockRepo.updateRecord).toHaveBeenCalledTimes(1);
        const [tableName, id, deleteDto] = mockRepo.updateRecord.mock.calls[0];
        expect(tableName).toBe('clasificaciones');
        expect(id).toBe('1');
        expect(deleteDto).toMatchObject({ deleted_by: 'creator-1' });
        expect(deleteDto.deleted_at).toBeInstanceOf(Date);
        expect(mockRepo.saveRecord).not.toHaveBeenCalled();
        expect(result.status).toBe('completed');
    });
});

describe('CsvFileStructureValidator', () => {
    it('should return empty array when csvContent is empty', () => {
        const result = usersCsvFileStructureValidator.execute([]);
        expect(result).toEqual([]);
    });

    it('should return empty array when records contain only allowed columns', () => {
        const csvContent = [
            {
                id: '1',
                nombres: 'Guillermo',
                apellido1: 'Mejia',
                apellido2: 'Vasquez',
                email: 'guillermo.mejia@konecta.com',
                telefono: '5512345678',
                movil: '5512345678',
                is_active: '1',
                rol_id: 'abc',
                codigos_externos: '{"abcd":"abcd"}',
                external_id: '',
                grupos: 'grupo1',
            },
        ];

        const result = usersCsvFileStructureValidator.execute(csvContent);
        expect(result).toEqual([]);
    });

    it('should return errors when there are invalid columns', () => {
        const csvContent = [
            {
                id: '2',
                nombres: 'Test',
                apellido1: 'User',
                email: 'test@konecta.com',
                telefono: '123',
                movil: '456',
                is_active: '1',
                rol_id: 'xyz',
                codigos_externos: '',
                external_id: '',
                grupo_activo: 'invalid_column_value',
            },
        ];

        const result = usersCsvFileStructureValidator.execute(csvContent);

        expect(result).toContain('registro con id:2 presenta la siguiente columna invalida:grupo_activo');
    });

    it('should stop collecting errors after reaching 20', () => {
        const csvContent = Array.from({ length: 25 }, (_, i) => ({
            id: `rec-${i}`,
            nombres: 'Test',
            apellido1: 'User',
            email: 'test@konecta.com',
            telefono: '123',
            movil: '456',
            is_active: '1',
            rol_id: 'xyz',
            codigos_externos: '',
            external_id: '',
            columna_extra: 'invalid',
        }));

        const result = usersCsvFileStructureValidator.execute(csvContent);

        expect(result.length).toBeLessThanOrEqual(20);
    });

    it('reports a missing "id" without also flagging its other columns as invalid', () => {
        const csvContent = [{ nombres: 'Sin Id', email: 'sinid@konecta.com' }];

        const result = usersCsvFileStructureValidator.execute(csvContent);

        expect(result).toEqual(['Archivo inválido: el campo "id" es requerido']);
    });
});

describe('CsvContentValidator.validate', () => {
    let repository;

    beforeEach(() => {
        repository = {
            findActiveRoleById: jest.fn(),
            findActiveGroupsByIds: jest.fn(),
        };
        jest.clearAllMocks();
    });

    it('devuelve isValid=true y sanitiza el registro cuando todo es válido', async () => {
        const roleId = uuidv4();
        const g1 = uuidv4();
        const g2 = uuidv4();

        repository.findActiveRoleById.mockResolvedValue({ id: roleId });
        repository.findActiveGroupsByIds.mockResolvedValue([{ id: g1 }, { id: g2 }]);

        const csv = [
            {
                id: uuidv4(),
                nombres: 'Luis',
                apellido1: 'Galvan',
                email: 'luis@example.com',
                telefono: '3112345678',
                movil: '3001234567',
                is_active: '1',
                rol_id: roleId,
                codigos_externos: 'abcd',
                external_id: 'mi_ext',
                grupos: `${g1}, ${g2}`,
            },
        ];

        const res = await usersCsvContentValidator.validate(csv, repository);

        expect(res.isValid).toBe(true);
        expect(res.errors).toHaveLength(0);
        expect(res.sanitized).toHaveLength(1);

        expect(res.sanitized[0]).toMatchObject({
            id: csv[0].id,
            nombres: 'Luis',
            apellido1: 'Galvan',
            email: 'luis@example.com',
            telefono: '3112345678',
            movil: '3001234567',
            is_active: 1,
            rol_id: roleId,
            codigos_externos: { abcd: 'abcd' },
            external_id: 'mi_ext',
            grupos: `${g1}, ${g2}`,
        });
    });

    it('marca error si is_active no es numérico (p.ej., "on") y lo incluye en summary', async () => {
        const csv = [
            {
                id: uuidv4(),
                nombres: 'Ana',
                email: 'ana@example.com',
                is_active: 'on',
            },
        ];

        const res = await usersCsvContentValidator.validate(csv, repository);

        expect(res.isValid).toBe(false);
        expect(res.errors).toHaveLength(1);
        expect(res.errors[0]).toMatchObject({
            row: 1,
            errors: expect.arrayContaining([
                expect.objectContaining({ field: 'is_active', message: 'Invalid numeric enum value' }),
            ]),
        });
        expect(res.summary).toContain('Error en el registro 1');
        expect(res.summary).toContain('Invalid numeric enum value');
    });

    it('valida formato de UUIDs en "grupos" y reporta los inválidos', async () => {
        const bad1 = 'not-a-uuid';
        const bad2 = '123';
        const good = uuidv4();

        repository.findActiveGroupsByIds.mockResolvedValue([{ id: good }]);

        const csv = [
            {
                id: uuidv4(),
                nombres: 'Pepe',
                email: 'pepe@example.com',
                grupos: `${bad1}, ${good}, ${bad2}`,
            },
        ];

        const res = await usersCsvContentValidator.validate(csv, repository);

        expect(res.isValid).toBe(false);
        const err = res.errors[0].errors.find((e) => e.field === 'grupos');
        expect(err).toBeDefined();
        expect(err.message).toContain('Formato de UUID inválido');
        expect(err.message).toContain(bad1);
        expect(err.message).toContain(bad2);
    });

    it('reporta grupos no encontrados en BD', async () => {
        const g1 = uuidv4();
        const g2 = uuidv4();
        repository.findActiveGroupsByIds.mockResolvedValue([{ id: g1 }]);

        const csv = [
            {
                id: uuidv4(),
                nombres: 'Marta',
                email: 'marta@example.com',
                grupos: `${g1},${g2}`,
            },
        ];

        const res = await usersCsvContentValidator.validate(csv, repository);

        expect(res.isValid).toBe(false);
        const err = res.errors[0].errors.find((e) => e.field === 'grupos');
        expect(err.message).toContain('Los siguientes grupos no existen o están eliminados');
        expect(err.message).toContain(g2);
    });

    it('reporta rol_id inexistente', async () => {
        const roleId = uuidv4();
        repository.findActiveRoleById.mockResolvedValue(null);

        const csv = [
            {
                id: uuidv4(),
                nombres: 'Juan',
                email: 'juan@example.com',
                rol_id: roleId,
            },
        ];

        const res = await usersCsvContentValidator.validate(csv, repository);

        expect(res.isValid).toBe(false);
        const err = res.errors[0].errors.find((e) => e.field === 'rol_id');
        expect(err.message).toBe('El rol no existe o está eliminado');
    });

    it('corta la validación cuando alcanza 20 filas con error', async () => {
        const csv = Array.from({ length: 25 }, (_, i) => ({
            id: uuidv4(),
            nombres: `User ${i}`,
            email: `u${i}@example.com`,
            is_active: 'no-num',
        }));

        const res = await usersCsvContentValidator.validate(csv, repository);

        expect(res.isValid).toBe(false);
        expect(res.errors.length).toBeLessThanOrEqual(20);
    });

    it('ignora campos no permitidos y solo valida los permitidos', async () => {
        const roleId = uuidv4();
        repository.findActiveRoleById.mockResolvedValue({ id: roleId });

        const csv = [
            {
                id: uuidv4(),
                nombres: 'Test',
                email: 'test@example.com',
                is_active: '1',
                rol_id: roleId,
                columna_extra: 'debe_ignorarse',
            },
        ];

        const res = await usersCsvContentValidator.validate(csv, repository);
        expect(res.isValid).toBe(true);
        expect(res.sanitized[0]).not.toHaveProperty('columna_extra');
    });

    it('devuelve un resultado vacío pero válido cuando csvContent es null o undefined', async () => {
        const resNull = await usersCsvContentValidator.validate(null, repository);
        const resUndefined = await usersCsvContentValidator.validate(undefined, repository);

        expect(resNull).toEqual({ isValid: true, errors: [], sanitized: [], summary: '' });
        expect(resUndefined).toEqual({ isValid: true, errors: [], sanitized: [], summary: '' });
        expect(repository.findActiveRoleById).not.toHaveBeenCalled();
    });

    it('trata una fila null dentro del array como si no tuviera ningún campo permitido', async () => {
        const res = await usersCsvContentValidator.validate([null], repository);

        expect(res.isValid).toBe(true);
        expect(res.sanitized).toHaveLength(1);
        expect(res.sanitized[0]).not.toHaveProperty('id');
        expect(res.sanitized[0]).not.toHaveProperty('nombres');
    });

    it('deduplica ids de grupo repetidos antes de consultarlos en BD', async () => {
        const g1 = uuidv4();
        repository.findActiveGroupsByIds.mockResolvedValue([{ id: g1 }]);

        const csv = [
            {
                id: uuidv4(),
                nombres: 'Dup',
                email: 'dup@example.com',
                grupos: `${g1},${g1},${g1}`,
            },
        ];

        const res = await usersCsvContentValidator.validate(csv, repository);

        expect(res.isValid).toBe(true);
        expect(repository.findActiveGroupsByIds).toHaveBeenCalledWith([g1]);
    });

    it('no consulta grupos en BD cuando todos los ids tienen formato inválido', async () => {
        const csv = [
            {
                id: uuidv4(),
                nombres: 'Malo',
                email: 'malo@example.com',
                grupos: 'not-a-uuid,also-bad',
            },
        ];

        const res = await usersCsvContentValidator.validate(csv, repository);

        expect(res.isValid).toBe(false);
        expect(repository.findActiveGroupsByIds).not.toHaveBeenCalled();
        const err = res.errors[0].errors.find((e) => e.field === 'grupos');
        expect(err.message).toContain('Formato de UUID inválido');
    });

    it('trata una cadena de grupos compuesta solo por espacios como si no hubiera grupos', async () => {
        const csv = [
            {
                id: uuidv4(),
                nombres: 'Espacios',
                email: 'espacios@example.com',
                grupos: '   ',
            },
        ];

        const res = await usersCsvContentValidator.validate(csv, repository);

        expect(res.isValid).toBe(true);
        expect(repository.findActiveGroupsByIds).not.toHaveBeenCalled();
        expect(res.errors).toHaveLength(0);
    });
});

describe('buildAuxJsonFromCsv', () => {
    it('agrupa filas por id y construye arrays anidados correctamente', () => {
        const csvContent = [
            {
                id: '1',
                nombre: 'pepito',
                cedula: '5555',
                'contactos::nombre': 'juan',
                'contactos::telefono': '123',
                'contactos::direccion': 'calle 123',
            },
            {
                id: '1',
                nombre: 'pepito',
                cedula: '5555',
                'contactos::nombre': 'pablo',
                'contactos::telefono': '456',
                'contactos::direccion': 'calle 456',
            },
            {
                id: '2',
                nombre: 'pablito',
                cedula: '654sd',
            },
        ];

        const result = buildAuxJsonFromCsv(csvContent);

        expect(result).toEqual([
            {
                id: '1',
                nombre: 'pepito',
                cedula: '5555',
                contactos: [
                    { nombre: 'juan', telefono: '123', direccion: 'calle 123' },
                    { nombre: 'pablo', telefono: '456', direccion: 'calle 456' },
                ],
            },
            {
                id: '2',
                nombre: 'pablito',
                cedula: '654sd',
            },
        ]);
    });

    it('asigna UUID a filas sin id e ignora columnas vacías', () => {
        const csvContent = [
            {
                id: '',
                nombre: 'sin-id',
            },
            {
                id: '10',
                nombre: 'con-id',
                cedula: '',
                'contactos::nombre': '',
            },
        ];

        const result = buildAuxJsonFromCsv(csvContent);

        expect(result).toHaveLength(2);

        const sinId = result.find((r) => r.nombre === 'sin-id');
        expect(sinId).toBeDefined();
        expect(typeof sinId.id).toBe('string');
        expect(sinId.id.length).toBeGreaterThan(0);

        expect(result).toEqual(expect.arrayContaining([expect.objectContaining({ nombre: 'con-id', id: '10' })]));

        const conId = result.find((r) => r.id === '10');
        expect(conId.cedula).toBeUndefined();
    });
});

describe('buildAuxJsonFromCsv - data compleja con progreso y contactos', () => {
    it('construye correctamente objeto con progreso (object) y contactos (array) para varios ids', () => {
        const csvContent = [
            {
                id: '1',
                edad: '10',
                nombre: 'Jose',
                'progreso::inicio': 'true',
                'progreso::finalizado': 'false',
                'progreso::intermedio': 'true',
                'contactos::nombre': 'David',
                'contactos::telefono': '5467894560',
                constituido: 'true',
            },
            {
                id: '1',
                edad: '10',
                nombre: 'Jose',
                'progreso::inicio': 'true',
                'progreso::finalizado': 'false',
                'progreso::intermedio': 'true',
                'contactos::nombre': 'Felipe',
                'contactos::telefono': '987654310',
                constituido: 'true',
            },

            {
                id: '2',
                edad: '10',
                nombre: 'Jose',
                'progreso::inicio': 'true',
                'progreso::finalizado': 'false',
                'progreso::intermedio': 'true',
                'contactos::nombre': 'David',
                'contactos::telefono': '5467894560',
                constituido: 'true',
            },
            {
                id: '2',
                edad: '10',
                nombre: 'Jose',
                'progreso::inicio': 'true',
                'progreso::finalizado': 'false',
                'progreso::intermedio': 'true',
                'contactos::nombre': 'Felipe',
                'contactos::telefono': '987654310',
                constituido: 'true',
            },

            {
                id: '3',
                edad: '10',
                nombre: 'Jose',
                'progreso::inicio': 'true',
                'progreso::finalizado': 'false',
                'progreso::intermedio': 'true',
                'contactos::nombre': 'David',
                'contactos::telefono': '5467894560',
                constituido: 'true',
            },
            {
                id: '3',
                edad: '10',
                nombre: 'Jose',
                'progreso::inicio': 'true',
                'progreso::finalizado': 'false',
                'progreso::intermedio': 'true',
                'contactos::nombre': 'Felipe',
                'contactos::telefono': '987654310',
                constituido: 'true',
            },
        ];

        const result = buildAuxJsonFromCsv(csvContent);

        expect(result).toEqual([
            {
                id: '1',
                edad: '10',
                nombre: 'Jose',
                constituido: 'true',
                progreso: {
                    inicio: 'true',
                    finalizado: 'false',
                    intermedio: 'true',
                },
                contactos: [
                    { nombre: 'David', telefono: '5467894560' },
                    { nombre: 'Felipe', telefono: '987654310' },
                ],
            },
            {
                id: '2',
                edad: '10',
                nombre: 'Jose',
                constituido: 'true',
                progreso: {
                    inicio: 'true',
                    finalizado: 'false',
                    intermedio: 'true',
                },
                contactos: [
                    { nombre: 'David', telefono: '5467894560' },
                    { nombre: 'Felipe', telefono: '987654310' },
                ],
            },
            {
                id: '3',
                edad: '10',
                nombre: 'Jose',
                constituido: 'true',
                progreso: {
                    inicio: 'true',
                    finalizado: 'false',
                    intermedio: 'true',
                },
                contactos: [
                    { nombre: 'David', telefono: '5467894560' },
                    { nombre: 'Felipe', telefono: '987654310' },
                ],
            },
        ]);
    });
});

describe('buildAuxJsonFromCsv - múltiples arreglos', () => {
    const dataStructure = {
        direccion: { type: 'string' },
        nombre: { type: 'string' },
        contactos: {
            type: 'array',
            data_structure: { label: { type: 'string' }, value: { type: 'string' } },
        },
        tipo: {
            type: 'array',
            data_structure: { label: { type: 'string' }, value: { type: 'string' } },
        },
    };

    it('reconstruye múltiples arreglos desde CSV con celdas vacías intercaladas', () => {
        const csvContent = [
            {
                id: '1',
                direccion: 'Carrera 32',
                nombre: 'Jordi',
                'contactos::label': 'Cuentas de servicio Integraciones',
                'contactos::value': '86d21b1f-013d-4426-89bc-08521f3e81ef',
                'tipo::label': 'Cuentas de servicio Integraciones',
                'tipo::value': '86d21b1f-013d-4426-89bc-08521f3e81ef',
            },
            {
                id: '1',
                direccion: 'Carrera 32',
                nombre: 'Jordi',
                'contactos::label': '',
                'contactos::value': '',
                'tipo::label': 'Administradores Operación',
                'tipo::value': 'd96cce1d-8d79-46af-aadc-a6ea005419aa',
            },
            {
                id: '1',
                direccion: 'Carrera 32',
                nombre: 'Jordi',
                'contactos::label': '',
                'contactos::value': '',
                'tipo::label': 'Cierre de expediente',
                'tipo::value': 'b0c55b4e-e8d6-48da-8b43-0ccb38dd5616',
            },
        ];

        const result = buildAuxJsonFromCsv(csvContent, dataStructure);

        expect(result).toHaveLength(1);
        const record = result[0];

        expect(record.id).toBe('1');
        expect(record.direccion).toBe('Carrera 32');
        expect(record.nombre).toBe('Jordi');

        expect(record.contactos).toHaveLength(1);
        expect(record.contactos[0]).toEqual({
            label: 'Cuentas de servicio Integraciones',
            value: '86d21b1f-013d-4426-89bc-08521f3e81ef',
        });

        expect(record.tipo).toHaveLength(3);
        expect(record.tipo[1]).toEqual({
            label: 'Administradores Operación',
            value: 'd96cce1d-8d79-46af-aadc-a6ea005419aa',
        });
        expect(record.tipo[2]).toEqual({
            label: 'Cierre de expediente',
            value: 'b0c55b4e-e8d6-48da-8b43-0ccb38dd5616',
        });
    });

    it('no inyecta entradas vacías en arreglos cuando las celdas están en blanco', () => {
        const csvContent = [
            { id: '2', 'contactos::label': '', 'contactos::value': '', 'tipo::label': 'A', 'tipo::value': '1' },
            { id: '2', 'contactos::label': '', 'contactos::value': '', 'tipo::label': 'B', 'tipo::value': '2' },
        ];

        const result = buildAuxJsonFromCsv(csvContent, dataStructure);
        const record = result[0];

        expect(record.contactos).toHaveLength(0);
        expect(record.tipo).toHaveLength(2);
    });

    it('no duplica elementos idénticos dentro del mismo arreglo', () => {
        const csvContent = [
            { id: '3', 'tipo::label': 'Repetido', 'tipo::value': 'v1' },
            { id: '3', 'tipo::label': 'Repetido', 'tipo::value': 'v1' },
        ];

        const result = buildAuxJsonFromCsv(csvContent, dataStructure);
        expect(result[0].tipo).toHaveLength(1);
    });

    it('crea arreglos vacíos para arrayFields declarados que no aparecen en el CSV', () => {
        const csvContent = [{ id: '4', nombre: 'Sin arreglos' }];

        const result = buildAuxJsonFromCsv(csvContent, dataStructure);
        expect(result[0].contactos).toEqual([]);
        expect(result[0].tipo).toEqual([]);
    });

    it('roundtrip: flattenAuxRow → buildAuxJsonFromCsv produce el objeto original', () => {
        const originalData = {
            direccion: 'Carrera 32',
            nombre: 'Jordi',
            contactos: [{ label: 'Cuentas de servicio Integraciones', value: '86d21b1f' }],
            tipo: [
                { label: 'Cuentas de servicio Integraciones', value: '86d21b1f' },
                { label: 'Administradores Operación', value: 'd96cce1d' },
                { label: 'Cierre de expediente', value: 'b0c55b4e' },
            ],
        };

        const dbRow = { id: 'roundtrip-id', data: JSON.stringify(originalData) };

        const flatRows = flattenAuxRow(dbRow, ['id'], dataStructure);

        const normalizedCsvRows = flatRows.map((row) => {
            const normalized = {};
            for (const [k, v] of Object.entries(row)) {
                normalized[k] = v !== undefined ? v : '';
            }
            return normalized;
        });

        const reconstructed = buildAuxJsonFromCsv(normalizedCsvRows, dataStructure);

        expect(reconstructed).toHaveLength(1);
        const record = reconstructed[0];
        expect(record.id).toBe('roundtrip-id');
        expect(record.direccion).toBe(originalData.direccion);
        expect(record.nombre).toBe(originalData.nombre);
        expect(record.contactos).toHaveLength(originalData.contactos.length);
        expect(record.tipo).toHaveLength(originalData.tipo.length);
        expect(record.contactos).toEqual(originalData.contactos);
        expect(record.tipo).toEqual(originalData.tipo);
    });
});
