import Joi from 'joi';
import * as workspaceTagUpdates from './WorkspaceTagUpdateFlowQueuer.mjs';
import {
    WORKSPACE_CHANNEL_HUB_TAG_DEACTIVATION_FAILED,
    WORKSPACE_CHANNEL_HUB_TAG_DELETION_FLOW_REQUIRED,
} from '@kace/error-codes';

export class WorkspaceChannelHubTagDeactivatorError extends Error {
    constructor(
        message,
        statusCode = 502,
        details = undefined,
        publicErrorCode = WORKSPACE_CHANNEL_HUB_TAG_DEACTIVATION_FAILED
    ) {
        super(message);
        this.name = 'WorkspaceChannelHubTagDeactivatorError';
        this.statusCode = statusCode;
        this.details = details;
        this.publicErrorCode = publicErrorCode;
    }
}

const flowIdSchema = Joi.string().trim().min(1).required();
const deleteResponseIdentifiersSchema = Joi.object({
    connectionId: Joi.any(),
    connection_id: Joi.any(),
    ruleId: Joi.any(),
    rule_id: Joi.any(),
    message: Joi.any(),
    detail: Joi.any(),
    status: Joi.any(),
}).unknown(true);
const DELETE_SUCCESS_MESSAGE = 'Mail rule deleted successfully';
const baseUrlSchema = Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .allow(null);

const decodeBaseUrl = (url) => {
    const { value, error } = baseUrlSchema.validate(url ?? null);
    if (error) throw new TypeError('KACE API base URL must be an HTTP or HTTPS URL');
    return value?.replace(/\/+$/, '') ?? null;
};

const statusCodeFrom = (error) =>
    error?.statusCode ??
    error?.status ??
    error?.response?.statusCode ??
    error?.response?.status ??
    error?.cause?.statusCode ??
    error?.cause?.status;

const isAlreadyAbsentDelete = (error) => Number(statusCodeFrom(error)) === 404 && error?.fields?.method === 'DELETE';
const isRetryableDeleteError = (error) => {
    if (error?.fields?.reason === 'invalid_delete_response') return false;
    const statusCode = Number(statusCodeFrom(error));
    return !statusCode || statusCode === 408 || statusCode === 429 || statusCode >= 500;
};

const wait = (durationMs) => new Promise((resolve) => setTimeout(resolve, durationMs));

const workflowResponseToJson = (response) => {
    const json = response?.toJson?.();
    return json?.data ?? json;
};

const deleteResponseMatchesTarget = (deleteResponse, target) => {
    const { error, value } = deleteResponseIdentifiersSchema.validate(deleteResponse, { convert: false });
    if (error) return true;
    return [
        ['connectionId', target.connectionId],
        ['connection_id', target.connectionId],
        ['ruleId', target.ruleId],
        ['rule_id', target.ruleId],
    ].every(([field, expected]) => !Object.prototype.hasOwnProperty.call(value, field) || value[field] === expected);
};

const invalidDeleteResponseError = (message, reason = 'invalid_delete_response', statusCode = 502) =>
    Object.assign(new Error(message), {
        statusCode,
        fields: { reason },
    });

const deadlineExceededError = () =>
    Object.assign(new Error('Workspace deactivation deadline exceeded'), { statusCode: 504 });

const classifyDeleteResponse = (response, target) => {
    const channelHubTag = workflowResponseToJson(response)?.context?.channel_hub_tag;
    if (
        channelHubTag?.connectionId !== target.connectionId ||
        channelHubTag?.ruleId !== target.ruleId ||
        !Object.prototype.hasOwnProperty.call(channelHubTag, 'delete_response') ||
        !deleteResponseMatchesTarget(channelHubTag.delete_response, target)
    ) {
        throw invalidDeleteResponseError('Delete-tag RESTflow response did not match the requested Channel Hub rule');
    }

    const { error, value } = deleteResponseIdentifiersSchema.validate(channelHubTag.delete_response, {
        convert: false,
    });
    if (error) {
        throw invalidDeleteResponseError(
            'Delete-tag RESTflow returned an unrecognized provider response',
            'unexpected_delete_response'
        );
    }
    if (value.message === DELETE_SUCCESS_MESSAGE && value.status === undefined) return { alreadyAbsent: false };
    const expectedAbsentDetail = `No mail rule found for connectionId ${target.connectionId} and ruleId ${target.ruleId}`;
    if (value.status === 400 && value.detail === expectedAbsentDetail) return { alreadyAbsent: true };
    const providerErrorStatus =
        Number.isInteger(value.status) && value.status >= 400 && value.status <= 599 ? value.status : 502;
    throw invalidDeleteResponseError(
        'Delete-tag RESTflow returned an unrecognized provider response',
        'unexpected_delete_response',
        providerErrorStatus
    );
};

const withDeadline = (operation, remainingMs) => {
    if (remainingMs <= 0) {
        return Promise.race([operation, Promise.reject(deadlineExceededError())]);
    }
    let timeoutId;
    const timeout = new Promise((_resolve, reject) => {
        timeoutId = setTimeout(() => reject(deadlineExceededError()), remainingMs);
    });
    return Promise.race([operation, timeout]).finally(() => clearTimeout(timeoutId));
};

const mapWithConcurrency = async (items, concurrency, mapper) => {
    const results = Array.from({ length: items.length });
    let nextIndex = 0;
    const worker = async () => {
        while (nextIndex < items.length) {
            const index = nextIndex;
            nextIndex += 1;
            results[index] = await mapper(items[index]);
        }
    };
    const workers = Array.from({ length: Math.min(concurrency, items.length) }, worker);
    const settlements = await Promise.allSettled(workers);
    const failedWorker = settlements.find(({ status }) => status === 'rejected');
    if (failedWorker) throw failedWorker.reason;
    return results;
};

/**
 * Deletes all registered Channel Hub rules before the workspace is made inactive.
 * The previous workspace snapshot is intentionally used for every deletion.
 */
export class WorkspaceChannelHubTagDeactivator {
    #workflowExecutorFactory;
    #metadata;
    #kaceApiBaseUrl;
    #logger;
    #maxConcurrency;
    #maxAttempts;
    #deadlineMs;
    #retryDelayMs;
    #maxRequestTimeoutMs;
    #now;

    constructor({
        workflowExecutor,
        workflowExecutorFactory,
        metadata = {},
        kaceApiBaseUrl = null,
        logger = console,
        maxConcurrency = 3,
        maxAttempts = 3,
        deadlineMs = 24_000,
        retryDelayMs = 250,
        maxRequestTimeoutMs = 10_000,
        now = () => Date.now(),
    }) {
        this.#workflowExecutorFactory = workflowExecutorFactory ?? (() => workflowExecutor);
        this.#metadata = metadata;
        this.#kaceApiBaseUrl = decodeBaseUrl(kaceApiBaseUrl);
        this.#logger = logger;
        this.#maxConcurrency = maxConcurrency;
        this.#maxAttempts = maxAttempts;
        this.#deadlineMs = deadlineMs;
        this.#retryDelayMs = retryDelayMs;
        this.#maxRequestTimeoutMs = maxRequestTimeoutMs;
        this.#now = now;
    }

    async execute(previousWorkspace, { targets = workspaceTagUpdates.channelHubRuleTargets(previousWorkspace) } = {}) {
        if (targets.length === 0) return [];

        if (flowIdSchema.validate(previousWorkspace?.tag_deletion_flow_id).error) {
            throw new WorkspaceChannelHubTagDeactivatorError(
                'Workspace has no tag deletion flow assigned',
                409,
                { workspace_id: previousWorkspace?.id },
                WORKSPACE_CHANNEL_HUB_TAG_DELETION_FLOW_REQUIRED
            );
        }

        const deadlineAt = this.#now() + this.#deadlineMs;
        return mapWithConcurrency(targets, this.#maxConcurrency, async (target) => {
            let lastError;
            for (let attempt = 0; attempt < this.#maxAttempts; attempt += 1) {
                try {
                    const requestTimeoutResolver = () => {
                        const remainingMs = deadlineAt - this.#now();
                        if (remainingMs <= 0) throw deadlineExceededError();
                        return Math.min(this.#maxRequestTimeoutMs, remainingMs);
                    };
                    const workflowExecutor = this.#workflowExecutorFactory({
                        requestTimeoutMs: requestTimeoutResolver(),
                        requestTimeoutResolver,
                    });
                    const response = await withDeadline(
                        workflowExecutor.execute({
                            flow_id: previousWorkspace.tag_deletion_flow_id,
                            initial_context: {
                                source: 'workspaces.deactivate',
                                tenant_id: this.#metadata.tenant_id,
                                kace_api_base_url: this.#kaceApiBaseUrl,
                                workspace: previousWorkspace,
                                channel_hub_tag: workspaceTagUpdates.buildChannelHubTagContext(
                                    previousWorkspace,
                                    target
                                ),
                            },
                        }),
                        deadlineAt - this.#now()
                    );
                    const { alreadyAbsent } = classifyDeleteResponse(response, target);
                    return { ...target, already_absent: alreadyAbsent };
                } catch (error) {
                    if (isAlreadyAbsentDelete(error)) return { ...target, already_absent: true };
                    lastError = error;
                    if (
                        !isRetryableDeleteError(error) ||
                        attempt >= this.#maxAttempts - 1 ||
                        this.#now() >= deadlineAt
                    ) {
                        break;
                    }
                    try {
                        await withDeadline(wait(this.#retryDelayMs * 2 ** attempt), deadlineAt - this.#now());
                    } catch (deadlineError) {
                        lastError = deadlineError;
                        break;
                    }
                }
            }

            this.#logger?.error?.('Delete-tag RESTflow execution failed during workspace deactivation', {
                workspace_id: previousWorkspace.id,
                flow_id: previousWorkspace.tag_deletion_flow_id,
                channel_hub_account_id: target.channel_hub_account_id,
                connection_id: target.connectionId,
                rule_id: target.ruleId,
                error_name: lastError?.name ?? null,
                error_message: lastError?.message ?? 'Remote deletion failed',
                error_status: Number(statusCodeFrom(lastError)) || null,
            });
            throw new WorkspaceChannelHubTagDeactivatorError(
                'Channel Hub rule deletion failed; workspace remains active',
                502,
                {
                    workspace_id: previousWorkspace.id,
                    channel_hub_account_id: target.channel_hub_account_id,
                    connection_id: target.connectionId,
                    rule_id: target.ruleId,
                }
            );
        });
    }
}
