import {
    WSRestFlow,
    WSRestFlowCollectionResponse,
    WSRestFlowResponse,
    WSRestFlowSelectCollectionResponse,
} from '../../src/ws-rest-flows';
import { v4 as uuidv4 } from 'uuid';
import WSRestFlowMother from './domain/WSRestFlowMother';
import { DeleteFieldsDoNotExistError, InvalidArgumentError } from '../../src/shared';

describe('WSRestFlow Entity', () => {
    const dto = WSRestFlowMother.dto();

    it('should create a WSRestFlow with valid data', () => {
        const flow = WSRestFlow.create(dto);

        expect(flow.id.value).toBe(dto.id);
        expect(flow.description.value).toBe(dto.description);
        expect(flow.external_code.value).toBe(dto.external_code);
        expect(flow.json_diagram_properties.value).toBe(dto.json_diagram_properties);
        expect(flow.created_at.value).toBe(dto.created_at);
        expect(flow.created_by.value).toBe(dto.created_by);
    });

    it('should update WSRestFlow data', () => {
        const wsRestFlow = WSRestFlow.create(dto);

        const newData = {
            description: 'Updated Flow Description',
            external_code: 'Updated Flow External Code',
            json_diagram_properties: {
                nodes: [{ id: uuidv4(), data: { label: 'Updated Node' } }],
            },
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
        };

        wsRestFlow.update(newData);

        expect(wsRestFlow.description.value).toBe(newData.description);
        expect(wsRestFlow.updated_at.value).toBe(newData.updated_at);
        expect(wsRestFlow.updated_by.value).toBe(newData.updated_by);
    });

    it('should throw an error with invalid UUID', () => {
        const invalidData = { ...dto, id: 'invalid-uuid' };

        expect(() => WSRestFlow.create(invalidData)).toThrow('Invalid value invalid-uuid for object uuid');
    });

    it('does not update properties when values are the same', () => {
        const wsRestFlow = WSRestFlow.create(dto);
        const sameData = { ...dto };

        wsRestFlow.update(sameData);

        expect(wsRestFlow.changedAttributes).toEqual({});
    });

    it('marks a WSRestFlow instance as deleted', () => {
        const wsRestFlow = WSRestFlow.create(dto);

        const deleteDto = {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidv4(),
        };

        wsRestFlow.delete(deleteDto);

        expect(wsRestFlow.deleted_at.value).toBe(deleteDto.deleted_at);
        expect(wsRestFlow.deleted_by.value).toBe(deleteDto.deleted_by);
        expect(wsRestFlow.isDeleted()).toBe(deleteDto.deleted_by);
    });

    it('throws an error when delete fields do not exist', () => {
        const wsRestFlow = WSRestFlow.create(dto);

        expect(() => wsRestFlow.delete({})).toThrow(DeleteFieldsDoNotExistError);
    });

    it('keeps unmarked deleted fields as null', () => {
        const wsRestFlow = WSRestFlow.create(dto);
        wsRestFlow.deleted_at = null;
        wsRestFlow.deleted_by = undefined;

        expect(wsRestFlow.deleted_at.value).toBeNull();
        expect(wsRestFlow.deleted_by.value).toBeUndefined();
    });

    it('flushes changes in WSRestFlow instance', () => {
        const wsRestFlow = WSRestFlow.create(dto);
        const updateDto = {
            description: 'Updated Flow Description',
            is_active: false,
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
        };
        wsRestFlow.update(updateDto);
        wsRestFlow.flushChanges();

        expect(wsRestFlow.changedAttributes).toEqual({});
    });

    it('should get json representation of WSRestFlow', () => {
        const wsRestFlow = WSRestFlow.create(dto);
        const json = wsRestFlow.toJson();

        expect(json).toEqual({
            id: wsRestFlow.id.value,
            description: wsRestFlow.description.value,
            external_code: wsRestFlow.external_code.value,
            json_diagram_properties: wsRestFlow.json_diagram_properties.value,
            is_active: wsRestFlow.is_active.value,
            is_primary: wsRestFlow.is_primary.value,
            initial_context: wsRestFlow.initial_context.value,
            created_at: wsRestFlow.created_at.value,
            created_by: wsRestFlow.created_by.value,
            updated_at: wsRestFlow.updated_at.value,
            updated_by: wsRestFlow.updated_by.value,
        });
    });

    it('should throw an error when json_diagram_properties is invalid', () => {
        const invalidDto = {
            ...dto,
            json_diagram_properties: {
                nodes: 'invalid-nodes',
            },
        };

        expect(() => WSRestFlow.create(invalidDto)).toThrow(InvalidArgumentError);
    });

    it('should throw an error when json_diagram_properties is missing nodes', () => {
        const invalidDto = {
            ...dto,
            json_diagram_properties: {
                nodes: [],
            },
        };

        expect(() => WSRestFlow.create(invalidDto)).toThrow(InvalidArgumentError);
    });

    it('should throw an error when json_diagram_properties is missing edges', () => {
        const invalidDto = {
            ...dto,
            json_diagram_properties: {
                nodes: [{ id: uuidv4(), data: { label: 'Node' } }],
                edges: 'invalid-edges',
            },
        };

        expect(() => WSRestFlow.create(invalidDto)).toThrow(InvalidArgumentError);
    });
});

describe('WSRestFlow Response Tests', () => {
    it('converts WSRestFlow object to JSON representation', () => {
        const wsRestFlow = WSRestFlow.create(WSRestFlowMother.dto());
        const wsRestFlowResponse = new WSRestFlowResponse(wsRestFlow);
        const json = wsRestFlowResponse.toJson();

        expect(json).toEqual({
            data: {
                id: wsRestFlow.id.value,
                description: wsRestFlow.description.value,
                external_code: wsRestFlow.external_code.value,
                json_diagram_properties: wsRestFlow.json_diagram_properties.value,
                is_active: wsRestFlow.is_active.value,
                is_primary: wsRestFlow.is_primary.value,
                created_at: wsRestFlow.created_at.value,
                created_by: wsRestFlow.created_by.value,
                updated_at: wsRestFlow.updated_at.value,
                updated_by: wsRestFlow.updated_by.value,
            },
        });
    });

    it('returns an empty object if WSRestFlow is not provided', () => {
        const wsRestFlowResponse = new WSRestFlowResponse(null);
        const json = wsRestFlowResponse.toJson();
        expect(json).toEqual({});
    });
});

describe('WSRestFlow Collection Response Tests', () => {
    it('converts WSRestFlow collection to JSON representation', () => {
        const wsRestFlowCollection = [
            WSRestFlow.create(WSRestFlowMother.dto()),
            WSRestFlow.create(WSRestFlowMother.dto()),
        ];
        const wsRestFlowCollectionResponse = new WSRestFlowCollectionResponse(
            wsRestFlowCollection,
            wsRestFlowCollection.length
        );
        const json = wsRestFlowCollectionResponse.toJson();

        expect(json).toEqual({
            data: {
                items: wsRestFlowCollection.map((wsRestFlow) => new WSRestFlowResponse(wsRestFlow).toJson().data),
            },
            metadata: {
                count: wsRestFlowCollection.length,
            },
        });
    });
});

describe('WSRestFlowSelectCollectionResponse', () => {
    it('should map a WSRestFlow collection to { value, label } items and include count', () => {
        const wsrestFlow1 = WSRestFlow.create(WSRestFlowMother.dto({ description: 'Alpha' }));
        const wsrestFlow2 = WSRestFlow.create(WSRestFlowMother.dto({ description: 'Beta' }));

        const collection = [wsrestFlow1, wsrestFlow2];
        const response = new WSRestFlowSelectCollectionResponse(collection, collection.length);

        const json = response.toJson();

        expect(json).toEqual({
            data: {
                items: [
                    { value: wsrestFlow1.id.value, label: wsrestFlow1.description.value },
                    { value: wsrestFlow2.id.value, label: wsrestFlow2.description.value },
                ],
            },
            metadata: { count: 2 },
        });
    });

    it('should return an empty items array with count=0 when collection is empty', () => {
        const response = new WSRestFlowSelectCollectionResponse([], 0);
        const json = response.toJson();

        expect(json).toEqual({
            data: { items: [] },
            metadata: { count: 0 },
        });
    });

    it('should only expose value and label keys per item (no extra fields leaked)', () => {
        const wsrestFlow = WSRestFlow.create(WSRestFlowMother.dto({ description: 'OnlyKeys' }));
        const json = new WSRestFlowSelectCollectionResponse([wsrestFlow], 1).toJson();

        expect(Array.isArray(json.data.items)).toBe(true);
        expect(json.data.items.length).toBe(1);

        const item = json.data.items[0];
        const keys = Object.keys(item);
        expect(keys.sort()).toEqual(['label', 'value']);
    });

    it('should reflect the exact count passed (even if it differs from items length)', () => {
        const wsrestFlow = WSRestFlow.create(WSRestFlowMother.dto({ nombre: 'Paged' }));
        const response = new WSRestFlowSelectCollectionResponse([wsrestFlow], 42);
        const json = response.toJson();

        expect(json.metadata.count).toBe(42);
        expect(json.data.items).toEqual([{ value: wsrestFlow.id.value, label: wsrestFlow.description.value }]);
    });
});
