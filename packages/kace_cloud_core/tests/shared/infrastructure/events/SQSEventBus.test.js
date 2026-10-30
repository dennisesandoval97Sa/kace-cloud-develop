import { jest } from '@jest/globals';
import { SQSEventBus } from '../../../../src/shared/infrastructure/events/SQSEventBus.js';
import { DomainEvent } from '../../../../src/shared/domain/events/DomainEvent.js';
import { ValueObjectUuid } from '../../../../src/shared/domain/value-object/ValueObjectUuid.js';

describe('SQSEventBus', () => {
    let sqsEventBus;
    let mockSqsClient;
    const standardQueueUrl = 'https://sqs.us-east-1.amazonaws.com/123456789/kace-events-queue';
    const fifoQueueUrl = 'https://sqs.us-east-1.amazonaws.com/123456789/kace-events-queue.fifo';
    const aggregateId = ValueObjectUuid.random();

    const createEvent = (eventName = 'kace.core.case.created', metadata = {}) => {
        return new DomainEvent({
            eventName,
            aggregateId,
            payload: { clientId: ValueObjectUuid.random() },
            metadata,
        });
    };

    beforeEach(() => {
        mockSqsClient = {
            send: jest.fn().mockResolvedValue({ MessageId: 'mock-message-id-123' }),
        };
    });

    describe('constructor', () => {
        it('should create an instance with valid params', () => {
            // Act
            const bus = new SQSEventBus({ sqsClient: mockSqsClient, queueUrl: standardQueueUrl });

            // Assert
            expect(bus).toBeInstanceOf(SQSEventBus);
        });

        it('should throw if sqsClient is not provided', () => {
            // Act & Assert
            expect(() => new SQSEventBus({ queueUrl: standardQueueUrl })).toThrow('SQSEventBus: sqsClient is required');
        });

        it('should throw if queueUrl is not provided', () => {
            // Act & Assert
            expect(() => new SQSEventBus({ sqsClient: mockSqsClient })).toThrow('SQSEventBus: queueUrl is required');
        });
    });

    describe('publish (Standard Queue)', () => {
        beforeEach(() => {
            sqsEventBus = new SQSEventBus({ sqsClient: mockSqsClient, queueUrl: standardQueueUrl });
        });

        it('should send a message to SQS with correct body', async () => {
            // Arrange
            const event = createEvent();

            // Act
            await sqsEventBus.publish(event);

            // Assert
            expect(mockSqsClient.send).toHaveBeenCalledTimes(1);
            const sentCommand = mockSqsClient.send.mock.calls[0][0];
            const input = sentCommand.input;

            expect(input.QueueUrl).toBe(standardQueueUrl);
            const body = JSON.parse(input.MessageBody);
            expect(body.eventName).toBe('kace.core.case.created');
            expect(body.aggregateId).toBe(aggregateId);
        });

        it('should include eventName in MessageAttributes', async () => {
            // Arrange
            const event = createEvent();

            // Act
            await sqsEventBus.publish(event);

            // Assert
            const sentCommand = mockSqsClient.send.mock.calls[0][0];
            const input = sentCommand.input;

            expect(input.MessageAttributes.eventName).toEqual({
                DataType: 'String',
                StringValue: 'kace.core.case.created',
            });
        });

        it('should include tenantId in MessageAttributes when present', async () => {
            // Arrange
            const event = createEvent('kace.core.case.created', { tenant_id: 'tenant-acme' });

            // Act
            await sqsEventBus.publish(event);

            // Assert
            const sentCommand = mockSqsClient.send.mock.calls[0][0];
            const input = sentCommand.input;

            expect(input.MessageAttributes.tenantId).toEqual({
                DataType: 'String',
                StringValue: 'tenant-acme',
            });
        });

        it('should include correlationId in MessageAttributes when present', async () => {
            // Arrange
            const correlationId = ValueObjectUuid.random();
            const event = createEvent('kace.core.case.created', { correlation_id: correlationId });

            // Act
            await sqsEventBus.publish(event);

            // Assert
            const sentCommand = mockSqsClient.send.mock.calls[0][0];
            const input = sentCommand.input;

            expect(input.MessageAttributes.correlationId).toEqual({
                DataType: 'String',
                StringValue: correlationId,
            });
        });

        it('should NOT include FIFO-specific params for standard queues', async () => {
            // Arrange
            const event = createEvent();

            // Act
            await sqsEventBus.publish(event);

            // Assert
            const sentCommand = mockSqsClient.send.mock.calls[0][0];
            const input = sentCommand.input;

            expect(input.MessageGroupId).toBeUndefined();
            expect(input.MessageDeduplicationId).toBeUndefined();
        });

        it('should return the message ID on success', async () => {
            // Arrange
            const event = createEvent();

            // Act
            const result = await sqsEventBus.publish(event);

            // Assert
            expect(result).toEqual({ messageId: 'mock-message-id-123' });
        });

        it('should handle null event gracefully', async () => {
            // Act
            const result = await sqsEventBus.publish(null);

            // Assert
            expect(result).toBeUndefined();
            expect(mockSqsClient.send).not.toHaveBeenCalled();
        });

        it('should propagate SQS errors', async () => {
            // Arrange
            const event = createEvent();
            mockSqsClient.send.mockRejectedValueOnce(new Error('SQS Service Unavailable'));

            // Act & Assert
            await expect(sqsEventBus.publish(event)).rejects.toThrow('SQS Service Unavailable');
        });
    });

    describe('publish (FIFO Queue)', () => {
        beforeEach(() => {
            sqsEventBus = new SQSEventBus({ sqsClient: mockSqsClient, queueUrl: fifoQueueUrl });
        });

        it('should include MessageGroupId and MessageDeduplicationId for FIFO queues', async () => {
            // Arrange
            const event = createEvent();

            // Act
            await sqsEventBus.publish(event);

            // Assert
            const sentCommand = mockSqsClient.send.mock.calls[0][0];
            const input = sentCommand.input;

            expect(input.MessageGroupId).toBe(aggregateId);
            expect(input.MessageDeduplicationId).toBe(event.eventId);
        });
    });

    describe('publishBatch (Standard Queue)', () => {
        beforeEach(() => {
            mockSqsClient.send = jest.fn().mockResolvedValue({
                Successful: [{ Id: '0', MessageId: 'msg-1' }],
                Failed: [],
            });
            sqsEventBus = new SQSEventBus({ sqsClient: mockSqsClient, queueUrl: standardQueueUrl });
        });

        it('should send batch message to SQS', async () => {
            // Arrange
            const events = [createEvent('kace.core.case.created'), createEvent('kace.core.case.state_changed')];

            mockSqsClient.send.mockResolvedValueOnce({
                Successful: [
                    { Id: '0', MessageId: 'msg-1' },
                    { Id: '1', MessageId: 'msg-2' },
                ],
                Failed: [],
            });

            // Act
            const result = await sqsEventBus.publishBatch(events);

            // Assert
            expect(mockSqsClient.send).toHaveBeenCalledTimes(1);
            expect(result).toEqual({ successful: 2, failed: 0 });
        });

        it('should split into multiple batches when more than 10 events', async () => {
            // Arrange
            const events = Array.from({ length: 12 }, (_, i) => createEvent(`kace.core.event.${i}`));

            mockSqsClient.send
                .mockResolvedValueOnce({
                    Successful: Array.from({ length: 10 }, (_, i) => ({ Id: `${i}`, MessageId: `msg-${i}` })),
                    Failed: [],
                })
                .mockResolvedValueOnce({
                    Successful: [
                        { Id: '0', MessageId: 'msg-10' },
                        { Id: '1', MessageId: 'msg-11' },
                    ],
                    Failed: [],
                });

            // Act
            const result = await sqsEventBus.publishBatch(events);

            // Assert
            expect(mockSqsClient.send).toHaveBeenCalledTimes(2);
            expect(result).toEqual({ successful: 12, failed: 0 });
        });

        it('should report failed messages', async () => {
            // Arrange
            const events = [createEvent(), createEvent(), createEvent()];

            mockSqsClient.send.mockResolvedValueOnce({
                Successful: [{ Id: '0', MessageId: 'msg-1' }],
                Failed: [
                    { Id: '1', Code: 'InternalError', Message: 'Internal error' },
                    { Id: '2', Code: 'InternalError', Message: 'Internal error' },
                ],
            });

            // Act
            const result = await sqsEventBus.publishBatch(events);

            // Assert
            expect(result).toEqual({ successful: 1, failed: 2 });
        });

        it('should handle empty array', async () => {
            // Act
            const result = await sqsEventBus.publishBatch([]);

            // Assert
            expect(result).toEqual({ successful: 0, failed: 0 });
            expect(mockSqsClient.send).not.toHaveBeenCalled();
        });

        it('should handle null input', async () => {
            // Act
            const result = await sqsEventBus.publishBatch(null);

            // Assert
            expect(result).toEqual({ successful: 0, failed: 0 });
            expect(mockSqsClient.send).not.toHaveBeenCalled();
        });

        it('should propagate SQS errors', async () => {
            // Arrange
            const events = [createEvent()];
            mockSqsClient.send.mockRejectedValueOnce(new Error('SQS Batch Error'));

            // Act & Assert
            await expect(sqsEventBus.publishBatch(events)).rejects.toThrow('SQS Batch Error');
        });
    });

    describe('publishBatch (FIFO Queue)', () => {
        beforeEach(() => {
            mockSqsClient.send = jest.fn().mockResolvedValue({
                Successful: [{ Id: '0', MessageId: 'msg-1' }],
                Failed: [],
            });
            sqsEventBus = new SQSEventBus({ sqsClient: mockSqsClient, queueUrl: fifoQueueUrl });
        });

        it('should include FIFO params in batch entries', async () => {
            // Arrange
            const events = [createEvent()];

            // Act
            await sqsEventBus.publishBatch(events);

            // Assert
            const sentCommand = mockSqsClient.send.mock.calls[0][0];
            const input = sentCommand.input;
            const entry = input.Entries[0];

            expect(entry.MessageGroupId).toBe(aggregateId);
            expect(entry.MessageDeduplicationId).toBe(events[0].eventId);
        });
    });

    describe('subscribe', () => {
        it('should throw an error', () => {
            // Arrange
            sqsEventBus = new SQSEventBus({ sqsClient: mockSqsClient, queueUrl: standardQueueUrl });

            // Act & Assert
            expect(() => sqsEventBus.subscribe('test.event', jest.fn())).toThrow(
                'SQSEventBus does not support subscribe'
            );
        });
    });

    describe('unsubscribe', () => {
        it('should throw an error', () => {
            // Arrange
            sqsEventBus = new SQSEventBus({ sqsClient: mockSqsClient, queueUrl: standardQueueUrl });

            // Act & Assert
            expect(() => sqsEventBus.unsubscribe('test.event', jest.fn())).toThrow(
                'SQSEventBus does not support unsubscribe'
            );
        });
    });
});
