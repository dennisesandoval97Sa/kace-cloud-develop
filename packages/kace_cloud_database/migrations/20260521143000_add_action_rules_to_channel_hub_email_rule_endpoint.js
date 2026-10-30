const WS_REST_ENDPOINTS_TABLE = 'ws_rest_endpoints';
const CHANNEL_HUB_EMAIL_RULE_URL_PATTERN = '%/v1/channel/email/rule';
const ACTION_RULES_CONTEXT_PATH = 'context.channel_hub_tag.actionRules';

const parseBody = (rawBody) => {
    if (typeof rawBody === 'string') {
        return JSON.parse(rawBody);
    }
    return rawBody;
};

const serializeBody = (body, originalBody) => (typeof originalBody === 'string' ? JSON.stringify(body) : body);

const isObjectBody = (body) => body?.body && typeof body.body === 'object' && !Array.isArray(body.body);

export function addChannelHubEmailRuleBindings(rawBody) {
    const parsed = parseBody(rawBody);
    if (!isObjectBody(parsed)) return rawBody;

    const next = {
        ...parsed,
        body: {
            ...parsed.body,
            actionRules: parsed.body.actionRules ?? ACTION_RULES_CONTEXT_PATH,
        },
    };

    return serializeBody(next, rawBody);
}

export function removeChannelHubEmailRuleBindings(rawBody) {
    const parsed = parseBody(rawBody);
    if (!isObjectBody(parsed)) return rawBody;

    const nextBody = { ...parsed.body };
    if (nextBody.actionRules === ACTION_RULES_CONTEXT_PATH) {
        delete nextBody.actionRules;
    }

    return serializeBody({ ...parsed, body: nextBody }, rawBody);
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
    await updateMatchingEndpointBodies(knex, addChannelHubEmailRuleBindings);
}

/**
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await updateMatchingEndpointBodies(knex, removeChannelHubEmailRuleBindings);
}
