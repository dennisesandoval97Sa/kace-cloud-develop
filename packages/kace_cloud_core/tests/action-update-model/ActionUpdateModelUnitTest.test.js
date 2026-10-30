import {
    ActionUpdateModel,
    ActionUpdateModelCollectionResponse,
    ActionUpdateModelResponse,
    Aggregates,
    Formulas,
    Types,
    ValueObjectAggregate,
    ValueObjectField,
    ValueObjectFormula,
    ValueObjectTypes,
} from '../../src/action-update-model';
import { v4 as uuidV4 } from 'uuid';
import ActionUpdateModelMother from './domain/ActionUpdateModelMother';
import { ValueObjectString, ValueObjectUuid } from '../../src/shared';

describe('ActionUpdateModel Entity', () => {
    const dto = ActionUpdateModelMother.dto();

    it('should create an ActionUpdateModel with valid data', () => {
        const actionUpdateModel = ActionUpdateModel.create(dto);

        expect(actionUpdateModel.id).toBeInstanceOf(ValueObjectUuid);
        expect(actionUpdateModel.description).toBeInstanceOf(ValueObjectString);
        expect(actionUpdateModel.aggregate).toBeInstanceOf(ValueObjectAggregate);
        expect(actionUpdateModel.field).toBeInstanceOf(ValueObjectField);
        expect(actionUpdateModel.type).toBeInstanceOf(ValueObjectTypes);
        expect(actionUpdateModel.value).toBeInstanceOf(ValueObjectString);
        expect(actionUpdateModel.formula).toBeInstanceOf(ValueObjectFormula);
    });

    it('should update ActionUpdateModel data', () => {
        const actionUpdateModel = ActionUpdateModel.create(dto);
        const newData = {
            description: 'Updated Description',
            value: 'Updated Value',
            updated_at: new Date().toISOString(),
            updated_by: uuidV4(),
        };

        actionUpdateModel.update(newData);

        expect(actionUpdateModel.description.value).toBe(newData.description);
        expect(actionUpdateModel.value.value).toBe(newData.value);
        expect(actionUpdateModel.changedAttributes).toEqual(newData);
    });

    it('should throw an error with invalid UUID', () => {
        const invalidData = { ...dto, id: 'invalid-uuid' };

        expect(() => ActionUpdateModel.create(invalidData)).toThrow('Invalid value invalid-uuid for object uuid');
    });

    it('does not update properties when values are the same', () => {
        const actionUpdateModel = ActionUpdateModel.create(dto);
        const initialDescription = actionUpdateModel.description.value;

        actionUpdateModel.description = initialDescription; // Same value

        expect(actionUpdateModel.changedAttributes).toEqual({});
    });

    it('marks an ActionUpdateModel instance as deleted', () => {
        const actionUpdateModel = ActionUpdateModel.create(dto);
        const deleteDto = {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidV4(),
        };

        actionUpdateModel.delete(deleteDto);

        expect(actionUpdateModel.deleted_at.value).toBe(deleteDto.deleted_at);
        expect(actionUpdateModel.deleted_by.value).toBe(deleteDto.deleted_by);
    });

    it('flushes changes in ActionUpdateModel instance', () => {
        const actionUpdateModel = ActionUpdateModel.create(dto);
        const updateDto = {
            description: 'Updated Description',
            value: 'Updated Value',
            updated_at: new Date().toISOString(),
            updated_by: uuidV4(),
        };

        actionUpdateModel.update(updateDto);
        actionUpdateModel.flushChanges();

        expect(actionUpdateModel.changedAttributes).toEqual({});
    });
});

describe('ActionUpdateModel Response Tests', () => {
    it('should convert ActionUpdateModel object to JSON representation', () => {
        const dto = ActionUpdateModelMother.dto();
        const actionUpdateModel = ActionUpdateModel.create(dto);
        const actionUpdateModelResponse = new ActionUpdateModelResponse(actionUpdateModel);

        const json = actionUpdateModelResponse.toJson();

        expect(json).toEqual({
            data: {
                ...dto,
                updated_at: null,
                updated_by: undefined,
            },
        });
    });

    it('returns an empty object if ActionUpdateModel is not provided', () => {
        const actionUpdateModelResponse = new ActionUpdateModelResponse(null);
        expect(actionUpdateModelResponse.toJson()).toEqual({});
    });
});

describe('ActionUpdateModel Collection Response Tests', () => {
    it('should convert ActionUpdateModel collection to JSON representation', () => {
        const kase1 = ActionUpdateModel.create(ActionUpdateModelMother.dto());
        const kase2 = ActionUpdateModel.create(ActionUpdateModelMother.dto());
        const actionUpdateModelCollection = [kase1, kase2];

        const actionUpdateModelCollectionResponse = new ActionUpdateModelCollectionResponse(
            actionUpdateModelCollection,
            actionUpdateModelCollection.length
        );

        const json = actionUpdateModelCollectionResponse.toJson();

        expect(json).toEqual({
            data: {
                items: [kase1.toJson(), kase2.toJson()],
            },
            metadata: {
                count: actionUpdateModelCollection.length,
            },
        });
    });
});

describe('Types', () => {
    it('should create Types correctly', () => {
        expect(Types.ALFANUMERICO).toEqual({
            key: 'Alfanumérico',
            value: 'alfanumerico',
        });
        expect(Types.NUMERO).toEqual({
            key: 'Número',
            value: 'numero',
        });
        expect(Types.FORMULA).toEqual({
            key: 'Formula',
            value: 'formula',
        });
    });

    it('should throw error for invalid value in constructor', () => {
        expect(() => new Types('InvalidType', 'invalid_value')).toThrow(
            'The value must be a valid Type: invalid_value'
        );
    });

    it('should return correct type from value', () => {
        const type = Types.fromValue('alfanumerico');
        expect(type).toBe(Types.ALFANUMERICO);

        const anotherType = Types.fromValue('numero');
        expect(anotherType).toBe(Types.NUMERO);

        const formulaType = Types.fromValue('formula');
        expect(formulaType).toBe(Types.FORMULA);
    });

    it('should throw error for invalid value in fromValue method', () => {
        expect(() => Types.fromValue('invalid_value')).toThrow('Invalid type');
    });

    it('should convert Types to JSON', () => {
        const expectedJson = {
            ALFANUMERICO: 'alfanumerico',
            NUMERO: 'numero',
            FORMULA: 'formula',
        };

        expect(Types.toJson()).toEqual(expectedJson);
    });
});

describe('Formulas', () => {
    it('should create formulas correctly', () => {
        expect(Formulas.FECHA_ACTUAL).toEqual({
            key: 'FECHA_ACTUAL',
            value: 'fecha_actual',
        });
        expect(Formulas.HORA_ACTUAL).toEqual({
            key: 'HORA_ACTUAL',
            value: 'hora_actual',
        });
        expect(Formulas.FECHA_HORA_ACTUAL).toEqual({
            key: 'FECHA_HORA_ACTUAL',
            value: 'fecha_hora_actual',
        });
        expect(Formulas.MODELO_A_MODELO).toEqual({
            key: 'MODELO_A_MODELO',
            value: 'modelo_a_modelo',
        });
    });

    it('should throw error for invalid key in constructor', () => {
        expect(() => new Formulas('InvalidFormula', 'invalid_key')).toThrow(
            'The key must be a valid Formula key: invalid_key'
        );
    });

    it('should return correct formula from value', () => {
        const formula = Formulas.fromValue('fecha_actual');
        expect(formula).toBe(Formulas.FECHA_ACTUAL);

        const anotherFormula = Formulas.fromValue('hora_actual');
        expect(anotherFormula).toBe(Formulas.HORA_ACTUAL);

        const fechaHoraFormula = Formulas.fromValue('fecha_hora_actual');
        expect(fechaHoraFormula).toBe(Formulas.FECHA_HORA_ACTUAL);

        const modeloAModeloFormula = Formulas.fromValue('modelo_a_modelo');
        expect(modeloAModeloFormula).toBe(Formulas.MODELO_A_MODELO);
    });

    it('should throw error for invalid key in fromValue method', () => {
        expect(() => Formulas.fromValue('invalid_key')).toThrow('Invalid key');
    });

    it('should convert Formulas to JSON', () => {
        const expectedJson = {
            BOOLEAN_FALSE: 'boolean_false',
            BOOLEAN_TRUE: 'boolean_true',
            FECHA_ACTUAL: 'fecha_actual',
            HORA_ACTUAL: 'hora_actual',
            FECHA_HORA_ACTUAL: 'fecha_hora_actual',
            MODELO_A_MODELO: 'modelo_a_modelo',
            HASH_SHA256: 'hash_sha256',
        };

        expect(Formulas.toJson()).toEqual(expectedJson);
    });
});

describe('Aggregates', () => {
    it('should create aggregates correctly', () => {
        expect(Aggregates.CLIENTES).toEqual({
            key: 'CLIENTES',
            value: 'Client',
        });
        expect(Aggregates.CASOS).toEqual({
            key: 'CASOS',
            value: 'Case',
        });
        expect(Aggregates.AUX_CASE).toEqual({
            key: 'AUX_CASE',
            value: 'AuxCases',
        });
        expect(Aggregates.AUX_CLIENT).toEqual({
            key: 'AUX_CLIENT',
            value: 'AuxClient',
        });
    });

    it('should throw error for invalid value in constructor', () => {
        expect(() => new Aggregates('InvalidAggregate', 'InvalidValue')).toThrow(
            'The value must be a valid Aggregate value: InvalidValue'
        );
    });

    it('should return correct aggregate from value', () => {
        const aggregate = Aggregates.fromValue('Client');
        expect(aggregate).toBe(Aggregates.CLIENTES);

        const anotherAggregate = Aggregates.fromValue('Case');
        expect(anotherAggregate).toBe(Aggregates.CASOS);

        const auxCasesAggregate = Aggregates.fromValue('AuxCases');
        expect(auxCasesAggregate).toBe(Aggregates.AUX_CASE);

        const auxClientAggregate = Aggregates.fromValue('AuxClient');
        expect(auxClientAggregate).toBe(Aggregates.AUX_CLIENT);
    });

    it('should throw error for invalid value in fromValue method', () => {
        expect(() => Aggregates.fromValue('InvalidValue')).toThrow('Invalid Aggregate');
    });

    it('should convert Aggregates to JSON', () => {
        const expectedJson = {
            CLIENTES: 'Client',
            CASOS: 'Case',
            AUX_CASE: 'AuxCases',
            AUX_CLIENT: 'AuxClient',
        };

        expect(Aggregates.toJson()).toEqual(expectedJson);
    });
});
