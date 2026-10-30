const CHANNEL_HUB_MESSAGE_WEBHOOK_PATH = '/webhooks/channel-hub';

export class ChannelHubPayloadBuilder {
    /**
     * @param {Object} tenant - Tenant context object
     * @param {Object} account - Account with email and country_id (ChannelHubAccount or MailAccount)
     * @return {Object} Channel Hub connection payload
     */
    static buildConnectionPayload(tenant, account) {
        const email = account.from_address?.value ?? account.email?.value ?? account.email;
        const countryId = account.country_id?.value ?? 'co';
        const operatorId =
            account.operator_id?.value ?? account.operator_id ?? account.channelHubAccountType?.() ?? 'imap';

        return {
            user: tenant.channel_hub_user.value,
            countryId,
            customerId: tenant.apps_service_name.value,
            serviceId: tenant.apps_service_name.value,
            channelId: 'email',
            operatorId,
            providerAccountId: email,
            limits: {
                messagesPerDay: 0,
                clientsPerDay: 0,
            },
            billing: {
                costPerMessage: '0.34',
            },
            webhooks: [
                {
                    redirectionMessageWebhook: ChannelHubPayloadBuilder.#joinUrl(
                        tenant.apiUrl(),
                        CHANNEL_HUB_MESSAGE_WEBHOOK_PATH
                    ),
                    redirectionStatusWebhook: '',
                    webhookParams: '',
                    webhookHeaders: `x-tenant-id = ${tenant.id.value}, x-api-key = ${tenant.webhook_api_key.value}`,
                    nameWebhook: 'main',
                },
            ],
            serviceOwner: tenant.apps_service_name.value,
            operator: {
                email,
                isSendOnly: false,
                userFoldersToExclude: [],
            },
        };
    }

    static #joinUrl(baseUrl, path) {
        const normalizedBase = String(baseUrl).replace(/\/+$/, '');
        const normalizedPath = String(path).startsWith('/') ? path : `/${path}`;

        return `${normalizedBase}${normalizedPath}`;
    }
}
