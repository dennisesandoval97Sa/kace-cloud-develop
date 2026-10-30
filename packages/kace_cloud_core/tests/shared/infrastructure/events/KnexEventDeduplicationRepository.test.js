import { jest } from '@jest/globals';
import { KnexEventDeduplicationRepository } from '../../../../src/shared/infrastructure/events/KnexEventDeduplicationRepository.js';
import { ValueObjectUuid } from '../../../../src/shared/domain/value-object/ValueObjectUuid.js';

describe('KnexEventDeduplicationRepository', () => {
    let mockConnection;
    let mockWhere;
    let mockFirst;
    let mockInsert;
    let repository;

    beforeEach(() => {
        // Arrange - Create chainable mock connection
        mockFirst = jest.fn();
        mockWhere = jest.fn().mockReturnValue({ first: mockFirst });
        mockInsert = jest.fn().mockResolvedValue([]);

        mockConnection = jest.fn().mockReturnValue({
            where: mockWhere,
            insert: mockInsert,
        });

        repository = new KnexEventDeduplicationRepository(mockConnection);
    });

    describe('constructor', () => {
        it('should create instance with valid connection', () => {
            // Arrange & Act
            const instance = new KnexEventDeduplicationRepository(mockConnection);

            // Assert
            expect(instance).toBeInstanceOf(KnexEventDeduplicationRepository);
        });

        it('should throw error when connection is null', () => {
            // Arrange & Act & Assert
            expect(() => {
                new KnexEventDeduplicationRepository(null);
            }).toThrow('KnexEventDeduplicationRepository: connection is required');
        });

        it('should throw error when connection is undefined', () => {
            // Arrange & Act & Assert
            expect(() => {
                new KnexEventDeduplicationRepository(undefined);
            }).toThrow('KnexEventDeduplicationRepository: connection is required');
        });
    });

    describe('exists', () => {
        it('should return true when row is found', async () => {
            // Arrange
            const eventId = ValueObjectUuid.random();
            mockFirst.mockResolvedValue({ event_id: eventId });

            // Act
            const result = await repository.exists(eventId);

            // Assert
            expect(result).toBe(true);
            expect(mockConnection).toHaveBeenCalledWith('event_deduplication');
            expect(mockWhere).toHaveBeenCalledWith({ event_id: eventId });
            expect(mockFirst).toHaveBeenCalledTimes(1);
        });

        it('should return false when no row is found', async () => {
            // Arrange
            const eventId = ValueObjectUuid.random();
            mockFirst.mockResolvedValue(undefined);

            // Act
            const result = await repository.exists(eventId);

            // Assert
            expect(result).toBe(false);
            expect(mockConnection).toHaveBeenCalledWith('event_deduplication');
            expect(mockWhere).toHaveBeenCalledWith({ event_id: eventId });
            expect(mockFirst).toHaveBeenCalledTimes(1);
        });

        it('should return false when row is null', async () => {
            // Arrange
            const eventId = ValueObjectUuid.random();
            mockFirst.mockResolvedValue(null);

            // Act
            const result = await repository.exists(eventId);

            // Assert
            expect(result).toBe(false);
        });

        it('should propagate database errors', async () => {
            // Arrange
            const eventId = ValueObjectUuid.random();
            const dbError = new Error('Database connection lost');
            mockFirst.mockRejectedValue(dbError);

            // Act & Assert
            await expect(repository.exists(eventId)).rejects.toThrow('Database connection lost');
            expect(mockConnection).toHaveBeenCalledWith('event_deduplication');
        });
    });

    describe('save', () => {
        it('should insert record with correct data', async () => {
            // Arrange
            const eventId = ValueObjectUuid.random();
            const eventName = 'kace.core.case.created';
            const aggregateId = ValueObjectUuid.random();
            mockInsert.mockResolvedValue([1]);

            // Act
            await repository.save(eventId, eventName, aggregateId);

            // Assert
            expect(mockConnection).toHaveBeenCalledWith('event_deduplication');
            expect(mockInsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    event_id: eventId,
                    event_name: eventName,
                    aggregate_id: aggregateId,
                    processed_at: expect.any(String),
                })
            );
            expect(mockInsert).toHaveBeenCalledTimes(1);
        });

        it('should set processed_at as ISO string', async () => {
            // Arrange
            const eventId = ValueObjectUuid.random();
            const eventName = 'test.event';
            const aggregateId = ValueObjectUuid.random();
            const beforeCall = new Date();
            mockInsert.mockResolvedValue([1]);

            // Act
            await repository.save(eventId, eventName, aggregateId);

            // Assert
            const insertCall = mockInsert.mock.calls[0][0];
            expect(insertCall.processed_at).toBeDefined();
            const processedAt = new Date(insertCall.processed_at);
            expect(processedAt.getTime()).toBeGreaterThanOrEqual(beforeCall.getTime());
            expect(processedAt.getTime()).toBeLessThanOrEqual(new Date().getTime());
        });

        it('should ignore PostgreSQL duplicate key errors (code 23505)', async () => {
            // Arrange
            const eventId = ValueObjectUuid.random();
            const eventName = 'test.event';
            const aggregateId = ValueObjectUuid.random();
            const duplicateError = new Error('Duplicate key violation');
            duplicateError.code = '23505';
            mockInsert.mockRejectedValue(duplicateError);

            // Act
            await repository.save(eventId, eventName, aggregateId);

            // Assert - Should not throw
            expect(mockInsert).toHaveBeenCalledTimes(1);
        });

        it('should ignore SQLite UNIQUE constraint failed errors', async () => {
            // Arrange
            const eventId = ValueObjectUuid.random();
            const eventName = 'test.event';
            const aggregateId = ValueObjectUuid.random();
            const duplicateError = new Error('UNIQUE constraint failed: event_deduplication.event_id');
            mockInsert.mockRejectedValue(duplicateError);

            // Act
            await repository.save(eventId, eventName, aggregateId);

            // Assert - Should not throw
            expect(mockInsert).toHaveBeenCalledTimes(1);
        });

        it('should re-throw non-duplicate errors', async () => {
            // Arrange
            const eventId = ValueObjectUuid.random();
            const eventName = 'test.event';
            const aggregateId = ValueObjectUuid.random();
            const genericError = new Error('Connection timeout');
            mockInsert.mockRejectedValue(genericError);

            // Act & Assert
            await expect(repository.save(eventId, eventName, aggregateId)).rejects.toThrow('Connection timeout');
            expect(mockInsert).toHaveBeenCalledTimes(1);
        });

        it('should re-throw database errors with different error codes', async () => {
            // Arrange
            const eventId = ValueObjectUuid.random();
            const eventName = 'test.event';
            const aggregateId = ValueObjectUuid.random();
            const foreignKeyError = new Error('Foreign key violation');
            foreignKeyError.code = '23503';
            mockInsert.mockRejectedValue(foreignKeyError);

            // Act & Assert
            await expect(repository.save(eventId, eventName, aggregateId)).rejects.toThrow('Foreign key violation');
        });
    });

    describe('TABLE_NAME constant', () => {
        it('should have correct table name', () => {
            // Assert
            expect(KnexEventDeduplicationRepository.TABLE_NAME).toBe('event_deduplication');
        });
    });
});
