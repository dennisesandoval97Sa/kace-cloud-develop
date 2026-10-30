import { DomainActionJobFinder } from '../../../action-jobs/index.js';
import { DomainActionUpdateModelFinder } from '../../../action-update-model/index.js';
import { DomainActionFinder } from '../../../actions/index.js';
import { DomainCaseFinder } from '../../../cases/index.js';
import { DomainClientFinder } from '../../../clients/index.js';
import { DomainConfigFinder } from '../../../global-config/index.js';
import { GroupFinderDomain } from '../../../grupos/index.js';
import { DomainMailAccountFinder } from '../../../mail-accounts/index.js';
import { EmailService, Mail } from '../../../mails/index.js';
import { KnexSecretsVaultRepository } from '../../../secrets-vault/infrastructure/persistence/KnexSecretsVaultRepository.js';
import { CaseActionValidator } from '../../../shared/domain/services/CaseActionValidator.js';
import { Helper } from '../../../shared/index.js';
import { DomainUserFinder } from '../../../users/index.js';

export class ActionJobProcessingQueueService {
    /** @type {KnexActionJobProcessingRepository} is initialized in the constructor */
    #actionExecutionRepository;
    /** @type {KnexActionJobRepository} is initialized in the constructor */
    #actionJobRepository;
    /** @type {DomainActionJobFinder} is initialized in the constructor */
    #actionJobFinder;
    /** @type {ActionExecutor} is initialized in the constructor */
    #actionExecutor;
    /** @type {ClientModelUpdater} is initialized in the constructor */
    #clientModelUpdater;
    /** @type {DomainActionFinder} is initialized in the constructor */
    #actionFinder;
    /** @type {CaseActionValidator} is initialized in the constructor */
    #caseActionValidator;
    /** @type {DomainClientFinder} is initialized in the constructor */
    #caseFinder;
    /** @type {DomainCaseFinder} is initialized in the constructor */
    #clientFinder;
    /** @type {DomainActionUpdateModelFinder} is initialized in the constructor */
    #actionUpdateModelFinder;
    /** @type {DomainUserFinder} is initialized in the constructor */
    #userFinder;
    /** @type {GroupFinderDomain} is initialized in the constructor */
    #groupFinder;
    /** @type {DomainConfigFinder} is initialized in the constructor */
    #configFinder;
    /** @type {DomainMailAccountFinder} is initialized in the constructor */
    #mailAccountFinder;
    /** @type {EmailService} is initialized in the constructor */
    #emailService;

    #maxRetries = 3;
    #batchSize = 25;

    constructor({
        actionExecutionRepository,
        actionJobRepository,
        actionExecutor,
        clientModelUpdater,
        caseRepository,
        clientRepository,
        actionRepository,
        actionUpdateModelRepository,
        usersRepository,
        groupsRepository,
        globalConfigurationRepository,
        mailAccountRepository,
        maxRetries = 3,
        batchSize = 25,
    }) {
        this.#actionExecutionRepository = actionExecutionRepository;
        this.#actionJobRepository = actionJobRepository;
        this.#actionJobFinder = new DomainActionJobFinder(actionJobRepository);
        this.#actionExecutor = actionExecutor;
        this.#clientModelUpdater = clientModelUpdater;
        this.#actionFinder = new DomainActionFinder(actionRepository);
        this.#caseActionValidator = new CaseActionValidator(actionRepository);
        this.#caseFinder = new DomainCaseFinder(caseRepository);
        this.#clientFinder = new DomainClientFinder(clientRepository);
        this.#actionUpdateModelFinder = new DomainActionUpdateModelFinder(actionUpdateModelRepository);
        this.#userFinder = new DomainUserFinder(usersRepository);
        this.#groupFinder = new GroupFinderDomain(groupsRepository);
        this.#configFinder = new DomainConfigFinder(globalConfigurationRepository);
        this.#mailAccountFinder = new DomainMailAccountFinder(mailAccountRepository);
        this.#maxRetries = maxRetries;
        this.#batchSize = batchSize;
        this.#emailService = new EmailService(new KnexSecretsVaultRepository(actionJobRepository.connection));
    }

    /**
     * Process a batch of action executions
     * @param {string} jobId - The ID of the batch execution to process
     * @returns {Promise<void>}
     */
    async processJob(jobId) {
        try {
            const jobExecution = await this.#actionJobFinder.execute(jobId);
            if (!jobExecution) {
                throw new Error(`Batch execution with ID ${jobId} not found`);
            }

            jobExecution.markAsInProgress();
            await this.#actionJobRepository.update(jobExecution);

            const allResults = [];
            let totalProcessed = 0;
            // Una ejecucion marcada para reintento vuelve al estado pendiente, asi que
            // seguiria saliendo en la consulta siguiente. Se lleva la cuenta de lo ya visto
            // para que cada pasada avance y el lote termine.
            const processedIds = [];

            let pendingExecutions = await this.#actionExecutionRepository.findByBatchExecutionId(
                jobExecution.id,
                this.#batchSize,
                processedIds
            );

            while (pendingExecutions.length) {
                for (const execution of pendingExecutions) {
                    Helper.logInfo(`Processing execution ${execution.id.value} for batch ${jobId}`);
                    processedIds.push(execution.id.value);
                    const result = await this.processExecution(execution);
                    allResults.push(result);
                    totalProcessed++;
                    Helper.logInfo(`Completed processing execution ${execution.id.value} for batch ${jobId}`);
                }

                pendingExecutions = await this.#actionExecutionRepository.findByBatchExecutionId(
                    jobExecution.id,
                    this.#batchSize,
                    processedIds
                );
            }

            await this.#completeBatch(jobExecution, allResults, totalProcessed);
        } catch (error) {
            Helper.logError(`Error processing batch ${jobId}:`, error);
            try {
                const jobExecution = await this.#actionJobFinder.execute(jobId);
                if (jobExecution) {
                    jobExecution.markAsCompleted({
                        error: error.message,
                        stack: error.stack,
                        completedAt: new Date().toISOString(),
                    });
                    await this.#actionJobRepository.update(jobExecution);
                }
            } catch (updateError) {
                Helper.logError(`Failed to update batch execution status:`, updateError);
            }
            Helper.logError(`processJob execution failed`, { jobId, error: error.message });
            throw new Error(`processJob execution failed. Batch ID: ${jobId}`);
        }
    }

    async #completeBatch(jobExecution, allResults, totalProcessed) {
        if (totalProcessed === 0) {
            Helper.logInfo(`No pending executions found for batch ${jobExecution.id.value}`);
            jobExecution.markAsCompleted({ message: 'No executions to process' });
            await this.#actionJobRepository.update(jobExecution);
            return;
        }

        const successCount = allResults.filter((r) => r.success).length;
        const failureCount = allResults.filter((r) => !r.success).length;

        jobExecution.processed_records = successCount;
        jobExecution.failed_records = failureCount;

        const batchResult = {
            totalExecutions: totalProcessed,
            successfulExecutions: successCount,
            failedExecutions: failureCount,
            completedAt: new Date().toISOString(),
        };

        jobExecution.markAsCompleted(batchResult);
        await this.#actionJobRepository.update(jobExecution);
        await this.#sendNotification(jobExecution, batchResult);

        Helper.logInfo(`Batch ${jobExecution.id.value} completed: ${JSON.stringify(batchResult)}`);
    }

    /**
     * Process a single action execution
     * @param {ActionJobProcessing} execution - The execution to process
     * @returns {Promise<{success: boolean, executionId: string}>}
     */
    async processExecution(execution) {
        if (!execution.details.value) {
            execution.details = { attempts: 0, errors: [] };
        }

        try {
            execution.markAsInProgress();
            execution.incrementAttempt();
            await this.#actionExecutionRepository.update(execution);

            Helper.logInfo(`Executing action ${execution.action_id.value} for case ${execution.case_id.value}`);
            const action = await this.#actionFinder.execute(execution.action_id.value);

            const result = await this.executeActionBasedOnType(execution, action);
            if (result) {
                execution.markAsCompleted();
            } else {
                execution.markAsFailed([`Fallo la ejecución de la accion`]);
            }
            await this.#actionExecutionRepository.update(execution);

            return { success: result, executionId: execution.id.value };
        } catch (error) {
            Helper.logError(`Error processing execution ${execution.id.value}:`, error);
            return this.handleExecutionError(execution, error);
        }
    }

    /**
     * Execute action based on whether it's client-specific or case-specific
     * @param {ActionJobProcessing} execution - The execution to process
     * @param {Action} action - The action to execute
     * @returns {Promise<boolean>} - The result of the action execution
     */
    async executeActionBasedOnType(execution, action) {
        if (execution.client_id.value) {
            return this.#executeClientAction(execution, action);
        }
        if (execution.case_id.value) {
            return this.#executeCaseAction(execution, action);
        }
        throw new Error(`Execution ${execution.id.value} has neither a valid client_id nor a case_id`);
    }

    /**
     * Execute the client-specific action
     * @param {ActionJobProcessing} execution - The execution to process
     * @param {Action} action - The action to execute
     * @returns {Promise<boolean>} - The result of the action execution
     */
    async #executeClientAction(execution, action) {
        Helper.logInfo(`Executing client action ${execution.action_id.value} for client ${execution.client_id.value}`);

        const client = await this.#clientFinder.execute(execution.client_id.value);
        if (!client) {
            throw new Error(`Client with ID ${execution.client_id.value} not found`);
        }

        if (!action.model_update_id.value) {
            throw new Error(`Action ${action.id.value} doesn't have a model_update_id for client model update`);
        }

        const modelUpdate = await this.#actionUpdateModelFinder.execute(action.model_update_id.value);
        if (!modelUpdate) {
            throw new Error(`Model update with ID ${action.model_update_id.value} not found`);
        }

        return this.#clientModelUpdater.execute(modelUpdate, client);
    }

    /**
     * Execute the case-specific action
     * @param {import('../ActionJobProcessing.js').ActionJobProcessing} execution - The execution to process
     * @param {Action} action - The action to execute
     * @returns {Promise<boolean>} - The result of the action execution
     */
    async #executeCaseAction(execution, action) {
        Helper.logInfo(`Executing action ${execution.action_id.value} for case ${execution.case_id.value}`);

        const kase = await this.#caseFinder.execute(execution.case_id.value);
        if (!kase) {
            return false;
        }
        const shouldEvaluateConditions = execution.evaluate_conditions.value;

        if (shouldEvaluateConditions) {
            const conditionsAreMet = await this.#caseActionValidator.validate(kase, action);
            Helper.logInfo(
                `Case ${execution.case_id.value} does not meet conditions for action ${execution.action_id.value}. Skipping execution.`
            );
            if (!conditionsAreMet) {
                Helper.logInfo(
                    `Action ${action.id.value} conditions not met for case ${kase.id.value}, skipping execution.`
                );
                return false;
            }
        }
        return this.#actionExecutor.execute(action, kase, execution.details.value?.content, 'bulk_action');
    }

    /**
     * Handle error during execution and schedule retry if necessary
     * @param {ActionJobProcessing} execution - The execution that failed
     * @param {Error} error - The error that occurred
     * @returns {Promise<{success: boolean, executionId: string, error: string, scheduledForRetry: boolean}>}
     */
    async handleExecutionError(execution, error) {
        Helper.logError(`Error executing action ${execution.action_id.value}:`, error);

        const currentAttempts = execution.details.value.attempts || 0;
        const errorDetails = {
            message: error.message,
            timestamp: new Date().toISOString(),
            attempt: currentAttempts,
        };

        let scheduledForRetry = true;
        execution.markForRetry([errorDetails]);
        Helper.logInfo(
            `Scheduled retry for action ${execution.action_id.value}, attempt ${currentAttempts}/${this.#maxRetries}`
        );

        if (currentAttempts >= this.#maxRetries) {
            scheduledForRetry = false;
            execution.markAsFailed();
            Helper.logError(`Action ${execution.action_id.value} failed after ${currentAttempts} attempts`);
        }

        await this.#actionExecutionRepository.update(execution);

        return {
            success: false,
            executionId: execution.id.value,
            error: error.message,
            scheduledForRetry,
        };
    }

    async #sendNotification(jobExecution) {
        try {
            const user = await this.#userFinder.execute(jobExecution.created_by.value);
            if (!user) {
                throw new Error('Job creator not found');
            }

            if (!user.grupo_activo.value) {
                throw new Error('User has no active group');
            }
            const group = await this.#groupFinder.execute(user.grupo_activo.value);
            if (!group) {
                throw new Error('User group not found');
            }

            const configuration = await this.#configFinder.execute(group.configuration_id.value);
            if (!configuration) {
                throw new Error('Group configuration not found');
            }

            const mailAccountId = configuration.settings?.behaviors?.getConfig(
                'agente',
                'casos'
            ).account_to_send_notifications;
            if (!mailAccountId) {
                throw new Error('Configuration mail account not found');
            }

            const mailAccount = await this.#mailAccountFinder.execute(mailAccountId);
            if (!mailAccount) {
                throw new Error('Configuration mail account not found');
            }

            const mail = new Mail({
                id: mailAccount.id.value,
                to: [user.email.value],
                subject: `Notificación de finalización de proceso`,
                content: this.#notificationTemplate(jobExecution),
                mail_account_id: mailAccount.id.value,
                sent_by: jobExecution.createdBy,
                sent_status: 'pending',
                created_at: new Date(),
                created_by: user.id.value,
            });

            await this.#emailService.execute(mail, mailAccount);

            Helper.logInfo(`Notification sent to ${user.email.value} using account ${mailAccount.id.value}`);

            jobExecution.notifications_sent = true;
            await this.#actionJobRepository.update(jobExecution);
        } catch (error) {
            Helper.logError(`Notification sent error`, error);
            Helper.logError(`Notification message: ${this.#notificationTemplate(jobExecution)}`);
            jobExecution.notifications_sent = false;
            jobExecution.details = { ...jobExecution.details.value, notifications: `${error.message}` };
            await this.#actionJobRepository.update(jobExecution);
        }
    }

    #notificationTemplate(jobExecution) {
        const actionType = jobExecution.type.value;
        const totalRecords = jobExecution.total_records.value;
        const processedRecords = jobExecution.processed_records.value;
        const failedRecords = jobExecution.failed_records.value;
        const startAt = jobExecution.start_at.value.toLocaleString();
        const endAt = jobExecution.end_at.value.toLocaleString();
        return `Hola,

        El proceso de acciones masivas ha sido completado exitosamente.

        Detalles del proceso:
        - Tipo de proceso: ${actionType}
        - Fecha de inicio: ${startAt}
        - Fecha de finalización: ${endAt}
        - Total de registros: ${totalRecords}
        - Registros procesados: ${processedRecords}
        - Registros fallidos: ${failedRecords}

        Si tienes alguna duda o necesitas más información, no dudes en ponerte en contacto.

        Gracias por utilizar nuestros servicios.

        Saludos cordiales.`;
    }
}
