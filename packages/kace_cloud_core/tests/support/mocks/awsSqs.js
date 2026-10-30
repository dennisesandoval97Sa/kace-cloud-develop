import { jest } from '@jest/globals';

/**
 * Mocks '@aws-sdk/client-sqs' so tests never open a real SQS connection.
 *
 * Reflects the real usage in src/shared/infrastructure/events/RoutingEventBus.js and
 * SQSEventBus.js: `new SQSClient(config)` followed by `client.send(new XCommand(input))`.
 * Covers the write-path commands used by RoutingEventBus (SendMessageCommand,
 * SendMessageBatchCommand) plus the read-path commands used by the (env-gated) real-SQS
 * integration test (ReceiveMessageCommand, DeleteMessageCommand, PurgeQueueCommand), so the
 * same mock can back both a unit test and that integration test if it's ever pointed at
 * this mock instead of a real queue.
 *
 * MUST be called (and awaited) before dynamically importing the module under test.
 *
 * @example
 * const { send, calls } = await mockAwsSqs();
 * const { RoutingEventBus } = await import('../../src/shared/infrastructure/events/RoutingEventBus.js');
 * send.mockResolvedValue({ MessageId: 'abc' });
 * // ...call code under test...
 * expect(calls.SendMessageCommand[0]).toMatchObject({ QueueUrl: 'https://sqs.test/queue' });
 *
 * @returns {{
 *   send: import('@jest/globals').jest.Mock,
 *   clients: Array<{config: object}>,
 *   calls: {
 *     SendMessageCommand: object[],
 *     SendMessageBatchCommand: object[],
 *     ReceiveMessageCommand: object[],
 *     DeleteMessageCommand: object[],
 *     PurgeQueueCommand: object[],
 *   },
 * }}
 */
export const mockAwsSqs = () => {
    const send = jest.fn();
    const clients = [];
    const calls = {
        SendMessageCommand: [],
        SendMessageBatchCommand: [],
        ReceiveMessageCommand: [],
        DeleteMessageCommand: [],
        PurgeQueueCommand: [],
    };

    const makeCommand = (name) =>
        class {
            constructor(input) {
                this.input = input;
                calls[name].push(input);
            }
        };

    class FakeSQSClient {
        constructor(config) {
            this.config = config;
            clients.push(this);
        }

        send(command) {
            return send(command);
        }
    }

    jest.unstable_mockModule('@aws-sdk/client-sqs', () => ({
        SQSClient: FakeSQSClient,
        SendMessageCommand: makeCommand('SendMessageCommand'),
        SendMessageBatchCommand: makeCommand('SendMessageBatchCommand'),
        ReceiveMessageCommand: makeCommand('ReceiveMessageCommand'),
        DeleteMessageCommand: makeCommand('DeleteMessageCommand'),
        PurgeQueueCommand: makeCommand('PurgeQueueCommand'),
    }));

    return { send, clients, calls };
};
