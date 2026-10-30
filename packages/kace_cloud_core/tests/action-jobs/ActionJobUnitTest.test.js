import { ActionJob, ActionJobResponse, ActionJobCollectionResponse, ValueObjectS3Key } from '../../src/action-jobs';
import {
    ValueObjectUuid,
    ValueObjectBoolean,
    ValueObjectTimestamp,
    ValueObjectJson,
    ValueObjectInt,
    ValueObjectString,
    ValidationFailError,
} from '../../src/shared';
import ActionJobMother from './domain/ActionJobMother';
import { v4 as uuidV4 } from 'uuid';

describe('ActionJob Entity', () => {
    const dto = ActionJobMother.dto();

    it('should create an ActionJob with valid data', () => {
        const actionJob = new ActionJob(dto);

        expect(actionJob.id).toBeInstanceOf(ValueObjectUuid);
        expect(actionJob.action_id).toBeInstanceOf(ValueObjectUuid);
        expect(actionJob.type).toBeInstanceOf(ValueObjectString);
        expect(actionJob.is_pending).toBeInstanceOf(ValueObjectBoolean);
        expect(actionJob.is_in_progress).toBeInstanceOf(ValueObjectBoolean);
        expect(actionJob.is_completed).toBeInstanceOf(ValueObjectBoolean);
        expect(actionJob.total_records).toBeInstanceOf(ValueObjectInt);
        expect(actionJob.processed_records).toBeInstanceOf(ValueObjectInt);
        expect(actionJob.failed_records).toBeInstanceOf(ValueObjectInt);
        expect(actionJob.details).toBeInstanceOf(ValueObjectJson);
        expect(actionJob.notifications_sent).toBeInstanceOf(ValueObjectBoolean);
        expect(actionJob.start_at).toBeInstanceOf(ValueObjectTimestamp);
        expect(actionJob.end_at).toBeInstanceOf(ValueObjectTimestamp);
        expect(actionJob.created_at).toBeInstanceOf(ValueObjectTimestamp);
        expect(actionJob.created_by).toBeInstanceOf(ValueObjectUuid);
    });

    it('should update ActionJob data', () => {
        const actionJob = new ActionJob(dto);
        const newData = {
            action_id: uuidV4(),
            type: 'batch-updated',
            total_records: 150,
            processed_records: 50,
            failed_records: 5,
            updated_at: new Date().toISOString(),
            updated_by: uuidV4(),
        };

        actionJob.update(newData);

        expect(actionJob.action_id.value).toBe(newData.action_id);
        expect(actionJob.type.value).toBe(newData.type);
        expect(actionJob.total_records.value).toBe(newData.total_records);
        expect(actionJob.processed_records.value).toBe(newData.processed_records);
        expect(actionJob.failed_records.value).toBe(newData.failed_records);
        expect(actionJob.changedAttributes).toEqual({
            action_id: newData.action_id,
            type: newData.type,
            total_records: newData.total_records,
            processed_records: newData.processed_records,
            failed_records: newData.failed_records,
            updated_at: newData.updated_at,
            updated_by: newData.updated_by,
        });
    });

    it('should mark ActionJob as in progress', () => {
        const actionJob = new ActionJob(dto);
        actionJob.markAsInProgress();

        expect(actionJob.is_in_progress.value).toBe(true);
        expect(actionJob.is_completed.value).toBe(false);
        expect(actionJob.start_at.value).toBeDefined();
    });

    it('should mark ActionJob as completed', () => {
        const actionJob = new ActionJob(dto);
        const result = { success: true };
        actionJob.markAsCompleted(result);

        expect(actionJob.is_in_progress.value).toBe(false);
        expect(actionJob.is_completed.value).toBe(true);
        expect(actionJob.failed_records.value).toBe(0);
        expect(actionJob.end_at.value).toBeDefined();
        expect(actionJob.details.value).toEqual(result);
    });

    it('does not update properties when values are the same', () => {
        const actionJob = new ActionJob(dto);
        const initialActionId = actionJob.action_id.value;

        actionJob.action_id = initialActionId;

        expect(actionJob.changedAttributes).toEqual({});
    });

    it('marks an ActionJob instance as deleted', () => {
        const actionJob = new ActionJob(dto);
        const deleteDto = {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidV4(),
        };

        actionJob.delete(deleteDto);

        expect(actionJob.deleted_at.value).toBe(deleteDto.deleted_at);
        expect(actionJob.deleted_by.value).toBe(deleteDto.deleted_by);
    });

    it('flushes changes in ActionJob instance', () => {
        const actionJob = new ActionJob(dto);
        const updateDto = {
            is_in_progress: true,
            updated_at: new Date().toISOString(),
            updated_by: uuidV4(),
        };

        actionJob.update(updateDto);
        actionJob.flushChanges();

        expect(actionJob.changedAttributes).toEqual({});
    });
});

describe('ActionJob Response Tests', () => {
    it('should convert ActionJob object to JSON representation', () => {
        const dto = ActionJobMother.dto();
        const actionJob = new ActionJob(dto);
        const actionJobResponse = new ActionJobResponse(actionJob);

        const json = actionJobResponse.toJson();
        const expectedData = {
            id: actionJob.id.value,
            type: actionJob.type.value,
            is_pending: actionJob.is_pending.value,
            is_in_progress: actionJob.is_in_progress.value,
            is_completed: actionJob.is_completed.value,
            action_id: actionJob.action_id.value,
            search_filter: actionJob.search_filter.value,
            s3_file_key: actionJob.s3_file_key.value,
            start_at: actionJob.start_at.value,
            end_at: actionJob.end_at.value,
            total_records: actionJob.total_records.value,
            processed_records: actionJob.processed_records.value,
            failed_records: actionJob.failed_records.value,
            details: actionJob.details.value,
            notifications_sent: actionJob.notifications_sent.value,
            created_at: actionJob.created_at.value,
            created_by: actionJob.created_by.value,
            updated_by: actionJob.updated_by.value,
            updated_at: actionJob.updated_at.value,
        };

        expect(json).toEqual({
            data: expectedData,
        });
    });

    it('returns an empty object if ActionJob is not provided', () => {
        const actionJobResponse = new ActionJobResponse(null);
        expect(actionJobResponse.toJson()).toEqual({});
    });
});

describe('ActionJob Collection Response Tests', () => {
    it('should convert ActionJob collection to JSON representation', () => {
        const execution1 = new ActionJob(ActionJobMother.dto());
        const execution2 = new ActionJob(ActionJobMother.dto());
        const actionJobCollection = [execution1, execution2];

        const actionJobCollectionResponse = new ActionJobCollectionResponse(
            actionJobCollection,
            actionJobCollection.length
        );

        const json = actionJobCollectionResponse.toJson();

        const expectedItems = [
            new ActionJobResponse(execution1).toJson().data,
            new ActionJobResponse(execution2).toJson().data,
        ];
        expect(json).toEqual({
            data: {
                items: expectedItems,
            },
            metadata: {
                count: actionJobCollection.length,
            },
        });
    });
});

describe('ValueObjectS3Key Tests', () => {
    it('should throw an error if the value is null, undefined, or empty', () => {
        const invalidValues = [null, undefined, ''];

        invalidValues.forEach((value) => {
            expect(() => new ValueObjectS3Key('key', value)).toThrow('The value cannot be null');
        });
    });

    it('should allow null value if nullable is true', () => {
        expect(() => new ValueObjectS3Key('key', null, true)).not.toThrow();
    });

    it('should throw an error if the value exceeds 1024 characters', () => {
        const longValue = 'a'.repeat(1025);
        expect(() => new ValueObjectS3Key('key', longValue)).toThrow(
            'key: The value must be at most 1024 characters long'
        );
    });

    it('should throw an error if the value contains invalid characters', () => {
        const invalidValue = 'invalid<key';
        expect(() => new ValueObjectS3Key('key', invalidValue)).toThrow('key: The value must match the pattern');
    });
});

describe('ActionJob ID Validation Tests', () => {
    it('should allow file type without action_id and without restflow_id', () => {
        const dto = ActionJobMother.dtoWithoutIdsData({
            type: 'file',
            action_id: null,
            restflow_id: null,
        });

        expect(() => new ActionJob(dto)).not.toThrow();
    });

    it('should allow file_clients type without action_id and without restflow_id', () => {
        const dto = ActionJobMother.dtoWithoutIdsData({
            type: 'file_clients',
            action_id: null,
            restflow_id: null,
        });

        expect(() => new ActionJob(dto)).not.toThrow();
    });

    it('should throw ValidationFailError if neither action_id nor restflow_id are provided for filter type', () => {
        const dto = ActionJobMother.dtoWithoutIdsData({
            type: 'filter',
            action_id: null,
            restflow_id: null,
        });

        expect(() => new ActionJob(dto)).toThrow(ValidationFailError);
        expect(() => new ActionJob(dto)).toThrow('At least one of action_id or restflow_id must be provided');
    });

    it('should throw ValidationFailError if neither action_id nor restflow_id are provided for filter_clients type', () => {
        const dto = ActionJobMother.dtoWithoutIdsData({
            type: 'filter_clients',
            action_id: null,
            restflow_id: null,
        });

        expect(() => new ActionJob(dto)).toThrow(ValidationFailError);
        expect(() => new ActionJob(dto)).toThrow('At least one of action_id or restflow_id must be provided');
    });

    it('should throw ValidationFailError if both action_id and restflow_id are provided', () => {
        const dto = ActionJobMother.dtoWithoutIdsData({
            type: 'file',
            action_id: uuidV4(),
            restflow_id: uuidV4(),
        });

        expect(() => new ActionJob(dto)).toThrow(ValidationFailError);
        expect(() => new ActionJob(dto)).toThrow('Only one of action_id or restflow_id is permitted');
    });
});
