/* eslint-disable no-undef */
import { TestHelper } from '@kace/api-common';
import { v4 as uuidv4 } from 'uuid';
import knex from 'knex';
import { globalRoleId } from '@kace/database/seeds/20241125105900_usuario_base.js';

const tenant = await TestHelper.getTenant();
const knexConfig = tenant.buildKnexConfig();

const HTTP_OK = 200;
const HTTP_CREATED = 201;
const HTTP_BAD_REQUEST = 400;

const baseUrl =
    process.env.APPS_ENVIRONMENT === 'staging'
        ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/auxiliaries`
        : 'http://127.0.0.1:60098';
const testEntity = 'strategies';
const auxTable = `aux_${testEntity}`;
let db;
let schemaId;

describe('Auxiliaries Controller E2E - validation behavior', () => {
    beforeAll(async () => {
        await TestHelper.resetSchemaAndMigrate(tenant);

        db = knex(knexConfig);
        await db.raw(`SET search_path TO ${tenant.db_schema.value}`);
        await createValidationFixtures();
        await grantAuxiliaryPermissions();
    }, 240000);

    afterAll(async () => {
        if (db) {
            await db.destroy();
            db = undefined;
        }
    });

    describe('POST /:entity - Create auxiliary', () => {
        it('should create an auxiliary successfully with dependent fields', async () => {
            const payload = {
                id: uuidv4(),
                data: {
                    field_a: true,
                    field_b: 'some value',
                    date_tz: '2026-03-13T10:00:00',
                },
            };

            const response = await TestHelper.postRequest(`${baseUrl}/${testEntity}`, payload);

            expect(response.status).toBe(HTTP_CREATED);
        });

        it('should return validation error when field_a is true and field_b is missing', async () => {
            const payload = {
                id: uuidv4(),
                data: {
                    field_a: true,
                },
            };

            const response = await TestHelper.postRequest(`${baseUrl}/${testEntity}`, payload);
            expect(response.status).toBe(HTTP_BAD_REQUEST);
        });

        it('should allow creating without field_b when field_a is false', async () => {
            const payload = {
                id: uuidv4(),
                data: {
                    field_a: false,
                    date_tz: '2026-03-13T10:00:00',
                },
            };

            const response = await TestHelper.postRequest(`${baseUrl}/${testEntity}`, payload);

            expect(response.status).toBe(HTTP_CREATED);
        });
    });

    describe('POST /:entity - Dependency validation (String)', () => {
        it('should require field_c when field_status is "active"', async () => {
            const payload = {
                id: uuidv4(),
                data: {
                    field_a: false,
                    field_status: 'active',
                },
            };

            const response = await TestHelper.postRequest(`${baseUrl}/${testEntity}`, payload);

            expect(response.status).toBe(HTTP_BAD_REQUEST);
        });

        it('should not require field_c when field_status is not "active"', async () => {
            const payload = {
                id: uuidv4(),
                data: {
                    field_a: false,
                    field_status: 'inactive',
                },
            };

            const response = await TestHelper.postRequest(`${baseUrl}/${testEntity}`, payload);

            expect(response.status).toBe(HTTP_CREATED);
        });

        it('should create successfully when field_status is "active" and field_c is provided', async () => {
            const payload = {
                id: uuidv4(),
                data: {
                    field_a: false,
                    field_status: 'active',
                    field_c: 'my notes here',
                },
            };

            const response = await TestHelper.postRequest(`${baseUrl}/${testEntity}`, payload);

            expect(response.status).toBe(HTTP_CREATED);
        });
    });

    describe('POST /:entity - Dependency validation (Number)', () => {
        it('should require field_d when field_priority is 1', async () => {
            const payload = {
                id: uuidv4(),
                data: {
                    field_a: false,
                    field_priority: 1,
                },
            };

            const response = await TestHelper.postRequest(`${baseUrl}/${testEntity}`, payload);

            expect(response.status).toBe(HTTP_BAD_REQUEST);
        });

        it('should not require field_d when field_priority is not 1', async () => {
            const payload = {
                id: uuidv4(),
                data: {
                    field_a: false,
                    field_priority: 2,
                },
            };

            const response = await TestHelper.postRequest(`${baseUrl}/${testEntity}`, payload);

            expect(response.status).toBe(HTTP_CREATED);
        });

        it('should create successfully when field_priority is 1 and field_d is provided', async () => {
            const payload = {
                id: uuidv4(),
                data: {
                    field_a: false,
                    field_priority: 1,
                    field_d: 42,
                },
            };

            const response = await TestHelper.postRequest(`${baseUrl}/${testEntity}`, payload);

            expect(response.status).toBe(HTTP_CREATED);
        });
    });

    describe('POST /:entity/:id - Update auxiliary', () => {
        it('should update partial dependent payload without invalid reference crash', async () => {
            const id = uuidv4();
            await TestHelper.postRequest(`${baseUrl}/${testEntity}`, {
                id,
                data: {
                    field_a: true,
                    field_b: 'initial',
                },
            });

            const updatePayload = {
                data: {
                    field_b: 'updated',
                },
            };

            const response = await TestHelper.postRequest(`${baseUrl}/${testEntity}/${id}`, updatePayload);
            const record = await db(auxTable).where({ id }).first();

            expect(response.status).toBe(HTTP_OK);
            expect(record.data.field_b).toBe('updated');
        });

        it('should return validation error for invalid dependent field type', async () => {
            const id = uuidv4();
            await TestHelper.postRequest(`${baseUrl}/${testEntity}`, {
                id,
                data: {
                    field_a: true,
                    field_b: 'initial',
                },
            });

            const updatePayload = {
                data: {
                    field_b: 123,
                },
            };

            const response = await TestHelper.postRequest(`${baseUrl}/${testEntity}/${id}`, updatePayload);

            expect(response.status).toBe(HTTP_BAD_REQUEST);
        });

        it('should normalize timezone date values during partial update', async () => {
            const id = uuidv4();

            await db(auxTable).insert({
                id,
                data: JSON.stringify({ field_a: false, date_tz: '2026-03-13T10:00:00.000Z' }),
                created_at: new Date(),
                created_by: id,
            });

            const updatePayload = {
                data: {
                    date_tz: '2026-03-13T15:00:00',
                },
            };

            const response = await TestHelper.postRequest(`${baseUrl}/${testEntity}/${id}`, updatePayload);
            const record = await db(auxTable).where({ id }).first();

            expect(response.status).toBe(HTTP_OK);
            expect(record.data.date_tz).toBe('2026-03-13T20:00:00.000Z');
        });
    });

    describe('POST /:entity - Unique field validation', () => {
        it('should create a record with a unique field value successfully', async () => {
            const payload = {
                id: uuidv4(),
                data: { field_a: false, unique_code: 'CODE-001' },
            };

            const response = await TestHelper.postRequest(`${baseUrl}/${testEntity}`, payload);
            expect(response.status).toBe(HTTP_CREATED);
        });

        it('should reject creating a record with a duplicate unique field value', async () => {
            await TestHelper.postRequest(`${baseUrl}/${testEntity}`, {
                id: uuidv4(),
                data: { field_a: false, unique_code: 'CODE-DUP' },
            });

            const response = await TestHelper.postRequest(`${baseUrl}/${testEntity}`, {
                id: uuidv4(),
                data: { field_a: false, unique_code: 'CODE-DUP' },
            });
            expect(response.status).toBe(HTTP_BAD_REQUEST);
        });

        it('should allow multiple records with null for a unique field', async () => {
            await TestHelper.postRequest(`${baseUrl}/${testEntity}`, {
                id: uuidv4(),
                data: { field_a: false, unique_code: null },
            });

            const response = await TestHelper.postRequest(`${baseUrl}/${testEntity}`, {
                id: uuidv4(),
                data: { field_a: false, unique_code: null },
            });
            expect(response.status).toBe(HTTP_CREATED);
        });

        it('should allow updating a record to its own unique field value (self-exclude)', async () => {
            const id = uuidv4();
            await TestHelper.postRequest(`${baseUrl}/${testEntity}`, {
                id,
                data: { field_a: false, unique_code: 'CODE-UPDATE' },
            });

            const response = await TestHelper.postRequest(`${baseUrl}/${testEntity}/${id}`, {
                data: { unique_code: 'CODE-UPDATE' },
            });
            expect(response.status).toBe(HTTP_OK);
        });

        it('should reject updating a record to a unique value that belongs to another record', async () => {
            const idA = uuidv4();
            const idB = uuidv4();

            await TestHelper.postRequest(`${baseUrl}/${testEntity}`, {
                id: idA,
                data: { field_a: false, unique_code: 'CODE-A' },
            });
            await TestHelper.postRequest(`${baseUrl}/${testEntity}`, {
                id: idB,
                data: { field_a: false, unique_code: 'CODE-B' },
            });

            const response = await TestHelper.postRequest(`${baseUrl}/${testEntity}/${idB}`, {
                data: { unique_code: 'CODE-A' },
            });
            expect(response.status).toBe(HTTP_BAD_REQUEST);
        });
    });
});

async function createValidationFixtures() {
    schemaId = uuidv4();

    await db('schemas').insert({
        id: schemaId,
        name: 'Auxiliaries Validation Test Schema',
        is_active: true,
        data_structure: JSON.stringify({
            field_a: { type: 'boolean', required: true },
            field_b: {
                type: 'string',
                required: true,
                dependsOn: 'field_a',
                dependency: true,
                dependencyValue: 'true',
                dependencyValueValidation: true,
            },
            field_status: { type: 'string', required: false },
            field_c: {
                type: 'string',
                required: true,
                dependsOn: 'field_status',
                dependency: true,
                dependencyValue: 'active',
                dependencyValueValidation: true,
            },
            field_priority: { type: 'number', required: false },
            field_d: {
                type: 'number',
                required: true,
                dependsOn: 'field_priority',
                dependency: true,
                dependencyValue: '1',
                dependencyValueValidation: true,
            },
            date_tz: {
                type: 'date',
                required: false,
                timezoneFormat: 'withoutTimezone',
                timezone: 'America/Bogota',
            },
            unique_code: { type: 'string', required: false, unique: true },
        }),
        created_at: new Date(),
        created_by: uuidv4(),
    });

    const auxTable = `aux_${testEntity}`;
    const historyTable = `history_aux_${testEntity}`;

    const hasAuxTable = await db.schema.hasTable(auxTable);
    if (!hasAuxTable) {
        await db.schema.createTable(auxTable, (table) => {
            table.string('id', 36).primary();
            table.jsonb('data').notNullable();
            table.timestamp('created_at');
            table.timestamp('updated_at');
            table.timestamp('deleted_at');
            table.string('created_by', 36);
            table.string('updated_by', 36);
            table.string('deleted_by', 36);
        });
    }

    const hasHistoryTable = await db.schema.hasTable(historyTable);
    if (!hasHistoryTable) {
        await db.schema.createTable(historyTable, (table) => {
            table.string('id', 36).primary();
            table.string('entity_id', 36).notNullable();
            table.jsonb('changed_attributes');
            table.jsonb('new_attributes');
            table.jsonb('original_attributes');
            table.timestamp('created_at');
            table.string('created_by', 36);
        });
    }

    await db('aux_definitions').insert({
        id: uuidv4(),
        name: testEntity,
        tablename: auxTable,
        logs_tablename: historyTable,
        schema_id: schemaId,
        is_active: true,
        created_at: new Date(),
        created_by: uuidv4(),
    });
}

async function grantAuxiliaryPermissions() {
    const rol = await db('roles').where({ id: globalRoleId }).first();
    const permisos = typeof rol.permisos === 'string' ? JSON.parse(rol.permisos) : rol.permisos;

    const entityName = testEntity.charAt(0).toUpperCase() + testEntity.slice(1);
    permisos.auxiliaries = [
        ...(permisos.auxiliaries || []),
        { name: `${entityName}Create`, granted: true, module_id: testEntity, description: `Create ${testEntity}` },
        { name: `${entityName}Update`, granted: true, module_id: testEntity, description: `Update ${testEntity}` },
        { name: `${entityName}Delete`, granted: true, module_id: testEntity, description: `Delete ${testEntity}` },
        { name: `${entityName}Read`, granted: true, module_id: testEntity, description: `Read ${testEntity}` },
    ];

    await db('roles')
        .where({ id: globalRoleId })
        .update({ permisos: JSON.stringify(permisos) });
}
