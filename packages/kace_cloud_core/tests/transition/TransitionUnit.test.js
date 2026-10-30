import { v4 as uuidv4 } from 'uuid';

import { StatusEnum } from '../../src/shared';
import { Transitions } from '../../src/transition';
import { TransitionsMother } from './domain/TransitionsMother';
import { TransitionsCollectionResponse } from '../../src/transition/index.js';
import { TransitionsResponse } from '../../src/transition/index.js';

describe('Transitions test', () => {
    it('should return a Transition instance', () => {
        const dto = TransitionsMother.dto();
        const transition = Transitions.create(dto);

        expect(transition).toBeInstanceOf(Transitions);
        expect(transition.id.value).toEqual(dto.id);
        expect(transition.estado_actual_id.value).toEqual(dto.estado_actual_id);
        expect(transition.siguiente_estado_id.value).toEqual(dto.siguiente_estado_id);
        expect(transition.flujo_id.value).toEqual(dto.flujo_id);
        expect(transition.updated_at.value).toEqual(null);
        expect(transition.updated_by.value).toEqual(null);
    });

    it('should update a Transition', () => {
        const dto = TransitionsMother.dto();
        const transition = new Transitions(dto);

        const updateDto = {
            estado_actual_id: uuidv4(),
            siguiente_estado_id: uuidv4(),
            flujo_id: uuidv4(),
            status: StatusEnum.INACTIVE.value,
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
        };

        transition.update(updateDto);

        expect(transition).toBeInstanceOf(Transitions);
        expect(transition.estado_actual_id.value).toEqual(updateDto.estado_actual_id);
        expect(transition.siguiente_estado_id.value).toEqual(updateDto.siguiente_estado_id);
        expect(transition.flujo_id.value).toEqual(updateDto.flujo_id);
        expect(transition.updated_at.value).toEqual(updateDto.updated_at);
        expect(transition.updated_by.value).toEqual(updateDto.updated_by);
    });

    it('does not update properties when values are the same', () => {
        const dto = TransitionsMother.dto();
        const transition = Transitions.create(dto);

        transition.update(dto);

        expect(transition.changedAttributes).toEqual({});
    });

    it('marks a Transiton instance as deleted', () => {
        const dto = TransitionsMother.dto();
        const transition = Transitions.create(dto);
        const deleteDto = {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidv4(),
        };
        transition.delete(deleteDto);

        expect(transition.deleted_at.value).toEqual(deleteDto.deleted_at);
        expect(transition.deleted_by.value).toEqual(deleteDto.deleted_by);
    });

    it('flushes changes in Transitions instance', () => {
        const dto = TransitionsMother.dto();
        const transitions = Transitions.create(dto);
        const updateDto = {
            status: StatusEnum.INACTIVE.value,
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
        };
        transitions.update(updateDto);
        transitions.flushChanges();

        expect(transitions.changedAttributes).toEqual({});
    });

    it('should allow null value when updating ans_id', () => {
        const dto = TransitionsMother.dto();
        const transition = Transitions.create(dto);

        const updateDto = {
            ans_id: null,
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
        };

        transition.update(updateDto);

        expect(transition).toBeInstanceOf(Transitions);
        expect(transition.ans_id.value).toBeNull();
        expect(transition.updated_at.value).toEqual(updateDto.updated_at);
        expect(transition.updated_by.value).toEqual(updateDto.updated_by);
    });

    it('should track is_visible in changedAttributes when updated', () => {
        const dto = TransitionsMother.dto();
        const transition = Transitions.create(dto);

        transition.is_visible = false;

        expect(transition.changedAttributes).toHaveProperty('is_visible', false);
    });
});

describe('Transitions Responses Tests', () => {
    it('converts Transition object to JSON representation', () => {
        const transition = new Transitions(TransitionsMother.dto());
        const transitionResponse = new TransitionsResponse(transition);

        const json = transitionResponse.toJson();

        expect(json).toEqual({
            data: {
                id: transition.id.value,
                estado_actual_id: transition.estado_actual_id.value,
                siguiente_estado_id: transition.siguiente_estado_id.value,
                is_visible: transition.is_visible.value,
                creator: null,
                flujo_id: transition.flujo_id.value,
                status: transition.status.value,
                created_by: transition.created_by.value,
                created_at: transition.created_at.value,
                updated_by: null,
                updated_at: null,
            },
        });
    });

    it('return an empty object if Transition is null', () => {
        const transitionResponse = new TransitionsResponse(null);

        const json = transitionResponse.toJson();

        expect(json).toMatchObject({});
    });

    it('converts Transition collection object to JSON representation', () => {
        const transition = [new Transitions(TransitionsMother.dto()), new Transitions(TransitionsMother.dto())];
        const transitionsCollectionReponse = new TransitionsCollectionResponse(transition, transition.length);

        const json = transitionsCollectionReponse.toJson();

        expect(json).toEqual({
            data: {
                items: transition.map((transition) => new TransitionsResponse(transition).toJson().data),
            },
            metadata: {
                count: transition.length,
            },
        });
    });
});
