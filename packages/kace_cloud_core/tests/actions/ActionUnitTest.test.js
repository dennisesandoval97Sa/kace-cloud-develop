import {
    Action,
    ActionCollectionResponse,
    ActionResponse,
    ActionTriggers,
    ActionTypes,
    ActionTypeValidator,
    ActionValidationError,
    ValueObjectActionType,
    ValueObjectPriority,
    ValueObjectTriggers,
} from '../../src/actions';
import { User } from '../../src/users/domain/User';
import { v4 as uuidv4 } from 'uuid';
import ActionMother from './domain/ActionMother';
import UsersMother from '../users/domain/UsersMother';
import { InvalidArgumentError } from '../../src/shared/errors/InvalidArgumentError';
import { ValueObjectEntity } from '../../src/actions/domain/value-objects/ValueObjectEntity';
import { ValueObjectPermissions } from '../../src/actions/domain/value-objects/ValueObjectPermissions';

describe('Action Entity', () => {
    const dto = ActionMother.dto();

    it('should create an Action with valid data', () => {
        const action = Action.create(dto);
        expect(action.id.value).toBe(dto.id);
        expect(action.action_type.value).toBe(dto.action_type);
        expect(action.description.value).toBe(dto.description);
        expect(action.state_id.value).toBe(dto.state_id);
        expect(action.group_id.value).toBe(dto.group_id);
        expect(action.responsible_id.value).toBe(dto.responsible_id);
        expect(action.is_active.value).toBe(dto.is_active);
        expect(action.created_by.value).toBe(dto.created_by);
        expect(action.created_at.value).toBe(dto.created_at);
    });

    it('should update Action data', () => {
        const action = Action.create(dto);
        const newData = {
            description: 'Updated Action Description',
            priority: 2,
            is_active: false,
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
        };
        action.description = newData.description;
        action.priority = newData.priority;
        action.is_active = newData.is_active;
        action.updated_at = newData.updated_at;
        action.updated_by = newData.updated_by;

        expect(action.description.value).toBe(newData.description);
        expect(action.priority.value).toBe(newData.priority);
        expect(action.is_active.value).toBe(newData.is_active);
        expect(action.changedAttributes).toEqual(newData);
    });

    it('should throw an error with invalid UUID', () => {
        const invalidData = { ...dto, id: 'invalid-uuid' };
        expect(() => Action.create(invalidData)).toThrow('Invalid value invalid-uuid for object uuid');
    });

    it('does not update properties when values are the same', () => {
        const action = Action.create(dto);
        const sameData = { ...dto };

        action.description = sameData.description;
        action.priority = sameData.priority;
        action.is_active = sameData.is_active;

        expect(action.changedAttributes).toEqual({});
    });

    it('marks an Action instance as deleted', () => {
        const action = Action.create(dto);
        const deleteDto = {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidv4(),
        };
        action.deleted_at = deleteDto.deleted_at;
        action.deleted_by = deleteDto.deleted_by;

        expect(action.deleted_at.value).toBe(deleteDto.deleted_at);
        expect(action.deleted_by.value).toBe(deleteDto.deleted_by);
    });

    it('keeps unmarked deleted fields as null', () => {
        const action = Action.create(dto);
        action.deleted_at = null;
        action.deleted_by = undefined;

        expect(action.deleted_at.value).toBeNull();
        expect(action.deleted_by.value).toBeUndefined();
    });

    it('flushes changes in Action instance', () => {
        const action = Action.create(dto);
        const updateDto = {
            description: 'Updated Action Description',
            priority: 2,
            is_active: false,
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
        };
        action.description = updateDto.description;
        action.priority = updateDto.priority;
        action.is_active = updateDto.is_active;
        action.updated_at = updateDto.updated_at;
        action.updated_by = updateDto.updated_by;
        action.flushChanges();

        expect(action.changedAttributes).toEqual({});
    });

    it('should create an Action with a valid automation_id', () => {
        const validDto = { ...dto, automation_id: uuidv4() };
        const actionWithUuid = Action.create(validDto);
        expect(actionWithUuid.automation_id.value).toBe(validDto.automation_id);
        const nullDto = { ...dto, automation_id: null };
        const actionWithNull = Action.create(nullDto);

        expect(actionWithNull.automation_id.value).toBeNull();
    });

    it('should throw an error with an invalid automation_id', () => {
        const invalidDto = { ...dto, automation_id: 'invalid-uuid' };

        expect(() => Action.create(invalidDto)).toThrow('Invalid value invalid-uuid for object uuid');
    });

    describe('Action hasPermission', () => {
        let action;
        let user;
        const userWhiteList = uuidv4();
        const groupBlackList = uuidv4();
        const userDtoBlackList = { ...UsersMother.dto(), grupo_activo: uuidv4() };

        const permissions = {
            whiteList: {
                usuarios: [userWhiteList, uuidv4()],
            },
            blackList: {
                usuarios: [userDtoBlackList.id],
                grupos: [groupBlackList],
            },
        };

        beforeEach(() => {
            action = Action.create({ ...dto, permissions });
            user = new User({ ...UsersMother.dto(), grupo_activo: uuidv4() });
        });

        it('should return true if user is in the whiteList', () => {
            user = new User({ ...userDtoBlackList, id: userWhiteList });
            expect(action.hasPermission(user)).toBe(true);
        });

        it('should return false if user is in the blackList (usuarios)', () => {
            user = new User(userDtoBlackList);
            expect(action.hasPermission(user)).toBe(false);
        });

        it("should return false if user's group is in the blackList (grupos)", () => {
            user.grupo_activo = groupBlackList;
            expect(action.hasPermission(user)).toBe(false);
        });

        it('should return true if user is not in either whiteList or blackList', () => {
            user.grupo_activo = uuidv4();
            expect(action.hasPermission(user)).toBe(true);
        });

        it('should return true if whiteList or blackList does not exist', () => {
            action.permissions = null;
            expect(action.hasPermission(user)).toBe(true);
        });

        it('should return true if user is in the whiteList and blackList also exists', () => {
            action.permissions = {
                whiteList: { usuarios: [user.id.value] },
                blackList: { usuarios: [user.id.value], grupos: [] },
            };
            expect(action.hasPermission(user)).toBe(true);
        });

        it('should return false if user is in blackList and not in whiteList', () => {
            action.permissions = {
                whiteList: { usuarios: [] },
                blackList: { usuarios: [user.id.value], grupos: [] },
            };
            expect(action.hasPermission(user)).toBe(false);
        });

        // NOTE: the `if (blackList)` guard at Action.js:413 has no reachable false branch.
        // ValueObjectPermissions#ensureValueIsValid throws unless `blackList` is an object
        // with `grupos`/`usuarios` arrays, so any successfully-constructed `permissions`
        // value always has a truthy `blackList`. The only way `this.permissions.value` is
        // falsy is `permissions === null`, which is already handled by the early return at
        // line 403 (see "should return true if whiteList or blackList does not exist" above),
        // so line 413's negative branch is unreachable from the public API without bypassing
        // ValueObjectPermissions's own invariants.
    });
});

describe('Action constructor defaults', () => {
    // Only action_type has no `??` fallback and no `nullable: true` at the Value Object
    // level, so it is the sole field that must be supplied explicitly here.
    const minimalFields = {
        id: uuidv4(),
        action_type: ActionTypes.ASIGNAR_ASESOR_EN_CURSO.value,
        created_at: new Date().toISOString(),
        created_by: uuidv4(),
    };

    it('defaults description to "default" when omitted', () => {
        const action = new Action({ ...minimalFields, conditions: {}, priority: 1, is_active: true });
        expect(action.description.value).toBe('default');
    });

    it('does not default description when an explicit value is provided', () => {
        const action = new Action({
            ...minimalFields,
            description: 'explicit description',
            conditions: {},
            priority: 1,
            is_active: true,
        });
        expect(action.description.value).toBe('explicit description');
    });

    it('defaults conditions to an empty object when omitted', () => {
        const action = new Action({ ...minimalFields, description: 'valid description', priority: 1, is_active: true });
        expect(action.conditions.value).toEqual({});
    });

    it('does not default conditions when an explicit value is provided', () => {
        const explicitConditions = { combinator: 'and', rules: [] };
        const action = new Action({
            ...minimalFields,
            description: 'valid description',
            conditions: explicitConditions,
            priority: 1,
            is_active: true,
        });
        expect(action.conditions.value).toEqual(explicitConditions);
    });

    it('defaults priority to 1 when omitted', () => {
        const action = new Action({
            ...minimalFields,
            description: 'valid description',
            conditions: {},
            is_active: true,
        });
        expect(action.priority.value).toBe(1);
    });

    it('does not default priority when an explicit value is provided', () => {
        const action = new Action({
            ...minimalFields,
            description: 'valid description',
            conditions: {},
            priority: 42,
            is_active: true,
        });
        expect(action.priority.value).toBe(42);
    });

    it('defaults is_active to false when omitted', () => {
        const action = new Action({ ...minimalFields, description: 'valid description', conditions: {}, priority: 1 });
        expect(action.is_active.value).toBe(false);
    });

    it('does not default is_active when an explicit value is provided', () => {
        const action = new Action({
            ...minimalFields,
            description: 'valid description',
            conditions: {},
            priority: 1,
            is_active: true,
        });
        expect(action.is_active.value).toBe(true);
    });
});

describe('Action setters branch coverage', () => {
    // Every mutable field on Action follows the same guarded-setter pattern:
    //   set field(value) { if (this.#field.value !== value) { ...replace + track change... } }
    // Each row below is exercised twice: once assigning a genuinely different value
    // (the "change" branch) and once re-assigning the field's own current value
    // (the "no-op" branch, which must leave changedAttributes untouched).
    const fullDto = () => ({
        ...ActionMother.dto(),
        action_type: ActionTypes.ASIGNAR_ASESOR_EN_CURSO.value,
        conditions: { combinator: 'and', rules: [] },
        triggers: ['crear_caso'],
        permissions: {
            whiteList: { usuarios: [] },
            blackList: { usuarios: [], grupos: [] },
        },
        state_id: uuidv4(),
        group_id: uuidv4(),
        responsible_id: uuidv4(),
        template_id: uuidv4(),
        mail_account_id: uuidv4(),
        advisor_list_id: uuidv4(),
        group_list_id: uuidv4(),
        ws_rest_flow_id: uuidv4(),
        model_update_id: uuidv4(),
        external_group_code: 'EXT-GROUP-100',
        external_user_code: 'EXT-USER-100',
        external_group_dynamic_code: 'EXT-GROUP-DYN-100',
        external_user_dynamic_code: 'EXT-USER-DYN-100',
        automation_id: uuidv4(),
        entity: 'case',
    });

    const mutableFields = [
        ['action_type', ActionTypes.ASIGNAR_GRUPO_EN_CURSO.value],
        ['conditions', { combinator: 'or', rules: [] }],
        ['triggers', ['editar_caso', 'cambio_estado']],
        ['permissions', { whiteList: { usuarios: [uuidv4()] }, blackList: { usuarios: [], grupos: [] } }],
        ['state_id', uuidv4()],
        ['group_id', uuidv4()],
        ['responsible_id', uuidv4()],
        ['template_id', uuidv4()],
        ['mail_account_id', uuidv4()],
        ['advisor_list_id', uuidv4()],
        ['group_list_id', uuidv4()],
        ['ws_rest_flow_id', uuidv4()],
        ['model_update_id', uuidv4()],
        ['external_group_code', 'EXT-GROUP-200'],
        ['external_user_code', 'EXT-USER-200'],
        ['external_group_dynamic_code', 'EXT-GROUP-DYN-200'],
        ['external_user_dynamic_code', 'EXT-USER-DYN-200'],
        ['automation_id', uuidv4()],
        ['entity', 'group'],
    ];

    it.each(mutableFields)('marks "%s" as changed when a different value is assigned', (field, newValue) => {
        const action = Action.create(fullDto());

        action[field] = newValue;

        // `triggers` is the sole setter that records changedAttributes as a JSON string
        // instead of the raw value (see Action.js `set triggers`).
        const expectedChangedAttribute = field === 'triggers' ? JSON.stringify(newValue) : newValue;
        expect(action.changedAttributes[field]).toEqual(expectedChangedAttribute);
        expect(action[field].value).toEqual(newValue);
    });

    it.each(mutableFields)('does not mark "%s" as changed when the current value is re-assigned', (field) => {
        const action = Action.create(fullDto());

        action[field] = action[field].value;

        expect(action.changedAttributes).toEqual({});
    });
});

describe('Action Response Tests', () => {
    it('converts Action object to JSON representation', () => {
        const dto = ActionMother.dto();
        const action = Action.create(dto);
        const actionResponse = new ActionResponse(action);

        const json = actionResponse.toJson();

        expect(json).toEqual({
            data: {
                ...dto,
                updated_at: null,
                updated_by: undefined,
            },
        });
    });

    it('returns an empty object if Action is not provided', () => {
        const actionResponse = new ActionResponse(null);
        expect(actionResponse.toJson()).toEqual({});
    });
});

describe('Action Collection Response Tests', () => {
    it('converts Action collection to JSON representation', () => {
        const actionCollection = [Action.create(ActionMother.dto()), Action.create(ActionMother.dto())];
        const actionCollectionResponse = new ActionCollectionResponse(actionCollection, actionCollection.length);

        const json = actionCollectionResponse.toJson();

        expect(json).toEqual({
            data: {
                items: actionCollection.map((action) => new ActionResponse(action).toJson().data),
            },
            metadata: {
                count: actionCollection.length,
            },
        });
    });
});

describe('ActionTypes', () => {
    test('should create action types correctly', () => {
        expect(ActionTypes.ASIGNAR_ASESOR_EN_CURSO).toEqual({
            key: 'ASIGNAR_ASESOR_EN_CURSO',
            value: 'asignar_asesor_en_curso',
        });
        expect(ActionTypes.ENVIO_CORREO).toEqual({
            key: 'ENVIO_CORREO',
            value: 'envio_correo',
        });
    });

    test('should throw error for invalid value in constructor', () => {
        expect(() => new ActionTypes('INVALID', 'invalid_value')).toThrow(
            'The value must be a valid Type: invalid_value'
        );
    });

    test('should return action type from value', () => {
        const actionType = ActionTypes.fromValue('asignar_grupo_en_curso');
        expect(actionType).toBe(ActionTypes.ASIGNAR_GRUPO_EN_CURSO);
    });

    test('should throw error for invalid value in fromValue method', () => {
        expect(() => ActionTypes.fromValue('invalid_value')).toThrow('Invalid value: invalid_value');
    });

    test('should convert action types to JSON', () => {
        const expectedJson = {
            ASIGNAR_ASESOR_EN_CURSO: 'asignar_asesor_en_curso',
            ASIGNAR_LISTA_ASESORES: 'asignar_lista_asesores',
            ASIGNAR_GRUPO_EN_CURSO: 'asignar_grupo_en_curso',
            ASIGNAR_LISTA_GRUPOS: 'asignar_lista_grupos',
            ASIGNAR_GRUPO_POR_CODIGO_EXTERNO: 'asignar_grupo_por_codigo_externo',
            ASIGNAR_USUARIO_POR_CODIGO_EXTERNO: 'asignar_usuario_por_codigo_externo',
            ASIGNAR_GRUPO_POR_CODIGO_EXTERNO_DINAMICO: 'asignar_grupo_por_codigo_externo_dinamico',
            ASIGNAR_USUARIO_POR_CODIGO_EXTERNO_DINAMICO: 'asignar_usuario_por_codigo_externo_dinamico',
            ENVIO_CORREO: 'envio_correo',
            CONSUMO_REST_FLOW: 'consumo_rest_flow',
            ACTUALIZAR_MODELO: 'actualizar_modelo',
        };

        expect(ActionTypes.toJson()).toEqual(expectedJson);
    });
});

describe('ActionTypeValidator', () => {
    const createAction = (type, fields) => {
        return new Action({
            id: uuidv4(),
            description: 'Test',
            action_type: type,
            conditions: {},
            ...fields,
            priority: 99,
            created_at: new Date(),
            created_by: uuidv4(),
            is_active: true,
        });
    };

    it('validates ASIGNAR_ASESOR_EN_CURSO action correctly and handles errors', () => {
        let action = createAction(ActionTypes.ASIGNAR_ASESOR_EN_CURSO.value, { responsible_id: uuidv4() });
        expect(() => ActionTypeValidator.validate(action)).not.toThrow();

        action = createAction(ActionTypes.ASIGNAR_ASESOR_EN_CURSO.value, {});
        expect(() => ActionTypeValidator.validate(action)).toThrow(ActionValidationError);

        action = createAction(ActionTypes.ASIGNAR_ASESOR_EN_CURSO.value, {
            responsible_id: uuidv4(),
            group_id: uuidv4(),
        });
        expect(() => ActionTypeValidator.validate(action)).toThrow(ActionValidationError);
    });

    it('validates ASIGNAR_LISTA_ASESORES action correctly and handles errors', () => {
        let action = createAction(ActionTypes.ASIGNAR_LISTA_ASESORES.value, { advisor_list_id: uuidv4() });
        expect(() => ActionTypeValidator.validate(action)).not.toThrow();

        action = createAction(ActionTypes.ASIGNAR_LISTA_ASESORES.value, {});
        expect(() => ActionTypeValidator.validate(action)).toThrow(ActionValidationError);

        action = createAction(ActionTypes.ASIGNAR_LISTA_ASESORES.value, {
            advisor_list_id: uuidv4(),
            group_id: uuidv4(),
        });
        expect(() => ActionTypeValidator.validate(action)).toThrow(ActionValidationError);
    });

    it('validates ASIGNAR_GRUPO_EN_CURSO action correctly and handles errors', () => {
        let action = createAction(ActionTypes.ASIGNAR_GRUPO_EN_CURSO.value, { group_id: uuidv4() });
        expect(() => ActionTypeValidator.validate(action)).not.toThrow();

        action = createAction(ActionTypes.ASIGNAR_GRUPO_EN_CURSO.value, {});
        expect(() => ActionTypeValidator.validate(action)).toThrow(ActionValidationError);

        action = createAction(ActionTypes.ASIGNAR_GRUPO_EN_CURSO.value, {
            group_id: uuidv4(),
            responsible_id: uuidv4(),
        });
        expect(() => ActionTypeValidator.validate(action)).toThrow(ActionValidationError);
    });

    it('validates ASIGNAR_LISTA_GRUPOS action correctly and handles errors', () => {
        let action = createAction(ActionTypes.ASIGNAR_LISTA_GRUPOS.value, { group_list_id: uuidv4() });
        expect(() => ActionTypeValidator.validate(action)).not.toThrow();

        action = createAction(ActionTypes.ASIGNAR_LISTA_GRUPOS.value, {});
        expect(() => ActionTypeValidator.validate(action)).toThrow(ActionValidationError);

        action = createAction(ActionTypes.ASIGNAR_LISTA_GRUPOS.value, {
            group_list_id: uuidv4(),
            responsible_id: uuidv4(),
        });
        expect(() => ActionTypeValidator.validate(action)).toThrow(ActionValidationError);
    });

    it('validates ENVIO_CORREO action correctly and handles errors', () => {
        let action = createAction(ActionTypes.ENVIO_CORREO.value, { mail_account_id: uuidv4(), template_id: uuidv4() });
        expect(() => ActionTypeValidator.validate(action)).not.toThrow();

        action = createAction(ActionTypes.ENVIO_CORREO.value, { mail_account_id: uuidv4() });
        expect(() => ActionTypeValidator.validate(action)).toThrow(ActionValidationError);

        action = createAction(ActionTypes.ENVIO_CORREO.value, {
            mail_account_id: uuidv4(),
            template_id: uuidv4(),
            responsible_id: uuidv4(),
        });
        expect(() => ActionTypeValidator.validate(action)).toThrow(ActionValidationError);
    });

    it('validates ACTUALIZAR_MODELO action correctly and handles errors', () => {
        let action = createAction(ActionTypes.ACTUALIZAR_MODELO.value, { model_update_id: uuidv4() });
        expect(() => ActionTypeValidator.validate(action)).not.toThrow();

        action = createAction(ActionTypes.ACTUALIZAR_MODELO.value, {});
        expect(() => ActionTypeValidator.validate(action)).toThrow(ActionValidationError);

        action = createAction(ActionTypes.ACTUALIZAR_MODELO.value, { model_update_id: uuidv4(), group_id: uuidv4() });
        expect(() => ActionTypeValidator.validate(action)).toThrow(ActionValidationError);
    });

    it('validates ASIGNAR_GRUPO_POR_CODIGO_EXTERNO action correctly and handles errors', () => {
        let action = createAction(ActionTypes.ASIGNAR_GRUPO_POR_CODIGO_EXTERNO.value, {
            external_group_code: 'groupCode',
        });
        expect(() => ActionTypeValidator.validate(action)).not.toThrow();

        action = createAction(ActionTypes.ASIGNAR_GRUPO_POR_CODIGO_EXTERNO.value, {});
        expect(() => ActionTypeValidator.validate(action)).toThrow(ActionValidationError);

        action = createAction(ActionTypes.ASIGNAR_GRUPO_POR_CODIGO_EXTERNO.value, {
            external_group_code: 'groupCode',
            responsible_id: uuidv4(),
        });
        expect(() => ActionTypeValidator.validate(action)).toThrow(ActionValidationError);
    });

    it('validates ASIGNAR_USUARIO_POR_CODIGO_EXTERNO action correctly and handles errors', () => {
        let action = createAction(ActionTypes.ASIGNAR_USUARIO_POR_CODIGO_EXTERNO.value, {
            external_user_code: 'userCode',
        });
        expect(() => ActionTypeValidator.validate(action)).not.toThrow();

        action = createAction(ActionTypes.ASIGNAR_USUARIO_POR_CODIGO_EXTERNO.value, {});
        expect(() => ActionTypeValidator.validate(action)).toThrow(ActionValidationError);

        action = createAction(ActionTypes.ASIGNAR_USUARIO_POR_CODIGO_EXTERNO.value, {
            external_user_code: 'userCode',
            responsible_id: uuidv4(),
        });
        expect(() => ActionTypeValidator.validate(action)).toThrow(ActionValidationError);
    });

    it('validates CONSUMO_REST_FLOW action correctly and handles errors', () => {
        let action = createAction(ActionTypes.CONSUMO_REST_FLOW.value, { ws_rest_flow_id: uuidv4() });
        expect(() => ActionTypeValidator.validate(action)).not.toThrow();

        action = createAction(ActionTypes.CONSUMO_REST_FLOW.value, {});
        expect(() => ActionTypeValidator.validate(action)).toThrow(ActionValidationError);

        action = createAction(ActionTypes.CONSUMO_REST_FLOW.value, {
            ws_rest_flow_id: uuidv4(),
            responsible_id: uuidv4(),
        });
        expect(() => ActionTypeValidator.validate(action)).toThrow(ActionValidationError);
    });
});

describe('ValueObjectActionType Tests', () => {
    it('should create an instance with a valid value', () => {
        const validValue = ActionTypes.ASIGNAR_ASESOR_EN_CURSO.value;
        const actionType = new ValueObjectActionType('field', validValue);

        expect(actionType).toBeInstanceOf(ValueObjectActionType);
        expect(actionType.value).toBe(validValue);
        expect(actionType.field).toBe('field');
    });

    it('should throw an error if the value is null, undefined, or empty', () => {
        const invalidValues = [null, undefined, ''];

        invalidValues.forEach((value) => {
            expect(() => new ValueObjectActionType('field', value)).toThrow('The value cannot be null');
        });
    });

    it('should not throw and should expose a null value when the value is null and nullable is true', () => {
        const actionType = new ValueObjectActionType('field', null, true);
        expect(actionType.value).toBeNull();
    });

    it('should be immutable', () => {
        const actionType = new ValueObjectActionType('field', ActionTypes.ASIGNAR_ASESOR_EN_CURSO.value);

        expect(() => {
            actionType.value = 'newValue';
        }).toThrow();
    });
});

describe('ValueObjectPriority Tests', () => {
    it('should create an instance with valid value', () => {
        const validValue = 1;
        const valueObject = new ValueObjectPriority('priority', validValue);
        expect(valueObject).toBeInstanceOf(ValueObjectPriority);
    });

    it('should throw an error if the value is null, undefined, or empty', () => {
        const invalidValues = [null, undefined, ''];

        invalidValues.forEach((value) => {
            expect(() => new ValueObjectPriority('priority', value)).toThrow('The value cannot be null');
        });
    });

    it('should throw an error if the priority is not a number', () => {
        const invalidValue = 'not-a-number';
        expect(() => new ValueObjectPriority('priority', invalidValue)).toThrow(
            'priority: The value must be an integer'
        );
    });

    it('should not throw an error if the priority is a valid number', () => {
        const validValue = 1;
        expect(() => new ValueObjectPriority('priority', validValue)).not.toThrow();
    });

    it('should not throw and skip Guards validation when the value is null/undefined and nullable is true', () => {
        expect(() => new ValueObjectPriority('priority', null, true)).not.toThrow();
        expect(() => new ValueObjectPriority('priority', undefined, true)).not.toThrow();
        // `super(field, +value)` runs before the nullable early-return, so the underlying
        // value is `+null` (0), not `null` itself — asserting this (rather than just
        // "does not throw") is what actually distinguishes this branch from a guard that
        // silently swallows an out-of-range value like 0.
        expect(new ValueObjectPriority('priority', null, true).value).toBe(0);
    });
});

describe('ValueObjectTriggers Tests', () => {
    it('should create an instance with a valid value (array of valid triggers)', () => {
        const validValue = [ActionTriggers.CREATE_CASE.value];
        const field = 'fieldName';
        const valueObject = new ValueObjectTriggers(field, validValue);

        expect(valueObject).toBeInstanceOf(ValueObjectTriggers);
        expect(valueObject.value).toEqual(validValue);
        expect(valueObject.field).toBe(field);
    });

    it('should throw an error if the value is null and nullable is false', () => {
        const invalidValue = null;
        const field = 'fieldName';

        expect(() => new ValueObjectTriggers(field, invalidValue, false)).toThrow(`${field}: The value cannot be null`);
    });

    it('should not throw an error if the value is null and nullable is true', () => {
        const invalidValue = null;
        const field = 'fieldName';

        expect(() => new ValueObjectTriggers(field, invalidValue, true)).not.toThrow();
    });

    it('should be immutable', () => {
        const validValue = [ActionTriggers.CREATE_CASE.value];
        const field = 'fieldName';
        const valueObject = new ValueObjectTriggers(field, validValue);

        expect(() => {
            valueObject.value = ['newValue'];
        }).toThrow();
    });

    it('should return null if value is not set and nullable is true', () => {
        const field = 'fieldName';
        const valueObject = new ValueObjectTriggers(field, null, true);

        expect(valueObject.value).toBeNull();
    });

    it('should throw an error if the value is an invalid trigger according to ActionTriggers', () => {
        const invalidValue = ['invalidTrigger'];
        const field = 'fieldName';

        expect(() => new ValueObjectTriggers(field, invalidValue)).toThrow('Invalid trigger value');
    });

    it('should throw an error if the value is not an array', () => {
        const invalidValue = 'stringTrigger';
        const field = 'fieldName';

        expect(() => new ValueObjectTriggers(field, invalidValue)).toThrow(
            new InvalidArgumentError(`${field}: The value must be an array`)
        );
    });

    it('should throw an error if any element in the array is invalid according to ActionTriggers', () => {
        const invalidValue = ['invalidTrigger'];
        const field = 'fieldName';

        expect(() => new ValueObjectTriggers(field, invalidValue)).toThrow('Invalid trigger value');
    });
});

describe('ValueObjectEntity Tests', () => {
    it('entity value must be a valid entity value', () => {
        const validValue = 'case';
        const valueObject = new ValueObjectEntity('entity', validValue);
        expect(valueObject.value).toBe(validValue);
    });

    it('should not throw and should expose a null value when the value is null and nullable is true', () => {
        const valueObject = new ValueObjectEntity('entity', null, true);
        expect(valueObject.value).toBeNull();
    });

    it('should throw an error if the value is null and nullable is false', () => {
        expect(() => new ValueObjectEntity('entity', null)).toThrow('entity: The value cannot be null');
    });

    it('should throw an error if the value is not a string', () => {
        const invalidValues = [1, true, new Date()];

        invalidValues.forEach((value) => {
            expect(() => new ValueObjectEntity('entity', value)).toThrow('entity: The value must be a string');
        });
    });

    it('should throw an error if the value is not a valid entity', () => {
        const invalidValue = 'invalid-entity';
        expect(() => new ValueObjectEntity('entity', invalidValue)).toThrow(`${invalidValue} isn't a valid entity`);
    });
});

describe('ValueObjectPermissions Tests', () => {
    const validPermissions = {
        whiteList: { usuarios: [uuidv4()] },
        blackList: { grupos: [uuidv4()], usuarios: [uuidv4()] },
    };

    it('should create a valid instance', () => {
        const vo = new ValueObjectPermissions('permissions', validPermissions);
        expect(vo.value).toEqual(validPermissions);
    });

    it('should throw an error if the value is null and not nullable', () => {
        expect(() => new ValueObjectPermissions('permissions', null)).toThrow('permissions: The value cannot be null');
    });

    it('should not throw and leave value null if the value is null and nullable', () => {
        const vo = new ValueObjectPermissions('permissions', null, true);
        expect(vo.value).toBeNull();
    });

    it('should throw an error if blackList or whiteList are not objects', () => {
        expect(
            () => new ValueObjectPermissions('permissions', { ...validPermissions, whiteList: 'not-an-object' })
        ).toThrow('permissions: blackList and whiteList must be objects');

        expect(
            () => new ValueObjectPermissions('permissions', { ...validPermissions, blackList: 'not-an-object' })
        ).toThrow('permissions: blackList and whiteList must be objects');
    });

    it('should throw an error if blackList.grupos or blackList.usuarios are not arrays', () => {
        expect(
            () =>
                new ValueObjectPermissions('permissions', {
                    ...validPermissions,
                    blackList: { grupos: 'not-an-array', usuarios: [] },
                })
        ).toThrow('permissions: blackList.grupos and blackList.usuarios must be arrays');

        expect(
            () =>
                new ValueObjectPermissions('permissions', {
                    ...validPermissions,
                    blackList: { grupos: [], usuarios: 'not-an-array' },
                })
        ).toThrow('permissions: blackList.grupos and blackList.usuarios must be arrays');
    });

    it('should throw an error if whiteList.usuarios is not an array', () => {
        expect(
            () =>
                new ValueObjectPermissions('permissions', {
                    ...validPermissions,
                    whiteList: { usuarios: 'not-an-array' },
                })
        ).toThrow('permissions: whiteList.usuarios must be an array');
    });

    it('should throw an error if blackList.grupos contains an invalid UUID', () => {
        expect(
            () =>
                new ValueObjectPermissions('permissions', {
                    ...validPermissions,
                    blackList: { grupos: ['not-a-uuid'], usuarios: [] },
                })
        ).toThrow('blackList.grupos: not-a-uuid is not a valid UUID');
    });

    it('should throw an error if blackList.usuarios contains an invalid UUID', () => {
        expect(
            () =>
                new ValueObjectPermissions('permissions', {
                    ...validPermissions,
                    blackList: { grupos: [], usuarios: ['not-a-uuid'] },
                })
        ).toThrow('blackList.usuarios: not-a-uuid is not a valid UUID');
    });

    it('should throw an error if whiteList.usuarios contains an invalid UUID', () => {
        expect(
            () =>
                new ValueObjectPermissions('permissions', {
                    ...validPermissions,
                    whiteList: { usuarios: ['not-a-uuid'] },
                })
        ).toThrow('whiteList.usuarios: not-a-uuid is not a valid UUID');
    });
});
