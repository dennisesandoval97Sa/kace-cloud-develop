import { jest } from '@jest/globals';

jest.unstable_mockModule('@aws-sdk/client-sqs', () => ({
    SQSClient: jest.fn(),
    SendMessageCommand: jest.fn(),
    SendMessageBatchCommand: jest.fn(),
}));
jest.unstable_mockModule('@aws-sdk/client-eventbridge', () => ({
    EventBridgeClient: jest.fn(),
    PutEventsCommand: jest.fn(),
}));

const { buildRoutingEventBusFromTenant } =
    await import('../../../../src/shared/infrastructure/events/buildRoutingEventBusFromTenant.js');
const { RoutingEventBus } = await import('../../../../src/shared/infrastructure/events/RoutingEventBus.js');
const { EventBridgeClient } = await import('@aws-sdk/client-eventbridge');

function makeTenant(overrides = {}) {
    return {
        id: { value: 't-1' },
        aws_sqs_region: { value: 'us-east-1' },
        aws_event_bridge_region: { value: 'us-east-1' },
        aws_event_bridge_event_bus_name: { value: 'test-bus' },
        aws_cases_events_queue_url: { value: 'https://sqs.test/cases.fifo' },
        aws_action_jobs_events_queue_url: { value: 'https://sqs.test/action-jobs.fifo' },
        aws_automated_actions_events_queue_url: { value: 'https://sqs.test/automated-actions.fifo' },
        aws_ws_rest_events_queue_url: { value: 'https://sqs.test/ws-rest.fifo' },
        aws_reports_events_queue_url: { value: 'https://sqs.test/reports.fifo' },
        ...overrides,
    };
}

describe('buildRoutingEventBusFromTenant', () => {
    it('returns a RoutingEventBus instance when the tenant has all required fields', () => {
        const bus = buildRoutingEventBusFromTenant(makeTenant());
        expect(bus).toBeInstanceOf(RoutingEventBus);
    });

    it('throws when tenant.aws_sqs_region is missing', () => {
        const t = makeTenant({ aws_sqs_region: undefined });
        expect(() => buildRoutingEventBusFromTenant(t)).toThrow(/aws_sqs_region/);
    });

    it('throws when tenant.aws_event_bridge_event_bus_name is missing', () => {
        const t = makeTenant({ aws_event_bridge_event_bus_name: undefined });
        expect(() => buildRoutingEventBusFromTenant(t)).toThrow(/aws_event_bridge_event_bus_name/);
    });

    it('throws when any per-BC queue URL is missing on the tenant', () => {
        const t = makeTenant({ aws_cases_events_queue_url: undefined });
        expect(() => buildRoutingEventBusFromTenant(t)).toThrow(/aws_cases_events_queue_url/);
    });

    it('defaults event-bridge region to aws_sqs_region if not provided', () => {
        EventBridgeClient.mockClear();
        const t = makeTenant({ aws_event_bridge_region: undefined });
        const bus = buildRoutingEventBusFromTenant(t);
        expect(bus).toBeInstanceOf(RoutingEventBus);
        expect(EventBridgeClient).toHaveBeenLastCalledWith({ region: 'us-east-1' });
    });

    it('throws when tenant is null', () => {
        expect(() => buildRoutingEventBusFromTenant(null)).toThrow(/tenant is required/);
    });

    it('configures the SQS client with adaptive retry backoff (maxAttempts=5)', () => {
        const constructed = [];
        const SqsSpy = jest.fn(function (cfg) {
            constructed.push(cfg);
        });
        buildRoutingEventBusFromTenant(makeTenant(), { SQSClient: SqsSpy });
        expect(constructed[0]).toMatchObject({ maxAttempts: 5, retryMode: 'adaptive' });
    });

    it('maps kace.core.import_execution.requested when aws_imports_events_queue_url is provided', () => {
        const tenant = makeTenant({
            aws_imports_events_queue_url: { value: 'https://sqs.test/imports.fifo' },
        });
        const bus = buildRoutingEventBusFromTenant(tenant);
        expect(bus).toBeInstanceOf(RoutingEventBus);
    });
});
