const WS_REST_ENDPOINTS_TABLE = 'ws_rest_endpoints';
const CHANNEL_HUB_EMAIL_RULE_URL_PATTERN = '%/v1/channel/email/rule';
const COMPACT_BODY_CONTEXT_PATH = 'context.channel_hub_tag';

const EXPANDED_EMAIL_RULE_BODY = {
    body: {
        connectionId: 'context.channel_hub_tag.connectionId',
        ruleName: 'context.channel_hub_tag.ruleName',
        subjectContains: 'context.channel_hub_tag.subjectContains',
        subjectEquals: 'context.channel_hub_tag.subjectEquals',
        toContains: 'context.channel_hub_tag.toContains',
        toEquals: 'context.channel_hub_tag.toEquals',
        bodyContains: 'context.channel_hub_tag.bodyContains',
        ccContains: 'context.channel_hub_tag.ccContains',
        ccEquals: 'context.channel_hub_tag.ccEquals',
        fromContains: 'context.channel_hub_tag.fromContains',
        fromEquals: 'context.channel_hub_tag.fromEquals',
        webhooks: 'context.channel_hub_tag.webhooks',
        actionRules: 'context.channel_hub_tag.actionRules',
    },
};

const parseBody = (rawBody) => {
    if (typeof rawBody === 'string') {
        return JSON.parse(rawBody);
    }
    return rawBody;
};

const serializeBody = (body, originalBody) => (typeof originalBody === 'string' ? JSON.stringify(body) : body);

export function compactChannelHubEmailRuleBody(rawBody) {
    parseBody(rawBody);
    return serializeBody({ body: COMPACT_BODY_CONTEXT_PATH }, rawBody);
}

export function restoreExpandedChannelHubEmailRuleBody(rawBody) {
    parseBody(rawBody);
    return serializeBody(EXPANDED_EMAIL_RULE_BODY, rawBody);
}

async function updateMatchingEndpointBodies(knex, transform) {
    const endpoints = await knex(WS_REST_ENDPOINTS_TABLE)
        .select('id', 'body')
        .where('url', 'like', CHANNEL_HUB_EMAIL_RULE_URL_PATTERN)
        .whereNull('deleted_at');

    for (const endpoint of endpoints) {
        const updatedBody = transform(endpoint.body);
        if (JSON.stringify(updatedBody) === JSON.stringify(endpoint.body)) continue;

        await knex(WS_REST_ENDPOINTS_TABLE).where({ id: endpoint.id }).update({ body: updatedBody });
    }
}

/**
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await updateMatchingEndpointBodies(knex, compactChannelHubEmailRuleBody);
}

/**
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await updateMatchingEndpointBodies(knex, restoreExpandedChannelHubEmailRuleBody);
}
