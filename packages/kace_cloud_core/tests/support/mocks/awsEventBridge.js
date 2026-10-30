import { jest } from '@jest/globals';

/**
 * Mocks '@aws-sdk/client-eventbridge' so tests never open a real EventBridge connection.
 *
 * Reflects the real usage in src/shared/infrastructure/events/EventBridgeEventBus.js:
 * `new EventBridgeClient(config)` followed by `client.send(new PutEventsCommand(input))`.
 * EventBridgeEventBus imports PutEventsCommand lazily (`await import('@aws-sdk/client-eventbridge')`
 * inside publish/publishBatch), so this mock must be registered before that module is
 * imported too, same as any static-import consumer.
 *
 * MUST be called (and awaited) before dynamically importing the module under test.
 *
 * @example
 * const { send, calls } = await mockAwsEventBridge();
 * const { EventBridgeEventBus } = await import('../../src/shared/infrastructure/events/EventBridgeEventBus.js');
 * send.mockResolvedValue({ FailedEntryCount: 0, Entries: [{ EventId: 'evt-1' }] });
 * // ...call code under test...
 * expect(calls.PutEventsCommand[0].Entries[0].DetailType).toBe('kace.core.case.created');
 *
 * @returns {{
 *   send: import('@jest/globals').jest.Mock,
 *   clients: Array<{config: object}>,
 *   calls: { PutEventsCommand: object[] },
 * }}
 */
export const mockAwsEventBridge = () => {
    const send = jest.fn();
    const clients = [];
    const calls = { PutEventsCommand: [] };

    class FakePutEventsCommand {
        constructor(input) {
            this.input = input;
            calls.PutEventsCommand.push(input);
        }
    }

    class FakeEventBridgeClient {
        constructor(config) {
            this.config = config;
            clients.push(this);
        }

        send(command) {
            return send(command);
        }
    }

    jest.unstable_mockModule('@aws-sdk/client-eventbridge', () => ({
        EventBridgeClient: FakeEventBridgeClient,
        PutEventsCommand: FakePutEventsCommand,
    }));

    return { send, clients, calls };
};
