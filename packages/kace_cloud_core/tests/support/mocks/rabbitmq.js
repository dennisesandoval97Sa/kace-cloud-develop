import { jest } from '@jest/globals';

/**
 * Mocks 'amqplib' so a future test never opens a real AMQP connection.
 *
 * NOTE on scope: as of this writing, nothing under src/ (including src/rabbitmq, which is
 * a pure DB CRUD + Crypto module for RabbitMQ *adapter settings*, not a live broker client)
 * actually imports 'amqplib' -
 * `grep -rn "amqplib\|amqp.connect\|createChannel" src/rabbitmq src/shared/infrastructure/events`
 * returns nothing in this package. This mock exists per the migration plan's explicit
 * deliverable list, shaped after amqplib's stable public API
 * (https://amqp-node.github.io/amqplib/channel_api.html), so it's ready the moment a real
 * AMQP client shows up in src/ instead of guessing at one now. If/when that lands, prefer
 * updating this file's shape to match the exact methods the new code calls over adding
 * unused surface here.
 *
 * MUST be called (and awaited) before dynamically importing the module under test.
 *
 * @example
 * const { calls, channel } = await mockRabbitmq();
 * const { SomeFutureAmqpPublisher } = await import('../../src/some-future-module.js');
 * channel.sendToQueue.mockResolvedValue(true);
 * // ...call code under test...
 * expect(calls.sendToQueue[0]).toMatchObject({ queue: 'kace.events', content: expect.any(Buffer) });
 *
 * @returns {{
 *   connect: import('@jest/globals').jest.Mock,
 *   connection: { createChannel: import('@jest/globals').jest.Mock, close: import('@jest/globals').jest.Mock },
 *   channel: {
 *     assertQueue: import('@jest/globals').jest.Mock,
 *     sendToQueue: import('@jest/globals').jest.Mock,
 *     publish: import('@jest/globals').jest.Mock,
 *     consume: import('@jest/globals').jest.Mock,
 *     ack: import('@jest/globals').jest.Mock,
 *     nack: import('@jest/globals').jest.Mock,
 *     close: import('@jest/globals').jest.Mock,
 *   },
 *   calls: { assertQueue: object[], sendToQueue: object[], publish: object[], consume: object[] },
 * }}
 */
export const mockRabbitmq = () => {
    const calls = { assertQueue: [], sendToQueue: [], publish: [], consume: [] };

    const channel = {
        assertQueue: jest.fn((queue, options) => {
            calls.assertQueue.push({ queue, options });
            return Promise.resolve({ queue, messageCount: 0, consumerCount: 0 });
        }),
        sendToQueue: jest.fn((queue, content, options) => {
            calls.sendToQueue.push({ queue, content, options });
            return true;
        }),
        publish: jest.fn((exchange, routingKey, content, options) => {
            calls.publish.push({ exchange, routingKey, content, options });
            return true;
        }),
        consume: jest.fn((queue, onMessage, options) => {
            calls.consume.push({ queue, onMessage, options });
            return Promise.resolve({ consumerTag: 'mock-consumer' });
        }),
        ack: jest.fn(),
        nack: jest.fn(),
        close: jest.fn().mockResolvedValue(undefined),
    };

    const connection = {
        createChannel: jest.fn().mockResolvedValue(channel),
        createConfirmChannel: jest.fn().mockResolvedValue(channel),
        close: jest.fn().mockResolvedValue(undefined),
    };

    const connect = jest.fn().mockResolvedValue(connection);

    // { virtual: true }: 'amqplib' is not an installed dependency of this package (there is
    // no real consumer yet - see the note above), so there is nothing on disk for Jest to
    // resolve. Without `virtual`, `unstable_mockModule` throws "Cannot find module 'amqplib'"
    // before ever reaching a factory it would otherwise ignore.
    jest.unstable_mockModule(
        'amqplib',
        () => ({
            default: { connect },
            connect,
        }),
        { virtual: true }
    );

    return { connect, connection, channel, calls };
};
