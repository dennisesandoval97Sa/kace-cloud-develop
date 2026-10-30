import { HttpResponse } from '@kace/api-common';
import {
    AUTHORIZATION_ERROR,
    BAD_REQUEST_ERROR,
    CHANNEL_HUB_WORKSPACE_PRIORITIES_UNAVAILABLE,
    CONFLICT_ERROR,
    GENERAL_INTERNAL_ERROR,
    NOT_FOUND_ERROR,
    normalizePublicErrorCode,
    VALIDATION_ERROR,
} from '@kace/error-codes';
import Joi from 'joi';
import { WorkspacePriorityConflictError } from './WorkspacePriorityApplication.mjs';
import { WorkspacePriorityUpdateSchema } from './schemas.mjs';

const activeOperationReceiptSchema = Joi.object({
    operationId: Joi.string().uuid().required(),
    status: Joi.string().valid('pending', 'in_progress').required(),
});

export const createWorkspacePriorityApplicationArguments = ({
    writerConfig,
    readerConfig,
    createWorkflowExecutor,
    eventBus,
}) => {
    return async (authenticatedUser) => ({
        writerConfig,
        readerConfig,
        workflowExecutor: await createWorkflowExecutor(authenticatedUser),
        eventBus,
    });
};

export const workspacePriorityErrorResponse = (error, event) => {
    if (error instanceof SyntaxError) {
        return HttpResponse.badRequest({ event, code: BAD_REQUEST_ERROR });
    }

    const code = normalizePublicErrorCode(error?.publicErrorCode);
    if (error instanceof WorkspacePriorityConflictError) {
        const receipt = activeOperationReceiptSchema.validate(error?.activeOperation);
        const activeOperation = receipt.error ? null : receipt.value;
        return HttpResponse.conflict({
            event,
            code: code ?? CONFLICT_ERROR,
            data: activeOperation ? { activeOperation } : undefined,
            headers: activeOperation ? { 'Retry-After': '1' } : {},
            publicData: activeOperation ? { activeOperation } : null,
        });
    }
    if (error?.statusCode === 409) {
        return HttpResponse.conflict({ event, code: code ?? CONFLICT_ERROR });
    }
    if (error?.statusCode === 404) {
        return HttpResponse.notFound({ event, code: code ?? NOT_FOUND_ERROR });
    }
    if (error?.statusCode === 400) {
        return HttpResponse.badRequest({ event, code: code ?? BAD_REQUEST_ERROR });
    }
    if (error?.statusCode === 502) {
        return HttpResponse.badGateway({
            event,
            code: code ?? CHANNEL_HUB_WORKSPACE_PRIORITIES_UNAVAILABLE,
        });
    }
    return HttpResponse.internalServerError({ event, code: code ?? GENERAL_INTERNAL_ERROR });
};

export class WorkspacePriorityControllerBoundary {
    constructor({ event, pathParameters, payload, tenant, applicationFactory, applicationFactoryArguments, logger }) {
        this.event = event;
        this.pathParameters = pathParameters;
        this.payload = payload;
        this.tenant = tenant;
        this.applicationFactory = applicationFactory;
        this.applicationFactoryArguments = applicationFactoryArguments;
        this.logger = logger;
    }

    async #withApplication(user, execute) {
        const applicationArguments = await this.applicationFactoryArguments(user);
        const application = await this.applicationFactory(applicationArguments);
        try {
            return await execute(application);
        } finally {
            await application.destroy?.();
        }
    }

    async list(user) {
        try {
            if (!user.hasPermission('administrador', 'channel-hub', 'ChannelHubRead')) {
                return HttpResponse.forbidden({ event: this.event, code: AUTHORIZATION_ERROR });
            }

            const accountId = this.pathParameters().id;
            const priorities = await this.#withApplication(user, (application) => application.list(accountId));
            return HttpResponse.ok({ data: priorities, event: this.event });
        } catch (error) {
            this.logger.logError('Controller::listWorkspacePriorities', error);
            return workspacePriorityErrorResponse(error, this.event);
        }
    }

    async reorder(user) {
        try {
            if (!user.hasPermission('administrador', 'channel-hub', 'ChannelHubUpdate')) {
                return HttpResponse.forbidden({ event: this.event, code: AUTHORIZATION_ERROR });
            }

            const { value, error } = WorkspacePriorityUpdateSchema.validate(this.payload(), { abortEarly: false });
            if (error) {
                this.logger.logError('Controller::reorderWorkspacePriorities::validationFailed', error);
                return HttpResponse.validationsFail({ event: this.event, code: VALIDATION_ERROR });
            }

            const receipt = await this.#withApplication(user, (application) =>
                application.requestReorder(this.pathParameters().id, value, {
                    tenantId: this.tenant().id.value,
                    userId: user.id.value,
                })
            );
            return HttpResponse.accepted({ data: receipt, event: this.event });
        } catch (error) {
            this.logger.logError('Controller::reorderWorkspacePriorities', error);
            return workspacePriorityErrorResponse(error, this.event);
        }
    }

    async status(user) {
        try {
            if (!user.hasPermission('administrador', 'channel-hub', 'ChannelHubRead')) {
                return HttpResponse.forbidden({ event: this.event, code: AUTHORIZATION_ERROR });
            }

            const { id: accountId, operationId } = this.pathParameters();
            const operation = await this.#withApplication(user, (application) =>
                application.findOperation(accountId, operationId)
            );
            if (!operation) return HttpResponse.notFound({ event: this.event, code: NOT_FOUND_ERROR });
            return HttpResponse.ok({ data: operation, event: this.event });
        } catch (error) {
            this.logger.logError('Controller::runWorkspacePriorityReorderStatus', error);
            return workspacePriorityErrorResponse(error, this.event);
        }
    }
}
