import { v4 as uuidv4 } from 'uuid';

import { Policy } from '../../src/policies/domain/Policy';
import { PoliciesMother } from './domain/PoliciesMother';
import { PolicyResponse } from '../../src/policies/application/PolicyResponse';
import { PolicyCollectionResponse } from '../../src/policies/application/PolicyCollectionResponse';
import { ActionsEnum } from '../../src/policies/domain/ActionsEnum';
import { OperationsEnum } from '../../src/policies/domain/OperationsEnum';

describe('Unit test for Policies', () => {
    test('Can create a Policie instance', () => {
        const dto = PoliciesMother.dto();
        const policy = new Policy(dto);

        expect(policy).toBeInstanceOf(Policy);
    });

    test('Can update a policy', () => {
        const dto = PoliciesMother.dto();
        const policy = new Policy(dto);

        policy.update({
            effect: 'deny',
            title: 'Test Updated',
            provider: 'UI-ADMIN',
            operations: ['read'],
            actions: ['flows'],
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
        });

        expect(policy).toBeInstanceOf(Policy);
        expect(policy.changedAttributes).not.toBeNull;
        expect(policy.changedAttributes.effect).toBe('deny');
        expect(policy.changedAttributes.title).toBe('Test Updated');
        expect(policy.changedAttributes.provider).toBe('UI-ADMIN');
    });

    test('does not update properties when values are the same', () => {
        const dto = PoliciesMother.dto();
        const policies = Policy.create(dto);

        policies.update(dto);

        expect(policies.changedAttributes).toEqual({});
    });

    it('marks a Policy instance as deleted', () => {
        const dto = PoliciesMother.dto();
        const policy = Policy.create(dto);
        const deleteDto = {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidv4(),
        };
        policy.delete(deleteDto);

        expect(policy.deleted_at.value).toEqual(deleteDto.deleted_at);
        expect(policy.deleted_by.value).toEqual(deleteDto.deleted_by);
    });

    test('keep as unmark deleted fields', () => {
        const dto = PoliciesMother.dto();
        const policy = Policy.create(dto);
        const deleteDto = {
            deleted_at: null,
            deleted_by: null,
        };
        policy.delete(deleteDto);

        expect(policy.deleted_at.value).toBeNull();
        expect(policy.deleted_by.value).toBeNull();
    });

    test('cannot create a Policy instance with not valid Action', () => {
        const dto = PoliciesMother.dto();
        dto.actions = ['invalid-action'];
        expect(() => Policy.create(dto)).toThrow('Invalid value for action');
    });

    test('cannot create a Policy instance with not valid Operation', () => {
        const dto = PoliciesMother.dto();
        dto.operations = ['invalid-operation'];
        expect(() => Policy.create(dto)).toThrow('Invalid value for operation');
    });

    test('cannot create a Policy instance with a null action', () => {
        const dto = PoliciesMother.dto();
        dto.actions = null;
        expect(() => Policy.create(dto)).toThrow('Invalid value for action');
    });

    test('flushes changes in Policy instance', () => {
        const dto = PoliciesMother.dto();
        const policy = Policy.create(dto);
        const updateDto = {
            provider: 'UI-ADMIN',
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
        };
        policy.update(updateDto);
        policy.flushChanges();

        expect(policy.changedAttributes).toEqual({});
    });
});

describe('Policy Responses Tests', () => {
    it('converts Policy object to JSON representation', () => {
        const policy = new Policy(PoliciesMother.dto());
        const policyResponse = new PolicyResponse(policy);

        const json = policyResponse.toJson();

        expect(json).toMatchObject({
            data: {
                id: policy.id.value,
                title: policy.title.value,
                provider: policy.provider.value,
                effect: policy.effect.value,
                operations: policy.operations.value,
                actions: policy.actions.value,
                created_at: policy.created_at.value,
                created_by: policy.created_by.value,
                updated_at: policy.updated_at.value,
                updated_by: policy.updated_by.value,
            },
        });
    });

    it('converts Policy collection object to JSON representation', () => {
        const policies = [new Policy(PoliciesMother.dto()), new Policy(PoliciesMother.dto())];
        const policiesResponse = new PolicyCollectionResponse(policies, policies.length);

        const json = policiesResponse.toJson().data;

        expect(json.items).toEqual(policies.map((policy) => new PolicyResponse(policy).toJson().data));
    });

    it('converts Policy search collection object to JSON representation', () => {
        const policies = [new Policy(PoliciesMother.dto()), new Policy(PoliciesMother.dto())];
        const policiesResponse = new PolicyCollectionResponse(policies, policies.length);

        const json = policiesResponse.toJson();

        expect(json).toEqual({
            data: {
                items: policies.map((policy) => new PolicyResponse(policy).toJson().data),
            },
            metadata: {
                count: policies.length,
            },
        });
    });
});

describe('Test Actions enum', () => {
    test('Action is a ActionsEnum instance', () => {
        const action = ActionsEnum.fromValue(ActionsEnum.ALL.value);
        const actionResponsible = ActionsEnum.fromValue(ActionsEnum.EDITAR_ESTADOS_SIN_SER_RESPONSABLE_CASO.value);
        expect(action).toBeInstanceOf(ActionsEnum);
        expect(actionResponsible).toBeInstanceOf(ActionsEnum);
    });

    test('should return exception when invalid action is passed', () => {
        expect(() => ActionsEnum.fromValue('INVALID_ACTION')).toThrow('Invalid value: INVALID_ACTION');
    });
});

describe('Test Operatios enum', () => {
    test('Operation is a OpeartionsEnum instance', () => {
        const operation = OperationsEnum.fromValue(OperationsEnum.CRUD.value);
        const operationCreate = OperationsEnum.fromValue(OperationsEnum.CREATE.value);
        const operationRead = OperationsEnum.fromValue(OperationsEnum.READ.value);
        const operationUpdate = OperationsEnum.fromValue(OperationsEnum.UPDATE.value);
        const operationDelete = OperationsEnum.fromValue(OperationsEnum.DELETE.value);

        expect(operation).toBeInstanceOf(OperationsEnum);
        expect(operationCreate).toBeInstanceOf(OperationsEnum);
        expect(operationRead).toBeInstanceOf(OperationsEnum);
        expect(operationUpdate).toBeInstanceOf(OperationsEnum);
        expect(operationDelete).toBeInstanceOf(OperationsEnum);
    });

    test('should return exception when invalid operation is passed', () => {
        expect(() => OperationsEnum.fromValue('INVALID_OPERATION')).toThrow('Invalid value: INVALID_OPERATION');
    });
});
