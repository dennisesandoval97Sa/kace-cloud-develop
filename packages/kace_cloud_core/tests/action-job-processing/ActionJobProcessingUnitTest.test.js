import {
    ActionJobProcessing,
    ActionJobProcessingResponse,
    ActionJobProcessingCollectionResponse,
} from '../../src/action-job-processing';
import { ValueObjectUuid, ValueObjectBoolean, ValueObjectTimestamp, ValueObjectJson } from '../../src/shared';
import ActionJobProcessingMother from './domain/ActionJobProcessingMother';
import { v4 as uuidV4 } from 'uuid';

describe('ActionJobProcessing Entity', () => {
    const dto = ActionJobProcessingMother.dto();

    it('should create an ActionJobProcessing with valid data', () => {
        const actionExecution = ActionJobProcessing.create(dto);

        expect(actionExecution.id).toBeInstanceOf(ValueObjectUuid);
        expect(actionExecution.action_id).toBeInstanceOf(ValueObjectUuid);
        expect(actionExecution.case_id).toBeInstanceOf(ValueObjectUuid);
        expect(actionExecution.is_in_progress).toBeInstanceOf(ValueObjectBoolean);
        expect(actionExecution.is_completed).toBeInstanceOf(ValueObjectBoolean);
        expect(actionExecution.is_failed).toBeInstanceOf(ValueObjectBoolean);
        expect(actionExecution.start_at).toBeInstanceOf(ValueObjectTimestamp);
        expect(actionExecution.end_at).toBeInstanceOf(ValueObjectTimestamp);
        expect(actionExecution.details).toBeInstanceOf(ValueObjectJson);
        expect(actionExecution.evaluate_conditions).toBeInstanceOf(ValueObjectBoolean);
    });

    it('should update ActionJobProcessing data', () => {
        const actionExecution = ActionJobProcessing.create(dto);
        const newData = {
            action_id: uuidV4(),
            case_id: uuidV4(),
            details: {
                retries: 2,
            },
            updated_at: new Date().toISOString(),
            updated_by: uuidV4(),
        };

        actionExecution.update(newData);

        expect(actionExecution.action_id.value).toBe(newData.action_id);
        expect(actionExecution.case_id.value).toBe(newData.case_id);
        expect(actionExecution.changedAttributes).toEqual({
            action_id: newData.action_id,
            case_id: newData.case_id,
            details: JSON.stringify(newData.details),
            updated_at: newData.updated_at,
            updated_by: newData.updated_by,
        });
    });

    it('should mark ActionJobProcessing as in progress', () => {
        const actionExecution = ActionJobProcessing.create(dto);
        actionExecution.markAsInProgress();

        expect(actionExecution.is_in_progress.value).toBe(true);
        expect(actionExecution.is_completed.value).toBe(false);
        expect(actionExecution.is_failed.value).toBe(false);
        expect(actionExecution.start_at.value).toBeDefined();
    });

    it('should mark ActionJobProcessing as completed', () => {
        const actionExecution = ActionJobProcessing.create(dto);
        actionExecution.markAsCompleted();

        expect(actionExecution.is_in_progress.value).toBe(false);
        expect(actionExecution.is_completed.value).toBe(true);
        expect(actionExecution.is_failed.value).toBe(false);
        expect(actionExecution.end_at.value).toBeDefined();
    });

    it('should mark ActionJobProcessing as failed', () => {
        const actionExecution = ActionJobProcessing.create(dto);
        const details = {
            errors: ['Something went wrong'],
        };
        actionExecution.markAsFailed(details.errors);

        expect(actionExecution.is_in_progress.value).toBe(false);
        expect(actionExecution.is_completed.value).toBe(false);
        expect(actionExecution.is_failed.value).toBe(true);
        expect(actionExecution.end_at.value).toBeDefined();
        expect(actionExecution.details.value).toStrictEqual(details);
    });

    it('does not update properties when values are the same', () => {
        const actionExecution = ActionJobProcessing.create(dto);
        const initialActionId = actionExecution.action_id.value;

        actionExecution.action_id = initialActionId;

        expect(actionExecution.changedAttributes).toEqual({});
    });

    it('marks an ActionJobProcessing instance as deleted', () => {
        const actionExecution = ActionJobProcessing.create(dto);
        const deleteDto = {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidV4(),
        };

        actionExecution.delete(deleteDto);

        expect(actionExecution.deleted_at.value).toBe(deleteDto.deleted_at);
        expect(actionExecution.deleted_by.value).toBe(deleteDto.deleted_by);
    });

    it('flushes changes in ActionJobProcessing instance', () => {
        const actionExecution = ActionJobProcessing.create(dto);
        const updateDto = {
            is_in_progress: true,
            updated_at: new Date().toISOString(),
            updated_by: uuidV4(),
        };

        actionExecution.update(updateDto);
        actionExecution.flushChanges();

        expect(actionExecution.changedAttributes).toEqual({});
    });

    it('should increment attempt', () => {
        const actionExecution = ActionJobProcessing.create(dto);
        actionExecution.incrementAttempt();
        expect(actionExecution.details.value.attempts).toBe(1);
    });
});

describe('ActionJobProcessing Response Tests', () => {
    it('should convert ActionJobProcessing object to JSON representation', () => {
        const dto = ActionJobProcessingMother.dto();
        const actionExecution = ActionJobProcessing.create(dto);
        const actionExecutionResponse = new ActionJobProcessingResponse(actionExecution);

        const json = actionExecutionResponse.toJson();

        expect(json).toEqual({
            data: {
                ...dto,
                updated_at: null,
                updated_by: undefined,
            },
        });
    });

    it('returns an empty object if ActionJobProcessing is not provided', () => {
        const actionExecutionResponse = new ActionJobProcessingResponse(null);
        expect(actionExecutionResponse.toJson()).toEqual({});
    });
});

describe('ActionJobProcessing Collection Response Tests', () => {
    it('should convert ActionJobProcessing collection to JSON representation', () => {
        const execution1 = ActionJobProcessing.create(ActionJobProcessingMother.dto());
        const execution2 = ActionJobProcessing.create(ActionJobProcessingMother.dto());
        const actionExecutionCollection = [execution1, execution2];

        const actionExecutionCollectionResponse = new ActionJobProcessingCollectionResponse(
            actionExecutionCollection,
            actionExecutionCollection.length
        );

        const json = actionExecutionCollectionResponse.toJson();

        expect(json).toEqual({
            data: {
                items: [execution1.toJson(), execution2.toJson()],
            },
            metadata: {
                count: actionExecutionCollection.length,
            },
        });
    });
});
