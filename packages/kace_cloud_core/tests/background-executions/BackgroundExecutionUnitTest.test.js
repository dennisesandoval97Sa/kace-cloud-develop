import { jest } from '@jest/globals';
import { BackgroundExecutionCollectionResponse } from '../../src/background-executions/aplication/BackgroundExecutionCollectionResponse';
import { BackgroundExecutionResponse } from '../../src/background-executions/aplication/BackgroundExecutionResponse';
import { BackgroundExecution } from '../../src/background-executions/domain/BackgroundExecution';
import BackgroundExecutionMother from './domain/BackgroundExecutionMother';

describe('BackgroundExecution entity', () => {
    const dto = BackgroundExecutionMother.dto();
    it('should create a BackgroundExecution with valid data', () => {
        const backgroundExecution = BackgroundExecution.create(dto);
        expect(backgroundExecution.id.value).toBe(dto.id);
        expect(backgroundExecution.proccess_description.value).toBe(dto.proccess_description);
        expect(backgroundExecution.execution_status.value).toBe(dto.execution_status);
    });
    it('should update BackgroundExecution proccess_description', () => {
        const backgroundExecution = BackgroundExecution.create(dto);
        const newData = {
            proccess_description: 'action_queue_executor',
        };
        backgroundExecution.update(newData);
        expect(backgroundExecution.proccess_description.value).toBe(newData.proccess_description);
    });
    it('should update BackgroundExecution execution_status', () => {
        const backgroundExecution = BackgroundExecution.create(dto);
        const newData = {
            execution_status: 1,
        };
        backgroundExecution.update(newData);
        expect(backgroundExecution.execution_status.value).toBe(newData.execution_status);
    });
    it('should throw an error with invalid UUID', () => {
        const invalidData = { ...dto, id: 'invalid-uuid' };
        expect(() => BackgroundExecution.create(invalidData)).toThrow('Invalid value invalid-uuid for object uuid');
    });
    it('does not update properties when values are the same', () => {
        const backgroundExecution = BackgroundExecution.create(dto);
        const sameData = { ...dto };
        backgroundExecution.update(sameData);
        expect(backgroundExecution.changedAttributes).toEqual({});
    });
    describe('BackgroundExecution Inputs', () => {
        it('should throw an error with empty proccess_description Input', () => {
            const emptyProccessDescriptionInput = { ...dto, proccess_description: '' };
            expect(() => BackgroundExecution.create(emptyProccessDescriptionInput)).toThrow(
                'proccess_description: The value cannot be null'
            );
        });
        it('should throw an error with bad value proccess_description Input', () => {
            const emptyProccessDescriptionInput = { ...dto, proccess_description: 1 };
            expect(() => BackgroundExecution.create(emptyProccessDescriptionInput)).toThrow('Invalid value for enum');
        });
        it('should throw an error with invalid execution_status', () => {
            const emptyExecutionStatusInput = { ...dto, execution_status: 'Test' };
            expect(() => BackgroundExecution.create(emptyExecutionStatusInput)).toThrow(
                'execution_status: The value must be a boolean'
            );
        });
        it('should throw an error with invalid execution_status', () => {
            const emptyExecutionStatusInput = { ...dto, execution_status: 7 };
            expect(() => BackgroundExecution.create(emptyExecutionStatusInput)).toThrow(
                'execution_status: The value must be a boolean'
            );
        });
        it('should throw an error with empty execution_status', () => {
            const emptyExecutionStatusInput = { ...dto, execution_status: '' };
            expect(() => BackgroundExecution.create(emptyExecutionStatusInput)).toThrow(
                'execution_status: The value cannot be null'
            );
        });
    });
    describe('isStale', () => {
        const fixedNow = new Date('2026-05-14T12:00:00.000Z');

        beforeEach(() => {
            jest.useFakeTimers();
            jest.setSystemTime(fixedNow);
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        it('returns false when the execution is not running', () => {
            const backgroundExecution = BackgroundExecution.create({
                ...BackgroundExecutionMother.dto(),
                execution_status: 0,
                updated_at: new Date(fixedNow.getTime() - 60 * 60 * 1000).toISOString(),
            });
            expect(backgroundExecution.isStale()).toBe(false);
        });

        it('returns false when running but updated_at is not set', () => {
            const backgroundExecution = BackgroundExecution.create({
                ...BackgroundExecutionMother.dto(),
                execution_status: 1,
            });
            expect(backgroundExecution.isStale()).toBe(false);
        });

        it('returns true when running and updated_at exceeds the default timeout (15 min)', () => {
            const sixteenMinutesAgo = new Date(fixedNow.getTime() - 16 * 60 * 1000).toISOString();
            const backgroundExecution = BackgroundExecution.create({
                ...BackgroundExecutionMother.dto(),
                execution_status: 1,
                updated_at: sixteenMinutesAgo,
            });
            expect(backgroundExecution.isStale()).toBe(true);
        });

        it('returns false when running and updated_at is within the default timeout', () => {
            const tenMinutesAgo = new Date(fixedNow.getTime() - 10 * 60 * 1000).toISOString();
            const backgroundExecution = BackgroundExecution.create({
                ...BackgroundExecutionMother.dto(),
                execution_status: 1,
                updated_at: tenMinutesAgo,
            });
            expect(backgroundExecution.isStale()).toBe(false);
        });

        it('returns false exactly at the timeout boundary', () => {
            const exactlyFifteenMinutesAgo = new Date(fixedNow.getTime() - 15 * 60 * 1000).toISOString();
            const backgroundExecution = BackgroundExecution.create({
                ...BackgroundExecutionMother.dto(),
                execution_status: 1,
                updated_at: exactlyFifteenMinutesAgo,
            });
            expect(backgroundExecution.isStale()).toBe(false);
        });

        it('respects a custom timeoutMinutes argument', () => {
            const fortyMinutesAgo = new Date(fixedNow.getTime() - 40 * 60 * 1000).toISOString();
            const backgroundExecution = BackgroundExecution.create({
                ...BackgroundExecutionMother.dto(),
                execution_status: 1,
                updated_at: fortyMinutesAgo,
            });
            expect(backgroundExecution.isStale(30)).toBe(true);
            expect(backgroundExecution.isStale(60)).toBe(false);
        });
    });
});
describe('BackgroundExecution Response Tests', () => {
    it('converts BackgroundExecution object to JSON representation', () => {
        const backgroundExecution = BackgroundExecution.create(BackgroundExecutionMother.dto());
        const backgroundExecutionResponse = new BackgroundExecutionResponse(backgroundExecution);
        const json = backgroundExecutionResponse.toJson();
        expect(json).toEqual({
            data: {
                id: backgroundExecution.id.value,
                proccess_description: backgroundExecution.proccess_description.value,
                execution_status: backgroundExecution.execution_status.value,
            },
        });
    });
    it('returns an empty object if BackgroundExecution is not provided', () => {
        const backgroundExecutionResponse = new BackgroundExecutionResponse(null);
        const json = backgroundExecutionResponse.toJson();
        expect(json).toEqual({});
    });
});
describe('BackgroundExecution Collection Response Tests', () => {
    it('converts BackgroundExecution collection to JSON representation', () => {
        const backgroundExecutionCollection = [
            BackgroundExecution.create(BackgroundExecutionMother.dto()),
            BackgroundExecution.create(BackgroundExecutionMother.dto()),
        ];
        const backgroundExecutionCollectionResponse = new BackgroundExecutionCollectionResponse(
            backgroundExecutionCollection,
            backgroundExecutionCollection.length
        );
        const json = backgroundExecutionCollectionResponse.toJson();
        expect(json).toEqual({
            data: {
                items: backgroundExecutionCollection.map(
                    (backgroundExecution) => new BackgroundExecutionResponse(backgroundExecution).toJson().data
                ),
            },
            metadata: {
                count: backgroundExecutionCollection.length,
            },
        });
    });
});
