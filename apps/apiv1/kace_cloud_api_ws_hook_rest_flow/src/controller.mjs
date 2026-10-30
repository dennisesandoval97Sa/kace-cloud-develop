import { BaseController, HttpResponse } from '@kace/api-common';
import { WSHookRestFlowSchema } from './WSHookRestFlowsSchema.mjs';
import { KnexWSRestWorkflowStepRepository } from '@kace/core/src/ws-rest-workflow-step/infrastructure/persistence/KnexWSRestWorkflowStepRepository.js';
import { KnexAllowedConnectionsRepository } from '@kace/core/src/allowed-conections/infrastructure/persistence/KnexAllowedConnectionsRepository';
import { KnexSecretsVaultRepository } from '@kace/core/src/secrets-vault/infrastructure/persistence/KnexSecretsVaultRepository';
import { WorkflowExecutor } from '@kace/core/src/ws-rest-workflow-step/application/executor/WorkflowExecutor.js';
import { Helper, ValueObjectUuid } from '@kace/core/src/shared/index.js';
import { WSRestFlowExecution } from '@kace/core/src/ws-rest-flow-executions/domain/WSRestFlowExecution.js';
import { WSRestFlowExecutionRequested } from '@kace/core/src/ws-rest-flow-executions/domain/events/WSRestFlowExecutionRequested.js';
import { WSRestFlowExecutionResponse } from '@kace/core/src/ws-rest-flow-executions/application/WSRestFlowExecutionResponse.js';
import { KnexWSRestFlowExecutionRepository } from '@kace/core/src/ws-rest-flow-executions/infrastructure/persistence/KnexWSRestFlowExecutionRepository.js';

export class Controller extends BaseController {
    constructor(event, knexConfig) {
        super(event, knexConfig);
        this.repository = new KnexWSRestWorkflowStepRepository(this.database_connection);
        this.allowedConnectionRepository = new KnexAllowedConnectionsRepository(this.database_connection);
        this.secretRepository = new KnexSecretsVaultRepository(this.database_connection);
        this.executionRepository = new KnexWSRestFlowExecutionRepository(this.database_connection);
        this.started_at = new Date();
    }

    #createWorkflowExecutor() {
        return new WorkflowExecutor(
            this.repository,
            this.allowedConnectionRepository,
            this.secretRepository,
            this.user
        );
    }

    #isSync() {
        return this.event.queryStringParameters?.sync === 'true';
    }

    async #executeAsync(dto) {
        const execution = new WSRestFlowExecution({
            id: ValueObjectUuid.random(),
            flow_id: dto.flow_id || null,
            external_code: dto.external_code || null,
            initial_context: dto.initial_context || null,
            status: 'pending',
            created_by: this.user.id.value,
            created_at: new Date(),
        });

        await this.executionRepository.save(execution);

        const domainEvent = new WSRestFlowExecutionRequested({
            executionId: execution.id.value,
            flowId: dto.flow_id || null,
            externalCode: dto.external_code || null,
            initialContext: dto.initial_context || null,
            metadata: {
                tenant_id: this.tenant.id.value,
                user_id: this.user.id.value,
            },
        });

        await this.eventPublisher.publish(domainEvent);

        return HttpResponse.accepted({
            data: {
                execution_id: execution.id.value,
                status: 'pending',
            },
            event: this.event,
        });
    }

    async #executeSync(dto) {
        const now = new Date();
        const execution = new WSRestFlowExecution({
            id: ValueObjectUuid.random(),
            flow_id: dto.flow_id || null,
            external_code: dto.external_code || null,
            initial_context: dto.initial_context || null,
            status: 'in_progress',
            created_by: this.user.id.value,
            created_at: now,
            started_at: now,
        });

        await this.executionRepository.save(execution);

        try {
            const response = await this.#createWorkflowExecutor().execute(dto);
            execution.markAsCompleted(response.toJson());
            await this.executionRepository.update(execution);
            return HttpResponse.ok({ ...response.toJson(), event: this.event });
        } catch (error) {
            execution.markAsFailed({
                message: error.message,
                stack: error.stack,
                failedAt: new Date().toISOString(),
                ...(error.fields ? { detail: error.fields } : {}),
            });
            await this.executionRepository.update(execution);

            if (error?.fields?.reason === 'error_condition_triggered') {
                return HttpResponse.badRequest({
                    message: error.message,
                    errors: { ...error.fields, execution_id: execution.id.value },
                    event: this.event,
                });
            }

            throw error;
        }
    }

    async actionCreate() {
        Helper.logInfo('Begin actionCreate');
        try {
            const hasPermission = this.user.hasPermission(
                'administrador',
                'ws-hook-rest-flows',
                'WsHookRestFlowCreate'
            );
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to create WS Hook REST flows.',
                    event: this.event,
                });
            }

            const payload = this.payload();
            const { value, error } = WSHookRestFlowSchema.validate(payload, {
                abortEarly: false,
            });
            if (error) {
                return HttpResponse.validationsFail({
                    errors: error,
                    event: this.event,
                });
            }

            if (this.#isSync()) {
                return await this.#executeSync(value);
            }

            return await this.#executeAsync(value);
        } catch (error) {
            Helper.logInfo(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End actionCreate');
        }
    }

    async actionRead() {
        Helper.logInfo('Begin actionRead');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'ws-hook-rest-flows', 'WsHookRestFlowRead');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to read WS Hook REST flows.',
                    event: this.event,
                });
            }

            const id = this.pathParameters().id;
            if (!this.validateId(id)) {
                return HttpResponse.badRequest({
                    message: 'Invalid id',
                    event: this.event,
                });
            }

            if (this.#isSync()) {
                return await this.#executeSync({ flow_id: id });
            }

            return await this.#executeAsync({ flow_id: id });
        } catch (error) {
            Helper.logInfo(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End actionRead');
        }
    }

    async actionExecutionStatus() {
        Helper.logInfo('Begin actionExecutionStatus');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'ws-hook-rest-flows', 'WsHookRestFlowRead');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to read WS Hook REST flow executions.',
                    event: this.event,
                });
            }

            const id = this.pathParameters().id;
            if (!this.validateId(id)) {
                return HttpResponse.badRequest({
                    message: 'Invalid id',
                    event: this.event,
                });
            }

            const execution = await this.executionRepository.find(id);
            if (!execution) {
                return HttpResponse.notFound({
                    message: 'Execution not found',
                    event: this.event,
                });
            }

            const response = new WSRestFlowExecutionResponse(execution);
            return HttpResponse.ok({ ...response.toJson(), event: this.event });
        } catch (error) {
            Helper.logInfo(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End actionExecutionStatus');
        }
    }

    async run() {
        try {
            this.user = await this.getLoggedInUser();
        } catch (error) {
            Helper.logError('Error getLoggedInUser', error);
            return HttpResponse.badRequest({
                message: error.message,
                errors: error,
                event: this.event,
            });
        }

        try {
            const resource = this.event.resource;
            const method = this.event.httpMethod;

            if (resource === '/executions/{id}' && method === 'GET') {
                return await this.actionExecutionStatus();
            }

            if (method === 'POST' && resource === '/') {
                return await this.actionCreate();
            }

            if (method === 'GET' && resource === '/{id}') {
                return await this.actionRead();
            }

            return HttpResponse.notFound({
                message: `Resource not found: ${resource}`,
                event: this.event,
            });
        } catch (error) {
            Helper.logError(error);
            return HttpResponse.internalServerError({ errors: error, event: this.event });
        } finally {
            await this.destroyDbConnection();
        }
    }
}
