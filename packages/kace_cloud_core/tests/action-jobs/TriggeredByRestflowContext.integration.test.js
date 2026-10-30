import { jest } from '@jest/globals';
import { v4 as uuid } from 'uuid';
import { ActionJob, KnexActionJobRepository, JobQueueProcessor, JobQueueFactory } from '../../src/action-jobs/index.js';
import { KnexActionJobProcessingRepository } from '../../src/action-job-processing/index.js';
import { KnexCaseRepository } from '../../src/cases/index.js';
import { KnexWSRestFlowRepository } from '../../src/ws-rest-flows/index.js';
import { KnexUsersRepository } from '../../src/users/index.js';
import { knexConfig } from '../knexfile.js';
import ActionJobMother from './domain/ActionJobMother.js';
import ActionJobProcessingMother from '../action-job-processing/domain/ActionJobProcessingMother.js';
import CasesMother from '../cases/domain/CasesMother.js';
import WSRestFlowMother from '../ws-rest-flows/domain/WSRestFlowMother.js';
import UsersMother from '../users/domain/UsersMother.js';

describe('triggered_by in RestFlow context — Integration Tests', () => {
    const repository = new KnexActionJobRepository(knexConfig);
    const actionJobProcessingRepository = new KnexActionJobProcessingRepository(repository.connection);
    const caseRepository = new KnexCaseRepository(repository.connection);
    const wsRestFlowRepository = new KnexWSRestFlowRepository(repository.connection);
    const usersRepository = new KnexUsersRepository(repository.connection);

    const triggeredByUser = {
        id: uuid(),
        nombres: 'Juan',
        apellido1: 'García',
        apellido2: 'López',
    };

    // ─── Helpers ────────────────────────────────────────────────────────────────

    async function createRestflowJob({ restflowId, restflowContext, totalRecords = 1 }) {
        return repository.save(
            ActionJob.create(
                ActionJobMother.dtoWithoutIdsData({
                    restflow_id: restflowId,
                    restflow_context: restflowContext,
                    type: 'filter',
                    total_records: totalRecords,
                })
            )
        );
    }

    /**
     * Devuelve un WorkflowExecutor mock (objeto plano) y un array donde
     * se acumulan los initial_context con los que se llama a execute().
     */
    function buildMockWorkflowExecutor() {
        const capturedContexts = [];
        const mockWorkflowExecutor = {
            execute: jest.fn().mockImplementation(async (dto) => {
                capturedContexts.push(dto.initial_context);
                return {};
            }),
        };
        return { mockWorkflowExecutor, capturedContexts };
    }

    function buildJobQueueProcessor(mockWorkflowExecutor) {
        const jobExecutionQueueService = JobQueueFactory.createJobExecutionQueueService({
            knexInstance: knexConfig,
        });
        return new JobQueueProcessor(jobExecutionQueueService, mockWorkflowExecutor);
    }

    // ─── Tests de persistencia ───────────────────────────────────────────────────

    describe('Persistence', () => {
        it('should persist triggered_by inside restflow_context in the action_jobs table', async () => {
            const restflowId = uuid();
            const dto = ActionJobMother.dtoWithoutIdsData({
                restflow_id: restflowId,
                restflow_context: { triggered_by: triggeredByUser },
            });

            await repository.save(ActionJob.create(dto));

            const row = await repository
                .connection(repository.tableName)
                .select('restflow_context')
                .where('id', dto.id)
                .first();

            const persistedContext =
                typeof row.restflow_context === 'string' ? JSON.parse(row.restflow_context) : row.restflow_context;

            expect(persistedContext.triggered_by).toMatchObject(triggeredByUser);
        });
    });

    // ─── Tests de ejecución del flujo ────────────────────────────────────────────

    describe('WorkflowExecutor receives triggered_by in initial_context', () => {
        it('should pass triggered_by to WorkflowExecutor.execute() when the job has it in restflow_context', async () => {
            const user = await UsersMother.createUser(usersRepository);
            const kase = await CasesMother.createCase(caseRepository, { created_by: user.id.value });
            const restflow = await WSRestFlowMother.create(wsRestFlowRepository);

            const actionJob = await createRestflowJob({
                restflowId: restflow.id.value,
                restflowContext: { triggered_by: triggeredByUser },
            });

            await ActionJobProcessingMother.create(actionJobProcessingRepository, {
                job_id: actionJob.id.value,
                action_id: null,
                restflow_id: restflow.id.value,
                case_id: kase.id.value,
            });

            const { mockWorkflowExecutor, capturedContexts } = buildMockWorkflowExecutor();
            const jobQueueProcessor = buildJobQueueProcessor(mockWorkflowExecutor);

            const result = await jobQueueProcessor.execute();

            expect(result.status).toBe('success');
            expect(result.data.jobId).toBe(actionJob.id.value);
            expect(mockWorkflowExecutor.execute).toHaveBeenCalledTimes(1);
            expect(mockWorkflowExecutor.execute).toHaveBeenCalledWith(
                expect.objectContaining({ flow_id: restflow.id.value })
            );

            const initialContext = capturedContexts[0];
            expect(initialContext.triggered_by).toMatchObject(triggeredByUser);
        });

        it('should include both triggered_by and case data in the context', async () => {
            const user = await UsersMother.createUser(usersRepository);
            const kase = await CasesMother.createCase(caseRepository, { created_by: user.id.value });
            const restflow = await WSRestFlowMother.create(wsRestFlowRepository);

            const actionJob = await createRestflowJob({
                restflowId: restflow.id.value,
                restflowContext: { triggered_by: triggeredByUser },
            });

            await ActionJobProcessingMother.create(actionJobProcessingRepository, {
                job_id: actionJob.id.value,
                action_id: null,
                restflow_id: restflow.id.value,
                case_id: kase.id.value,
            });

            const { mockWorkflowExecutor, capturedContexts } = buildMockWorkflowExecutor();
            const jobQueueProcessor = buildJobQueueProcessor(mockWorkflowExecutor);

            await jobQueueProcessor.execute();

            const initialContext = capturedContexts[0];
            // triggered_by viene del restflow_context
            expect(initialContext.triggered_by).toMatchObject(triggeredByUser);
            // getCaseInformationWithRelations agrega datos del caso — el contexto tiene más de una clave
            expect(Object.keys(initialContext).length).toBeGreaterThan(1);
        });

        it('should pass triggered_by to WorkflowExecutor for every action_job_processing record', async () => {
            const user = await UsersMother.createUser(usersRepository);
            const kase1 = await CasesMother.createCase(caseRepository, { created_by: user.id.value });
            const kase2 = await CasesMother.createCase(caseRepository, { created_by: user.id.value });
            const restflow = await WSRestFlowMother.create(wsRestFlowRepository);

            const actionJob = await createRestflowJob({
                restflowId: restflow.id.value,
                restflowContext: { triggered_by: triggeredByUser },
                totalRecords: 2,
            });

            await ActionJobProcessingMother.create(actionJobProcessingRepository, {
                job_id: actionJob.id.value,
                action_id: null,
                restflow_id: restflow.id.value,
                case_id: kase1.id.value,
            });
            await ActionJobProcessingMother.create(actionJobProcessingRepository, {
                job_id: actionJob.id.value,
                action_id: null,
                restflow_id: restflow.id.value,
                case_id: kase2.id.value,
            });

            const { mockWorkflowExecutor, capturedContexts } = buildMockWorkflowExecutor();
            const jobQueueProcessor = buildJobQueueProcessor(mockWorkflowExecutor);

            await jobQueueProcessor.execute();

            expect(mockWorkflowExecutor.execute).toHaveBeenCalledTimes(2);
            for (const ctx of capturedContexts) {
                expect(ctx.triggered_by).toMatchObject(triggeredByUser);
            }
        });

        it('should execute without triggered_by when restflow_context is empty (non-board execution)', async () => {
            const user = await UsersMother.createUser(usersRepository);
            const kase = await CasesMother.createCase(caseRepository, { created_by: user.id.value });
            const restflow = await WSRestFlowMother.create(wsRestFlowRepository);

            const actionJob = await createRestflowJob({
                restflowId: restflow.id.value,
                restflowContext: {},
            });

            await ActionJobProcessingMother.create(actionJobProcessingRepository, {
                job_id: actionJob.id.value,
                action_id: null,
                restflow_id: restflow.id.value,
                case_id: kase.id.value,
            });

            const { mockWorkflowExecutor, capturedContexts } = buildMockWorkflowExecutor();
            const jobQueueProcessor = buildJobQueueProcessor(mockWorkflowExecutor);

            const result = await jobQueueProcessor.execute();

            expect(result.status).toBe('success');
            expect(capturedContexts[0].triggered_by).toBeUndefined();
        });
    });
});
