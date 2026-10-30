import { ChannelHubPayloadBuilder } from '../../../../src/channel-hub-accounts/infrastructure/mappers/ChannelHubPayloadBuilder.js';

function value(value) {
    return { value };
}

function tenantWithApiUrl(apiUrl) {
    return {
        channel_hub_user: value('channel-hub-user'),
        apps_service_name: value('kace-service'),
        webhook_api_key: value('webhook-api-key'),
        id: value('tenant-id'),
        apiUrl: () => apiUrl,
    };
}

function account(overrides = {}) {
    return {
        email: value('support@example.com'),
        country_id: value('co'),
        ...overrides,
    };
}

describe('ChannelHubPayloadBuilder', () => {
    it('registers new Channel Hub accounts against the dedicated webhooks endpoint', () => {
        const payload = ChannelHubPayloadBuilder.buildConnectionPayload(
            tenantWithApiUrl('https://api.example.com'),
            account()
        );

        expect(payload.webhooks).toHaveLength(1);
        expect(payload.webhooks[0].redirectionMessageWebhook).toBe('https://api.example.com/webhooks/channel-hub');
        expect(payload.webhooks[0].redirectionMessageWebhook).not.toContain('/interactions/webhook');
        expect(payload.webhooks[0].redirectionMessageWebhook).not.toMatch(/\/webhook$/);
    });

    it('normalizes a tenant API URL that already ends with a slash', () => {
        const payload = ChannelHubPayloadBuilder.buildConnectionPayload(
            tenantWithApiUrl('https://api.example.com/'),
            account()
        );

        expect(payload.webhooks[0].redirectionMessageWebhook).toBe('https://api.example.com/webhooks/channel-hub');
    });

    it('keeps webhook authentication headers unchanged', () => {
        const payload = ChannelHubPayloadBuilder.buildConnectionPayload(
            tenantWithApiUrl('https://api.example.com'),
            account()
        );

        expect(payload.webhooks[0].webhookHeaders).toBe('x-tenant-id = tenant-id, x-api-key = webhook-api-key');
    });

    it('uses the Channel Hub account operator when provided', () => {
        const payload = ChannelHubPayloadBuilder.buildConnectionPayload(
            tenantWithApiUrl('https://api.example.com'),
            account({ operator_id: value('microsoft') })
        );

        expect(payload.operatorId).toBe('microsoft');
    });

    it('defaults manual Channel Hub accounts to imap when no operator is saved', () => {
        const payload = ChannelHubPayloadBuilder.buildConnectionPayload(
            tenantWithApiUrl('https://api.example.com'),
            account()
        );

        expect(payload.operatorId).toBe('imap');
    });
});
