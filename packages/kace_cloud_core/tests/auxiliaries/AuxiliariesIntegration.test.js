import { v4 as uuidv4 } from 'uuid';
import { knexConfig } from '../knexfile.js';
import { KnexAuxiliariesRepository } from '../../src/auxiliaries/infrastructure/persistence/KnexAuxiliariesRepository.js';
import { AuxiliaryMother } from './domain/AuxiliaryMother.js';
import { Auxiliary } from '../../src/auxiliaries/domain/Auxiliary.js';
import { AuxiliaryCreator } from '../../src/auxiliaries/application/create/AuxiliaryCreator.js';
import { SchemaMetadataCache, ValidationFailError } from '../../src/shared/index.js';
import { AuxiliaryDeleter } from '../../src/auxiliaries/application/delete/AuxiliaryDeleter.js';
import { AuxiliaryBulkDeleter } from '../../src/auxiliaries/application/delete/AuxiliaryBulkDeleter.js';
import { AuxiliaryFinder } from '../../src/auxiliaries/application/find/AuxiliaryFinder.js';
import { AuxiliaryResponse } from '../../src/auxiliaries/application/AuxiliaryResponse.js';
import { AuxiliarySearcher } from '../../src/auxiliaries/application/search/AuxiliarySearcher.js';
import { AuxiliaryCollectionResponse } from '../../src/auxiliaries/application/AuxiliaryCollectionResponse.js';
import { AuxiliaryUpdater } from '../../src/auxiliaries/application/update/AuxiliaryUpdater.js';
import { AuxiliaryListSearcher } from '../../src/auxiliaries/application/AuxiliaryListSearcher.js';
import { AUXILIARY_RECORD_HAS_MAIN_ENTITY_DEPENDENCY } from '@kace/error-codes';

describe('Auxiliaries integration test', () => {
    const repository = new KnexAuxiliariesRepository(knexConfig);

    // El reset por test elimina las tablas ausentes del manifiesto, asi que el DDL
    // se rehace en cada test y no una sola vez.
    beforeEach(async () => {
        SchemaMetadataCache.clear();
        await repository.connection.schema.dropTableIfExists('aux_proveedores');
        await repository.connection.schema.createTable('aux_proveedores', (table) => {
            table.string('id', 36).primary();
            table.jsonb('data').notNullable();
            table.timestamp('created_at');
            table.timestamp('updated_at');
            table.timestamp('deleted_at').nullable();
            table.string('created_by', 36);
            table.string('updated_by', 36);
            table.string('deleted_by', 36);
        });

        await repository.connection.schema.dropTableIfExists('history_aux_proveedores');
        await repository.connection.schema.createTable('history_aux_proveedores', (table) => {
            table.string('id', 36).primary();
            table.string('entity_id', 36);
            table.jsonb('changed_attributes');
            table.jsonb('new_attributes');
            table.jsonb('original_attributes');
            table.timestamp('created_at');
            table.string('created_by', 36);
        });
    });

    beforeEach(async () => {
        await repository.connection('aux_proveedores').delete();
        await repository.connection('history_aux_proveedores').delete();
    });
    beforeEach(() => SchemaMetadataCache.clear());

    it('successfully creates a new record in an existing auxiliary table', async () => {
        const tableName = 'aux_proveedores';
        const auxiliaryCreator = new AuxiliaryCreator(repository);
        const data = AuxiliaryMother.dto();

        await expect(auxiliaryCreator.execute(data, tableName)).resolves.not.toThrow();
    });

    it('throws ValidationFailError when trying to create a record in a non-existent auxiliary table', async () => {
        const tableName = 'non_existent_table';
        const auxiliaryCreator = new AuxiliaryCreator(repository);
        const data = {
            nombre: 'Test Case',
            descripcion: 'Test Description',
        };

        await expect(auxiliaryCreator.execute(data, tableName)).rejects.toThrow(ValidationFailError);
    });

    it('throws ValidationFailError when trying to create an auxiliary record with empty data', async () => {
        const tableName = 'aux_proveedores';
        const auxiliaryCreator = new AuxiliaryCreator(repository);
        const data = {};

        await expect(auxiliaryCreator.execute(data, tableName)).rejects.toThrow(ValidationFailError);
    });

    it('throws ValidationFailError when trying to create an auxiliary record with null data', async () => {
        const tableName = 'aux_proveedores';
        const auxiliaryCreator = new AuxiliaryCreator(repository);
        const data = null;

        await expect(auxiliaryCreator.execute(data, tableName)).rejects.toThrow(ValidationFailError);
    });

    it('successfully deletes an existing auxiliary record and updates deletion metadata', async () => {
        const tableName = 'aux_proveedores';
        const auxiliary = await AuxiliaryMother.create(repository, tableName);
        const auxiliaryDeleter = new AuxiliaryDeleter(repository);

        const deletedAt = new Date().toISOString();
        const deletedBy = uuidv4();
        await auxiliaryDeleter.execute(auxiliary.id.value, { deleted_at: deletedAt, deleted_by: deletedBy }, tableName);

        const notFound = await repository.find(auxiliary.id, tableName);
        expect(notFound).toBeNull();

        const raw = await repository.connection(tableName).where({ id: auxiliary.id.value }).first();
        // El driver de postgres devuelve timestamptz como Date, y el dto viaja en
        // ISO: se compara el instante, no su representacion. Mismo criterio en
        // todas las aserciones de fecha de este archivo.
        expect(raw.deleted_at).toEqual(new Date(deletedAt));
        expect(raw.deleted_by).toBe(deletedBy);
    });

    it('throws ValidationFailError when trying to delete an auxiliary record from a non-existent table', async () => {
        const auxiliaryDeleter = new AuxiliaryDeleter(repository);
        const tableName = 'non_existent_table';
        const id = uuidv4();
        const dto = { deleted_at: new Date().toISOString(), deleted_by: uuidv4() };

        await expect(auxiliaryDeleter.execute(id, dto, tableName)).rejects.toThrow(ValidationFailError);
    });

    it('successfully finds an existing auxiliary record and returns it with the expected structure', async () => {
        const tableName = 'aux_proveedores';
        const savedRecord = await AuxiliaryMother.create(repository, tableName);
        const auxiliaryFinder = new AuxiliaryFinder(repository);

        const foundRecord = await auxiliaryFinder.execute(savedRecord.id.value, tableName);

        expect(foundRecord).toBeInstanceOf(AuxiliaryResponse);
        const responseJson = foundRecord.toJson();
        expect(responseJson).toHaveProperty('data');
        expect(responseJson.data.id).toBe(savedRecord.id.value);
        expect(responseJson.data.data.nombre).toBe(savedRecord.data.value.nombre);
        expect(responseJson.data.data.descripcion).toBe(savedRecord.data.value.descripcion);
    });

    it('returns an empty response object when the auxiliary record does not exist', async () => {
        const tableName = 'aux_proveedores';
        const nonExistentId = uuidv4();
        const auxiliaryFinder = new AuxiliaryFinder(repository);

        const foundRecord = await auxiliaryFinder.execute(nonExistentId, tableName);

        expect(foundRecord).toBeInstanceOf(AuxiliaryResponse);
        expect(foundRecord.toJson()).toEqual({});
    });

    it('throws ValidationFailError when trying to find an auxiliary record in a non-existent table', async () => {
        const tableName = 'non_existent_table';
        const id = uuidv4();
        const auxiliaryFinder = new AuxiliaryFinder(repository);

        await expect(auxiliaryFinder.execute(id, tableName)).rejects.toThrow(ValidationFailError);
    });

    it('throws ValidationFailError when trying to find an auxiliary record with a null ID', async () => {
        const tableName = 'aux_proveedores';
        const auxiliaryFinder = new AuxiliaryFinder(repository);

        await expect(auxiliaryFinder.execute(null, tableName)).rejects.toThrow(ValidationFailError);
    });

    it('successfully searches auxiliary records using filters and excludes soft-deleted entries (integration)', async () => {
        const tableName = 'aux_proveedores';
        const auxiliarySearcher = new AuxiliarySearcher(repository);

        const activos = [
            { data: { nombre: 'Test Case 1', descripcion: 'Description 1' } },
            { data: { nombre: 'Test Case 2', descripcion: 'Description 2' } },
        ];
        for (const data of activos) {
            await AuxiliaryMother.create(repository, tableName, data);
        }

        const eliminados = [{ data: { nombre: 'Deleted Case', descripcion: 'Deleted Description' } }];
        for (const data of eliminados) {
            const auxiliary = await AuxiliaryMother.create(repository, tableName, data);
            await repository
                .connection(tableName)
                .where('id', auxiliary.id.value)
                .update({ deleted_at: new Date().toISOString() });
        }

        const dtoCriteria = {
            filter: null,
            relationship: null,
            limit: null,
            offset: null,
            order: null,
        };

        const result = await auxiliarySearcher.execute(dtoCriteria, tableName);

        expect(result).toBeInstanceOf(AuxiliaryCollectionResponse);
        const responseJson = result.toJson();

        expect(responseJson.data.items).toHaveLength(2);
        expect(Number(responseJson.metadata.count)).toBe(2);

        responseJson.data.items.forEach((item) => {
            expect(item.deleted_at).toBeNull();
        });
    });

    it('successfully updates an existing auxiliary record and persists the changes (integration)', async () => {
        const tableName = 'aux_proveedores';

        const originalData = {
            data: { nombre: 'Original Case', descripcion: 'Original Description' },
        };
        const auxiliary = await AuxiliaryMother.create(repository, tableName, originalData);

        const updateData = {
            data: {
                nombre: 'Updated Case',
                descripcion: 'Updated Description',
            },
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
        };

        const auxiliaryUpdater = new AuxiliaryUpdater(repository);
        await auxiliaryUpdater.execute(auxiliary.id.value, updateData, tableName);

        const updatedRawRecord = await repository.connection(tableName).where('id', auxiliary.id.value).first();

        expect(updatedRawRecord.data.nombre).toBe('Updated Case');
        expect(updatedRawRecord.data.descripcion).toBe('Updated Description');
        expect(updatedRawRecord.updated_at).toEqual(new Date(updateData.updated_at));
        expect(updatedRawRecord.updated_by).toBe(updateData.updated_by);
    });

    it('successfully updates an existing auxiliary record with nested data and persists the changes (integration)', async () => {
        const tableName = 'aux_proveedores';

        const originalData = {
            data: {
                edad: 65,
                nombre: 'name1',
                progreso: {
                    inicio: true,
                },
                contactos: [
                    {
                        nombre: 'name3',
                        telefono: '6987',
                    },
                ],
                constituido: false,
                fecha_inicio: 1753452132983,
            },
        };

        const auxiliary = await AuxiliaryMother.create(repository, tableName, originalData);

        const updateData = {
            data: {
                progreso: {
                    intermedio: true,
                },
            },
        };

        const auxiliaryUpdater = new AuxiliaryUpdater(repository);
        await auxiliaryUpdater.execute(auxiliary.id.value, updateData, tableName);

        const updatedRawRecord = await repository.connection(tableName).where('id', auxiliary.id.value).first();

        expect(updatedRawRecord.data.progreso.inicio).toBe(true);
        expect(updatedRawRecord.data.progreso.intermedio).toBe(true);
    });

    it('successfully updates an existing auxiliary record with nested data and nested object persists the changes ', async () => {
        const tableName = 'aux_proveedores';

        const originalData = {
            data: {
                edad: 65,
                nombre: 'name1',
                progreso: {
                    inicio: true,
                },
                contactos: [
                    {
                        nombre: 'name3',
                        telefono: '6987',
                    },
                ],
                constituido: false,
                fecha_inicio: 1753452132983,
            },
        };

        const auxiliary = await AuxiliaryMother.create(repository, tableName, originalData);

        const updateData = {
            data: {
                progreso: {
                    intermedio: true,
                },
                contactos: [
                    {
                        nombre: 'new name',
                        telefono: '6987',
                    },
                ],
            },
        };

        const auxiliaryUpdater = new AuxiliaryUpdater(repository);

        await expect(auxiliaryUpdater.execute(auxiliary.id.value, updateData, tableName)).resolves.not.toThrow();
    });

    it('throws ValidationFailError when trying to update an auxiliary record in a non-existent table', async () => {
        const tableName = 'non_existent_table';
        const id = uuidv4();
        const updateData = {
            data: {
                nombre: 'Updated Case',
                descripcion: 'Updated Description',
            },
        };

        const auxiliaryUpdater = new AuxiliaryUpdater(repository);
        await expect(auxiliaryUpdater.execute(id, updateData, tableName)).rejects.toThrow(ValidationFailError);
    });

    it('throws ValidationFailError when trying to update an auxiliary record with a null ID', async () => {
        const tableName = 'aux_proveedores';
        const updateData = {
            data: {
                nombre: 'Updated Case',
                descripcion: 'Updated Description',
            },
        };

        const auxiliaryUpdater = new AuxiliaryUpdater(repository);
        await expect(auxiliaryUpdater.execute(null, updateData, tableName)).rejects.toThrow(ValidationFailError);
    });

    // El SQLInjectionGuard solo bloquea en modo enforce, y la corrida hereda
    // SQL_GUARD_MODE=observe del .env de la raiz que carga jest.config.js. Estos
    // dos tests describen el modo enforce, asi que lo fijan ellos en vez de
    // depender del entorno ambiente. El XSSGuard no tiene modo observe y no lo
    // necesita.
    const withEnforceGuard = async (assertion) => {
        const previous = process.env.SQL_GUARD_MODE;
        delete process.env.SQL_GUARD_MODE;

        try {
            await assertion();
        } finally {
            if (previous === undefined) {
                delete process.env.SQL_GUARD_MODE;
            } else {
                process.env.SQL_GUARD_MODE = previous;
            }
        }
    };

    it('falla si un string en el campo data intenta inyectar SQL', async () => {
        const tableName = 'aux_proveedores';
        const auxiliaryCreator = new AuxiliaryCreator(repository);

        const data = AuxiliaryMother.dto({
            data: {
                nombre: 'into',
                descripcion: 'Descripción válida',
            },
        });

        await withEnforceGuard(() =>
            expect(auxiliaryCreator.execute(data, tableName)).rejects.toThrow(/Palabras prohibidas detectadas/)
        );
    });

    it('falla si un string en el campo data contiene un ataque XSS', async () => {
        const tableName = 'aux_proveedores';
        const auxiliaryCreator = new AuxiliaryCreator(repository);

        const data = AuxiliaryMother.dto({
            data: {
                nombre: '<script>',
                descripcion: 'Descripción válida',
            },
        });

        await expect(auxiliaryCreator.execute(data, tableName)).rejects.toThrow(/Palabras prohibidas detectadas/);
    });

    it('falla al actualizar un registro si un string en el campo data intenta inyectar SQL', async () => {
        const tableName = 'aux_proveedores';
        const originalData = {
            data: { nombre: 'Original', descripcion: 'Original' },
        };
        const auxiliary = await AuxiliaryMother.create(repository, tableName, originalData);

        const updateData = {
            data: {
                nombre: 'into',
                descripcion: 'Descripción válida',
            },
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
        };
        const auxiliaryUpdater = new AuxiliaryUpdater(repository);
        await withEnforceGuard(() =>
            expect(auxiliaryUpdater.execute(auxiliary.id.value, updateData, tableName)).rejects.toThrow(
                /Palabras prohibidas detectadas/
            )
        );
    });

    it('falla al actualizar un registro si un string en el campo data contiene un ataque XSS', async () => {
        const tableName = 'aux_proveedores';
        const originalData = {
            data: { nombre: 'Original', descripcion: 'Original' },
        };
        const auxiliary = await AuxiliaryMother.create(repository, tableName, originalData);

        const updateData = {
            data: {
                nombre: '<script>',
                descripcion: 'Descripción válida',
            },
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
        };
        const auxiliaryUpdater = new AuxiliaryUpdater(repository);
        await expect(auxiliaryUpdater.execute(auxiliary.id.value, updateData, tableName)).rejects.toThrow(
            /Palabras prohibidas detectadas/
        );
    });

    it('successfully creates a new record and returns the created record', async () => {
        const tableName = 'aux_proveedores';
        const auxiliaryCreator = new AuxiliaryCreator(repository);

        const dto = AuxiliaryMother.dto();

        const savedAuxiliary = await auxiliaryCreator.execute(dto, tableName);

        expect(savedAuxiliary).toBeInstanceOf(AuxiliaryResponse);

        const json = savedAuxiliary.toJson();

        expect(json).toHaveProperty('data');
        expect(json.data).toMatchObject({
            id: dto.id,
            data: dto.data,
            created_at: dto.created_at,
            created_by: dto.created_by,
            updated_at: dto.updated_at,
            updated_by: dto.updated_by,
            deleted_at: dto.deleted_at,
            deleted_by: dto.deleted_by,
        });
    });

    it('devuelve colección con el "data" completo de cada fila cuando no se pasa fieldPath', async () => {
        const tableName = 'aux_proveedores';

        await AuxiliaryMother.create(repository, tableName, {
            data: { barrio: 'candelaria', activo: true },
        });
        await AuxiliaryMother.create(repository, tableName, {
            data: { barrio: 'manrique', activo: false },
        });

        const searcher = new AuxiliaryListSearcher(repository);
        const res = await searcher.execute(tableName);
        const json = res.toJson();

        expect(Array.isArray(json.data)).toBe(true);
        expect(json.data.length).toBe(2);

        expect(json.data).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ barrio: 'candelaria', activo: true }),
                expect.objectContaining({ barrio: 'manrique', activo: false }),
            ])
        );

        expect(json.metadata.count).toBe(2);
    });

    it('lanza ValidationFailError si fieldPath termina en un objeto (no primitivo)', async () => {
        const tableName = 'aux_proveedores';

        await AuxiliaryMother.create(repository, tableName, {
            data: {
                auxcli_campanya: {
                    BASE_PRUEBAVALIDADOR: { auxcli_barrio: 'candelaria', activo: true },
                },
            },
        });

        const searcher = new AuxiliaryListSearcher(repository);

        await expect(searcher.execute(tableName, 'auxcli_campanya.BASE_PRUEBAVALIDADOR')).rejects.toThrow(
            ValidationFailError
        );
    });

    it('omite null/undefined al extraer por fieldPath cuando algunas filas no tienen la ruta', async () => {
        const tableName = 'aux_proveedores';

        await AuxiliaryMother.create(repository, tableName, {
            data: { a: { b: 'ok' } },
        });

        await AuxiliaryMother.create(repository, tableName, {
            data: { a: {} },
        });

        const searcher = new AuxiliaryListSearcher(repository);
        const res = await searcher.execute(tableName, 'a.b');
        const json = res.toJson();

        expect(json.data).toEqual(['ok']);
        expect(json.metadata.count).toBe(1);
    });

    it('deduplica valores primitivos extraídos por fieldPath', async () => {
        const tableName = 'aux_proveedores';

        await AuxiliaryMother.create(repository, tableName, {
            data: { barrio: 'candelaria' },
        });
        await AuxiliaryMother.create(repository, tableName, {
            data: { barrio: 'candelaria' },
        });
        await AuxiliaryMother.create(repository, tableName, {
            data: { barrio: 'manrique' },
        });

        const searcher = new AuxiliaryListSearcher(repository);
        const res = await searcher.execute(tableName, 'barrio');
        const json = res.toJson();

        expect(new Set(json.data)).toEqual(new Set(['candelaria', 'manrique']));
        expect(json.metadata.count).toBe(2);
    });

    it('lanza error si fieldPath termina en array, pero permite acceder a un índice (primitivo)', async () => {
        const tableName = 'aux_proveedores';

        await AuxiliaryMother.create(repository, tableName, {
            data: {
                auxcli_campanya: {
                    BASE_PRUEBAVALIDADOR: { auxcli_tags: ['A', 'B', 'C'] },
                },
            },
        });

        const searcher = new AuxiliaryListSearcher(repository);

        await expect(searcher.execute(tableName, 'auxcli_campanya.BASE_PRUEBAVALIDADOR.auxcli_tags')).rejects.toThrow(
            ValidationFailError
        );

        const resElem = await searcher.execute(tableName, 'auxcli_campanya.BASE_PRUEBAVALIDADOR.auxcli_tags.1');
        const jsonElem = resElem.toJson();
        expect(jsonElem.data).toEqual(['B']);
        expect(jsonElem.metadata.count).toBe(1);
    });

    it('devuelve colección vacía cuando la ruta no existe en ninguna fila', async () => {
        const tableName = 'aux_proveedores';
        await AuxiliaryMother.create(repository, tableName, {
            data: { a: { b: 1 } },
        });

        const searcher = new AuxiliaryListSearcher(repository);
        const res = await searcher.execute(tableName, 'a.x.y.z');
        const json = res.toJson();

        expect(json.data).toEqual([]);
        expect(json.metadata.count).toBe(0);
    });

    it('devuelve colección vacía cuando la tabla no tiene registros', async () => {
        const tableName = 'aux_proveedores';

        const searcher = new AuxiliaryListSearcher(repository);
        const res = await searcher.execute(tableName, 'barrio');
        const json = res.toJson();

        expect(json.data).toEqual([]);
        expect(json.metadata.count).toBe(0);
    });

    it('save persiste created_at y created_by en la tabla auxiliar', async () => {
        const tableName = 'aux_proveedores';
        const createdAt = '2025-01-15T10:30:00.000Z';
        const createdBy = uuidv4();
        const dto = AuxiliaryMother.dto({ created_at: createdAt, created_by: createdBy });
        const auxiliary = new Auxiliary(dto);

        await repository.save(auxiliary, tableName);

        const row = await repository.connection(tableName).where('id', auxiliary.id.value).first();
        expect(row.created_at).toEqual(new Date(createdAt));
        expect(row.created_by).toBe(createdBy);
    });

    it('saveHistory persiste created_at y created_by en la tabla history_aux_*', async () => {
        const tableName = 'aux_proveedores';
        const historyTable = 'history_aux_proveedores';
        const createdAt = '2025-01-20T14:00:00.000Z';
        const createdBy = uuidv4();
        const dto = AuxiliaryMother.dto({ created_at: createdAt, created_by: createdBy });
        const auxiliary = new Auxiliary(dto);

        await repository.connection(historyTable).delete();
        await repository.saveHistory(auxiliary, null, tableName);

        const row = await repository
            .connection(historyTable)
            .where('entity_id', auxiliary.id.value)
            .orderBy('created_at', 'desc')
            .first();
        expect(row).toBeDefined();
        expect(row.created_at).toEqual(new Date(createdAt));
        expect(row.created_by).toBe(createdBy);
    });

    describe('existsByFieldValue', () => {
        it('should return false when no record with the given field value exists', async () => {
            const tableName = 'aux_proveedores';
            const result = await repository.existsByFieldValue(tableName, 'nombre', 'NONEXISTENT', null);
            expect(result).toBe(false);
        });

        it('should return true when a record with the given field value exists', async () => {
            const tableName = 'aux_proveedores';
            await AuxiliaryMother.create(repository, tableName, { data: { nombre: 'CODIGO-001' } });

            const result = await repository.existsByFieldValue(tableName, 'nombre', 'CODIGO-001', null);
            expect(result).toBe(true);
        });

        it('should return false when the only matching record is excluded by id', async () => {
            const tableName = 'aux_proveedores';
            const record = await AuxiliaryMother.create(repository, tableName, { data: { nombre: 'CODIGO-SELF' } });

            const result = await repository.existsByFieldValue(tableName, 'nombre', 'CODIGO-SELF', {
                id: record.id.value,
            });
            expect(result).toBe(false);
        });

        it('should return true when another record has the same value (different id)', async () => {
            const tableName = 'aux_proveedores';
            await AuxiliaryMother.create(repository, tableName, { data: { nombre: 'CODIGO-DUP' } });
            const current = await AuxiliaryMother.create(repository, tableName, { data: { nombre: 'CODIGO-DUP' } });

            const result = await repository.existsByFieldValue(tableName, 'nombre', 'CODIGO-DUP', {
                id: current.id.value,
            });
            expect(result).toBe(true);
        });

        it('should return false when the matching record is soft-deleted', async () => {
            const tableName = 'aux_proveedores';
            const record = await AuxiliaryMother.create(repository, tableName, { data: { nombre: 'CODIGO-DELETED' } });
            await repository
                .connection(tableName)
                .where('id', record.id.value)
                .update({ deleted_at: new Date().toISOString() });

            const result = await repository.existsByFieldValue(tableName, 'nombre', 'CODIGO-DELETED', null);
            expect(result).toBe(false);
        });

        it('should return true for a nested field path when a matching record exists', async () => {
            const tableName = 'aux_proveedores';
            await AuxiliaryMother.create(repository, tableName, {
                data: { direccion: { calle: 'Av. Principal 123' } },
            });

            const result = await repository.existsByFieldValue(
                tableName,
                ['direccion', 'calle'],
                'Av. Principal 123',
                null
            );
            expect(result).toBe(true);
        });

        it('should return false for a nested field path when no matching record exists', async () => {
            const tableName = 'aux_proveedores';
            const result = await repository.existsByFieldValue(tableName, ['direccion', 'calle'], 'NONEXISTENT', null);
            expect(result).toBe(false);
        });
    });

    describe('unique field validation via use case', () => {
        const dataStructure = { codigo: { type: 'string', required: false, unique: true } };
        const tableName = 'aux_proveedores';

        it('AuxiliaryCreator throws ValidationFailError when creating a record with a duplicate unique field value', async () => {
            const auxiliaryCreator = new AuxiliaryCreator(repository);
            const first = AuxiliaryMother.dto({ data: { codigo: 'UNIQUE-001' } });
            await auxiliaryCreator.execute(first, tableName, dataStructure);

            const duplicate = AuxiliaryMother.dto({ data: { codigo: 'UNIQUE-001' } });
            await expect(auxiliaryCreator.execute(duplicate, tableName, dataStructure)).rejects.toThrow(
                ValidationFailError
            );
        });

        it('AuxiliaryCreator allows creating multiple records with null for a unique field', async () => {
            const auxiliaryCreator = new AuxiliaryCreator(repository);
            const first = AuxiliaryMother.dto({ data: { codigo: null } });
            const second = AuxiliaryMother.dto({ data: { codigo: null } });

            await expect(auxiliaryCreator.execute(first, tableName, dataStructure)).resolves.not.toThrow();
            await expect(auxiliaryCreator.execute(second, tableName, dataStructure)).resolves.not.toThrow();
        });

        it('AuxiliaryUpdater throws ValidationFailError when updating to a unique value owned by another record', async () => {
            const auxiliaryCreator = new AuxiliaryCreator(repository);
            const auxiliaryUpdater = new AuxiliaryUpdater(repository);

            const recordA = AuxiliaryMother.dto({ data: { codigo: 'CODE-A' } });
            const recordB = AuxiliaryMother.dto({ data: { codigo: 'CODE-B' } });
            await auxiliaryCreator.execute(recordA, tableName, dataStructure);
            await auxiliaryCreator.execute(recordB, tableName, dataStructure);

            const updateDto = {
                data: { codigo: 'CODE-A' },
                updated_at: new Date().toISOString(),
                updated_by: uuidv4(),
            };
            await expect(
                auxiliaryUpdater.execute(recordB.id, updateDto, tableName, false, dataStructure)
            ).rejects.toThrow(ValidationFailError);
        });

        it('AuxiliaryUpdater allows updating a record to its own unique field value (self-exclude)', async () => {
            const auxiliaryCreator = new AuxiliaryCreator(repository);
            const auxiliaryUpdater = new AuxiliaryUpdater(repository);

            const record = AuxiliaryMother.dto({ data: { codigo: 'CODE-SELF' } });
            await auxiliaryCreator.execute(record, tableName, dataStructure);

            const updateDto = {
                data: { codigo: 'CODE-SELF' },
                updated_at: new Date().toISOString(),
                updated_by: uuidv4(),
            };
            await expect(
                auxiliaryUpdater.execute(record.id, updateDto, tableName, false, dataStructure)
            ).resolves.not.toThrow();
        });
    });

    it('saveHistory usa updated_at cuando existe en lugar de created_at', async () => {
        const tableName = 'aux_proveedores';
        const historyTable = 'history_aux_proveedores';
        const createdAt = '2025-01-20T14:00:00.000Z';
        const updatedAt = '2025-02-19T10:00:00.000Z';
        const createdBy = uuidv4();
        const updatedBy = uuidv4();

        const dto = AuxiliaryMother.dto({
            created_at: createdAt,
            created_by: createdBy,
            updated_at: updatedAt,
            updated_by: updatedBy,
        });
        const auxiliary = new Auxiliary(dto);

        await repository.connection(historyTable).delete();
        await repository.saveHistory(auxiliary, null, tableName);

        const row = await repository
            .connection(historyTable)
            .where('entity_id', auxiliary.id.value)
            .orderBy('created_at', 'desc')
            .first();
        expect(row).toBeDefined();
        expect(row.created_at).toEqual(new Date(updatedAt));
        expect(row.created_by).toBe(updatedBy);
    });

    describe('hasMainEntityDependency validation', () => {
        const tableName = 'aux_proveedores';

        beforeEach(async () => {
            await repository.connection('cases').delete();
        });

        it('blocks deletion when FK references an existing main entity', async () => {
            const casoId = uuidv4();
            await repository.connection('cases').insert({ id: casoId });

            const createdAux = await AuxiliaryMother.create(repository, tableName, {
                data: { nombre: 'Aux with FK', caso_id: casoId },
            });

            const hasDependency = await repository.hasMainEntityDependency(createdAux.id.value, tableName);

            expect(hasDependency).toBe(true);
        });

        it('allows deletion when FK references a deleted main entity', async () => {
            const casoId = uuidv4();
            await repository.connection('cases').insert({ id: casoId, deleted_at: new Date().toISOString() });

            const createdAux = await AuxiliaryMother.create(repository, tableName, {
                data: { nombre: 'Aux with deleted FK', caso_id: casoId },
            });

            const hasDependency = await repository.hasMainEntityDependency(createdAux.id.value, tableName);

            expect(hasDependency).toBe(false);

            // La premisa del test -el caso existe y esta borrado- se fija aparte para
            // distinguir este false del que saldria si la fila no existiera.
            const caso = await repository.connection('cases').where('id', casoId).first();
            expect(caso.deleted_at).not.toBeNull();
        });

        it('allows deletion when no FK exists in data', async () => {
            const createdAux = await AuxiliaryMother.create(repository, tableName, {
                data: { nombre: 'Aux without FK' },
            });

            const hasDependency = await repository.hasMainEntityDependency(createdAux.id.value, tableName);

            expect(hasDependency).toBe(false);
        });

        it('blocks deletion when data.notificacion_id references a live user_notification', async () => {
            const notificacionId = uuidv4();
            await repository.connection('user_notifications').insert({ id: notificacionId });

            const createdAux = await AuxiliaryMother.create(repository, tableName, {
                data: { nombre: 'Aux linked to notification', notificacion_id: notificacionId },
            });

            const hasDependency = await repository.hasMainEntityDependency(createdAux.id.value, tableName);

            expect(hasDependency).toBe(true);
        });

        it('allows deletion when data.notificacion_id references a deleted user_notification', async () => {
            const notificacionId = uuidv4();
            await repository
                .connection('user_notifications')
                .insert({ id: notificacionId, deleted_at: new Date().toISOString() });

            const createdAux = await AuxiliaryMother.create(repository, tableName, {
                data: { nombre: 'Aux linked to deleted notification', notificacion_id: notificacionId },
            });

            const hasDependency = await repository.hasMainEntityDependency(createdAux.id.value, tableName);

            expect(hasDependency).toBe(false);

            // La premisa -la notificacion existe y esta borrada- se fija aparte para
            // distinguir este false del que saldria si la fila no existiera.
            const notificacion = await repository.connection('user_notifications').where('id', notificacionId).first();
            expect(notificacion.deleted_at).not.toBeNull();
        });
    });

    describe('AuxiliaryDeleter blocks deletion when main entity exists', () => {
        const tableName = 'aux_proveedores';

        beforeEach(async () => {
            await repository.connection('cases').delete();
        });

        it('throws ValidationFailError when auxiliary has FK to existing main entity', async () => {
            const casoId = uuidv4();
            await repository.connection('cases').insert({ id: casoId });

            const auxiliary = await AuxiliaryMother.create(repository, tableName, {
                data: { nombre: 'Aux linked', caso_id: casoId },
            });

            const auxiliaryDeleter = new AuxiliaryDeleter(repository);
            const dto = { deleted_at: new Date().toISOString(), deleted_by: uuidv4() };

            await expect(auxiliaryDeleter.execute(auxiliary.id.value, dto, tableName)).rejects.toThrow(
                'No se puede eliminar el registro porque está vinculado a una entidad principal'
            );

            try {
                await auxiliaryDeleter.execute(auxiliary.id.value, dto, tableName);
            } catch (error) {
                expect(error.publicErrorCode).toBe(AUXILIARY_RECORD_HAS_MAIN_ENTITY_DEPENDENCY);
            }
        });

        it('allows deletion when main entity is deleted', async () => {
            const casoId = uuidv4();
            await repository.connection('cases').insert({ id: casoId, deleted_at: new Date().toISOString() });

            const auxiliary = await AuxiliaryMother.create(repository, tableName, {
                data: { nombre: 'Aux with deleted FK', caso_id: casoId },
            });

            const auxiliaryDeleter = new AuxiliaryDeleter(repository);
            const dto = { deleted_at: new Date().toISOString(), deleted_by: uuidv4() };

            await expect(auxiliaryDeleter.execute(auxiliary.id.value, dto, tableName)).resolves.not.toThrow();

            // El borrado se comprueba sobre la fila, no solo por la ausencia de
            // excepcion: asi el test sigue diciendo algo aunque la guarda de
            // dependencia este muerta.
            const raw = await repository.connection(tableName).where('id', auxiliary.id.value).first();
            expect(raw.deleted_at).toEqual(new Date(dto.deleted_at));
        });
    });

    describe('AuxiliaryBulkDeleter integration', () => {
        const tableName = 'aux_proveedores';

        beforeEach(async () => {
            await repository.connection('cases').delete();
        });

        it('successfully bulk deletes multiple records', async () => {
            const auxiliary1 = await AuxiliaryMother.create(repository, tableName);
            const auxiliary2 = await AuxiliaryMother.create(repository, tableName);
            const auxiliary3 = await AuxiliaryMother.create(repository, tableName);

            const bulkDeleter = new AuxiliaryBulkDeleter(repository);
            const deletedAt = new Date().toISOString();
            const deletedBy = uuidv4();

            const result = await bulkDeleter.execute(
                [auxiliary1.id.value, auxiliary2.id.value, auxiliary3.id.value],
                { deleted_at: deletedAt, deleted_by: deletedBy },
                tableName
            );

            expect(result.deleted).toHaveLength(3);
            expect(result.skipped).toHaveLength(0);

            expect(await repository.find(auxiliary1.id, tableName)).toBeNull();
            expect(await repository.find(auxiliary2.id, tableName)).toBeNull();
            expect(await repository.find(auxiliary3.id, tableName)).toBeNull();

            const raw1 = await repository.connection(tableName).where({ id: auxiliary1.id.value }).first();
            const raw2 = await repository.connection(tableName).where({ id: auxiliary2.id.value }).first();
            const raw3 = await repository.connection(tableName).where({ id: auxiliary3.id.value }).first();
            expect(raw1.deleted_at).toEqual(new Date(deletedAt));
            expect(raw1.deleted_by).toBe(deletedBy);
            expect(raw2.deleted_at).toEqual(new Date(deletedAt));
            expect(raw3.deleted_at).toEqual(new Date(deletedAt));
        });

        it('throws ValidationFailError when trying to bulk delete from a non-existent table', async () => {
            const bulkDeleter = new AuxiliaryBulkDeleter(repository);
            const tableName = 'non_existent_table';
            const ids = [uuidv4()];
            const dto = { deleted_at: new Date().toISOString(), deleted_by: uuidv4() };

            await expect(bulkDeleter.execute(ids, dto, tableName)).rejects.toThrow(ValidationFailError);
        });

        it('skips ids that do not exist', async () => {
            const tableName = 'aux_proveedores';
            const existingAuxiliary = await AuxiliaryMother.create(repository, tableName);

            const bulkDeleter = new AuxiliaryBulkDeleter(repository);
            const dto = { deleted_at: new Date().toISOString(), deleted_by: uuidv4() };

            const result = await bulkDeleter.execute([existingAuxiliary.id.value, uuidv4()], dto, tableName);
            console.log(result);
            expect(result.deleted).toHaveLength(1);
            expect(result.deleted).toContain(existingAuxiliary.id.value);
            expect(result.skipped).toHaveLength(1);
        });

        it('throws ValidationFailError when ids array is empty', async () => {
            const tableName = 'aux_proveedores';
            const bulkDeleter = new AuxiliaryBulkDeleter(repository);
            const dto = { deleted_at: new Date().toISOString(), deleted_by: uuidv4() };

            await expect(bulkDeleter.execute([], dto, tableName)).rejects.toThrow(ValidationFailError);
        });

        it('skips records that are already deleted', async () => {
            const tableName = 'aux_proveedores';
            const auxiliary1 = await AuxiliaryMother.create(repository, tableName);
            const auxiliary2 = await AuxiliaryMother.create(repository, tableName);

            const previousDeletedAt = new Date().toISOString();
            await repository
                .connection(tableName)
                .where('id', auxiliary1.id.value)
                .update({ deleted_at: previousDeletedAt });

            const bulkDeleter = new AuxiliaryBulkDeleter(repository);
            const newDeletedAt = new Date().toISOString();
            const deletedBy = uuidv4();

            const result = await bulkDeleter.execute(
                [auxiliary1.id.value, auxiliary2.id.value],
                { deleted_at: newDeletedAt, deleted_by: deletedBy },
                tableName
            );

            expect(result.deleted).toHaveLength(1);
            expect(result.deleted).toContain(auxiliary2.id.value);
            expect(result.skipped).toHaveLength(1);
            expect(result.skipped).toContain(auxiliary1.id.value);

            const raw1 = await repository.connection(tableName).where({ id: auxiliary1.id.value }).first();
            const raw2 = await repository.connection(tableName).where({ id: auxiliary2.id.value }).first();
            expect(raw1.deleted_at).toEqual(new Date(previousDeletedAt));
            expect(raw2.deleted_at).toEqual(new Date(newDeletedAt));
        });

        it('blocks auxiliary with FK dependency in bulk delete', async () => {
            const casoId = uuidv4();
            await repository.connection('cases').insert({ id: casoId });

            const auxiliary1 = await AuxiliaryMother.create(repository, tableName, {
                data: { nombre: 'Aux linked', caso_id: casoId },
            });
            const auxiliary2 = await AuxiliaryMother.create(repository, tableName, {
                data: { nombre: 'Aux no link' },
            });

            const bulkDeleter = new AuxiliaryBulkDeleter(repository);
            const dto = { deleted_at: new Date().toISOString(), deleted_by: uuidv4() };

            const result = await bulkDeleter.execute([auxiliary1.id.value, auxiliary2.id.value], dto, tableName);

            expect(result.deleted).toHaveLength(1);
            expect(result.deleted).toContain(auxiliary2.id.value);
            expect(result.blocked).toHaveLength(1);
            expect(result.blocked).toContain(auxiliary1.id.value);
        });
    });

    describe('FK en columna directa (aux_cases): validación de dependencia con entidad principal', () => {
        const auxTableName = 'aux_cases';

        // `aux_cases` y `history_aux_cases` son tablas REALES del esquema migrado
        // (20240918191125_aux_casos.js, renombradas despues), asi que no se crean ni
        // se destruyen aqui: crearlas fallaria con "relation already exists" y el
        // dropTableIfExists se llevaria por delante tablas que el reset no repone.
        beforeEach(async () => {
            await repository.connection(auxTableName).delete();
            await repository.connection('cases').delete();
        });

        // caso_id es NOT NULL en la tabla real, asi que "sin dependencia" no se puede
        // expresar con null: se expresa apuntando a un caso que no existe.
        const insertAuxCase = async (casoId, extraData = {}) => {
            const id = uuidv4();
            await repository.connection(auxTableName).insert({
                id,
                caso_id: casoId,
                data: JSON.stringify({ nombre: 'Aux cases test', ...extraData }),
                created_at: new Date().toISOString(),
                created_by: uuidv4(),
            });
            return id;
        };

        describe('hasMainEntityDependency — path KNOWN_FK_COLUMNS (columna directa)', () => {
            it('retorna true cuando caso_id apunta a un caso activo', async () => {
                const casoId = uuidv4();
                await repository.connection('cases').insert({ id: casoId });
                const auxId = await insertAuxCase(casoId);

                const hasDependency = await repository.hasMainEntityDependency(auxId, auxTableName);

                expect(hasDependency).toBe(true);
            });

            it('retorna false cuando caso_id apunta a un caso inexistente', async () => {
                const auxId = await insertAuxCase(uuidv4());

                const hasDependency = await repository.hasMainEntityDependency(auxId, auxTableName);

                expect(hasDependency).toBe(false);
            });

            it('retorna false cuando caso_id apunta a un caso con deleted_at', async () => {
                const casoId = uuidv4();
                await repository.connection('cases').insert({ id: casoId, deleted_at: new Date().toISOString() });
                const auxId = await insertAuxCase(casoId);

                const hasDependency = await repository.hasMainEntityDependency(auxId, auxTableName);

                expect(hasDependency).toBe(false);

                // La premisa -el caso existe y esta borrado- se fija aparte para
                // distinguir este false del que saldria si la fila no existiera.
                const caso = await repository.connection('cases').where('id', casoId).first();
                expect(caso.deleted_at).not.toBeNull();
            });
        });

        describe('AuxiliaryDeleter — columna directa caso_id', () => {
            it('lanza ValidationFailError cuando caso_id referencia un caso activo', async () => {
                const casoId = uuidv4();
                await repository.connection('cases').insert({ id: casoId });
                const auxId = await insertAuxCase(casoId);

                const auxiliaryDeleter = new AuxiliaryDeleter(repository);
                const dto = { deleted_at: new Date().toISOString(), deleted_by: uuidv4() };

                await expect(auxiliaryDeleter.execute(auxId, dto, auxTableName)).rejects.toThrow(
                    'No se puede eliminar el registro porque está vinculado a una entidad principal'
                );
            });

            it('elimina correctamente cuando caso_id apunta a un caso inexistente', async () => {
                const auxId = await insertAuxCase(uuidv4());

                const auxiliaryDeleter = new AuxiliaryDeleter(repository);
                const deletedAt = new Date().toISOString();
                const dto = { deleted_at: deletedAt, deleted_by: uuidv4() };

                await expect(auxiliaryDeleter.execute(auxId, dto, auxTableName)).resolves.not.toThrow();

                const row = await repository.connection(auxTableName).where('id', auxId).first();
                expect(row.deleted_at).toEqual(new Date(deletedAt));
            });

            it('elimina correctamente cuando caso_id apunta a un caso ya eliminado', async () => {
                const casoId = uuidv4();
                await repository.connection('cases').insert({ id: casoId, deleted_at: new Date().toISOString() });
                const auxId = await insertAuxCase(casoId);

                const auxiliaryDeleter = new AuxiliaryDeleter(repository);
                const dto = { deleted_at: new Date().toISOString(), deleted_by: uuidv4() };

                await expect(auxiliaryDeleter.execute(auxId, dto, auxTableName)).resolves.not.toThrow();

                // El borrado se comprueba sobre la fila, no solo por la ausencia de
                // excepcion: la guarda de dependencia podria dejar pasar la llamada
                // sin llegar a marcar deleted_at.
                const row = await repository.connection(auxTableName).where('id', auxId).first();
                expect(row.deleted_at).toEqual(new Date(dto.deleted_at));
            });
        });

        describe('AuxiliaryBulkDeleter — columna directa caso_id', () => {
            it('mueve a blocked los registros cuyo caso_id referencia un caso activo', async () => {
                const casoId = uuidv4();
                await repository.connection('cases').insert({ id: casoId });

                const linkedId = await insertAuxCase(casoId);
                const freeId = await insertAuxCase(uuidv4());

                const bulkDeleter = new AuxiliaryBulkDeleter(repository);
                const dto = { deleted_at: new Date().toISOString(), deleted_by: uuidv4() };

                const result = await bulkDeleter.execute([linkedId, freeId], dto, auxTableName);

                expect(result.deleted).toHaveLength(1);
                expect(result.deleted).toContain(freeId);
                expect(result.blocked).toHaveLength(1);
                expect(result.blocked).toContain(linkedId);
                expect(result.skipped).toHaveLength(0);
            });

            it('elimina todos cuando ningún caso_id referencia un caso activo', async () => {
                const freeId1 = await insertAuxCase(uuidv4());
                const freeId2 = await insertAuxCase(uuidv4());

                const bulkDeleter = new AuxiliaryBulkDeleter(repository);
                const dto = { deleted_at: new Date().toISOString(), deleted_by: uuidv4() };

                const result = await bulkDeleter.execute([freeId1, freeId2], dto, auxTableName);

                expect(result.deleted).toHaveLength(2);
                expect(result.blocked).toHaveLength(0);
                expect(result.skipped).toHaveLength(0);

                // El borrado se comprueba sobre las filas: los conteos de arriba
                // saldrian igual aunque bulkDelete no marcara deleted_at.
                const rows = await repository.connection(auxTableName).whereIn('id', [freeId1, freeId2]);
                expect(rows.every((row) => row.deleted_at !== null)).toBe(true);
            });

            it('bloquea todos cuando todos los caso_id referencian casos activos', async () => {
                const casoId1 = uuidv4();
                const casoId2 = uuidv4();
                await repository.connection('cases').insert([{ id: casoId1 }, { id: casoId2 }]);

                const linkedId1 = await insertAuxCase(casoId1);
                const linkedId2 = await insertAuxCase(casoId2);

                const bulkDeleter = new AuxiliaryBulkDeleter(repository);
                const dto = { deleted_at: new Date().toISOString(), deleted_by: uuidv4() };

                const result = await bulkDeleter.execute([linkedId1, linkedId2], dto, auxTableName);

                expect(result.deleted).toHaveLength(0);
                expect(result.blocked).toHaveLength(2);
                expect(result.skipped).toHaveLength(0);
            });
        });
    });
});
