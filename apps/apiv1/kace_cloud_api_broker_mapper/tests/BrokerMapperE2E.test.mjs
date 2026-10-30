import '@kace/database/env-config.js';
import { TestHelper } from '@kace/api-common/tests/helpers/TestHelper.js';
import { KnexMapperRepository } from '@kace/core/src/rabbitmq/infrastructure/persistence/KnexMapperRepository.js';
import { validate as uuidValidate, v4 as uuidv4, version as uuidVersion } from 'uuid';
import MapperMother from '@kace/core/tests/rabbitmq/domain/MapperMother.js';

const tenant = await TestHelper.getTenant();
const REQUIRED_TABLES = ['revoked_tokens', 'broker_message_mappers'];
const BROKER_MAPPER_SEARCH_PERMISSION = 'BrokerMapperSearchAdvanced';
const SCHEMA_READY_TIMEOUT_MS = 10_000;
const SCHEMA_READY_POLL_INTERVAL_MS = 100;

describe('BrokerMapperController E2E tests', () => {
    const repository = new KnexMapperRepository(tenant.buildKnexConfig());
    const baseUrl = 'http://127.0.0.1:60094';

    const canonicalMapperIdFrom = (response, requestedId) => {
        const mapperId = response.data.data.id;
        expect(mapperId).not.toBe(requestedId);
        expect(uuidValidate(mapperId)).toBe(true);
        expect(uuidVersion(mapperId)).toBe(4);
        return mapperId;
    };

    const resetSchemaAndWaitUntilReady = async () => {
        await TestHelper.resetSchemaAndMigrate(tenant, {
            searchPermissionNames: [BROKER_MAPPER_SEARCH_PERMISSION],
        });

        const deadline = Date.now() + SCHEMA_READY_TIMEOUT_MS;
        let lastError;

        while (Date.now() < deadline) {
            try {
                const ready = await Promise.all(
                    REQUIRED_TABLES.map((tableName) =>
                        repository.connection.schema.withSchema(tenant.db_schema.value).hasTable(tableName)
                    )
                );

                if (ready.every(Boolean)) return;
            } catch (error) {
                lastError = error;
            }

            await new Promise((resolve) => setTimeout(resolve, SCHEMA_READY_POLL_INTERVAL_MS));
        }

        throw new Error(
            `Schema "${tenant.db_schema.value}" was not ready within ${SCHEMA_READY_TIMEOUT_MS}ms; ` +
                `expected tables: ${REQUIRED_TABLES.join(', ')}`,
            { cause: lastError }
        );
    };

    afterAll(async () => {
        try {
            await repository.connection.destroy();
        } catch {
            // The connection can already be closed after a failed setup.
        }
    });

    /* CREATE OPERATION */
    describe('POST / - Create Mapper', () => {
        beforeEach(async () => {
            await resetSchemaAndWaitUntilReady();
        });

        it('should create a mapper successfully', async () => {
            // Arrange
            const payload = MapperMother.dto();

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response.status).toBe(201);
            expect(response.data.data).toBeDefined();
            canonicalMapperIdFrom(response, payload.id);
        });

        it('should create a mapper with rules including parse_to', async () => {
            // Arrange
            const payload = MapperMother.dto({
                rules: [
                    {
                        id: uuidv4(),
                        target_entity: 'cases',
                        target_field: 'priority',
                        source_field: 'payload.priority',
                        parse_to: 'number',
                    },
                    {
                        id: uuidv4(),
                        target_entity: 'cases',
                        target_field: 'is_active',
                        source_field: 'payload.active',
                        parse_to: 'boolean',
                    },
                    {
                        id: uuidv4(),
                        target_entity: 'cases',
                        target_field: 'created_date',
                        source_field: 'payload.date',
                        parse_to: 'datetime',
                    },
                ],
            });

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response.status).toBe(201);
            const mapperId = canonicalMapperIdFrom(response, payload.id);

            // Verify rules were stored with parse_to
            const readResponse = await TestHelper.getRequest(`${baseUrl}/${mapperId}`);
            expect(readResponse.status).toBe(200);
            const rules = readResponse.data.data.rules;
            expect(rules).toHaveLength(3);

            const numberRule = rules.find((r) => r.target_field === 'priority');
            expect(numberRule.parse_to).toBe('number');

            const booleanRule = rules.find((r) => r.target_field === 'is_active');
            expect(booleanRule.parse_to).toBe('boolean');

            const datetimeRule = rules.find((r) => r.target_field === 'created_date');
            expect(datetimeRule.parse_to).toBe('datetime');
        });

        it('should create a mapper with rules where parse_to is null', async () => {
            // Arrange
            const payload = MapperMother.dto({
                rules: [
                    {
                        id: uuidv4(),
                        target_entity: 'cases',
                        target_field: 'reference',
                        source_field: 'payload.ref',
                        parse_to: null,
                    },
                ],
            });

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response.status).toBe(201);
            const mapperId = canonicalMapperIdFrom(response, payload.id);

            const readResponse = await TestHelper.getRequest(`${baseUrl}/${mapperId}`);
            expect(readResponse.status).toBe(200);
            expect(readResponse.data.data.rules[0].parse_to).toBeNull();
        });

        it('should create a mapper with empty rules array', async () => {
            // Arrange
            const payload = MapperMother.dto({ rules: [] });

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response.status).toBe(201);
        });

        it('should return 400 when validation fails with empty payload', async () => {
            // Arrange
            const payload = {};

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response).toHaveProperty('status', 400);
        });

        it("should return 400 when required field 'name' is missing", async () => {
            // Arrange
            const payload = MapperMother.dto();
            delete payload.name;

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response).toHaveProperty('status', 400);
        });

        it('should return 400 when name exceeds max length', async () => {
            // Arrange
            const payload = MapperMother.dto({ name: 'A'.repeat(256) });

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response).toHaveProperty('status', 400);
        });

        it('should return 400 when rule has invalid parse_to value', async () => {
            // Arrange
            const payload = MapperMother.dto({
                rules: [
                    {
                        id: uuidv4(),
                        target_entity: 'cases',
                        target_field: 'reference',
                        source_field: 'payload.ref',
                        parse_to: 'invalid_type',
                    },
                ],
            });

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response).toHaveProperty('status', 400);
        });

        it('should replace duplicate client IDs with distinct canonical IDs', async () => {
            // Arrange
            const requestedId = uuidv4();
            const payload1 = MapperMother.dto({
                id: requestedId,
                name: `Duplicate ID Mapper One ${uuidv4()}`,
            });
            const payload2 = MapperMother.dto({
                id: requestedId,
                name: `Duplicate ID Mapper Two ${uuidv4()}`,
            });

            // Act
            const response1 = await TestHelper.postRequest(baseUrl, payload1);
            const response2 = await TestHelper.postRequest(baseUrl, payload2);

            // Assert
            expect(response1.status).toBe(201);
            expect(response2.status).toBe(201);
            const mapperId1 = canonicalMapperIdFrom(response1, requestedId);
            const mapperId2 = canonicalMapperIdFrom(response2, requestedId);
            expect(mapperId1).not.toBe(mapperId2);
        });

        it('should handle concurrent mapper creation', async () => {
            // Arrange
            const payload1 = MapperMother.randomDto();
            const payload2 = MapperMother.randomDto();

            // Act
            const [response1, response2] = await Promise.all([
                TestHelper.postRequest(baseUrl, payload1),
                TestHelper.postRequest(baseUrl, payload2),
            ]);

            // Assert
            expect(response1.status).toBe(201);
            expect(response2.status).toBe(201);
        });
    });

    /* READ OPERATION */
    describe('GET /:id - Read Mapper by ID', () => {
        beforeEach(async () => {
            await resetSchemaAndWaitUntilReady();
        });

        it('should fetch a mapper successfully', async () => {
            // Arrange
            const mapper = await MapperMother.createMapper(repository);

            // Act
            const response = await TestHelper.getRequest(`${baseUrl}/${mapper.id}`);

            // Assert
            expect(response.status).toBe(200);
            expect(response.data.data).toBeDefined();
            expect(response.data.data.id).toBe(mapper.id);
            expect(response.data.data.name).toBe(mapper.name);
        });

        it('should fetch a mapper with rules and parse_to values', async () => {
            // Arrange
            const mapper = await MapperMother.createMapper(repository, {
                rules: [
                    {
                        id: uuidv4(),
                        target_entity: 'cases',
                        target_field: 'priority',
                        source_field: 'payload.priority',
                        parse_to: 'number',
                    },
                    {
                        id: uuidv4(),
                        target_entity: 'cases',
                        target_field: 'name',
                        source_field: 'payload.name',
                        parse_to: 'string',
                    },
                ],
            });

            // Act
            const response = await TestHelper.getRequest(`${baseUrl}/${mapper.id}`);

            // Assert
            expect(response.status).toBe(200);
            expect(response.data.data.rules).toHaveLength(2);

            const priorityRule = response.data.data.rules.find((r) => r.target_field === 'priority');
            expect(priorityRule.parse_to).toBe('number');

            const nameRule = response.data.data.rules.find((r) => r.target_field === 'name');
            expect(nameRule.parse_to).toBe('string');
        });

        it('should return error when fetching a non-existent mapper', async () => {
            // Arrange
            const nonExistentId = uuidv4();

            // Act
            const response = await TestHelper.getRequest(`${baseUrl}/${nonExistentId}`);

            // Assert
            expect(response.status).toBeGreaterThanOrEqual(400);
        });

        it('should return 400 when ID is invalid format', async () => {
            // Arrange
            const invalidId = 'invalid-uuid-format';

            // Act
            const response = await TestHelper.getRequest(`${baseUrl}/${invalidId}`);

            // Assert
            expect(response).toHaveProperty('status', 400);
        });

        it('should return all required fields in mapper response', async () => {
            // Arrange
            const mapper = await MapperMother.createMapper(repository);

            // Act
            const response = await TestHelper.getRequest(`${baseUrl}/${mapper.id}`);

            // Assert
            expect(response.status).toBe(200);
            const requiredFields = ['id', 'name', 'rules'];
            requiredFields.forEach((field) => {
                expect(response.data.data).toHaveProperty(field);
            });
        });
    });

    /* UPDATE OPERATION */
    describe('POST /:id - Update Mapper', () => {
        beforeEach(async () => {
            await resetSchemaAndWaitUntilReady();
        });

        it('should update a mapper successfully', async () => {
            // Arrange
            const mapper = await MapperMother.createMapper(repository);
            const payload = { name: 'Updated Mapper Name' };

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/${mapper.id}`, payload);

            // Assert
            expect(response.status).toBe(200);
        });

        it('should update mapper rules with parse_to values', async () => {
            // Arrange
            const payloadMapper = await MapperMother.dto({
                rules: [
                    {
                        id: uuidv4(),
                        target_entity: 'cases',
                        target_field: 'reference',
                        source_field: 'payload.ref',
                        parse_to: null,
                    },
                ],
            });

            const createResponse = await TestHelper.postRequest(baseUrl, payloadMapper);
            expect(createResponse.status).toBe(201);
            const mapperId = canonicalMapperIdFrom(createResponse, payloadMapper.id);

            const newRuleId = uuidv4();
            const payload = {
                rules: [
                    {
                        id: newRuleId,
                        target_entity: 'cases',
                        target_field: 'priority',
                        source_field: 'payload.priority',
                        parse_to: 'number',
                    },
                ],
            };

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/${mapperId}`, payload);

            // Assert
            expect(response.status).toBe(200);

            // Verify updated rules
            const readResponse = await TestHelper.getRequest(`${baseUrl}/${mapperId}`);
            expect(readResponse.status).toBe(200);
            expect(readResponse.data.data.rules).toHaveLength(1);
            expect(readResponse.data.data.rules[0].parse_to).toBe('number');
        });

        it('should update parse_to from null to a valid value', async () => {
            // Arrange
            const ruleId = uuidv4();
            const mapper = await MapperMother.createMapper(repository, {
                rules: [
                    {
                        id: ruleId,
                        target_entity: 'cases',
                        target_field: 'reference',
                        source_field: 'payload.ref',
                        parse_to: null,
                    },
                ],
            });

            const payload = {
                rules: [
                    {
                        id: ruleId,
                        target_entity: 'cases',
                        target_field: 'reference',
                        source_field: 'payload.ref',
                        parse_to: 'datetime',
                    },
                ],
            };

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/${mapper.id}`, payload);

            // Assert
            expect(response.status).toBe(200);

            const readResponse = await TestHelper.getRequest(`${baseUrl}/${mapper.id}`);
            expect(readResponse.data.data.rules[0].parse_to).toBe('datetime');
        });

        it('should return 400 when validation fails on update', async () => {
            // Arrange
            const mapper = await MapperMother.createMapper(repository);
            const payload = { name: 'A'.repeat(256) };

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/${mapper.id}`, payload);

            // Assert
            expect(response).toHaveProperty('status', 400);
        });

        it('should return 400 when updating with invalid ID', async () => {
            // Arrange
            const invalidId = 'invalid-uuid';
            const payload = { name: 'Updated Name' };

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/${invalidId}`, payload);

            // Assert
            expect(response).toHaveProperty('status', 400);
        });

        it('should return 400 when updating rule with invalid parse_to', async () => {
            // Arrange
            const mapper = await MapperMother.createMapper(repository);
            const payload = {
                rules: [
                    {
                        id: uuidv4(),
                        target_entity: 'cases',
                        target_field: 'reference',
                        source_field: 'payload.ref',
                        parse_to: 'not_valid',
                    },
                ],
            };

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/${mapper.id}`, payload);

            // Assert
            expect(response).toHaveProperty('status', 400);
        });

        it('should update only provided fields', async () => {
            // Arrange
            const mapper = await MapperMother.createMapper(repository);
            const originalName = mapper.name;
            const payload = { queue: 'new-queue' };

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/${mapper.id}`, payload);
            const fetchResponse = await TestHelper.getRequest(`${baseUrl}/${mapper.id}`);

            // Assert
            expect(response.status).toBe(200);
            expect(fetchResponse.data.data.queue).toBe('new-queue');
            expect(fetchResponse.data.data.name).toBe(originalName);
        });
    });

    /* DELETE OPERATION */
    describe('GET /:id/delete - Delete Mapper (Soft Delete)', () => {
        beforeEach(async () => {
            await resetSchemaAndWaitUntilReady();
        });

        it('should delete a mapper successfully', async () => {
            // Arrange
            const mapper = await MapperMother.createMapper(repository);

            // Act
            const response = await TestHelper.getRequest(`${baseUrl}/${mapper.id}/delete`);

            // Assert
            expect(response.status).toBe(200);
        });

        it('should return 400 when deleting with invalid ID', async () => {
            // Arrange
            const invalidId = 'invalid-uuid';

            // Act
            const response = await TestHelper.getRequest(`${baseUrl}/${invalidId}/delete`);

            // Assert
            expect(response).toHaveProperty('status', 400);
        });

        it('should soft delete mapper (deleted_at should be set)', async () => {
            // Arrange
            const mapper = await MapperMother.createMapper(repository);

            // Act
            await TestHelper.getRequest(`${baseUrl}/${mapper.id}/delete`);
            const deletedMapper = await repository.table().where({ id: mapper.id }).first();

            // Assert
            expect(deletedMapper.deleted_at).not.toBeNull();
            expect(deletedMapper.deleted_by).not.toBeNull();
        });
    });

    /* INDEX OPERATION */
    describe('GET / - Index Mapper (List with default criteria)', () => {
        beforeEach(async () => {
            await resetSchemaAndWaitUntilReady();
        });

        it('should fetch mapper list with default criteria', async () => {
            // Arrange
            await MapperMother.createRandomMapper(repository);
            await MapperMother.createRandomMapper(repository);

            // Act
            const response = await TestHelper.getRequest(baseUrl);

            // Assert
            expect(response.status).toBe(200);
            expect(response.data.data).toBeDefined();
            expect(Array.isArray(response.data.data.items)).toBe(true);
            expect(response.data.data.items.length).toBeGreaterThanOrEqual(0);
        });

        it('should return paginated results with default limit of 10', async () => {
            // Arrange
            for (let i = 0; i < 12; i++) {
                await MapperMother.createRandomMapper(repository);
            }

            // Act
            const response = await TestHelper.getRequest(baseUrl);

            // Assert
            expect(response.status).toBe(200);
            expect(response.data.data.items.length).toBeLessThanOrEqual(10);
        });

        it('should not return soft-deleted mappers', async () => {
            // Arrange
            const mapper = await MapperMother.createMapper(repository);
            await TestHelper.getRequest(`${baseUrl}/${mapper.id}/delete`);

            // Act
            const response = await TestHelper.getRequest(baseUrl);

            // Assert
            expect(response.status).toBe(200);
            const foundDeleted = response.data.data.items.find((item) => item.id === mapper.id);
            expect(foundDeleted).toBeUndefined();
        });
    });

    /* SEARCH OPERATION */
    describe('POST /search - Search Mapper with custom criteria', () => {
        beforeEach(async () => {
            await resetSchemaAndWaitUntilReady();
        });

        it('should search mapper with filter by id', async () => {
            // Arrange
            const mapper = await MapperMother.createRandomMapper(repository);
            const dtoCriteria = {
                filter: [
                    {
                        field: 'id',
                        operator: 'eq',
                        value: mapper.id,
                        type: 'AND',
                    },
                ],
                relationship: null,
                limit: 1,
                offset: 0,
                order: { field: 'created_at', direction: 'desc' },
            };

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/search`, dtoCriteria);

            // Assert
            expect(response.status).toBe(200);
            expect(response.data.data.items.length).toEqual(1);
            expect(response.data.data.items[0].id).toEqual(mapper.id);
        });

        it('should search mapper with filter by name', async () => {
            // Arrange
            const uniqueName = `UniqueMapper_${Date.now()}`;
            await MapperMother.createMapper(repository, {
                name: uniqueName,
            });
            const dtoCriteria = {
                filter: [
                    {
                        field: 'broker_message_mappers.name',
                        operator: 'eq',
                        value: uniqueName,
                        type: 'AND',
                    },
                ],
                relationship: null,
                limit: 10,
                offset: 0,
                order: { field: 'created_at', direction: 'desc' },
            };

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/search`, dtoCriteria);

            // Assert
            expect(response.status).toBe(200);
            expect(response.data.data.items.length).toBeGreaterThanOrEqual(1);
            expect(response.data.data.items[0].name).toEqual(uniqueName);
        });

        it('should return empty array when no mappers match the search criteria', async () => {
            // Arrange
            const dtoCriteria = {
                filter: [
                    {
                        field: 'id',
                        operator: 'eq',
                        value: uuidv4(),
                        type: 'AND',
                    },
                ],
                relationship: null,
                limit: 10,
                offset: 0,
                order: { field: 'created_at', direction: 'desc' },
            };

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/search`, dtoCriteria);

            // Assert
            expect(response.status).toBe(200);
            expect(response.data.data.items).toEqual([]);
        });

        it('should support pagination with limit and offset', async () => {
            // Arrange
            for (let i = 0; i < 5; i++) {
                await MapperMother.createRandomMapper(repository);
            }
            const dtoCriteria = {
                filter: undefined,
                relationship: null,
                limit: 2,
                offset: 1,
                order: { field: 'created_at', direction: 'desc' },
            };

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/search`, dtoCriteria);

            // Assert
            expect(response.status).toBe(200);
            expect(response.data.data.items.length).toBeLessThanOrEqual(2);
        });

        it('should support LIKE operator for partial text search', async () => {
            // Arrange
            const prefix = `SearchTest_${Date.now()}`;
            await MapperMother.createMapper(repository, { name: `${prefix}_One` });
            await MapperMother.createMapper(repository, { name: `${prefix}_Two` });
            const dtoCriteria = {
                filter: [
                    {
                        field: 'broker_message_mappers.name',
                        operator: 'like',
                        value: `%${prefix}%`,
                        type: 'AND',
                    },
                ],
                relationship: null,
                limit: 10,
                offset: 0,
                order: { field: 'created_at', direction: 'desc' },
            };

            // Act
            const response = await TestHelper.postRequest(`${baseUrl}/search`, dtoCriteria);

            // Assert
            expect(response.status).toBe(200);
            expect(response.data.data.items.length).toBeGreaterThanOrEqual(2);
        });
    });

    /* ERROR HANDLING AND EDGE CASES */
    describe('Error handling and edge cases', () => {
        beforeEach(async () => {
            await resetSchemaAndWaitUntilReady();
        });

        it('should return 404 when accessing non-existent route', async () => {
            // Arrange
            const invalidRoute = `${baseUrl}/${uuidv4()}/invalid`;

            // Act
            const response = await TestHelper.getRequest(invalidRoute);

            // Assert
            expect(response).toHaveProperty('status', 404);
        });

        it('should validate UUID format in path parameters', async () => {
            // Arrange
            const notAUuid = '123-456-789';

            // Act
            const response = await TestHelper.getRequest(`${baseUrl}/${notAUuid}`);

            // Assert
            expect(response).toHaveProperty('status', 400);
        });

        it('should handle very long strings gracefully', async () => {
            // Arrange
            const payload = MapperMother.dto({ name: 'A'.repeat(10000) });

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response).toHaveProperty('status', 400);
        });

        it('should distinguish null values in optional and required fields', async () => {
            // Arrange
            const optionalNullPayload = MapperMother.dto();
            optionalNullPayload.queue = null;

            // Act
            const optionalNullResponse = await TestHelper.postRequest(baseUrl, optionalNullPayload);

            // Assert
            expect(optionalNullResponse.status).toBe(201);

            // Arrange
            const requiredNullPayload = MapperMother.dto();
            requiredNullPayload.rest_flow_id = null;

            // Act
            const requiredNullResponse = await TestHelper.postRequest(baseUrl, requiredNullPayload);

            // Assert
            expect(requiredNullResponse.status).toBe(400);
        });

        it('should handle special characters in name', async () => {
            // Arrange
            const payload = MapperMother.dto({ name: 'Mapper Especial Ñoño' });

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response.status).toBe(201);
        });
    });

    /* DATA INTEGRITY AND CONSISTENCY */
    describe('Data integrity and consistency', () => {
        beforeEach(async () => {
            await resetSchemaAndWaitUntilReady();
        });

        it('should maintain data consistency during concurrent updates', async () => {
            // Arrange
            const mapper = await MapperMother.createMapper(repository);
            const payload1 = { name: 'Concurrent Update One' };
            const payload2 = { name: 'Concurrent Update Two' };

            // Act
            await Promise.all([
                TestHelper.postRequest(`${baseUrl}/${mapper.id}`, payload1),
                TestHelper.postRequest(`${baseUrl}/${mapper.id}`, payload2),
            ]);
            const fetchResponse = await TestHelper.getRequest(`${baseUrl}/${mapper.id}`);

            // Assert
            expect(['Concurrent Update One', 'Concurrent Update Two']).toContain(fetchResponse.data.data.name);
        });

        it('should correctly persist all parse_to types', async () => {
            // Arrange
            const parseToTypes = ['string', 'number', 'boolean', 'datetime'];
            const rules = parseToTypes.map((type) => ({
                id: uuidv4(),
                target_entity: 'cases',
                target_field: `field_${type}`,
                source_field: `payload.${type}`,
                parse_to: type,
            }));
            const payload = MapperMother.dto({ rules });

            // Act
            const response = await TestHelper.postRequest(baseUrl, payload);

            // Assert
            expect(response.status).toBe(201);
            const mapperId = canonicalMapperIdFrom(response, payload.id);

            const readResponse = await TestHelper.getRequest(`${baseUrl}/${mapperId}`);
            expect(readResponse.status).toBe(200);

            const storedRules = readResponse.data.data.rules;
            expect(storedRules).toHaveLength(4);

            for (const type of parseToTypes) {
                const rule = storedRules.find((r) => r.target_field === `field_${type}`);
                expect(rule).toBeDefined();
                expect(rule.parse_to).toBe(type);
            }
        });

        it('should replace rules on update (remove old, add new)', async () => {
            // Arrange
            const originalRuleId = uuidv4();
            const mapper = await MapperMother.createMapper(repository, {
                rules: [
                    {
                        id: originalRuleId,
                        target_entity: 'cases',
                        target_field: 'original_field',
                        source_field: 'payload.original',
                        parse_to: 'string',
                    },
                ],
            });

            const newRules = [
                {
                    target_entity: 'clients',
                    target_field: 'new_field_one',
                    source_field: 'payload.new_one',
                    parse_to: 'number',
                },
                {
                    target_entity: 'clients',
                    target_field: 'new_field_two',
                    source_field: 'payload.new_two',
                    parse_to: 'boolean',
                },
            ];

            // Act
            const updateResponse = await TestHelper.postRequest(`${baseUrl}/${mapper.id}`, {
                rules: newRules,
            });

            // Assert
            expect(updateResponse.status).toBe(200);

            const readResponse = await TestHelper.getRequest(`${baseUrl}/${mapper.id}`);
            expect(readResponse.status).toBe(200);
            expect(readResponse.data.data.rules).toHaveLength(2);

            const oldRule = readResponse.data.data.rules.find((r) => r.target_field === 'original_field');
            expect(oldRule).toBeUndefined();
        });
    });
});
