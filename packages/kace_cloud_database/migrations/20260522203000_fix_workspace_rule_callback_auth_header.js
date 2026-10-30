const WS_REST_ENDPOINTS_TABLE = 'ws_rest_endpoints';
const WORKSPACE_RULE_CALLBACK_ENDPOINT_ID = '9d7f3e6f-41d4-48ea-a8f1-8c725c0d7be0';
const RAW_KACE_ID_TOKEN_HEADER = 'context.kace.auth.id_token';
const BEARER_KACE_ID_TOKEN_HEADER = `Bearer ${RAW_KACE_ID_TOKEN_HEADER}`;
const KACE_RESTFLOW_CALLBACK_FINGERPRINT = 'kace-restflow-callback';

function parseHeaders(value) {
    if (!value) {
        return { headers: {} };
    }

    if (typeof value === 'object') {
        return value;
    }

    try {
        const parsed = JSON.parse(value);
        if (parsed && typeof parsed === 'object') {
            return parsed;
        }
    } catch (_error) {
        // Fall through to a safe default. The endpoint is owned by this migration,
        // so replacing an invalid JSON blob is preferable to keeping a broken auth header.
    }

    return { headers: {} };
}

async function setCallbackHeaders(knex, { authorizationHeader, clientFingerprint }) {
    const row = await knex(WS_REST_ENDPOINTS_TABLE).where({ id: WORKSPACE_RULE_CALLBACK_ENDPOINT_ID }).first('headers');

    if (!row) {
        return;
    }

    const headersConfig = parseHeaders(row.headers);
    const headers = headersConfig.headers && typeof headersConfig.headers === 'object' ? headersConfig.headers : {};

    if (clientFingerprint === undefined) {
        delete headers['X-Client-Fingerprint'];
    } else {
        headers['X-Client-Fingerprint'] = clientFingerprint;
    }

    await knex(WS_REST_ENDPOINTS_TABLE)
        .where({ id: WORKSPACE_RULE_CALLBACK_ENDPOINT_ID })
        .update({
            headers: JSON.stringify({
                ...headersConfig,
                headers: {
                    ...headers,
                    Authorization: authorizationHeader,
                },
            }),
        });
}

export async function up(knex) {
    await setCallbackHeaders(knex, {
        authorizationHeader: RAW_KACE_ID_TOKEN_HEADER,
        clientFingerprint: KACE_RESTFLOW_CALLBACK_FINGERPRINT,
    });
}

export async function down(knex) {
    await setCallbackHeaders(knex, {
        authorizationHeader: BEARER_KACE_ID_TOKEN_HEADER,
        clientFingerprint: undefined,
    });
}
