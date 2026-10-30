import { ActionsQueueExecutions } from '../../src/actions-queue-executions/domain/ActionsQueueExecutions';
import { DeleteFieldsDoNotExistError, InvalidArgumentError, ValidationFailError } from '../../src/shared';
import { StatusEnum } from '../../src/actions-queue-executions/domain/enum/StatusEnum';
import { ActionTriggers } from '../../src/shared/domain/enum/ActionTriggersEnum';
import { ActionsQueueExecutionsMother } from './domain/ActionsQueueExecutionsMother';
import { v4 as uuidv4 } from 'uuid';
import { ValueObjectStartExecution } from '../../src/actions-queue-executions/domain/value-objects/ValueObjectStartExecution';
import { ValueObjectEndExecution } from '../../src/actions-queue-executions/domain/value-objects/ValueObjectEndExecution';

describe('Enum status', () => {
    it('should create a valid status enum', () => {
        const status = StatusEnum.PENDING;

        expect(status.key).toEqual('PENDING');
        expect(status.value).toEqual('pending');
    });

    it('should return the correct status enum from value', () => {
        const status = StatusEnum.fromValue('pending');

        expect(status).toEqual(StatusEnum.PENDING);
    });

    it('should convert status enum to JSON', () => {
        const statusJson = StatusEnum.toJson();

        expect(statusJson).toEqual({
            PENDING: 'pending',
            IN_PROGRESS: 'in_progress',
            FAILED: 'failed',
            COMPLETED: 'completed',
        });
    });

    it('should throw an error for invalid status value', () => {
        let error;
        try {
            new StatusEnum('INVALID', 'invalid');
        } catch (caughtError) {
            error = caughtError;
        }

        expect(error).toBeInstanceOf(InvalidArgumentError);
        expect(error.statusCode).toBe(400);
    });

    it('should throw an error for null status value', () => {
        let error;
        try {
            new StatusEnum('PENDING', null);
        } catch (caughtError) {
            error = caughtError;
        }

        expect(error).toBeInstanceOf(InvalidArgumentError);
        expect(error.statusCode).toBe(400);
    });
});

describe('ActionsQueueExecutuions Entity Tests', () => {
    it('should create an ActionsQueueExecutions instance', () => {
        const dto = ActionsQueueExecutionsMother.dto();
        const actionsQueueExecutions = ActionsQueueExecutions.create(dto);

        const startExecutionDate = new ValueObjectStartExecution(dto.start_execution);
        const endExecutionDate = new ValueObjectEndExecution(dto.end_execution);

        expect(actionsQueueExecutions).toBeInstanceOf(ActionsQueueExecutions);
        expect(actionsQueueExecutions.id.value).toEqual(dto.id);
        expect(actionsQueueExecutions.action_id.value).toEqual(dto.action_id);
        expect(actionsQueueExecutions.case_id.value).toEqual(dto.case_id);
        expect(actionsQueueExecutions.client_id.value).toEqual(dto.client_id);
        expect(actionsQueueExecutions.status.value).toEqual(dto.status);
        expect(actionsQueueExecutions.trigger_type.value).toEqual(dto.trigger_type);
        expect(actionsQueueExecutions.start_execution.value).toEqual(startExecutionDate.value);
        expect(actionsQueueExecutions.end_execution.value).toEqual(endExecutionDate.value);
    });

    it('should update an ActionsQueueExecutions instance', () => {
        const dto = ActionsQueueExecutionsMother.dto();

        const actionsQueueExecutions = ActionsQueueExecutions.create(dto);

        const updateDto = {
            action_id: uuidv4(),
            case_id: uuidv4(),
            client_id: uuidv4(),
            status: StatusEnum.IN_PROGRESS.value,
            trigger_type: ActionTriggers.EDIT_CASE.value,
            start_execution: new Date('2025-01-02').toISOString(),
            end_execution: new Date('2025-01-03').toISOString(),
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
        };

        actionsQueueExecutions.update(updateDto);

        expect(actionsQueueExecutions).toBeInstanceOf(ActionsQueueExecutions);
        expect(actionsQueueExecutions.status.value).toEqual(updateDto.status);
        expect(actionsQueueExecutions.trigger_type.value).toEqual(updateDto.trigger_type);
        expect(actionsQueueExecutions.start_execution.value).toEqual(updateDto.start_execution);
        expect(actionsQueueExecutions.end_execution.value).toEqual(updateDto.end_execution);
        expect(actionsQueueExecutions.updated_at.value).toEqual(updateDto.updated_at);
        expect(actionsQueueExecutions.updated_by.value).toEqual(updateDto.updated_by);
    });

    it('should not update the data if the new data is the same as the old data', () => {
        const dto = ActionsQueueExecutionsMother.dto();

        const actionsQueueExecutions = ActionsQueueExecutions.create(dto);

        const startExecutionDate = new ValueObjectStartExecution(dto.start_execution);
        const endExecutionDate = new ValueObjectEndExecution(dto.end_execution);

        actionsQueueExecutions.client_id = dto.client_id;
        actionsQueueExecutions.status = dto.status;
        actionsQueueExecutions.trigger_type = dto.trigger_type;
        actionsQueueExecutions.start_execution = startExecutionDate.value;
        actionsQueueExecutions.end_execution = endExecutionDate.value;
        actionsQueueExecutions.updated_at = dto.updated_at;
        actionsQueueExecutions.updated_by = dto.updated_by;

        expect(actionsQueueExecutions.changedAttributes).toEqual({});
    });

    it('should marks the entity as deleted', () => {
        const dto = ActionsQueueExecutionsMother.dto();

        const actionsQueueExecutions = ActionsQueueExecutions.create(dto);

        const deleteDto = {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidv4(),
        };

        actionsQueueExecutions.delete(deleteDto);
        expect(actionsQueueExecutions.deleted_at.value).not.toBeNull();
        expect(actionsQueueExecutions.deleted_by.value).toEqual(deleteDto.deleted_by);
    });

    it('should throw an error if the deleteDto is missing', () => {
        const dto = ActionsQueueExecutionsMother.dto();

        const actionsQueueExecutions = ActionsQueueExecutions.create(dto);

        const deleteDto = {};

        expect(() => {
            actionsQueueExecutions.delete(deleteDto);
        }).toThrow(DeleteFieldsDoNotExistError);
    });

    it('should flush the entity', () => {
        const dto = ActionsQueueExecutionsMother.dto();

        const actionsQueueExecutions = ActionsQueueExecutions.create(dto);

        const updateDto = {
            action_id: uuidv4(),
        };

        actionsQueueExecutions.update(updateDto);
        actionsQueueExecutions.flushChanges();

        expect(actionsQueueExecutions.changedAttributes).toEqual({});
    });

    it('should allow create with valid execution dates (start before end)', () => {
        const dto = ActionsQueueExecutionsMother.dto({
            start_execution: new Date('2025-01-01T10:00:00Z').toISOString(),
            end_execution: new Date('2025-01-01T11:00:00Z').toISOString(),
        });

        const actionsQueueExecutions = ActionsQueueExecutions.create(dto);

        expect(actionsQueueExecutions).toBeInstanceOf(ActionsQueueExecutions);
        expect(actionsQueueExecutions.start_execution.value).toEqual(dto.start_execution);
        expect(actionsQueueExecutions.end_execution.value).toEqual(dto.end_execution);
    });

    it('should throw error when creating with invalid execution dates (start after end)', () => {
        const dto = ActionsQueueExecutionsMother.dto({
            start_execution: new Date('2025-01-01T12:00:00Z').toISOString(),
            end_execution: new Date('2025-01-01T10:00:00Z').toISOString(),
        });

        expect(() => {
            ActionsQueueExecutions.create(dto);
        }).toThrow(ValidationFailError);
    });

    it('should throw error when updating start_execution to a date after end_execution', () => {
        const dto = ActionsQueueExecutionsMother.dto({
            start_execution: new Date('2025-01-01T10:00:00Z').toISOString(),
            end_execution: new Date('2025-01-01T12:00:00Z').toISOString(),
        });

        const actionsQueueExecutions = ActionsQueueExecutions.create(dto);

        expect(() => {
            actionsQueueExecutions.start_execution = new Date('2025-01-01T13:00:00Z').toISOString();
        }).toThrow(ValidationFailError);
    });

    it('should allow null values for dates and return default values', () => {
        const dto = ActionsQueueExecutionsMother.dto();

        const actionsQueueExecutions = ActionsQueueExecutions.create({
            ...dto,
            start_execution: null,
            end_execution: null,
        });

        expect(actionsQueueExecutions.start_execution).toBeInstanceOf(ValueObjectStartExecution);
        expect(actionsQueueExecutions.end_execution).toBeInstanceOf(ValueObjectEndExecution);
    });
});
