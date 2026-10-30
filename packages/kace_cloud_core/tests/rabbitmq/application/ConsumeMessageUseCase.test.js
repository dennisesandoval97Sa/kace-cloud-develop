import { v4 as uuidv4 } from 'uuid';
import { ConsumeMessageUseCase } from '../../../src/rabbitmq/application/ConsumeMessageUseCase.js';
import { MapperUpdater } from '../../../src/rabbitmq/application/update/MapperUpdater.js';
import { CustomError } from '../../../src/shared/index.js';
import MapperMother from '../domain/MapperMother.js';
import { jest } from '@jest/globals';
import { knexConfig } from '../../knexfile.js';
import { KnexMapperRepository } from '../../../src/rabbitmq/infrastructure/persistence/KnexMapperRepository.js';

describe('rabbitmq/application/ConsumeMessageUseCase', () => {
    const repository = new KnexMapperRepository(knexConfig);

    describe('ConsumeMessageUseCase', () => {
        test('should map message and execute rest flow with mapped dto', async () => {
            const mapper = {
                id: 'm1',
                name: 'map-cases',
                rest_flow_id: 'flow-1',
                rules: [
                    {
                        mapper_id: 'm1',
                        target_entity: 'case',
                        target_field: 'reference',
                        source_field: 'payload.reference',
                    },
                    { mapper_id: 'm1', target_entity: 'case', target_field: 'title', source_field: 'payload.title' },
                ],
            };

            const mapperRepository = {
                findByConnectionId: jest.fn().mockResolvedValue([mapper]),
            };

            const flowExecutor = { execute: jest.fn().mockResolvedValue({}) };

            const usecase = new ConsumeMessageUseCase({ mapperRepository, flowExecutor });

            const message = { payload: { reference: 123, title: 'Test case' } };
            const result = await usecase.execute({ connectionId: 'conn-1', message });

            expect(mapperRepository.findByConnectionId).toHaveBeenCalledWith('conn-1');
            expect(flowExecutor.execute).toHaveBeenCalledTimes(1);
            expect(flowExecutor.execute).toHaveBeenCalledWith({
                external_code: 'flow-1',
                initial_context: { reference: 123, title: 'Test case' },
            });
            expect(result).toEqual({ executed: 1 });
        });

        test('should execute flow for client mapper', async () => {
            const mapper = {
                id: 'm2',
                name: 'map-clients',
                rest_flow_id: 'flow-client',
                rules: [
                    {
                        mapper_id: 'm2',
                        target_entity: 'client',
                        target_field: 'cliente_id',
                        source_field: 'payload.id',
                    },
                ],
            };

            const mapperRepository = { findByConnectionId: jest.fn().mockResolvedValue([mapper]) };

            const flowExecutor = { execute: jest.fn().mockResolvedValue({}) };

            const usecase = new ConsumeMessageUseCase({ mapperRepository, flowExecutor });

            const message = { payload: { id: 'client-123' } };
            const result = await usecase.execute({ connectionId: 'conn-2', message });

            expect(flowExecutor.execute).toHaveBeenCalledTimes(1);
            expect(flowExecutor.execute).toHaveBeenCalledWith({
                external_code: 'flow-client',
                initial_context: { cliente_id: 'client-123' },
            });
            expect(result).toEqual({ executed: 1 });
        });

        test('returns executed:0 without iterating when findByConnectionId resolves to a nullish value', async () => {
            const mapperRepository = { findByConnectionId: jest.fn().mockResolvedValue(null) };
            const flowExecutor = { execute: jest.fn() };
            const usecase = new ConsumeMessageUseCase({ mapperRepository, flowExecutor });

            const result = await usecase.execute({ connectionId: 'conn-none', message: {} });

            expect(result).toEqual({ executed: 0 });
            expect(flowExecutor.execute).not.toHaveBeenCalled();
        });

        test('maps a missing nested source_field path to undefined instead of throwing', async () => {
            const mapper = {
                id: 'm3',
                rest_flow_id: 'flow-3',
                rules: [{ mapper_id: 'm3', target_field: 'missing', source_field: 'payload.does.not.exist' }],
            };
            const mapperRepository = { findByConnectionId: jest.fn().mockResolvedValue([mapper]) };
            const flowExecutor = { execute: jest.fn().mockResolvedValue({}) };
            const usecase = new ConsumeMessageUseCase({ mapperRepository, flowExecutor });

            const result = await usecase.execute({ connectionId: 'conn-3', message: { payload: {} } });

            expect(flowExecutor.execute).toHaveBeenCalledWith({
                external_code: 'flow-3',
                initial_context: { missing: undefined },
            });
            expect(result).toEqual({ executed: 1 });
        });

        test('does not call flowExecutor and does not increment executed when the mapper has no rest_flow_id', async () => {
            const mapper = {
                id: 'm4',
                rest_flow_id: null,
                rules: [{ mapper_id: 'm4', target_field: 'x', source_field: 'payload.x' }],
            };
            const mapperRepository = { findByConnectionId: jest.fn().mockResolvedValue([mapper]) };
            const flowExecutor = { execute: jest.fn() };
            const usecase = new ConsumeMessageUseCase({ mapperRepository, flowExecutor });

            const result = await usecase.execute({ connectionId: 'conn-4', message: { payload: { x: 1 } } });

            expect(flowExecutor.execute).not.toHaveBeenCalled();
            expect(result).toEqual({ executed: 0 });
        });
    });

    // ============================================================
    // MAPPER UPDATER TESTS
    // ============================================================

    describe('MapperUpdater', () => {
        let updater;

        beforeEach(async () => {
            // Clean tables before each test
            await repository.connection('broker_message_mapper_rules').del();
            await repository.connection('broker_message_mappers').del();
            updater = new MapperUpdater(repository);
        });

        describe('execute', () => {
            it('should update a mapper successfully', async () => {
                // Arrange
                const mapper = await MapperMother.createMapper(repository);
                const changes = { name: 'Updated Name' };

                // Act
                const result = await updater.execute(mapper.id, changes);

                // Assert
                expect(result.name).toEqual(changes.name);

                // Verify in database
                const updated = await repository.findById(mapper.id);
                expect(updated.name).toEqual('Updated Name');
            });

            it('should throw CustomError 404 when mapper does not exist', async () => {
                // Arrange
                const id = uuidv4();

                // Act & Assert
                await expect(updater.execute(id, { name: 'Test' })).rejects.toThrow(CustomError);
                await expect(updater.execute(id, { name: 'Test' })).rejects.toThrow(`Mapper with id ${id} not found`);
            });

            it('should throw error when id is not a valid UUID', async () => {
                // Arrange
                const invalidId = 'not-a-uuid';

                // Act & Assert
                await expect(updater.execute(invalidId, { name: 'Test' })).rejects.toThrow();
            });

            it('should update rules with mapper_id injected', async () => {
                // Arrange
                const mapper = await MapperMother.createMapper(repository);
                const ruleId = uuidv4();
                const changes = {
                    rules: [
                        {
                            id: ruleId,
                            target_entity: 'cases',
                            target_field: 'priority',
                            source_field: 'payload.priority',
                            parse_to: 'number',
                        },
                    ],
                };

                // Act
                await updater.execute(mapper.id, changes);

                // Assert - Verify rules in database
                const updated = await repository.findById(mapper.id);
                expect(updated.rules).toHaveLength(1);
                expect(updated.rules[0].target_field).toBe('priority');
                expect(updated.rules[0].parse_to).toBe('number');
            });

            it('should update only name without modifying rules', async () => {
                // Arrange
                const mapper = await MapperMother.createMapper(repository, {
                    rules: [MapperMother.ruleDto({ parse_to: 'string' })],
                });
                const originalRulesCount = mapper.rules.length;
                const changes = { name: 'Only Name Updated' };

                // Act
                await updater.execute(mapper.id, changes);

                // Assert
                const updated = await repository.findById(mapper.id);
                expect(updated.name).toBe('Only Name Updated');
                expect(updated.rules).toHaveLength(originalRulesCount);
            });

            it('should handle empty rules array (remove all rules)', async () => {
                // Arrange
                const mapper = await MapperMother.createMapper(repository, {
                    rules: [MapperMother.ruleDto()],
                });
                const changes = { rules: [] };

                // Act
                await updater.execute(mapper.id, changes);

                // Assert
                const updated = await repository.findById(mapper.id);
                expect(updated.rules).toHaveLength(0);
            });

            it('should update rules with all parse_to types', async () => {
                // Arrange
                const mapper = await MapperMother.createMapper(repository);
                const parseToTypes = ['string', 'number', 'boolean', 'datetime'];
                const rules = parseToTypes.map((type) => ({
                    id: uuidv4(),
                    target_entity: 'cases',
                    target_field: `field_${type}`,
                    source_field: `payload.${type}`,
                    parse_to: type,
                }));

                // Act
                await updater.execute(mapper.id, { rules });

                // Assert
                const updated = await repository.findById(mapper.id);
                expect(updated.rules).toHaveLength(4);

                parseToTypes.forEach((type) => {
                    const rule = updated.rules.find((r) => r.target_field === `field_${type}`);
                    expect(rule).toBeDefined();
                    expect(rule.parse_to).toBe(type);
                });
            });

            it('should update queue field', async () => {
                // Arrange
                const mapper = await MapperMother.createMapper(repository);
                const changes = { queue: 'new-queue-name' };

                // Act
                await updater.execute(mapper.id, changes);

                // Assert
                const updated = await repository.findById(mapper.id);
                expect(updated.queue).toBe('new-queue-name');
            });

            it('should replace existing rules with new ones', async () => {
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

                const newRuleId = uuidv4();
                const changes = {
                    rules: [
                        {
                            id: newRuleId,
                            target_entity: 'clients',
                            target_field: 'new_field',
                            source_field: 'payload.new',
                            parse_to: 'number',
                        },
                    ],
                };

                // Act
                await updater.execute(mapper.id, changes);

                // Assert
                const updated = await repository.findById(mapper.id);
                expect(updated.rules).toHaveLength(1);
                expect(updated.rules[0].target_field).toBe('new_field');
                expect(updated.rules[0].parse_to).toBe('number');

                // Original rule should not exist
                const oldRule = updated.rules.find((r) => r.id === originalRuleId);
                expect(oldRule).toBeUndefined();
            });
        });

        describe('history', () => {
            it('should not fail when repository does not have saveHistory', async () => {
                // Arrange
                const mapper = await MapperMother.createMapper(repository);
                const changes = { name: 'No History' };

                // Act
                const result = await updater.execute(mapper.id, changes);

                // Assert - Should complete without error
                expect(result.name).toBe('No History');
            });
        });
    });
});
