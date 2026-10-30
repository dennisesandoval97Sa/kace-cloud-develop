import { User } from '@kace/core/src/users/domain/User.js';
import { ValueObjectUuid } from '@kace/core/src/shared/index.js';

export const createValueObject = (value) => ({ value });

export const createTenantContext = () => ({
    tenant: {
        apps_allowed_origins: createValueObject('*'),
        apps_debug: createValueObject('true'),
        aws_cognito_user_pool_id: createValueObject('us-east-1_aaaaaaaaa'),
        aws_cognito_app_client_id: createValueObject('test-client-id'),
        secret_key: createValueObject('0123456789abcdef0123456789abcdef'),
        secret_iv: createValueObject('0123456789abcdef'),
        encryption_method: createValueObject('aes-256-cbc'),
        aws_sqs_region: createValueObject('us-east-1'),
        aws_sqs_events_queue_url: createValueObject('https://sqs.us-east-1.amazonaws.com/000000000000/test.fifo'),
        aws_event_bridge_region: createValueObject('us-east-1'),
        aws_event_bridge_event_bus_name: createValueObject('test-event-bus'),
    },
});

export const createApiEvent = ({ body = {}, resource = '/', httpMethod = 'POST', pathParameters = {} } = {}) => ({
    resource,
    httpMethod,
    path: resource,
    headers: {
        Authorization: 'Bearer test',
        Host: 'localhost',
        origin: '*',
    },
    pathParameters,
    queryStringParameters: {},
    body: JSON.stringify(body),
    tenantContext: createTenantContext(),
    kContext: {
        awsRequestId: 'test-request-id',
    },
});

export const createAuthenticatedUser = ({ permissions = {}, id = ValueObjectUuid.random() } = {}) =>
    new User({
        id,
        rol_id: ValueObjectUuid.random(),
        is_active: 1,
        created_at: '2026-01-01T00:00:00.000Z',
        created_by: ValueObjectUuid.random(),
        permissions: {
            agente: [],
            administrador: [],
            ...permissions,
        },
    });

export const permission = (role, moduleId, name, granted = true) => ({
    role,
    module_id: moduleId,
    name,
    granted,
});
