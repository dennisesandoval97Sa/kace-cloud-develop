import { ActionJobProcessingQueueService } from '../../src/action-job-processing/domain/services/ActionJobProcessingQueueService.js';
import { KnexActionJobRepository } from '../../src/action-jobs/index.js';
import { KnexActionJobProcessingRepository } from '../../src/action-job-processing/index.js';
import { knexConfig } from '../knexfile.js';
import { v4 as uuid } from 'uuid';
import ActionJobMother from '../action-jobs/domain/ActionJobMother.js';
import { KnexActionRepository } from '../../src/actions/index.js';
import { KnexCaseRepository } from '../../src/cases/index.js';

import ActionJobProcessingMother from './domain/ActionJobProcessingMother.js';
import ActionMother from '../actions/domain/ActionMother.js';
import CasesMother from '../cases/domain/CasesMother.js';
import { KnexUsersRepository } from '../../src/users/index.js';
import { KnexGroupsRepository } from '../../src/grupos/index.js';
import { KnexGlobalConfigurationRepository } from '../../src/global-config/index.js';
import { KnexMailAccountRepository } from '../../src/mail-accounts/index.js';

describe('ActionJobProcessingQueueService', () => {
    const actionExecutionRepository = new KnexActionJobProcessingRepository(knexConfig);
    const actionJobRepository = new KnexActionJobRepository(actionExecutionRepository.connection);
    const actionRepository = new KnexActionRepository(actionExecutionRepository.connection);
    const caseRepository = new KnexCaseRepository(actionExecutionRepository.connection);
    const usersRepository = new KnexUsersRepository(actionExecutionRepository.connection);
    const groupsRepository = new KnexGroupsRepository(actionExecutionRepository.connection);
    const globalConfigurationRepository = new KnexGlobalConfigurationRepository(actionExecutionRepository.connection);
    const mailAccountRepository = new KnexMailAccountRepository(actionExecutionRepository.connection);

    let actionExecutor = {
        execute: async (_action, _kase, _content) => {
            return true;
        },
    };
    let service;

    let action;
    let kase;

    beforeEach(async () => {
        // `actionExecutor` es un objeto compartido y varios tests le reescriben
        // `execute`. Sin este reinicio, el comportamiento se filtraba al siguiente.
        actionExecutor.execute = async (_action, _kase, _content) => true;

        action = await ActionMother.create(actionRepository);
        kase = await CasesMother.createCase(caseRepository);

        service = new ActionJobProcessingQueueService({
            actionExecutionRepository,
            actionJobRepository,
            actionExecutor,
            actionRepository,
            caseRepository,
            usersRepository,
            groupsRepository,
            globalConfigurationRepository,
            mailAccountRepository,
            maxRetries: 2,
            concurrencyLimit: 2,
        });
    });

    describe('processJob', () => {
        it('should mark the batch as completed when there are no pending executions', async () => {
            const batch = await ActionJobMother.create(actionJobRepository);
            const jobId = batch.id.value;

            await service.processJob(jobId);

            const updatedBatch = await actionJobRepository.find(batch.id);
            expect(updatedBatch.is_completed.value).toBeTruthy();
            expect(updatedBatch.details.value.message).toBe('No executions to process');
        });

        it('should successfully process all executions in a batch', async () => {
            const batch = await ActionJobMother.create(actionJobRepository, { total_records: 3 });
            const jobId = batch.id.value;

            await ActionJobProcessingMother.create(actionExecutionRepository, {
                job_id: jobId,
                action_id: action.id.value,
                case_id: kase.id.value,
            });
            await ActionJobProcessingMother.create(actionExecutionRepository, {
                job_id: jobId,
                action_id: action.id.value,
                case_id: kase.id.value,
            });
            await ActionJobProcessingMother.create(actionExecutionRepository, {
                job_id: jobId,
                action_id: action.id.value,
                case_id: kase.id.value,
            });

            await service.processJob(jobId);

            const updatedBatch = await actionJobRepository.find(batch.id);
            expect(updatedBatch.is_completed.value).toBeTruthy();
            expect(updatedBatch.processed_records.value).toBe(3);
            expect(updatedBatch.failed_records.value).toBe(0);
            expect(updatedBatch.details.value.successfulExecutions).toBe(3);
            expect(updatedBatch.details.value.failedExecutions).toBe(0);

            const updatedExecutions = await actionExecutionRepository
                .connection(actionExecutionRepository.tableName)
                .select('*');

            expect(updatedExecutions.every((e) => e.is_completed)).toBe(true);
        });

        it('should handle failures in executions respecting the max retry limit', async () => {
            actionExecutor.execute = async (_action, _kase, _content) => {
                throw new Error('Execution failed');
            };

            const batch = await ActionJobMother.create(actionJobRepository);
            const jobId = batch.id.value;

            const execution = await ActionJobProcessingMother.create(actionExecutionRepository, {
                job_id: jobId,
                action_id: action.id.value,
                case_id: kase.id.value,
            });

            // Cada pasada de `processJob` consume UN intento: al fallar, la ejecucion
            // queda marcada para reintento (ni completada ni fallida) y la vuelve a
            // recoger la pasada siguiente. El limite se alcanza en la segunda.
            await service.processJob(jobId);

            let updatedExecution = await actionExecutionRepository.find(execution.id);
            expect(updatedExecution.is_failed.value).toBeFalsy();
            expect(updatedExecution.details.value.attempts).toBe(1);

            await service.processJob(jobId);

            const updatedBatch = await actionJobRepository.find(batch.id);
            expect(updatedBatch.is_completed.value).toBeTruthy();
            expect(updatedBatch.processed_records.value).toBe(0);
            expect(updatedBatch.failed_records.value).toBe(1);

            updatedExecution = await actionExecutionRepository.find(execution.id);
            expect(updatedExecution.is_completed.value).toBeFalsy();
            expect(updatedExecution.is_failed.value).toBeTruthy();
            expect(updatedExecution.is_in_progress.value).toBeFalsy();
            expect(updatedExecution.details.value.attempts).toBe(2);
            expect(updatedExecution.details.value.errors.length).toBe(2);
        });

        it('should process executions with the set concurrency limit', async () => {
            const batch = await ActionJobMother.create(actionJobRepository);
            const jobId = batch.id.value;

            const execIds = [];
            for (let i = 0; i < 5; i++) {
                await ActionJobProcessingMother.create(actionExecutionRepository, {
                    job_id: jobId,
                    action_id: action.id.value,
                    case_id: kase.id.value,
                    details: { content: `exec-${i}` },
                });
                execIds.push(`exec-${i}`);
            }

            let executionOrder = [];

            actionExecutor.execute = async (_action, _kase, content) => {
                executionOrder.push(content);
                const delay = content === execIds[1] ? 50 : 10;
                await new Promise((resolve) => setTimeout(resolve, delay));
                return { status: 'success' };
            };

            await service.processJob(jobId);

            const updatedBatch = await actionJobRepository.find(batch.id);
            expect(updatedBatch.processed_records.value).toBe(5);
            expect(updatedBatch.failed_records.value).toBe(0);

            expect(executionOrder.length).toBe(5);

            const firstTwo = executionOrder.slice(0, 2);
            expect(firstTwo).toEqual(expect.arrayContaining([execIds[0], execIds[1]]));

            expect(executionOrder).toEqual(expect.arrayContaining(execIds));
        });

        it('should handle errors at the batch level', async () => {
            const fakeBatchID = uuid();
            await expect(service.processJob(fakeBatchID)).rejects.toThrow(
                `processJob execution failed. Batch ID: ${fakeBatchID}`
            );
        });

        it('should handle a mix of successful and failed executions in the batch', async () => {
            actionExecutor.execute = async (_action, _kase, content) => {
                if (content?.shouldFail) {
                    throw new Error('Execution failed');
                }
                return true;
            };

            const batch = await ActionJobMother.create(actionJobRepository);
            const jobId = batch.id.value;

            const failedExecution1 = await ActionJobProcessingMother.create(actionExecutionRepository, {
                job_id: jobId,
                action_id: action.id.value,
                case_id: kase.id.value,
                details: { content: { shouldFail: true } },
            });
            const execution2 = await ActionJobProcessingMother.create(actionExecutionRepository, {
                job_id: jobId,
                action_id: action.id.value,
                case_id: kase.id.value,
            });

            await service.processJob(jobId);

            const updatedBatch = await actionJobRepository.find(batch.id);
            expect(updatedBatch.processed_records.value).toBe(1);
            expect(updatedBatch.failed_records.value).toBe(1);

            const failedActionJobProcessing = await actionExecutionRepository.find(failedExecution1.id);
            const updatedActionJobProcessing = await actionExecutionRepository.find(execution2.id);

            expect(updatedActionJobProcessing.is_completed.value).toBeTruthy();
            expect(updatedActionJobProcessing.is_failed.value).toBeFalsy();
            // Una pasada de `processJob` incrementa el intento una sola vez: `handleExecutionError`
            // marca la ejecucion para reintento, pero no la vuelve a ejecutar en la misma pasada.
            expect(failedActionJobProcessing.details.value.attempts).toBe(1);
        });

        it('should process multiple pages of executions', async () => {
            const batch = await ActionJobMother.create(actionJobRepository);
            const jobId = batch.id.value;

            for (let i = 0; i < 30; i++) {
                await ActionJobProcessingMother.create(actionExecutionRepository, {
                    job_id: jobId,
                    action_id: action.id.value,
                    case_id: kase.id.value,
                });
            }

            await service.processJob(jobId);

            const updatedBatch = await actionJobRepository.find(batch.id);
            expect(updatedBatch.processed_records.value).toBe(30);
            expect(updatedBatch.failed_records.value).toBe(0);

            const executions = await actionExecutionRepository
                .connection(actionExecutionRepository.tableName)
                .select('*')
                .where('job_id', '=', batch.id.value)
                .limit(100);
            expect(executions.length).toBe(30);
            expect(executions.every((e) => e.is_completed)).toBe(true);
        });
    });

    describe('processExecution', () => {
        it('should successfully process an execution', async () => {
            const execution = await ActionJobProcessingMother.create(actionExecutionRepository, {
                action_id: action.id.value,
                case_id: kase.id.value,
            });

            const result = await service.processExecution(execution);

            expect(result).toBeDefined();

            const updatedExecution = await actionExecutionRepository.find(execution.id);
            const details = updatedExecution.details.value;

            expect(updatedExecution.is_completed.value).toBeTruthy();
            expect(updatedExecution.is_failed.value).toBeFalsy();
            expect(updatedExecution.is_in_progress.value).toBeFalsy();
            expect(details.attempts).toBe(1);
        });

        it('should retry execution when it fails', async () => {
            actionExecutor.execute = async (_action, _kase, _content) => {
                throw new Error('Execution failed');
            };

            const execution = await ActionJobProcessingMother.create(actionExecutionRepository, {
                action_id: action.id.value,
                case_id: kase.id.value,
            });

            const result = await service.processExecution(execution);
            expect(result.success).toBeFalsy();

            const updatedExecution = await actionExecutionRepository.find(execution.id);
            expect(updatedExecution.is_completed.value).toBeFalsy();
            expect(updatedExecution.is_failed.value).toBeFalsy();
            expect(updatedExecution.is_in_progress.value).toBeFalsy();
            expect(updatedExecution.details.value.attempts).toBe(1);
        });

        it('should mark execution as failed after max attempts are reached', async () => {
            actionExecutor.execute = async () => {
                throw new Error('Execution failed');
            };

            const execution = await ActionJobProcessingMother.create(actionExecutionRepository, {
                action_id: action.id.value,
                case_id: kase.id.value,
            });

            await service.processExecution(execution);
            let updatedExecution = await actionExecutionRepository.find(execution.id);
            expect(updatedExecution.is_failed.value).toBeFalsy();

            await service.processExecution(updatedExecution);
            updatedExecution = await actionExecutionRepository.find(execution.id);
            expect(updatedExecution.is_failed.value).toBeTruthy();
            expect(updatedExecution.details.value.attempts).toBe(2);
        });

        it('should accumulate error details on each failed attempt', async () => {
            actionExecutor.execute = async () => {
                throw new Error('Execution failed');
            };

            const execution = await ActionJobProcessingMother.create(actionExecutionRepository, {
                action_id: action.id.value,
                case_id: kase.id.value,
            });

            await service.processExecution(execution);
            const firstAttempt = await actionExecutionRepository.find(execution.id);
            expect(firstAttempt.details.value.errors.length).toBe(1);

            await service.processExecution(firstAttempt);
            const secondAttempt = await actionExecutionRepository.find(execution.id);
            expect(secondAttempt.details.value.errors.length).toBe(2);
        });
    });
});
