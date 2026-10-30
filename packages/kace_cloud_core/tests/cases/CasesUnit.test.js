import { v4 as uuidv4 } from 'uuid';
import CasesMother from './domain/CasesMother';
import {
    Case,
    CaseDataGridResponse,
    CaseResponse,
    ValueObjectAntiguedad,
    ValueObjectMotivoBaja,
    ValueObjectVista,
} from '../../src/cases';
import { CaseTransitionsResponse } from '../../src/cases/application/CaseTransitionsResponse';
import { DeleteFieldsDoNotExistError } from '../../src/shared/errors/DeleteFieldsDoNotExistError.js';

describe('Case test', () => {
    it('should return a Case instance', () => {
        const dto = CasesMother.dto();
        const kase = Case.create(dto);

        expect(kase).toBeInstanceOf(Case);
    });

    it('should update a Case', () => {
        const dto = CasesMother.dto();
        const kase = new Case(dto);

        const updateDto = {
            motivo_baja: 'MOtivo baja actualizado',
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
        };

        kase.update(updateDto);

        expect(kase).toBeInstanceOf(Case);
        expect(kase.motivo_baja.value).toEqual(updateDto.motivo_baja);
        expect(kase.updated_at.value).toEqual(updateDto.updated_at);
        expect(kase.updated_by.value).toEqual(updateDto.updated_by);
    });

    it('does not update properties when values are the same', () => {
        const dto = CasesMother.dto();
        const kase = Case.create(dto);

        kase.update(dto);

        expect(kase.changedAttributes).toEqual({});
    });

    it('marks a case instance as deleted', () => {
        const dto = CasesMother.dto();
        const kase = Case.create(dto);
        const deleteDto = {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidv4(),
        };
        kase.delete(deleteDto);

        expect(kase.deleted_at.value).toEqual(deleteDto.deleted_at);
        expect(kase.deleted_by.value).toEqual(deleteDto.deleted_by);
    });

    it('should throw a error if deleted fields are empty', () => {
        const dto = CasesMother.dto();
        const kase = Case.create(dto);
        const deleteDto = {};

        expect(() => kase.delete(deleteDto)).toThrow(DeleteFieldsDoNotExistError);
    });

    it('flushes changes in Case instance', () => {
        const dto = CasesMother.dto();
        const kase = Case.create(dto);
        const updateDto = {
            motivo_baja: 'MOtivo baja actualizado',
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
        };
        kase.update(updateDto);
        kase.flushChanges();

        expect(kase.changedAttributes).toEqual({});
    });

    it('should return a case whit external code property', () => {
        const dto = CasesMother.dto();
        const kase = Case.create(dto);

        expect(dto.external_code).toBe(kase.external_code.value);
    });

    it('should handle edited_by and edited_at initialization, setters and updates', () => {
        const dto = CasesMother.dto();
        const kase = Case.create(dto);

        expect(kase.edited_by.value).toBeFalsy();
        expect(kase.edited_at.value).toBeFalsy();

        const editorId = uuidv4();
        const editedAt = new Date().toISOString();

        kase.update({
            edited_by: editorId,
            edited_at: editedAt,
        });

        expect(kase.edited_by.value).toEqual(editorId);
        expect(kase.edited_at.value).toEqual(editedAt);
        expect(kase.changedAttributes.edited_by).toEqual(editorId);
        expect(kase.changedAttributes.edited_at).toEqual(editedAt);

        const json = kase.toJson();
        expect(json.edited_by).toEqual(editorId);
        expect(json.edited_at).toEqual(editedAt);
    });

    it('resets edited_by and edited_at to null on clone()', () => {
        const dto = CasesMother.dto();
        const kase = Case.create(dto);

        kase.update({
            edited_by: uuidv4(),
            edited_at: new Date().toISOString(),
        });

        const clonedId = uuidv4();
        const cloned = kase.clone(clonedId, uuidv4());

        expect(cloned.id.value).toEqual(clonedId);
        expect(cloned.edited_by.value).toBeNull();
        expect(cloned.edited_at.value).toBeNull();
        expect(cloned.toJson().edited_by).toBeNull();
        expect(cloned.toJson().edited_at).toBeNull();
    });

    it('sets cloned_by to the user performing the clone, not the last editor of the original', () => {
        const lastEditor = uuidv4();
        const kase = Case.create(CasesMother.dto({ updated_by: lastEditor }));
        const cloner = uuidv4();

        const cloned = kase.clone(uuidv4(), cloner);

        expect(cloned.cloned_by.value).toEqual(cloner);
    });

    it('credits the user performing the clone as creator and last updater of the clone', () => {
        const creator = uuidv4();
        const lastEditor = uuidv4();
        const kase = Case.create(CasesMother.dto({ created_by: creator, updated_by: lastEditor }));
        const cloner = uuidv4();

        const cloned = kase.clone(uuidv4(), cloner);

        expect(cloned.created_by.value).toEqual(cloner);
        expect(cloned.updated_by.value).toEqual(cloner);
    });

    it('does not carry the original external_code into the clone', () => {
        const kase = Case.create(CasesMother.dto({ external_code: 'EXT-1' }));

        const cloned = kase.clone(uuidv4(), uuidv4());

        expect(kase.external_code.value).toBe('EXT-1');
        expect(cloned.external_code.value).toBeNull();
    });
});

describe('Case Responses Tests', () => {
    it('converts Case object to JSON representation', () => {
        const kase = new Case(CasesMother.dto());
        const caseResponse = new CaseResponse(kase);

        const json = caseResponse.toJson();

        expect(json).toMatchObject({
            data: {
                id: kase.id.value,
                cliente_id: kase.cliente_id.value,
                transicion_id: kase.transicion_id.value,
                responsable_id: kase.responsable_id.value,
                clasificacion_id: kase.clasificacion_id.value,
                descripcion_caso_id: kase.descripcion_caso_id.value,
                caso_clonado_id: kase.caso_clonado_id.value,
                cambio_estado_comentario_id: kase.cambio_estado_comentario_id.value,
                grupo_id: kase.grupo_id.value,
                fecha_resolucion: kase.fecha_resolucion.value,
                antiguedad: kase.antiguedad.value,
                ans_posicion: kase.ans_posicion.value,
                antiguedad_dias: kase.antiguedad_dias.value,
                antiguedad_horas: kase.antiguedad_horas.value,
                antiguedad_minutos: kase.antiguedad_minutos.value,
                motivo_baja: kase.motivo_baja.value,
                alto_impacto: kase.alto_impacto.value,
                vista: kase.vista.value,
                created_at: kase.created_at.value,
                updated_at: kase.updated_at.value,
                created_by: kase.created_by.value,
                updated_by: kase.updated_by.value,
                deleted_at: kase.deleted_at.value,
                deleted_by: kase.deleted_by.value,
            },
        });
    });

    it('return an empty object if Case is null', () => {
        const caseResponse = new CaseResponse(null);

        const json = caseResponse.toJson();

        expect(json).toMatchObject({});
    });

    it('return an empty object if Date is null', () => {
        const caseTransitionResponse = new CaseTransitionsResponse(null);

        const json = caseTransitionResponse.toJson();

        expect(json).toMatchObject({});
    });

    it('converts case Grid to json representation', () => {
        const kase = new Case(CasesMother.dto());
        const caseGridResponse = new CaseDataGridResponse(kase);

        expect(caseGridResponse).toBeInstanceOf(CaseDataGridResponse);
    });

    it('The case respose return a external code property', () => {
        const kase = new Case(CasesMother.dto());
        const caseResponse = new CaseResponse(kase);

        const json = caseResponse.toJson();

        expect(json.data).toHaveProperty('external_code');
    });

    it('should set parent_id when provided', () => {
        const parentId = uuidv4();
        const dto = CasesMother.dto({ parent_id: parentId });
        const kase = new Case(dto);
        expect(kase.parent_id.value).toBe(parentId);
    });

    it('should allow nullable parent_id when creating a Case', () => {
        const dto = CasesMother.dto({ parent_id: null });
        const kase = new Case(dto);
        expect(kase.parent_id.value).toBeNull();
    });
});

describe('Uuid test', () => {
    it('should return an error when Antiguedad is null and is not nullable', () => {
        expect(() => new ValueObjectAntiguedad('Antiguedad', null, false)).toThrow('The value cannot be null');
    });

    it('should return an error when Motivo baja is null and is not nullable', () => {
        expect(() => new ValueObjectMotivoBaja('Motivo baja', null, false)).toThrow('The value cannot be null');
    });

    it('should return a string as a value', () => {
        const voMotivoBaja = new ValueObjectMotivoBaja('Motivo baja', 'motivo baja', false);
        expect(voMotivoBaja.value).toBe('motivo baja');
    });

    it('should return an error when Vista is null and is not nullable', () => {
        expect(() => new ValueObjectVista('Vista', null, false)).toThrow('The value cannot be null');
    });

    it('should return a null when vista is nullable', () => {
        const voVista = new ValueObjectVista('Vista', null, true);
        expect(voVista.value).toBeNull;
    });
});

describe('SLA fields resolution in Case class', () => {
    const dto = CasesMother.dto({
        antiguedad_dias: 10,
        antiguedad_horas: 5,
        antiguedad_minutos: 41,
        state_elapsed_days: 2,
        state_elapsed_hours: 10,
        state_elapsed_minutes: 15,
    });

    const kase = Case.create(dto);

    it('VALID_TRANSITIONS_SLA_FIELDS debe validar campos permitidos', () => {
        const validFields = [
            'casos.antiguedad_dias',
            'casos.antiguedad_horas',
            'casos.antiguedad_minutos',
            'casos.state_elapsed_days',
            'casos.state_elapsed_hours',
            'casos.state_elapsed_minutes',
        ];

        validFields.forEach((field) => {
            expect(kase.VALID_TRANSITIONS_SLA_FIELDS.includes(field)).toBe(true);
        });

        const invalidFields = ['casos.cliente_id', 'casos.estado', 'casos.vista'];

        invalidFields.forEach((field) => {
            expect(kase.VALID_TRANSITIONS_SLA_FIELDS.includes(field)).toBe(false);
        });
    });

    it('slaFieldResolvers debe calcular valores correctos de antigüedad y estado', () => {
        const resolvers = kase.slaFieldResolvers;

        expect(resolvers['casos.antiguedad_dias']()).toBe(10);
        expect(resolvers['casos.antiguedad_horas']()).toBe(245);
        expect(resolvers['casos.antiguedad_minutos']()).toBe(14741);

        expect(resolvers['casos.state_elapsed_days']()).toBe(2);
        expect(resolvers['casos.state_elapsed_hours']()).toBe(58);
        expect(resolvers['casos.state_elapsed_minutes']()).toBe(3495);
    });

    it('slaFieldResolvers debe fallar (undefined) si el campo no está definido', () => {
        const resolvers = kase.slaFieldResolvers;

        const invalidResolver = resolvers['casos.clasificacion_id'];
        expect(invalidResolver).toBeUndefined();
    });
});
