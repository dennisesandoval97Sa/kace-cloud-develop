import { jest } from '@jest/globals';
import { EventDeduplicator } from '../../../../src/shared/application/events/EventDeduplicator.js';
import { DomainEvent } from '../../../../src/shared/domain/events/DomainEvent.js';
import { ValueObjectUuid } from '../../../../src/shared/domain/value-object/ValueObjectUuid.js';

describe('EventDeduplicator', () => {
    let mockRepository;
    let deduplicator;

    beforeEach(() => {
        // Arrange - Create mock repository with jest functions
        mockRepository = {
            exists: jest.fn(),
            save: jest.fn(),
        };
        deduplicator = new EventDeduplicator(mockRepository);
    });

    describe('constructor', () => {
        it('should create instance with valid repository', () => {
            // Arrange & Act
            const instance = new EventDeduplicator(mockRepository);

            // Assert
            expect(instance).toBeInstanceOf(EventDeduplicator);
        });

        it('should throw error when repository is null', () => {
            // Arrange & Act & Assert
            expect(() => {
                new EventDeduplicator(null);
            }).toThrow('EventDeduplicator: repository is required');
        });

        it('should throw error when repository is undefined', () => {
            // Arrange & Act & Assert
            expect(() => {
                new EventDeduplicator(undefined);
            }).toThrow('EventDeduplicator: repository is required');
        });
    });

    describe('isAlreadyProcessed', () => {
        it('should return true when event exists in repository', async () => {
            // Arrange
            const eventId = ValueObjectUuid.random();
            mockRepository.exists.mockResolvedValue(true);

            // Act
            const result = await deduplicator.isAlreadyProcessed(eventId);

            // Assert
            expect(result).toBe(true);
            expect(mockRepository.exists).toHaveBeenCalledWith(eventId);
            expect(mockRepository.exists).toHaveBeenCalledTimes(1);
        });

        it('should return false when event does not exist in repository', async () => {
            // Arrange
            const eventId = ValueObjectUuid.random();
            mockRepository.exists.mockResolvedValue(false);

            // Act
            const result = await deduplicator.isAlreadyProcessed(eventId);

            // Assert
            expect(result).toBe(false);
            expect(mockRepository.exists).toHaveBeenCalledWith(eventId);
            expect(mockRepository.exists).toHaveBeenCalledTimes(1);
        });

        it('should call repository exists with correct eventId', async () => {
            // Arrange
            const eventId = 'test-event-id-123';
            mockRepository.exists.mockResolvedValue(false);

            // Act
            await deduplicator.isAlreadyProcessed(eventId);

            // Assert
            expect(mockRepository.exists).toHaveBeenCalledWith(eventId);
        });
    });

    describe('markAsProcessed', () => {
        it('should delegate to repository with correct parameters', async () => {
            // Arrange
            const aggregateId = ValueObjectUuid.random();
            const eventId = ValueObjectUuid.random();
            const eventName = 'kace.core.case.created';
            const event = new DomainEvent({
                eventId,
                eventName,
                aggregateId,
                payload: { field1: 'value1' },
                metadata: { user_id: 'user-123' },
            });
            mockRepository.save.mockResolvedValue(undefined);

            // Act
            await deduplicator.markAsProcessed(event);

            // Assert
            expect(mockRepository.save).toHaveBeenCalledWith(eventId, eventName, aggregateId);
            expect(mockRepository.save).toHaveBeenCalledTimes(1);
        });

        it('should handle domain event with minimal data', async () => {
            // Arrange
            const aggregateId = ValueObjectUuid.random();
            const eventId = ValueObjectUuid.random();
            const eventName = 'kace.core.test.event';
            const event = new DomainEvent({
                eventId,
                eventName,
                aggregateId,
            });
            mockRepository.save.mockResolvedValue(undefined);

            // Act
            await deduplicator.markAsProcessed(event);

            // Assert
            expect(mockRepository.save).toHaveBeenCalledWith(eventId, eventName, aggregateId);
        });

        it('should propagate repository errors', async () => {
            // Arrange
            const aggregateId = ValueObjectUuid.random();
            const event = new DomainEvent({
                eventName: 'test.event',
                aggregateId,
            });
            const expectedError = new Error('Database connection failed');
            mockRepository.save.mockRejectedValue(expectedError);

            // Act & Assert
            await expect(deduplicator.markAsProcessed(event)).rejects.toThrow('Database connection failed');
            expect(mockRepository.save).toHaveBeenCalledTimes(1);
        });
    });
});
