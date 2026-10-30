import { knexConfig } from '../knexfile.js';
import { v4 as uuid } from 'uuid';
import { WSRestWorkflowStepMother } from './domain/WSRestWorkflowStepMother.js';
import { WSRestWorkflowStepCreator } from '../../src/ws-rest-workflow-step/application/create/WSRestWorkflowStepCreator.js';
import { WSRestWorkflowStepUpdater } from '../../src/ws-rest-workflow-step/application/update/WSRestWorkflowStepUpdater.js';
import { WSRestWorkflowStepDeleter } from '../../src/ws-rest-workflow-step/application/delete/WSRestWorkflowStepDeleter.js';
import { WSRestWorkflowStepSearch } from '../../src/ws-rest-workflow-step/application/search/WSRestWorkflowStepSearch.js';
import { WSRestWorkflowStepFinder } from '../../src/ws-rest-workflow-step/application/find/WSRestWorkflowStepFinder.js';
import { WSRestWorkflowStepCounter } from '../../src/ws-rest-workflow-step/domain/services/WSRestWorkflowStepCounter.js';
import { KnexWSRestWorkflowStepRepository } from '../../src/ws-rest-workflow-step/infrastructure/persistence/KnexWSRestWorkflowStepRepository.js';
import { WSRestWorkflowStep } from '../../src/ws-rest-workflow-step/domain/WSRestWorkflowStep.js';
import { ValidationFailError } from '../../src/shared/errors/ValidationFailError.js';
import { WSRestWorkflowStepCollectionResponse } from '../../src/ws-rest-workflow-step/application/WSRestWorkflowStepCollectionResponse.js';
import { WSRestWorkflowStepResponse } from '../../src/ws-rest-workflow-step/application/WSRestWorkflowStepResponse.js';
import WSRestFunctionMother from '../ws_rest_functions/domain/WSRestFunctionMother.js';
import { KnexWSRestFunctionRepository } from '../../src/ws_rest_functions/infrastructure/persistence/KnexWSRestFunctionRepository.js';
import { KnexWSRestEndpointRepository } from '../../src/ws-rest-endpoints/infrastructure/persistence/KnexWSRestEndpointRepository.js';
import WSRestEndpointMother from '../ws-rest-endpoints/domain/WSRestEndpointMother.js';
import WSRestFlowMother from '../ws-rest-flows/domain/WSRestFlowMother.js';
import { KnexWSRestFlowRepository, WSRestFlow } from '../../src/ws-rest-flows/index.js';
import { WSRestEndpoint } from '../../src/ws-rest-endpoints/index.js';
import { WSRestWorkflowStepFinderService } from '../../src/ws-rest-workflow-step/domain/services/WSRestWorkflowStepFinderService.js';
import { User } from '../../src/users/index.js';
import UsersMother from '../users/domain/UsersMother.js';
import LocalTenantRepository from '../../src/tenant/infrastructure/local/LocalTenantRepository.js';
import { TenantContext } from '../../src/shared/infrastructure/context/TenantContext.js';

const tenant = await new LocalTenantRepository().find();

describe('RestWorkflowStep Test', () => {
    const repository = new KnexWSRestWorkflowStepRepository(knexConfig);
    const restFlowRepository = new KnexWSRestFlowRepository(knexConfig);
    const restFunctionRepository = new KnexWSRestFunctionRepository(knexConfig);
    const restEndpointRepository = new KnexWSRestEndpointRepository(knexConfig);
    const currentUser = new User(UsersMother.dto());

    it('should create a RestWorkflowStep successfully', async () => {
        await TenantContext.run(tenant, async () => {
            const dto = WSRestWorkflowStepMother.dto();
            // El dto va al caso de uso sin pasar por `create`, que es quien
            // respalda el flujo, el endpoint y la funcion que inventa.
            await WSRestWorkflowStepMother.ensureRelations(repository.connection, dto);
            const wsRestWorkflowStepCreator = new WSRestWorkflowStepCreator(repository);

            await wsRestWorkflowStepCreator.execute(dto);
            const result = await repository.connection(repository.tableName).select('*').where('id', dto.id);

            expect(result.length).toBe(1);
        });
    });

    it('should throw a ValidationFailError when creating a RestWorkflowStep with an existing id', async () => {
        await TenantContext.run(tenant, async () => {
            const dto = WSRestWorkflowStepMother.dto();
            await WSRestWorkflowStepMother.ensureRelations(repository.connection, dto);
            const wsRestWorkflowStepCreator = new WSRestWorkflowStepCreator(repository);

            await wsRestWorkflowStepCreator.execute(dto);

            await expect(wsRestWorkflowStepCreator.execute(dto)).rejects.toThrow(
                new ValidationFailError('WSRestWorkflowStep already exists', 'id')
            );
        });
    });

    it('Should throw when creating a RestWorkflowStep with endpoint_id and function_id', async () => {
        await TenantContext.run(tenant, async () => {
            const dto = WSRestWorkflowStepMother.dto(uuid(), uuid());
            const wsRestWorkflowStepCreator = new WSRestWorkflowStepCreator(repository);

            await expect(wsRestWorkflowStepCreator.execute(dto)).rejects.toThrow(
                'WSRestWorkflowStep invalid: only one of endpoint_id, function_id, or conditional_id must be set'
            );
        });
    });

    it('Can update an existing RestWorkflowStep', async () => {
        await TenantContext.run(tenant, async () => {
            const wsRestWorkflowStep = await WSRestWorkflowStepMother.create(repository);
            const wsRestWorkflowStepUpdater = new WSRestWorkflowStepUpdater(repository);

            const newValues = {
                endpoint_id: null,
                function_id: uuid(),
                updated_at: new Date().toISOString(),
                updated_by: uuid(),
            };
            // La funcion nueva es un id inventado aqui, y el update tambien
            // comprueba la clave foranea contra `ws_rest_functions`.
            await WSRestWorkflowStepMother.ensureRelations(repository.connection, newValues);
            await wsRestWorkflowStepUpdater.execute(wsRestWorkflowStep.id.value, newValues);

            const result = await repository.find(wsRestWorkflowStep.id);
            expect(result).toBeInstanceOf(WSRestWorkflowStep);
            expect(result.id.value).toEqual(wsRestWorkflowStep.id.value);
            expect(result.flow_id.value).toEqual(wsRestWorkflowStep.flow_id.value);
            expect(result.endpoint_id.value).toEqual(null);
            expect(result.function_id.value).toEqual(newValues.function_id);
            expect(result.created_by.value).toEqual(wsRestWorkflowStep.created_by.value);
            expect(result.created_at.value).toEqual(wsRestWorkflowStep.created_at.value);
            expect(result.updated_at.value).toEqual(newValues.updated_at);
            expect(result.updated_by.value).toEqual(newValues.updated_by);
        });
    });

    it('Try to update a RestWorkflowStep that does not exist', async () => {
        const wsRestWorkflowStepUpdater = new WSRestWorkflowStepUpdater(repository);
        const nonExistentId = uuid();
        const newValues = {
            endpoint_id: uuid(),
            function_id: uuid(),
            updated_at: new Date().toISOString(),
            updated_by: uuid(),
        };

        await expect(wsRestWorkflowStepUpdater.execute(nonExistentId, newValues)).rejects.toThrow(
            new ValidationFailError('WSRestWorkflowStep not found', 'id')
        );
    });

    it('can delete an existing RestWorkflowStep', async () => {
        await TenantContext.run(tenant, async () => {
            const wsRestWorkflowStep = await WSRestWorkflowStepMother.create(repository);
            const wsRestWorkflowStepDeleter = new WSRestWorkflowStepDeleter(repository);

            await wsRestWorkflowStepDeleter.execute(wsRestWorkflowStep.id.value, {
                deleted_by: uuid(),
                deleted_at: new Date().toISOString(),
            });

            const result = await repository.find(wsRestWorkflowStep.id);
            expect(result).toBeInstanceOf(WSRestWorkflowStep);
            expect(result.deleted_at.value).not.toBeNull();
            expect(result.deleted_by.value).not.toBeNull();
        });
    });

    it('Trying to delete RestWorkflowStep that doesnt exist', async () => {
        const wsRestWorkflowStepDeleter = new WSRestWorkflowStepDeleter(repository);
        const nonExistentId = uuid();

        await expect(
            wsRestWorkflowStepDeleter.execute(nonExistentId, {
                deleted_by: uuid(),
                deleted_at: new Date().toISOString(),
            })
        ).rejects.toThrow(new ValidationFailError('WSRestWorkflowStep not found', 'id'));
    });

    it('searches for RestWorkflowStep with given criteria', async () => {
        await TenantContext.run(tenant, async () => {
            for (let i = 0; i < 10; i++) {
                await WSRestWorkflowStepMother.create(repository);
            }

            const criteria = {
                filter: undefined,
                relationship: undefined,
                limit: 10,
                offset: 0,
                order: { field: 'created_at', direction: 'asc' },
            };

            const wsRestWorkflowStepSearch = new WSRestWorkflowStepSearch(repository);
            const searchResult = await wsRestWorkflowStepSearch.execute(criteria);
            expect(searchResult).toBeInstanceOf(WSRestWorkflowStepCollectionResponse);
        });
    });

    it('Can Search RestWorkflowStep by ID', async () => {
        await TenantContext.run(tenant, async () => {
            const wsRestWorkflowStep = await WSRestWorkflowStepMother.create(repository);
            const wsRestWorkflowStepFinder = new WSRestWorkflowStepFinder(repository, currentUser);
            const result = await wsRestWorkflowStepFinder.execute(wsRestWorkflowStep.id.value);
            expect(result).toBeInstanceOf(WSRestWorkflowStepResponse);
        });
    });

    it('should return null when trying to find a RestWorkflowStep with a non-existent ID', async () => {
        const wsRestWorkflowStepFinder = new WSRestWorkflowStepFinder(repository, currentUser);
        const nonExistentId = uuid();
        const result = await wsRestWorkflowStepFinder.execute(nonExistentId);
        expect(result.toJson()).toEqual({});
    });

    it('Should try to create one with invalid data ', async () => {
        await TenantContext.run(tenant, async () => {
            const dto = WSRestWorkflowStepMother.dto();
            delete dto.id;
            const wsRestWorkflowStepCreator = new WSRestWorkflowStepCreator(repository);

            await expect(wsRestWorkflowStepCreator.execute(dto)).rejects.toThrow();
        });
    });

    it('should count WSRestFlow instances correctly', async () => {
        await TenantContext.run(tenant, async () => {
            const wsRestWorkflowStepCounter = new WSRestWorkflowStepCounter(repository);
            const countBefore = await wsRestWorkflowStepCounter.execute({ filters: [], relationship: null });
            const initialCount = Number(countBefore.count);

            for (let i = 0; i < 10; i++) {
                await WSRestWorkflowStepMother.create(repository);
            }

            const searchResult = await wsRestWorkflowStepCounter.execute({ filters: [], relationship: null });

            expect(Number(searchResult.count) - initialCount).toBe(10);
        });
    });

    describe('WSRestWorkflowStepFinderService Tests', () => {
        /**
         * @type {WSRestWorkflowStepFinderService}
         */
        let finderService;

        beforeEach(() => {
            finderService = new WSRestWorkflowStepFinderService(repository);
        });

        it('should find and order workflow steps by identifier correctly', async () => {
            await TenantContext.run(tenant, async () => {
                const restFlow = await WSRestFlowMother.create(restFlowRepository);
                const restFunction = await WSRestFunctionMother.create(restFunctionRepository);
                const restEndpoint = await WSRestEndpointMother.create(restEndpointRepository);

                const commonFlowId = restFlow.id.value;

                const steps = [
                    {
                        ...WSRestWorkflowStepMother.dtoWithRelationshipOverride(null, restFunction.id.value),
                        flow_id: commonFlowId,
                        order: 2,
                    },
                    {
                        ...WSRestWorkflowStepMother.dtoWithRelationshipOverride(restEndpoint.id.value),
                        flow_id: commonFlowId,
                        order: 1,
                    },
                ];

                const creator = new WSRestWorkflowStepCreator(repository);
                for (const step of steps) {
                    await creator.execute(step);
                }

                const foundSteps = await finderService.findByFlowIdentifier({
                    flowId: commonFlowId,
                    options: {
                        loadEndpoint: true,
                        loadFunction: true,
                    },
                });

                expect(foundSteps).toHaveLength(2);

                expect(foundSteps[0].order.value).toBe(1);
                expect(foundSteps[1].order.value).toBe(2);

                foundSteps.forEach((step) => {
                    expect(step.flow_id.value).toBe(commonFlowId);
                });
            });
        });

        it('should properly hydrate relationships when finding by id', async () => {
            const restFlow = await WSRestFlowMother.create(restFlowRepository);
            const restEndpointAuth = await WSRestEndpointMother.create(restEndpointRepository);
            const restEndpoint = await WSRestEndpointMother.create(restEndpointRepository, {
                authorization_id: restEndpointAuth.id.value,
            });

            const flowId = restFlow.id.value;
            const externalCode = restFlow.external_code.value;
            const endpointId = restEndpoint.id.value;

            const step = WSRestWorkflowStepMother.dtoWithRelationshipOverride(endpointId);
            step.flow_id = flowId;
            step.endpoint_id = endpointId;

            const creator = new WSRestWorkflowStepCreator(repository);

            await creator.execute(step);
            const foundStep = (
                await finderService.findByFlowIdentifier({
                    externalCode,
                    options: {
                        loadEndpoint: true,
                        loadFunction: true,
                    },
                })
            )[0];

            expect(foundStep).toBeDefined();
            expect(foundStep.flow).toBeInstanceOf(WSRestFlow);
            expect(foundStep.endpoint).toBeInstanceOf(WSRestEndpoint);
            expect(foundStep.endpoint.authorization).toBeInstanceOf(WSRestEndpoint);
            expect(foundStep.function).toBeNull();

            expect(foundStep.flow_id.value).toBe(flowId);
            expect(foundStep.endpoint_id.value).toBe(endpointId);
        });
    });
});
