import {
    Classification,
    ClassificationCollectionResponse,
    ClassificationResponse,
    ClassificationsSelectCollectionResponse,
} from '../../src/classifications';
import { v4 as uuidv4 } from 'uuid';
import { ValueObjectBoolean, ValueObjectUuid } from '../../src/shared';
import ClassificationsMother from './domain/ClassificationsMother';
import { ValueObjectExternalId } from '../../src/classifications/domain/ValueObjectExternalId';
import { DeleteFieldsDoNotExistError } from '../../src/shared/errors/DeleteFieldsDoNotExistError.js';

describe('Classification Entity', () => {
    const dto = ClassificationsMother.dto();

    it('should create a classification with valid data', () => {
        const classification = Classification.create(dto);
        expect(classification.id).toBeInstanceOf(ValueObjectUuid);
        expect(classification.is_active).toBeInstanceOf(ValueObjectBoolean);
    });

    it('should update classification data', () => {
        const classification = Classification.create(dto);
        const newFlowId = uuidv4();
        const newData = {
            nivel1: 'Updated Level 1',
            flujo_id: newFlowId,
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
        };
        classification.update(newData);

        expect(classification.nivel1.value).toBe('Updated Level 1');
        expect(classification.flujo_id.value).toBe(newFlowId);
        expect(classification.changedAttributes).toEqual(newData);
    });

    it('should throw an error with invalid UUID', () => {
        const invalidData = dto;
        invalidData.id = 'invalid-uuid';

        expect(() => Classification.create(invalidData)).toThrow('Invalid value invalid-uuid for object uuid');
    });

    it('does not update properties when values are the same', () => {
        const dto = ClassificationsMother.dto();
        const classification = Classification.create(dto);
        delete dto.id;
        delete dto.created_at;
        delete dto.created_by;

        classification.update(dto);

        expect(classification.changedAttributes).toEqual({});
    });

    it('marks a Classification instance as deleted', () => {
        const dto = ClassificationsMother.dto();
        const classification = Classification.create(dto);
        const deleteDto = {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidv4(),
        };
        classification.delete(deleteDto);

        expect(classification.deleted_at.value).toBe(deleteDto.deleted_at);
        expect(classification.deleted_by.value).toBe(deleteDto.deleted_by);
    });

    it('keeps unmarked deleted fields as null', () => {
        const dto = ClassificationsMother.dto();
        const classification = Classification.create(dto);
        const deleteDto = {};

        expect(() => classification.delete(deleteDto)).toThrow(DeleteFieldsDoNotExistError);
    });

    it('flushes changes in Classification instance', () => {
        const dto = ClassificationsMother.dto();
        const classification = Classification.create(dto);
        const updateDto = {
            nivel1: 'Updated Level 1',
            nivel2: 'Updated Level 2',
            flujo_id: uuidv4(),
            ans_id: uuidv4(),
            is_active: false,
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
        };
        classification.update(updateDto);
        classification.flushChanges();

        expect(classification.changedAttributes).toEqual({});
    });

    it('should default can_start_sub_cases_flow to true when not provided', () => {
        const dto = ClassificationsMother.dto();
        delete dto.can_start_sub_cases_flow;
        const classification = new Classification(dto);

        expect(classification.can_start_sub_cases_flow.value).toBe(true);
    });

    it('should return a Classifications instance', () => {
        const dto = ClassificationsMother.dto();

        const classifications = Classification.create(dto);

        expect(classifications.id.value).toBe(dto.id);
        expect(typeof classifications.json_flujo.value).toBe('object');
    });

    it('should update a json_flujo Classifications', () => {
        const dto = ClassificationsMother.dto();
        const classifications = Classification.create(dto);

        const classificationId = uuidv4();
        const updateDto = ClassificationsMother.dto({ sub_classification_ids: [classificationId] });

        classifications.update({ json_flujo: updateDto.json_flujo });

        expect(classifications.json_flujo.value.edges[0].target).toEqual(classificationId);
    });

    it('getClassificationsIds returns an array with classifications Ids', () => {
        const dto = ClassificationsMother.dto();

        const classifications = Classification.create(dto);

        const classificationsIds = classifications.getClassificationsIds();

        // `dtoJsonFlow` decide al azar cuantos edges genera, asi que el numero de
        // aristas no es fijo: los ids esperados se derivan del propio dto.
        const expectedIds = [
            ...new Set(
                dto.json_flujo.edges.flatMap((edge) => [edge.source, edge.target]).filter((id) => id !== dto.id)
            ),
        ];

        expect(classificationsIds).toBeInstanceOf(Array);
        expect(classificationsIds.length).toBeGreaterThan(0);
        expect([...classificationsIds].sort()).toEqual(expectedIds.sort());
    });

    /**
     * AUD-1 (MSKT-1392): la bitácora necesita nombrar la clasificación, y una clasificación no
     * tiene `nombre` sino diez niveles. La regla de etiquetado es la misma que ya usa el
     * desplegable (`ClassificationsSelectCollectionResponse`), no una segunda definición.
     */
    describe('label', () => {
        it('une los niveles con " -> " hasta el primer vacío', () => {
            const classification = Classification.create(
                ClassificationsMother.dto({ nivel3: null, nivel4: null, nivel5: null })
            );

            expect(classification.label).toBe('Level 1 -> Level 2');
        });

        it('devuelve solo el primer nivel cuando el resto está vacío', () => {
            const soloNivel1 = Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`nivel${i + 2}`, null]));

            expect(Classification.create(ClassificationsMother.dto(soloNivel1)).label).toBe('Level 1');
        });
    });

    it('getClassificationRelations returns an array with classifications relations', () => {
        const dto = ClassificationsMother.dto();
        const classificationsFlows = Classification.create(dto);

        const classificationsIds = classificationsFlows.getClassificationRelations();

        expect(classificationsIds).toBeInstanceOf(Array);
        expect(classificationsIds.length).toBeGreaterThan(0);
        expect(classificationsIds[0]).toHaveProperty('classification_id');
        expect(classificationsIds[0]).toHaveProperty('sub_classification_id');
        expect(classificationsIds).toEqual(
            expect.arrayContaining([
                {
                    classification_id: dto.json_flujo.edges[0].source,
                    sub_classification_id: dto.json_flujo.edges[0].target,
                },
            ])
        );
    });
});

describe('Classification Responses Tests', () => {
    it('converts Classification object to JSON representation', () => {
        const dto = ClassificationsMother.dto();

        dto.description = [
            dto.nivel1,
            dto.nivel2,
            dto.nivel3,
            dto.nivel4,
            dto.nivel5,
            dto.nivel6,
            dto.nivel7,
            dto.nivel8,
            dto.nivel9,
            dto.nivel10,
        ].join(' -> ');

        const classification = new Classification(dto);
        const classificationResponse = new ClassificationResponse(classification);

        const json = classificationResponse.toJson();

        expect(json).toEqual({
            data: {
                id: classification.id.value,
                nivel1: classification.nivel1.value,
                nivel2: classification.nivel2.value,
                nivel3: classification.nivel3.value,
                nivel4: classification.nivel4.value,
                nivel5: classification.nivel5.value,
                nivel6: classification.nivel6.value,
                nivel7: classification.nivel7.value,
                nivel8: classification.nivel8.value,
                nivel9: classification.nivel9.value,
                nivel10: classification.nivel10.value,
                flujo_id: classification.flujo_id.value,
                ans_id: classification.ans_id.value,
                is_active: classification.is_active.value,
                description:
                    'Level 1 -> Level 2 -> Level 3 -> Level 4 -> Level 5 -> Level 6 -> Level 7 -> Level 8 -> Level 9 -> Level 10',
                default_group_id: classification.default_group_id.value,
                folio_config_id: classification.folio_config_id.value,
                external_id: classification.external_id.value,
                can_start_sub_cases_flow: classification.can_start_sub_cases_flow.value,
                created_at: classification.created_at.value,
                updated_at: classification.updated_at.value,
                created_by: classification.created_by.value,
                updated_by: classification.updated_by.value,
                json_flujo: classification.json_flujo.value,
                relations: classification.getClassificationRelations(),
            },
        });
    });

    it('converts ClassificationCollection to JSON representation', () => {
        const classificationCollection = [
            new Classification(ClassificationsMother.dto()),
            new Classification(ClassificationsMother.dto()),
        ];
        const classificationCollectionResponse = new ClassificationCollectionResponse(
            classificationCollection,
            classificationCollection.length
        );

        const json = classificationCollectionResponse.toJson();

        expect(json).toEqual({
            data: {
                items: classificationCollection.map(
                    (classification) => new ClassificationResponse(classification).toJson().data
                ),
            },
            metadata: {
                count: classificationCollection.length,
            },
        });
    });

    it('classification response must have a json_flow property', () => {
        const classification = new Classification(ClassificationsMother.dto());
        const classificationResponse = new ClassificationResponse(classification);

        const json = classificationResponse.toJson();

        expect(json.data).toHaveProperty('json_flujo');
    });

    it('classification response must have a relations property', () => {
        const classification = new Classification(ClassificationsMother.dto());
        const classificationResponse = new ClassificationResponse(classification);

        const json = classificationResponse.toJson();

        expect(json.data).toHaveProperty('relations');
    });
});

describe('ValueObjectExternalId', () => {
    const field = 'external_id';

    it('should create a valid external ID value object', () => {
        const externalId = new ValueObjectExternalId(field, 'some-external-id');

        expect(externalId).toBeDefined();
        expect(externalId.value).toBe('some-external-id');
    });

    it('should throw an error if the value is null, undefined, or empty', () => {
        const invalidValues = [null, undefined, ''];

        invalidValues.forEach((value) => {
            expect(() => new ValueObjectExternalId(field, value, false)).toThrow(`${field}: The value cannot be null`);
        });
    });

    it('should allow null value if nullable is true', () => {
        const externalId = new ValueObjectExternalId(field, null);

        expect(externalId).toBeDefined();
        expect(externalId.value).toBeNull();
    });

    it('should throw an error if the type is not a string', () => {
        const invalidValue = 123;
        expect(() => new ValueObjectExternalId(field, invalidValue)).toThrow(`${field}: The value must be a string`);
    });

    it('should throw an error if value exceeds max length', () => {
        const longValue = 'a'.repeat(46);

        expect(() => new ValueObjectExternalId(field, longValue)).toThrow();
    });
});

describe('ClassificationsSelectCollectionResponse (label join)', () => {
    const row = (o = {}) => ({
        id: o.id ?? 'c1',
        nivel1: o.nivel1 ?? '',
        nivel2: o.nivel2 ?? '',
        nivel3: o.nivel3 ?? '',
        nivel4: o.nivel4 ?? '',
        nivel5: o.nivel5 ?? '',
        nivel6: o.nivel6 ?? '',
        nivel7: o.nivel7 ?? '',
        nivel8: o.nivel8 ?? '',
        nivel9: o.nivel9 ?? '',
        nivel10: o.nivel10 ?? '',
    });

    // El separador real es ' -> ', el mismo que arma `description` en el resto del
    // modulo; el test afirmaba '>' y nunca coincidio con la respuesta.
    it('mapea a { value, label } uniendo niveles con " -> " hasta el primer vacío', () => {
        const a = row({ id: 'a', nivel1: 'A', nivel2: 'B', nivel3: 'C' });
        const b = row({ id: 'b', nivel1: 'X' });

        const json = new ClassificationsSelectCollectionResponse([a, b], 2).toJson();
        expect(json).toEqual({
            data: {
                items: [
                    { value: 'a', label: 'A -> B -> C' },
                    { value: 'b', label: 'X' },
                ],
            },
            metadata: { count: 2 },
        });
    });

    it('expone solo value y label', () => {
        const item = new ClassificationsSelectCollectionResponse([row({ nivel1: 'N1' })], 1).toJson().data.items[0];
        expect(Object.keys(item).sort()).toEqual(['label', 'value'].sort());
    });

    it('si todos los niveles están vacíos, label queda como cadena vacía', () => {
        const json = new ClassificationsSelectCollectionResponse([row({ id: 'z' })], 1).toJson();
        expect(json.data.items[0]).toEqual({ value: 'z', label: '' });
    });
});
