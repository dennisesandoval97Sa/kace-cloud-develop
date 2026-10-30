import {
    BaseController,
    ChannelHubInboundEmailWebhookResponse,
    channelHubSchema,
    HttpResponse,
} from '@kace/api-common';
import { objectIdentityErrorResponse } from '@kace/api-common/src/security/ObjectIdentityAuthorization.js';
import { buildChannelHubInboundEmailProcessor } from '@kace/core/src/channel-hub-inbound-emails/infrastructure/ChannelHubInboundEmailProcessorFactory.js';
import { Helper } from '@kace/core/src/shared/index.js';

// Legacy transition adapter for /interactions/webhook. Do not add Channel Hub
// Email/Interaction business logic here; canonical behavior lives in
// ChannelHubInboundEmailProcessor and the public /channel-hub webhook.
export class ControllerWebhook extends BaseController {
    #event;
    #processorFactory;

    constructor(event, knexConfig, { processorFactory } = {}) {
        super(event, knexConfig);
        this.#event = event;
        this.#processorFactory =
            processorFactory ?? (() => buildChannelHubInboundEmailProcessor(this.database_connection));
    }

    async actionCreate() {
        Helper.logInfo('Begin legacy Channel Hub webhook delegation');
        try {
            const hasPermission = this.user?.hasPermission?.('administrador', 'interactions', 'InteractionsCreate');

            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to create this resource.',
                    event: this.#event,
                });
            }

            let payload;
            try {
                payload = this.payload();
            } catch (error) {
                return ChannelHubInboundEmailWebhookResponse.invalidJsonPayload(error, this.#event);
            }

            const { error, value } = channelHubSchema.validate(payload, { abortEarly: false });
            if (error) {
                return ChannelHubInboundEmailWebhookResponse.invalidPayload(error, payload, this.#event);
            }

            const processorResource = this.#processorFactory();
            const processor = processorResource.processor ?? processorResource;

            try {
                const result = await processor.execute(value);
                return ChannelHubInboundEmailWebhookResponse.fromProcessingResult(result, this.#event);
            } finally {
                await processorResource.destroy?.();
            }
        } catch (error) {
            const response = objectIdentityErrorResponse(error, this.event);
            if (response) return response;
            Helper.logInfo(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.#event,
            });
        } finally {
            Helper.logInfo('End legacy Channel Hub webhook delegation');
        }
    }
}
