import { ChannelHubInboundEmailWebhookResponse, HttpResponse } from '@kace/api-common';
import { channelHubSchema } from './schemas.mjs';
import { buildChannelHubInboundEmailProcessor } from '@kace/core/src/channel-hub-inbound-emails/infrastructure/ChannelHubInboundEmailProcessorFactory.js';
import { Helper } from '@kace/core/src/shared/index.js';

export class Controller {
    #event;
    #knexConfig;
    #processorFactory;
    #logger;

    constructor(event, knexConfig, { logger = Helper, processorFactory } = {}) {
        this.#event = event;
        this.#knexConfig = knexConfig;
        this.#logger = logger;
        this.#processorFactory = processorFactory ?? (() => buildChannelHubInboundEmailProcessor(this.#knexConfig));
    }

    async handle() {
        try {
            switch (this.#event.resource) {
                case '/channel-hub':
                    return await this.#handleChannelHub();
                default:
                    return HttpResponse.notFound({
                        message: `Unknown webhook resource: ${this.#event.resource}`,
                        event: this.#event,
                    });
            }
        } catch (error) {
            return HttpResponse.internalServerError({
                errors: error,
                event: this.#event,
            });
        }
    }

    async #handleChannelHub() {
        let payload;
        const requestId = this.#requestId();
        try {
            payload = JSON.parse(this.#event.body || '{}');
        } catch (error) {
            this.#logger.logDebug('ChannelHubWebhook::invalidJsonPayload', {
                resource: this.#event.resource,
                requestId,
                error: error.message,
            });

            return ChannelHubInboundEmailWebhookResponse.invalidJsonPayload(error, this.#event);
        }

        this.#logger.logDebug('ChannelHubWebhook::receivedPayload', {
            resource: this.#event.resource,
            requestId,
            payload,
        });

        const { error, value } = channelHubSchema.validate(payload, { abortEarly: false });
        if (error) {
            this.#logger.logDebug('ChannelHubWebhook::validationFailed', {
                resource: this.#event.resource,
                requestId,
                messageId: payload?.messageId ?? null,
                messageIdOperator: payload?.messageIdOperator ?? null,
                connectionId: payload?.connectionId ?? null,
                tag: payload?.tag ?? null,
                errors: this.#validationErrorDetails(error),
            });

            return ChannelHubInboundEmailWebhookResponse.invalidPayload(error, payload, this.#event);
        }

        this.#logger.logDebug('ChannelHubWebhook::validationSucceeded', {
            resource: this.#event.resource,
            requestId,
            payload: this.#payloadDiagnostics(value),
        });

        const processorResource = this.#processorFactory();
        const processor = processorResource.processor ?? processorResource;

        try {
            const startedAt = Date.now();
            this.#logger.logDebug('ChannelHubWebhook::processingStarted', {
                resource: this.#event.resource,
                requestId,
                messageId: value.messageId ?? null,
                messageIdOperator: value.messageIdOperator ?? null,
                connectionId: value.connectionId ?? null,
                tag: value.tag ?? null,
            });

            const result = await processor.execute(value);
            this.#logger.logDebug('ChannelHubWebhook::processingResult', {
                resource: this.#event.resource,
                requestId,
                duration: Date.now() - startedAt,
                result: this.#processingResultDiagnostics(result),
            });

            return ChannelHubInboundEmailWebhookResponse.fromProcessingResult(result, this.#event);
        } finally {
            await processorResource.destroy?.();
        }
    }

    #requestId() {
        return this.#event.kContext?.awsRequestId ?? this.#event.requestContext?.requestId ?? 'unknown';
    }

    #validationErrorDetails(error) {
        return (error?.details ?? []).map((detail) => ({
            path: detail.path.join('.'),
            message: detail.message,
            type: detail.type,
        }));
    }

    #payloadDiagnostics(payload) {
        const destination = payload?.destination ?? {};
        const attachments = payload?.attachments;

        return {
            messageId: payload?.messageId ?? null,
            messageIdOperator: payload?.messageIdOperator ?? null,
            threadId: payload?.threadId ?? null,
            connectionId: payload?.connectionId ?? null,
            tag: payload?.tag ?? null,
            subject: payload?.subject ?? null,
            originType: this.#valueType(payload?.origin),
            destination: {
                toType: this.#valueType(destination.to),
                ccType: this.#valueType(destination.cc),
                bccType: this.#valueType(destination.bcc),
            },
            hasTextBodyUrl: Boolean(payload?.content?.text),
            hasHtmlBodyUrl: Boolean(payload?.content?.html),
            attachmentCount: Array.isArray(attachments) ? attachments.length : 0,
        };
    }

    #processingResultDiagnostics(result) {
        return {
            status: result?.status ?? null,
            code: result?.code ?? null,
            message: result?.message ?? null,
            accepted: Boolean(result?.accepted),
            nonRetryable: Boolean(result?.nonRetryable),
            retryable: Boolean(result?.retryable),
            alreadyProcessed: Boolean(result?.alreadyProcessed),
            data: this.#resultDataDiagnostics(result?.data),
            error: result?.error
                ? {
                      name: result.error.name ?? null,
                      message: result.error.message ?? null,
                  }
                : null,
        };
    }

    #resultDataDiagnostics(data) {
        if (!data) {
            return null;
        }

        return {
            email_id: data.email_id ?? null,
            interaction_id: data.interaction_id ?? null,
            already_processed: data.already_processed ?? null,
        };
    }

    #valueType(value) {
        if (Array.isArray(value)) {
            return `array(${value.length})`;
        }
        if (value === '') {
            return 'empty_string';
        }
        if (value === null) {
            return 'null';
        }
        if (value === undefined) {
            return 'undefined';
        }
        return typeof value;
    }
}
