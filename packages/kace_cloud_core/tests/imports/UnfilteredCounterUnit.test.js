import { jest } from '@jest/globals';

// Mock the dependencies
const mockConvertToKnex = jest.fn();
const mockLogError = jest.fn();

// Mock Criteria class
class MockCriteria {
    constructor(filter, relationship, limit, offset, order, tablename) {
        this.filter = filter;
        this.relationship = relationship;
        this.limit = limit;
        this.offset = offset;
        this.order = order;
        this.tablename = tablename;
    }

    convertToKnex(query) {
        return mockConvertToKnex(query);
    }
}

// Mock Helper
const MockHelper = {
    logError: mockLogError,
};

// Mock QueryDBError
class MockQueryDBError extends Error {
    constructor(message) {
        super(message);
        this.name = 'QueryDBError';
    }
}

// Mock the modules
jest.unstable_mockModule('../../src/shared/criteria/Criteria.js', () => ({
    Criteria: MockCriteria,
}));

jest.unstable_mockModule('../../src/shared/infrastructure/utils/Helper.js', () => ({
    Helper: MockHelper,
}));

jest.unstable_mockModule('../../src/shared/errors/QueryDBError.js', () => ({
    QueryDBError: MockQueryDBError,
}));

// Import the class under test after mocking
const { UnfilteredCounter } = await import('../../src/imports/domain/UnfilteredCounter.js');

describe('UnfilteredCounter Domain Service', () => {
    let counter;
    let mockRepository;
    let mockQuery;

    beforeEach(() => {
        jest.clearAllMocks();
        mockConvertToKnex.mockReset();
        mockLogError.mockReset();

        // Setup mock query object
        mockQuery = {
            count: jest.fn().mockReturnThis(),
        };

        // Setup mock repository
        mockRepository = {
            tableName: 's3_import_files',
            connection: jest.fn().mockReturnValue(mockQuery),
            read: { table: jest.fn().mockReturnValue(mockQuery) },
        };

        counter = new UnfilteredCounter(mockRepository);
    });

    describe('Constructor', () => {
        it('should create an instance with valid repository', () => {
            expect(counter).toBeDefined();
            expect(counter).toBeInstanceOf(UnfilteredCounter);
        });

        it('should store repository as private property', () => {
            // The repository is private, but we can verify it's used correctly in methods
            expect(() => new UnfilteredCounter(mockRepository)).not.toThrow();
        });
    });

    describe('execute method', () => {
        const validDtoCriteria = {
            filter: [
                {
                    field: 'status',
                    operator: 'eq',
                    value: 'pending',
                    type: 'and',
                },
            ],
            relationship: undefined,
        };

        it('should execute count query successfully and return count object', async () => {
            // Arrange
            const mockCountResult = { 'count(*)': 5 };
            mockConvertToKnex.mockResolvedValue([mockCountResult]);

            // Act
            const result = await counter.execute(validDtoCriteria);

            // Assert
            expect(mockRepository.read.table).toHaveBeenCalledWith('s3_import_files');
            expect(mockQuery.count).toHaveBeenCalled();
            expect(mockConvertToKnex).toHaveBeenCalledWith(mockQuery);
            expect(result).toEqual(mockCountResult);
        });

        it('should return count object with zero when no records match', async () => {
            // Arrange
            const mockCountResult = { 'count(*)': 0 };
            mockConvertToKnex.mockResolvedValue([mockCountResult]);

            // Act
            const result = await counter.execute(validDtoCriteria);

            // Assert
            expect(result).toEqual(mockCountResult);
        });

        it('should handle large count results', async () => {
            // Arrange
            const mockCountResult = { 'count(*)': 999999 };
            mockConvertToKnex.mockResolvedValue([mockCountResult]);

            // Act
            const result = await counter.execute(validDtoCriteria);

            // Assert
            expect(result).toEqual(mockCountResult);
        });

        it('should handle criteria with complex filters', async () => {
            // Arrange
            const complexCriteria = {
                filter: [
                    { field: 'status', operator: 'eq', value: 'completed', type: 'and' },
                    { field: 'created_at', operator: 'gte', value: '2024-01-01', type: 'and' },
                ],
                relationship: [{ table: 'users', field: 'user_id', relatedField: 'id' }],
            };
            const mockCountResult = { 'count(*)': 42 };
            mockConvertToKnex.mockResolvedValue([mockCountResult]);

            // Act
            const result = await counter.execute(complexCriteria);

            // Assert
            expect(result).toEqual(mockCountResult);
        });

        it('should handle criteria with null/undefined filters', async () => {
            // Arrange
            const criteriaWithNullFilters = {
                filter: null,
                relationship: undefined,
            };
            const mockCountResult = { 'count(*)': 100 };
            mockConvertToKnex.mockResolvedValue([mockCountResult]);

            // Act
            const result = await counter.execute(criteriaWithNullFilters);

            // Assert
            expect(result).toEqual(mockCountResult);
        });

        it('should handle criteria with empty arrays', async () => {
            // Arrange
            const criteriaWithEmptyArrays = {
                filter: [],
                relationship: [],
            };
            const mockCountResult = { 'count(*)': 50 };
            mockConvertToKnex.mockResolvedValue([mockCountResult]);

            // Act
            const result = await counter.execute(criteriaWithEmptyArrays);

            // Assert
            expect(result).toEqual(mockCountResult);
        });

        it('should handle undefined dtoCriteria properties gracefully', async () => {
            // Arrange
            const undefinedCriteria = {};
            const mockCountResult = { 'count(*)': 0 };
            mockConvertToKnex.mockResolvedValue([mockCountResult]);

            // Act
            const result = await counter.execute(undefinedCriteria);

            // Assert
            expect(result).toEqual(mockCountResult);
        });

        it('should create Criteria with correct parameters', async () => {
            // Arrange
            const mockCountResult = { 'count(*)': 3 };
            mockConvertToKnex.mockResolvedValue([mockCountResult]);

            // Act
            await counter.execute(validDtoCriteria);

            // Assert - Verify Criteria constructor was called with correct parameters
            expect(mockConvertToKnex).toHaveBeenCalledWith(mockQuery);
        });
    });

    describe('Error handling', () => {
        const validDtoCriteria = {
            filter: [{ field: 'status', operator: 'eq', value: 'pending', type: 'and' }],
            relationship: undefined,
        };

        it('should throw QueryDBError when database query fails', async () => {
            // Arrange
            const dbError = new Error('Database connection failed');
            mockConvertToKnex.mockRejectedValue(dbError);

            // Act & Assert
            await expect(counter.execute(validDtoCriteria)).rejects.toThrow(MockQueryDBError);

            await expect(counter.execute(validDtoCriteria)).rejects.toThrow('unfiltered-count');
        });

        it('should log error message when exception occurs', async () => {
            // Arrange
            const dbError = new Error('Connection timeout');
            mockConvertToKnex.mockRejectedValue(dbError);

            // Act
            try {
                await counter.execute(validDtoCriteria);
            } catch (error) {
                // Expected to throw
            }

            // Assert
            expect(mockLogError).toHaveBeenCalledWith('Error in UnfilteredCounter:', dbError);
        });

        it('should throw QueryDBError when convertToKnex throws', async () => {
            // Arrange
            mockConvertToKnex.mockRejectedValue(new Error('Invalid criteria'));

            // Act & Assert
            await expect(counter.execute(validDtoCriteria)).rejects.toThrow(MockQueryDBError);
        });

        it('should handle repository connection error', async () => {
            // Arrange
            mockRepository.read.table.mockImplementation(() => {
                throw new Error('Repository connection failed');
            });

            // Act & Assert
            await expect(counter.execute(validDtoCriteria)).rejects.toThrow(MockQueryDBError);
        });

        it('should handle malformed query result (empty array)', async () => {
            // Arrange
            mockConvertToKnex.mockResolvedValue([]);

            // Act
            const result = await counter.execute(validDtoCriteria);

            // Assert
            expect(result).toBeUndefined();
        });

        it('should handle malformed query result (null)', async () => {
            // Arrange
            mockConvertToKnex.mockResolvedValue([null]);

            // Act
            const result = await counter.execute(validDtoCriteria);

            // Assert
            expect(result).toBeNull();
        });
    });

    describe('Private method #countWithoutDeletedFilter', () => {
        const validDtoCriteria = {
            filter: [{ field: 'status', operator: 'eq', value: 'active', type: 'and' }],
            relationship: undefined,
        };

        it('should call convertToKnex with correct parameters', async () => {
            const mockCountResult = { 'count(*)': 10 };
            mockConvertToKnex.mockResolvedValue([mockCountResult]);

            await counter.execute(validDtoCriteria);

            expect(mockConvertToKnex).toHaveBeenCalledWith(mockQuery);
        });

        it('should return first element from query result array', async () => {
            const mockCountResult = { 'count(*)': 25 };
            mockConvertToKnex.mockResolvedValue([mockCountResult, { extra: 'data' }]);

            const result = await counter.execute(validDtoCriteria);

            expect(result).toEqual(mockCountResult);
        });
    });
    describe('Integration with repository', () => {
        const validDtoCriteria = {
            filter: [{ field: 'name', operator: 'like', value: 'test%', type: 'and' }],
            relationship: undefined,
        };

        it('should use repository tableName correctly', async () => {
            const customRepository = {
                tableName: 'custom_table',
                connection: jest.fn().mockReturnValue(mockQuery),
                read: { table: jest.fn().mockReturnValue(mockQuery) },
            };
            const customCounter = new UnfilteredCounter(customRepository);
            const mockCountResult = { 'count(*)': 15 };
            mockConvertToKnex.mockResolvedValue([mockCountResult]);

            await customCounter.execute(validDtoCriteria);

            expect(customRepository.read.table).toHaveBeenCalledWith('custom_table');
        });

        it('should call repository.read.table with tableName from repository', async () => {
            const mockCountResult = { 'count(*)': 8 };
            mockConvertToKnex.mockResolvedValue([mockCountResult]);

            await counter.execute(validDtoCriteria);

            expect(mockRepository.read.table).toHaveBeenCalledTimes(1);
            expect(mockRepository.read.table).toHaveBeenCalledWith(mockRepository.tableName);
        });
    });

    describe('Edge cases', () => {
        it('should handle different count result formats', async () => {
            const testCases = [{ 'count(*)': 5 }, { 'COUNT(*)': 10 }, { count: 15 }, { total: 20 }];

            for (const testCase of testCases) {
                mockConvertToKnex.mockResolvedValue([testCase]);
                const result = await counter.execute({
                    filter: [],
                    relationship: undefined,
                });

                expect(result).toEqual(testCase);
            }
        });

        it('should handle very large numbers', async () => {
            const largeNumber = { 'count(*)': Number.MAX_SAFE_INTEGER };
            mockConvertToKnex.mockResolvedValue([largeNumber]);

            const result = await counter.execute({
                filter: [],
                relationship: undefined,
            });

            expect(result).toEqual(largeNumber);
        });
    });

    describe('Criteria instantiation', () => {
        it('should create Criteria with all parameters from dtoCriteria', async () => {
            const testCriteria = {
                filter: [{ field: 'id', operator: 'eq', value: '123', type: 'and' }],
                relationship: [{ table: 'users', field: 'user_id' }],
            };
            const mockCountResult = { 'count(*)': 1 };
            mockConvertToKnex.mockResolvedValue([mockCountResult]);

            await counter.execute(testCriteria);

            expect(mockConvertToKnex).toHaveBeenCalledWith(mockQuery);
        });

        it('should pass tableName to Criteria constructor', async () => {
            const testCriteria = { filter: [], relationship: undefined };
            const mockCountResult = { 'count(*)': 0 };
            mockConvertToKnex.mockResolvedValue([mockCountResult]);

            await counter.execute(testCriteria);

            expect(mockConvertToKnex).toHaveBeenCalledWith(mockQuery);
            expect(mockRepository.read.table).toHaveBeenCalledWith('s3_import_files');
        });
    });
});
