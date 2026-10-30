import { ExportTableData } from '../../src/exports/application/ExportTableData';
import { KnexExportsRepository } from '../../src/exports/infraestructure/persistence/KnexExportsRepository';
import { knexConfig } from '@kace/database';
import { CSVStorage } from '../../src/exports/domain/CSVStorage';
import { jest } from '@jest/globals';
import { Criteria, TenantContext } from '../../src/shared';
import flattenExternalCodes from '../../src/shared/domain/utilities/processExternalCodes';
import knex from 'knex';
import { flattenAuxRow } from '../../src/shared/domain/utilities/processAuxiliaryData';
import { ValidationFailError } from '../../src/shared';
import { KnexAuxDefinitionsRepository } from '../../src/aux_definitions/infrastructure/persitance/KnexAuxDefinitionsRepository';
import { KnexSchemasRepository } from '../../src/schemas/infrastructure/persistence/KnexSchemasRepository';

jest.mock('../../src/exports/infraestructure/persistence/KnexExportsRepository');
jest.mock('../../src/exports/domain/CSVStorage');

const mockTenant = {
    aws_s3_region: { value: 'us-east-1' },
    aws_s3_access_key_id: { value: 'test-access-key' },
    aws_s3_secret_access_key: { value: 'test-secret-key' },
    aws_s3_bucket: { value: 'test-bucket' },
    apps_debug: { value: '0' },
    apps_debug_level: { value: '1' },
};

describe('Criteria - Unit', () => {
    let query;

    beforeEach(() => {
        query = knex({ client: 'pg' }).table('test_table');
    });

    it('Debe aplicar filtros correctamente a la consulta', () => {
        const dtoCriteria = {
            filter: [
                { field: 'created_at', operator: 'gte', value: '2024-01-01', type: 'AND' },
                { field: 'deleted_at', operator: 'null', value: 'null', type: 'AND' },
            ],
            limit: 0,
            offset: 0,
        };

        const criteria = new Criteria(
            dtoCriteria.filter,
            dtoCriteria.relationships,
            dtoCriteria.limit,
            dtoCriteria.offset,
            dtoCriteria.order,
            'test_table'
        );
        criteria.convertToKnex(query);

        const sqlQuery = query.toSQL().toNative();

        expect(sqlQuery.sql).toContain(`"created_at" >= $1`);
        expect(sqlQuery.sql).toContain(`"deleted_at" is null`);
        expect(sqlQuery.bindings).toContain('2024-01-01');
        expect(sqlQuery.bindings).not.toContain('null');
    });

    it('Debe aplicar el operador BETWEEN correctamente', () => {
        const dtoCriteria = {
            filter: [{ field: 'created_at', operator: 'between', value: '2024-01-01, 2024-02-01', type: 'AND' }],
            limit: 0,
            offset: 0,
        };

        const criteria = new Criteria(
            dtoCriteria.filter,
            dtoCriteria.relationships,
            dtoCriteria.limit,
            dtoCriteria.offset,
            dtoCriteria.order,
            'test_table'
        );
        criteria.convertToKnex(query);

        const sqlQuery = query.toSQL().toNative();

        expect(sqlQuery.sql).toContain(`"created_at" between $1 and $2`);
        expect(sqlQuery.bindings).toContain('2024-01-01');
        expect(sqlQuery.bindings).toContain('2024-02-01');
    });
});

describe('ExportTableData - Unit', () => {
    let repository, useCase;

    beforeEach(() => {
        jest.spyOn(TenantContext, 'getTenant').mockReturnValue(mockTenant);
        repository = new KnexExportsRepository(knexConfig);
        repository.getData = jest.fn().mockResolvedValue([]);
        jest.spyOn(CSVStorage.prototype, 'save').mockResolvedValue('https://s3-bucket/exports/usuarios.csv');
        useCase = new ExportTableData(repository);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('debería exportar los datos de una tabla a un archivo CSV', async () => {
        repository.getData = jest.fn().mockResolvedValue([
            { id: 1, nombre: 'Juan', email: 'juan@example.com' },
            { id: 2, nombre: 'Maria', email: 'maria@example.com' },
        ]);

        CSVStorage.prototype.save = jest.fn().mockResolvedValue('https://s3-bucket/exports/usuarios.csv');

        const result = await useCase.execute({ tableName: 'usuarios', headers: ['id', 'nombre', 'email'] });

        expect(result.downloadUrl).toMatch(
            /^https:\/\/[a-zA-Z0-9.-]*\.amazonaws\.com\/.+\?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-.*$/
        );
        expect(repository.getData).toHaveBeenCalledWith('usuarios', ['id', 'nombre', 'email'], expect.any(Object));

        expect(CSVStorage.prototype.save).toHaveBeenCalledWith(
            'usuarios',
            expect.arrayContaining([expect.objectContaining({ id: 1, nombre: 'Juan', email: 'juan@example.com' })])
        );
    });

    it('debería lanzar un error si la tabla no tiene datos', async () => {
        repository.getData = jest.fn().mockResolvedValue([]);

        const tableName = 'usuarios';

        await expect(useCase.execute({ tableName: tableName, headers: ['id', 'nombre'] })).rejects.toThrow(
            `No se encontraron registros en "${tableName}" que coincidan con el criterio de búsqueda.`
        );

        expect(repository.getData).toHaveBeenCalledWith(tableName, ['id', 'nombre'], expect.any(Object));

        expect(CSVStorage.prototype.save).not.toHaveBeenCalled();
    });

    it('debería lanzar un error si getData falla', async () => {
        repository.getData = jest.fn().mockRejectedValue(new Error('Error en la DB'));

        await expect(useCase.execute({ tableName: 'usuarios', headers: ['id', 'nombre'] })).rejects.toThrow(
            'Error en la DB'
        );

        expect(repository.getData).toHaveBeenCalledWith('usuarios', ['id', 'nombre'], expect.any(Object));

        expect(CSVStorage.prototype.save).not.toHaveBeenCalled();
    });

    it('debería exportar solo las columnas seleccionadas', async () => {
        repository.getData = jest.fn().mockResolvedValue([
            { id: 1, nombre: 'Juan' },
            { id: 2, nombre: 'Maria' },
        ]);

        CSVStorage.prototype.save = jest.fn().mockResolvedValue('https://s3-bucket/exports/usuarios.csv');

        await useCase.execute({ tableName: 'usuarios', headers: ['id', 'nombre'] });

        expect(CSVStorage.prototype.save).toHaveBeenCalledWith(
            'usuarios',
            expect.arrayContaining([expect.objectContaining({ id: 1, nombre: 'Juan' })])
        );
    });

    it('Debe retornar datos filtrados correctamente', async () => {
        const mockData = [
            { id: 1, email: 'test@gmail.com', created_at: '2024-01-10' },
            { id: 2, email: 'example@gmail.com', created_at: '2024-01-15' },
        ];

        repository.getData = jest.fn().mockResolvedValue(mockData);

        const dtoCriteria = {
            filter: [{ field: 'email', operator: 'like', value: '%gmail%', type: 'AND' }],
            limit: 0,
            offset: 0,
        };

        const data = await repository.getData('users', ['id', 'email', 'created_at'], dtoCriteria);

        expect(data).toEqual(mockData);
        expect(data).toHaveLength(2);
        expect(data[0]).toHaveProperty('email', 'test@gmail.com');
    });

    it('debería exportar auxiliares expandiendo la columna data cuando headers incluye "data"', async () => {
        const tableName = 'aux_proveedores';

        const mockDbRows = [
            {
                id: 'ace32710-9ec6-455c-a00d-2382bc9d327d',
                data: JSON.stringify({
                    edad: 10,
                    nombre: 'Jose',
                    constituido: true,
                    progreso: { inicio: true, finalizado: false, intermedio: true },
                    contactos: [
                        { nombre: 'David', telefono: '5467894560' },
                        { nombre: 'Felipe', telefono: '987654310' },
                    ],
                }),
            },
        ];

        repository.getData = jest.fn().mockResolvedValue(mockDbRows);

        // Mock the aux definition finder and schema rules
        jest.spyOn(KnexAuxDefinitionsRepository.prototype, 'findByTableName').mockResolvedValue({
            schema_id: { value: 'ace32710-9ec6-455c-a00d-2382bc9d327d' },
        });

        jest.spyOn(KnexSchemasRepository.prototype, 'find').mockResolvedValue({
            id: 'ace32710-9ec6-455c-a00d-2382bc9d327d',
            name: 'test-schema',
            is_active: true,
            data_structure: {},
        });

        jest.spyOn(KnexSchemasRepository.prototype, 'getSchemaRules').mockResolvedValue({
            id: { value: 'ace32710-9ec6-455c-a00d-2382bc9d327d' },
            name: { value: 'test-schema' },
            is_active: { value: true },
            data_structure: {
                value: {
                    edad: { type: 'number' },
                    nombre: { type: 'string' },
                    constituido: { type: 'boolean' },
                    progreso: {
                        type: 'object',
                        properties: {
                            inicio: { type: 'boolean' },
                            finalizado: { type: 'boolean' },
                            intermedio: { type: 'boolean' },
                        },
                    },
                    contactos: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                nombre: { type: 'string' },
                                telefono: { type: 'string' },
                            },
                        },
                    },
                },
            },
            created_at: { value: '2024-01-01T00:00:00.000Z' },
            created_by: { value: 'system' },
            updated_at: { value: '2024-01-01T00:00:00.000Z' },
            updated_by: { value: 'system' },
            deleted_at: { value: null },
            deleted_by: { value: null },
        });

        let capturedRows = null;
        CSVStorage.prototype.save = jest.fn().mockImplementation(async (_tableName, rows) => {
            capturedRows = rows;
            return 'https://s3.amazonaws.com/dummy-bucket/exports/aux_proveedores.csv?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=dummy';
        });

        CSVStorage.prototype.getDownloadUrl = jest
            .fn()
            .mockResolvedValue(
                'https://s3.amazonaws.com/dummy-bucket/exports/aux_proveedores.csv?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=dummy'
            );

        const headers = ['id', 'data', 'created_at', 'updated_at', 'created_by', 'updated_by'];

        const result = await useCase.execute({
            tableName,
            headers,
            criteria: {
                filter: [],
                limit: 0,
                offset: 0,
            },
        });

        expect(result.downloadUrl).toMatch(
            /^https:\/\/s3[a-zA-Z0-9.-]*\.amazonaws\.com\/.+\?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-.*$/
        );

        expect(repository.getData).toHaveBeenCalled();

        expect(capturedRows).toBeTruthy();
        expect(Array.isArray(capturedRows)).toBe(true);

        expect(capturedRows.length).toBe(2);

        const row1 = capturedRows[0];
        const row2 = capturedRows[1];

        for (const row of [row1, row2]) {
            expect(row.id).toBe('ace32710-9ec6-455c-a00d-2382bc9d327d');
            expect(row.edad).toBe(10);
            expect(row.nombre).toBe('Jose');
            expect(row.constituido).toBe(true);
            expect(row['progreso::inicio']).toBe(true);
            expect(row['progreso::finalizado']).toBe(false);
            expect(row['progreso::intermedio']).toBe(true);

            expect(row.data).toBeUndefined();
        }

        const contactosExportados = capturedRows.map((r) => ({
            nombre: r['contactos::nombre'],
            telefono: r['contactos::telefono'],
        }));

        expect(contactosExportados).toEqual(
            expect.arrayContaining([
                { nombre: 'David', telefono: '5467894560' },
                { nombre: 'Felipe', telefono: '987654310' },
            ])
        );
    });
});

describe('flattenAuxRow - múltiples arreglos', () => {
    const dataStructure = {
        direccion: { type: 'string' },
        nombre: { type: 'string' },
        telefono: { type: 'string' },
        contactos: {
            type: 'array',
            data_structure: { label: { type: 'string' }, value: { type: 'string' } },
        },
        tipo: {
            type: 'array',
            data_structure: { label: { type: 'string' }, value: { type: 'string' } },
        },
    };

    const baseDbRow = {
        id: '1',
        data: JSON.stringify({
            direccion: 'Carrera 32',
            nombre: 'Jordi',
            telefono: '3232323',
            contactos: [{ label: 'Cuentas de servicio Integraciones', value: '86d21b1f-013d-4426-89bc-08521f3e81ef' }],
            tipo: [
                { label: 'Cuentas de servicio Integraciones', value: '86d21b1f-013d-4426-89bc-08521f3e81ef' },
                { label: 'Administradores Operación', value: 'd96cce1d-8d79-46af-aadc-a6ea005419aa' },
                { label: 'Cierre de expediente', value: 'b0c55b4e-e8d6-48da-8b43-0ccb38dd5616' },
            ],
        }),
    };

    it('expande a max(longitudes) filas cuando dos arreglos tienen longitudes distintas', () => {
        const rows = flattenAuxRow(baseDbRow, ['id'], dataStructure);

        expect(rows).toHaveLength(3);

        for (const row of rows) {
            expect(row.id).toBe('1');
            expect(row.direccion).toBe('Carrera 32');
            expect(row.nombre).toBe('Jordi');
            expect(row.telefono).toBe('3232323');
        }

        expect(rows[0]['contactos::label']).toBe('Cuentas de servicio Integraciones');
        expect(rows[0]['contactos::value']).toBe('86d21b1f-013d-4426-89bc-08521f3e81ef');
        expect(rows[1]['contactos::label']).toBeUndefined();
        expect(rows[1]['contactos::value']).toBeUndefined();
        expect(rows[2]['contactos::label']).toBeUndefined();
        expect(rows[2]['contactos::value']).toBeUndefined();

        expect(rows[0]['tipo::label']).toBe('Cuentas de servicio Integraciones');
        expect(rows[1]['tipo::label']).toBe('Administradores Operación');
        expect(rows[2]['tipo::label']).toBe('Cierre de expediente');
    });

    it('produce una única fila cuando todos los arreglos están vacíos', () => {
        const row = {
            id: '2',
            data: JSON.stringify({ nombre: 'Test', contactos: [], tipo: [] }),
        };
        const rows = flattenAuxRow(row, ['id'], dataStructure);
        expect(rows).toHaveLength(1);
        expect(rows[0].nombre).toBe('Test');
    });

    it('produce filas según el arreglo no vacío cuando el otro está vacío', () => {
        const row = {
            id: '3',
            data: JSON.stringify({
                nombre: 'Test',
                contactos: [],
                tipo: [
                    { label: 'A', value: '1' },
                    { label: 'B', value: '2' },
                ],
            }),
        };
        const rows = flattenAuxRow(row, ['id'], dataStructure);
        expect(rows).toHaveLength(2);
        expect(rows[0]['tipo::label']).toBe('A');
        expect(rows[1]['tipo::label']).toBe('B');
        expect(rows[0]['contactos::label']).toBeUndefined();
    });

    it('no hace producto cartesiano: N filas para arreglos de longitud N y M (max)', () => {
        const row = {
            id: '4',
            data: JSON.stringify({
                contactos: [
                    { label: 'X', value: '1' },
                    { label: 'Y', value: '2' },
                ],
                tipo: [
                    { label: 'A', value: 'a' },
                    { label: 'B', value: 'b' },
                    { label: 'C', value: 'c' },
                ],
            }),
        };
        const rows = flattenAuxRow(row, ['id'], dataStructure);
        expect(rows).toHaveLength(3);
        expect(rows[0]['contactos::label']).toBe('X');
        expect(rows[1]['contactos::label']).toBe('Y');
        expect(rows[2]['contactos::label']).toBeUndefined();
    });

    it('combina objectGroups con múltiples arrayGroups correctamente', () => {
        const dsConObjeto = {
            ...dataStructure,
            progreso: { type: 'object', data_structure: { inicio: { type: 'boolean' } } },
        };
        const row = {
            id: '5',
            data: JSON.stringify({
                progreso: { inicio: true },
                contactos: [{ label: 'C1', value: 'v1' }],
                tipo: [
                    { label: 'T1', value: 'u1' },
                    { label: 'T2', value: 'u2' },
                ],
            }),
        };
        const rows = flattenAuxRow(row, ['id'], dsConObjeto);
        expect(rows).toHaveLength(2);
        for (const r of rows) {
            expect(r['progreso::inicio']).toBe(true);
        }
        expect(rows[0]['contactos::label']).toBe('C1');
        expect(rows[1]['contactos::label']).toBeUndefined();
    });
});

describe('flattenExternalCodes - Unit', () => {
    it('debe retornar string vacío si el valor es null o undefined', () => {
        expect(flattenExternalCodes(null)).toBe('');
        expect(flattenExternalCodes(undefined)).toBe('');
    });

    it('debe procesar un string que es un JSON array', () => {
        const input = '["abc","123"]';
        expect(flattenExternalCodes(input)).toBe('abc,123');
    });

    it('debe procesar un string que es un JSON object', () => {
        const input = '{"b":"b","a":"a"}';
        expect(flattenExternalCodes(input)).toBe('a,b'); // claves ordenadas
    });

    it('debe devolver el mismo string si no es JSON válido', () => {
        expect(flattenExternalCodes('no-json')).toBe('no-json');
    });

    it('debe procesar directamente un array', () => {
        expect(flattenExternalCodes(['abc', 123])).toBe('abc,123');
    });

    it('debe procesar directamente un objeto', () => {
        const input = { z: 1, x: 2 };
        expect(flattenExternalCodes(input)).toBe('x,z'); // claves ordenadas
    });

    it('debe convertir otros tipos a string', () => {
        expect(flattenExternalCodes(42)).toBe('42');
        expect(flattenExternalCodes(true)).toBe('true');
    });
});

describe('flattenAuxRow - auxiliares', () => {
    it('debería expandir la data al formato de import (progreso + contactos) cuando headers incluye "data"', () => {
        const row = {
            id: 'ace32710-9ec6-455c-a00d-2382bc9d327d',
            created_at: '2025-11-20T21:07:16.000Z',
            updated_at: '2025-11-20T21:07:16.000Z',
            data: JSON.stringify({
                edad: 10,
                nombre: 'Jose',
                constituido: true,
                progreso: {
                    inicio: true,
                    finalizado: false,
                    intermedio: true,
                },
                contactos: [
                    { nombre: 'David', telefono: '5467894560' },
                    { nombre: 'Felipe', telefono: '987654310' },
                ],
            }),
        };

        const headers = ['id', 'data', 'created_at', 'updated_at'];

        const result = flattenAuxRow(row, headers);

        expect(result).toHaveLength(2);

        const [row1, row2] = result;

        for (const r of [row1, row2]) {
            expect(r.id).toBe(row.id);
            expect(r.created_at).toBe(row.created_at);
            expect(r.updated_at).toBe(row.updated_at);

            expect(r.edad).toBe(10);
            expect(r.nombre).toBe('Jose');
            expect(r.constituido).toBe(true);

            expect(r['progreso::inicio']).toBe(true);
            expect(r['progreso::finalizado']).toBe(false);
            expect(r['progreso::intermedio']).toBe(true);

            expect(r.data).toBeUndefined();
        }

        const contactos = result.map((r) => ({
            nombre: r['contactos::nombre'],
            telefono: r['contactos::telefono'],
        }));

        expect(contactos).toEqual(
            expect.arrayContaining([
                { nombre: 'David', telefono: '5467894560' },
                { nombre: 'Felipe', telefono: '987654310' },
            ])
        );
    });

    it('debería devolver una sola fila cuando no hay arrays en data', () => {
        const row = {
            id: '1',
            data: JSON.stringify({
                edad: 25,
                nombre: 'Ana',
                constituido: false,
                progreso: {
                    inicio: true,
                    finalizado: false,
                    intermedio: false,
                },
            }),
        };

        const headers = ['id', 'data'];

        const result = flattenAuxRow(row, headers);

        expect(result).toHaveLength(1);

        const [onlyRow] = result;
        expect(onlyRow.id).toBe('1');
        expect(onlyRow.edad).toBe(25);
        expect(onlyRow.nombre).toBe('Ana');
        expect(onlyRow.constituido).toBe(false);
        expect(onlyRow['progreso::inicio']).toBe(true);
        expect(onlyRow['progreso::finalizado']).toBe(false);
        expect(onlyRow['progreso::intermedio']).toBe(false);
        expect(onlyRow.data).toBeUndefined();
    });

    it('debería lanzar ValidationFailError si la columna data no es JSON válido', () => {
        const row = {
            id: '1',
            data: '{invalid-json',
        };

        expect(() => flattenAuxRow(row, ['id', 'data'])).toThrow(ValidationFailError);
    });

    it('debería lanzar ValidationFailError si data no es un objeto', () => {
        const row = {
            id: '1',
            data: JSON.stringify(['esto', 'no', 'es', 'un', 'objeto']),
        };

        expect(() => flattenAuxRow(row, ['id', 'data'])).toThrow(ValidationFailError);
    });
});
