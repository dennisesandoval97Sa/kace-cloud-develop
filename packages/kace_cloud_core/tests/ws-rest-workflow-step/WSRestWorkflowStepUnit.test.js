import { WSRestWorkflowStepCollectionResponse as RestWorkflowStepCollection } from '../../src/ws-rest-workflow-step/application/WSRestWorkflowStepCollectionResponse.js';
import { WSRestWorkflowStepResponse } from '../../src/ws-rest-workflow-step/application/WSRestWorkflowStepResponse.js';
import { WSRestWorkflowStep } from '../../src/ws-rest-workflow-step/domain/WSRestWorkflowStep.js';
import { WSRestWorkflowStepMother } from './domain/WSRestWorkflowStepMother.js';
import { DeleteFieldsDoNotExistError } from '../../src/shared/errors/DeleteFieldsDoNotExistError.js';
import { ValidationFailError } from '../../src/shared/errors/ValidationFailError.js';
import { v4 as uuidv4 } from 'uuid';

describe('Rest Workflow Step Test', () => {
    it('should return a Rest Workflow Step instance with endpoint_id', () => {
        const dto = WSRestWorkflowStepMother.dto(uuidv4());
        const restWorkflowStep = WSRestWorkflowStep.create(dto);

        expect(restWorkflowStep).toBeInstanceOf(WSRestWorkflowStep);
        expect(restWorkflowStep.id.value).toEqual(dto.id);
        expect(restWorkflowStep.flow_id.value).toEqual(dto.flow_id);
        expect(restWorkflowStep.endpoint_id.value).toEqual(dto.endpoint_id);
        expect(restWorkflowStep.function_id.value).toEqual(dto.function_id);
        expect(restWorkflowStep.created_by.value).toEqual(dto.created_by);
        expect(restWorkflowStep.created_at.value).toEqual(dto.created_at);
    });

    it('should return a Rest Workflow Step instance with function_id', () => {
        const dto = WSRestWorkflowStepMother.dto(null, uuidv4());
        const restWorkflowStep = WSRestWorkflowStep.create(dto);

        expect(restWorkflowStep).toBeInstanceOf(WSRestWorkflowStep);
        expect(restWorkflowStep.id.value).toEqual(dto.id);
        expect(restWorkflowStep.flow_id.value).toEqual(dto.flow_id);
        expect(restWorkflowStep.endpoint_id.value).toEqual(dto.endpoint_id);
        expect(restWorkflowStep.function_id.value).toEqual(dto.function_id);
        expect(restWorkflowStep.created_by.value).toEqual(dto.created_by);
        expect(restWorkflowStep.created_at.value).toEqual(dto.created_at);
    });

    it('should return a Rest Workflow Step instance with function_id and endpoint_id', () => {
        const dto = WSRestWorkflowStepMother.dto(uuidv4(), uuidv4());
        expect(() => WSRestWorkflowStep.create(dto)).toThrow(ValidationFailError);
    });

    it('should return a Rest Workflow Step instance without function_id and endpoint_id', () => {
        const dto = {
            id: uuidv4(),
            flow_id: uuidv4(),
            endpoint_id: null,
            function_id: null,
            conditional_id: null,
            order: 1,
            created_by: uuidv4(),
            created_at: new Date().toISOString(),
        };
        expect(() => WSRestWorkflowStep.create(dto)).toThrow(ValidationFailError);
    });

    it('should update a Rest Workflow Step', () => {
        const dto = WSRestWorkflowStepMother.dto(uuidv4());
        const restWorkflowStep = new WSRestWorkflowStep(dto);

        const updateDto = {
            flow_id: uuidv4(),
            endpoint_id: null,
            function_id: uuidv4(),
            order: 2,
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
        };

        restWorkflowStep.update(updateDto);

        expect(restWorkflowStep).toBeInstanceOf(WSRestWorkflowStep);
        expect(restWorkflowStep.flow_id.value).toEqual(updateDto.flow_id);
        expect(restWorkflowStep.order.value).toEqual(updateDto.order);
        expect(restWorkflowStep.updated_at.value).toEqual(updateDto.updated_at);
        expect(restWorkflowStep.updated_by.value).toEqual(updateDto.updated_by);
    });

    it('does not update properties when values are the same', () => {
        const dto = WSRestWorkflowStepMother.dto(null, uuidv4());
        const restWorkflowStep = WSRestWorkflowStep.create(dto);

        restWorkflowStep.update(dto);

        expect(restWorkflowStep.changedAttributes).toEqual({});
    });

    it('marks a Rest Workflow Step instance as deleted', () => {
        const dto = WSRestWorkflowStepMother.dto(uuidv4());
        const restWorkflowStep = WSRestWorkflowStep.create(dto);
        const deleteDto = {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidv4(),
        };
        restWorkflowStep.delete(deleteDto);

        expect(restWorkflowStep.deleted_at.value).toEqual(deleteDto.deleted_at);
        expect(restWorkflowStep.deleted_by.value).toEqual(deleteDto.deleted_by);
    });

    it('should throw a error if deleted fields are empty', () => {
        const dto = WSRestWorkflowStepMother.dto(uuidv4());
        const restWorkflowStep = WSRestWorkflowStep.create(dto);
        const deleteDto = {};

        expect(() => restWorkflowStep.delete(deleteDto)).toThrow(DeleteFieldsDoNotExistError);
    });

    it('flushes changes in Groups instance', () => {
        const dto = WSRestWorkflowStepMother.dto(null, uuidv4());
        const restWorkflowStep = WSRestWorkflowStep.create(dto);
        const updateDto = {
            flow_id: uuidv4(),
            endpoint_id: uuidv4(),
            function_id: null,
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
        };
        restWorkflowStep.update(updateDto);
        restWorkflowStep.flushChanges();

        expect(restWorkflowStep.changedAttributes).toEqual({});
    });
});

describe('Rest Workflow Step Responses Tests', () => {
    it('converts Rest Workflow Step object to JSON representation', () => {
        const restWorkflowStep = new WSRestWorkflowStep(WSRestWorkflowStepMother.dto(uuidv4()));
        const jsonResponse = new WSRestWorkflowStepResponse(restWorkflowStep);

        expect(jsonResponse.toJson()).toMatchObject({
            data: {
                id: restWorkflowStep.id.value,
                flow_id: restWorkflowStep.flow_id.value,
                endpoint_id: restWorkflowStep.endpoint_id.value,
                function_id: restWorkflowStep.function_id.value,
                created_at: restWorkflowStep.created_at.value,
                updated_at: restWorkflowStep.updated_at.value,
                deleted_at: restWorkflowStep.deleted_at.value || null,
                created_by: restWorkflowStep.created_by.value,
                updated_by: restWorkflowStep.updated_by.value || undefined,
                deleted_by: restWorkflowStep.deleted_by.value || undefined,
            },
        });
    });

    it('return an empty object if Rest Workflow Step is null', () => {
        const restWorkflowStep = new WSRestWorkflowStepResponse(null);
        expect(restWorkflowStep.toJson()).toMatchObject({});
    });

    it('return an empty object if Rest Workflow Step is undefined', () => {
        const restWorkflowStep = new WSRestWorkflowStepResponse(undefined);
        expect(restWorkflowStep.toJson()).toMatchObject({});
    });

    it('converts Rest Workflow Step collection object to JSON representation', () => {
        const restWorkflowStep = [
            new WSRestWorkflowStep(WSRestWorkflowStepMother.dto(uuidv4())),
            new WSRestWorkflowStep(WSRestWorkflowStepMother.dto(null, uuidv4())),
        ];
        const collection = new RestWorkflowStepCollection(restWorkflowStep, restWorkflowStep.length).toJson();

        expect(collection).toEqual({
            data: {
                items: restWorkflowStep.map((step) => new WSRestWorkflowStepResponse(step).toJson().data),
            },
            metadata: {
                count: restWorkflowStep.length,
            },
        });
    });
});
