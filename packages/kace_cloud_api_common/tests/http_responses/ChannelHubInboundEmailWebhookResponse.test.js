import { HttpStatusCode } from 'axios';
import { ChannelHubInboundEmailWebhookResponse } from '../../src/http_responses/ChannelHubInboundEmailWebhookResponse.js';

const ORIGINAL_ENV = {
    NODE_ENV: process.env.NODE_ENV,
    APPS_ENVIRONMENT: process.env.APPS_ENVIRONMENT,
};

function restoreEnv() {
    for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
        if (value === undefined) {
            delete process.env[key];
        } else {
            process.env[key] = value;
        }
    }
}

function eventFixture() {
    return {
        headers: { origin: 'https://app.kace.test' },
        kContext: { awsRequestId: 'request-id-1' },
        tenant: { apps_debug: { value: 'false' } },
        tenantContext: {
            tenant: {
                apps_allowed_origins: { value: 'https://app.kace.test' },
            },
        },
    };
}

describe('ChannelHubInboundEmailWebhookResponse', () => {
    afterEach(() => {
        restoreEnv();
    });

    it('uses a generic top-level message and detailed errors for connectionId plus tag workspace inconsistency', () => {
        const message =
            "Channel Hub connectionId 'conn_123' with tag 'ventas' matches multiple active workspaces in KACE. This is a configuration inconsistency; the email cannot be routed safely. Workspaces: [workspaceId=workspace-a-id, workspaceName=Workspace A], [workspaceId=workspace-b-id, workspaceName=Workspace B].";
        const response = ChannelHubInboundEmailWebhookResponse.fromProcessingResult(
            {
                accepted: false,
                nonRetryable: true,
                retryable: false,
                code: 'inconsistent_channel_hub_connection_workspace',
                message,
            },
            eventFixture()
        );

        expect(response.statusCode).toBe(HttpStatusCode.BadRequest);
        expect(response.message).toBe('Channel Hub connectionId and tag match multiple workspaces in KACE.');
        expect(response.errors).toEqual({
            code: 'inconsistent_channel_hub_connection_workspace',
            message,
        });
    });

    it('returns non-retryable Channel Hub diagnostics in the webhook message field', () => {
        process.env.NODE_ENV = 'production';
        const message =
            'Multiple Channel Hub workspace candidates matched recipients in TO. This indicates a KACE misconfiguration and must be reviewed. Candidates: [workspaceId=workspace-id, workspaceName=Routing Workspace, accountId=account-id, connectionId=conn_support, email=support@example.com, recipientField=to].';
        const response = ChannelHubInboundEmailWebhookResponse.fromProcessingResult(
            {
                accepted: false,
                nonRetryable: true,
                retryable: false,
                code: 'ambiguous_channel_hub_workspace',
                message,
            },
            eventFixture()
        );

        expect(response.statusCode).toBe(HttpStatusCode.BadRequest);
        expect(response.message).toBe(message);
        expect(response.errors).toEqual({
            code: 'ambiguous_channel_hub_workspace',
            message,
        });

        const body = JSON.parse(response.toJson().body);
        expect(body.message).toBe(message);
        expect(body.errors).toEqual({
            code: 'ambiguous_channel_hub_workspace',
            message,
        });
        expect(body.message).not.toBe('Bad request');
    });
});
