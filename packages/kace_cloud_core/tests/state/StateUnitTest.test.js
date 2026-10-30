import { v4 as uuidv4 } from 'uuid';
import { StateMother } from './domain/StateMother';
import { State, StateCollectionResponse, StateResponse, StateSelectCollectionResponse } from '../../src/state';
import { DeleteFieldsDoNotExistError } from '../../src/shared/index.js';
import {
    SHARED_VISUAL_COLOR_ALLOWLIST,
    SHARED_VISUAL_ICON_ALLOWLIST,
} from '../../src/shared/visual-options/sharedVisualOptions.js';

describe('Ans Tests', () => {
    it('creates a new State instance from DTO', () => {
        const dto = StateMother.dto();
        dto.updated_at = null;
        dto.updated_by = null;
        dto.deleted_at = null;
        dto.deleted_by = null;
        const state = State.create(dto);
        expect(state.id.value).toBe(dto.id);
        expect(state.nombre.value).toBe(dto.nombre);
        expect(state.descripcion.value).toBe(dto.descripcion);
        expect(state.icon_class.value).toBe(dto.icon_class);
        expect(state.status.value).toBe(dto.status);
        expect(state.color.value).toBe(dto.color);
        expect(state.require_observation.value).toBe(dto.require_observation);
        expect(state.created_at.value).toBe(dto.created_at);
        expect(state.updated_at.value).toBe(dto.updated_at);
        expect(state.created_by.value).toBe(dto.created_by);
        expect(state.updated_by.value).toBe(dto.updated_by);
        expect(state.deleted_at.value).toBe(dto.deleted_at);
        expect(state.deleted_by.value).toBe(dto.deleted_by);
    });

    it('updates an State instance with new values', () => {
        const dto = StateMother.dto();
        const state = State.create(dto);
        const updateDto = {
            nombre: 'Updated Name',
            descripcion: 'Updated Description',
            icon_class: SHARED_VISUAL_ICON_ALLOWLIST[0],
            color: SHARED_VISUAL_COLOR_ALLOWLIST[0],
            require_observation: true,
            status: 2,
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
        };
        state.update(updateDto);

        expect(state.nombre.value).toBe(updateDto.nombre);
        expect(state.descripcion.value).toBe(updateDto.descripcion);
        expect(state.icon_class.value).toBe(updateDto.icon_class);
        expect(state.color.value).toBe(updateDto.color);
        expect(state.require_observation.value).toBe(updateDto.require_observation);
        expect(state.status.value).toBe(updateDto.status);
        expect(state.updated_at.value).toBe(updateDto.updated_at);
        expect(state.updated_by.value).toBe(updateDto.updated_by);
    });

    it('does not update properties when values are the same', () => {
        const dto = StateMother.dto();
        const state = State.create(dto);

        state.update(dto);

        expect(state.changedAttributes).toEqual({});
    });

    it('marks an State instance as deleted', () => {
        const dto = StateMother.dto();
        const state = State.create(dto);
        const deleteDto = {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidv4(),
        };
        state.delete(deleteDto);

        expect(state.deleted_at.value).toBe(deleteDto.deleted_at);
        expect(state.deleted_by.value).toBe(deleteDto.deleted_by);
    });

    it('should throw a error if deleted fields are empty', () => {
        const dto = StateMother.dto();
        const state = State.create(dto);
        const deleteDto = {};

        expect(() => state.delete(deleteDto)).toThrow(DeleteFieldsDoNotExistError);
    });

    it('flushes changes in State instance', () => {
        const dto = StateMother.dto();
        const state = State.create(dto);
        const updateDto = {
            nombre: 'Updated Name',
            descripcion: 'Updated Description',
            icon_class: SHARED_VISUAL_ICON_ALLOWLIST[1],
            color: SHARED_VISUAL_COLOR_ALLOWLIST[1],
            require_observation: false,
            status: 2,
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
        };
        state.update(updateDto);
        state.flushChanges();

        expect(state.changedAttributes).toEqual({});
    });

    it('should correctly convert state to JSON with expected attributes', () => {
        const dto = StateMother.dto();
        const state = State.create(dto);
        const json = state.toJson();

        const { tipo_id, ...expectedDto } = dto;

        expect(json).toEqual({ ...expectedDto, updated_at: null, updated_by: undefined });
    });
});

describe('State Responses Tests', () => {
    it('converts State object to JSON representation', () => {
        const state = new State(StateMother.randomDto());
        const stateResponse = new StateResponse(state);

        const json = stateResponse.toJson();

        expect(json).toEqual({
            data: {
                id: state.id.value,
                nombre: state.nombre.value,
                descripcion: state.descripcion.value,
                icon_class: state.icon_class.value,
                status: state.status.value,
                color: state.color.value,
                require_observation: state.require_observation.value,
                created_by: state.created_by.value,
                created_at: state.created_at.value,
                updated_at: state.updated_at.value,
                updated_by: state.updated_by.value,
                deleted_at: state.deleted_at.value,
                deleted_by: state.deleted_by.value,
            },
        });
    });

    it('converts StateCollection to JSON representation', () => {
        const stateCollection = [new State(StateMother.randomDto()), new State(StateMother.randomDto())];
        const stateCollectionResponse = new StateCollectionResponse(stateCollection, stateCollection.length);

        const json = stateCollectionResponse.toJson();

        expect(json).toEqual({
            data: {
                items: stateCollection.map((state) => new StateResponse(state).toJson().data),
            },
            metadata: {
                count: stateCollection.length,
            },
        });
    });
});

describe('StateSelectCollectionResponse', () => {
    it('should map a State collection to { value, label } items and include count', () => {
        const state1 = State.create(StateMother.dto({ nombre: 'Alpha' }));
        const state2 = State.create(StateMother.dto({ nombre: 'Beta' }));

        const collection = [state1, state2];
        const response = new StateSelectCollectionResponse(collection, collection.length);

        const json = response.toJson();

        expect(json).toEqual({
            data: {
                items: [
                    { value: state1.id.value, label: state1.nombre.value },
                    { value: state2.id.value, label: state2.nombre.value },
                ],
            },
            metadata: { count: 2 },
        });
    });

    it('should return an empty items array with count=0 when collection is empty', () => {
        const response = new StateSelectCollectionResponse([], 0);
        const json = response.toJson();

        expect(json).toEqual({
            data: { items: [] },
            metadata: { count: 0 },
        });
    });

    it('should only expose value and label keys per item (no extra fields leaked)', () => {
        const state = State.create(StateMother.dto({ nombre: 'OnlyKeys' }));
        const json = new StateSelectCollectionResponse([state], 1).toJson();

        expect(Array.isArray(json.data.items)).toBe(true);
        expect(json.data.items.length).toBe(1);

        const item = json.data.items[0];
        const keys = Object.keys(item);
        expect(keys.sort()).toEqual(['label', 'value']);
    });

    it('should reflect the exact count passed (even if it differs from items length)', () => {
        const state = State.create(StateMother.dto({ nombre: 'Paged' }));
        const response = new StateSelectCollectionResponse([state], 42);
        const json = response.toJson();

        expect(json.metadata.count).toBe(42);
        expect(json.data.items).toEqual([{ value: state.id.value, label: state.nombre.value }]);
    });
});
