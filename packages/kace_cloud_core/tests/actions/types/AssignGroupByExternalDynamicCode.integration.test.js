import { jest } from '@jest/globals';
import { Action } from '../../../src/actions/index.js';
import { KnexGroupsRepository } from '../../../src/grupos/index.js';
import { KnexCaseRepository } from '../../../src/cases/index.js';
import { KnexUsersRepository } from '../../../src/users/index.js';
import { KnexClassificationRepository } from '../../../src/classifications/index.js';
import ActionMother from '../../actions/domain/ActionMother.js';
import CasesMother from '../../cases/domain/CasesMother.js';
import { GroupsMother } from '../../grupos/domain/GroupsMother.js';
import ClassificationsMother from '../../classifications/domain/ClassificationsMother.js';
import { StatusEnum } from '../../../src/shared/domain/enum/StatusEnum.js';
import { AuxCasesMother } from '../../aux_casos/domain/AuxCasesMother.js';
import { v4 as uuidv4 } from 'uuid';
import { KnexAuxCasesRepository } from '../../../src/aux_casos/index.js';
import { AssignGroupByExternalDynamicCode } from '../../../src/actions/domain/types/AssignGroupByExternalDynamicCode.js';
import { knexConfig } from '../../knexfile.js';
import { ensureParentRow } from '../../support/ensureParentRow.js';

describe('Integration tests for AssignGroupByExternalDynamicCode', () => {
    let trx,
        caseRepository,
        userRepository,
        groupRepository,
        classificationRepository,
        auxCaseRepository,
        assignGroupByExternalDynamicCode;
    // El servicio real devuelve el id de un asesor que YA existe; el mock devolvia un
    // uuid nuevo por llamada que acaba escrito en `cases.responsable_id`, y postgres
    // exige que ese usuario exista. El asesor se siembra en el `beforeEach` de abajo y
    // no dentro del doble: el `AssignationService` real no toca la base para responder,
    // asi que meterle I/O al stub lo aleja del colaborador que imita.
    const assignedAdvisorId = uuidv4();
    const assignationServiceMock = { execute: jest.fn(async (grupo) => (grupo ? assignedAdvisorId : null)) };

    /** The group the action picked, i.e. what it handed to the assignation service. */
    const selectedGroupId = () => assignationServiceMock.execute.mock.calls.at(-1)?.[0] ?? null;

    beforeEach(async () => {
        assignationServiceMock.execute.mockClear();
        trx = await knexConfig.transaction();
        const trxInstance = () => trx;

        caseRepository = new KnexCaseRepository(trxInstance());
        userRepository = new KnexUsersRepository(trxInstance());
        groupRepository = new KnexGroupsRepository(trxInstance());
        classificationRepository = new KnexClassificationRepository(trxInstance());
        auxCaseRepository = new KnexAuxCasesRepository(trxInstance());

        assignGroupByExternalDynamicCode = new AssignGroupByExternalDynamicCode(
            caseRepository,
            userRepository,
            groupRepository,
            classificationRepository,
            assignationServiceMock,
            auxCaseRepository
        );

        // El asesor que el doble devuelve tiene que existir antes de que la accion lo
        // escriba en `cases.responsable_id`. Va dentro de la transaccion del test para
        // que el rollback de `afterEach` lo deshaga, y en un `beforeEach` porque el
        // reset a la plantilla borraria lo que sembrase un `beforeAll`.
        await ensureParentRow(trx, 'usuarios', assignedAdvisorId);
    });

    afterEach(async () => {
        await trx.rollback();
    });

    it('should return false if caseEntity is not an instance of Case', async () => {
        const action = Action.create(ActionMother.dto({ external_group_dynamic_code: 'a.b.code' }));
        const result = await assignGroupByExternalDynamicCode.execute({}, action);
        expect(result).toBe(false);
    });

    it('should return false if action is not an instance of Action', async () => {
        const caseEntity = await CasesMother.createCase(caseRepository);
        const result = await assignGroupByExternalDynamicCode.execute(caseEntity, {});
        expect(result).toBe(false);
    });

    it('should return false if aux case is not found or data is null', async () => {
        const caseEntity = await CasesMother.createCase(caseRepository);
        const action = Action.create(
            ActionMother.dto({
                external_group_dynamic_code: 'a.b.code',
            })
        );

        const result = await assignGroupByExternalDynamicCode.execute(caseEntity, action);
        expect(result).toBe(false);
    });

    it('should return false if the external group code path is invalid or not found', async () => {
        const caseEntity = await CasesMother.createCase(caseRepository);
        await AuxCasesMother.createAuxCase(auxCaseRepository, {
            caso_id: caseEntity.id.value,
            data: { x: { y: { z: 'NO_MATCH' } } },
        });

        const action = Action.create(
            ActionMother.dto({
                external_group_dynamic_code: 'a.b.code',
            })
        );

        const result = await assignGroupByExternalDynamicCode.execute(caseEntity, action);
        expect(result).toBe(false);
    });

    it('should assign a group based on dynamic external code from aux case data', async () => {
        const group = await GroupsMother.createRandomGroup(groupRepository, null, {
            codigo_externo: 'MATCH_CODE',
        });

        const caseEntity = await CasesMother.createCase(caseRepository);
        const auxData = {
            a: {
                b: {
                    code: 'MATCH_CODE',
                },
            },
        };

        await AuxCasesMother.createAuxCase(auxCaseRepository, {
            caso_id: caseEntity.id.value,
            data: auxData,
        });

        const action = Action.create(
            ActionMother.dto({
                external_group_dynamic_code: 'a.b.code',
            })
        );

        const result = await assignGroupByExternalDynamicCode.execute(caseEntity, action);
        expect(result).toBe(true);

        const updatedCase = await caseRepository
            .connection(caseRepository.tableName)
            .select('*')
            .where('id', caseEntity.id.value)
            .first();

        expect(updatedCase.grupo_id).toBe(group.id.value);
        expect(updatedCase.responsable_id).toBeDefined();
    });

    it('should not assign an inactive group, falling back to the classification default group', async () => {
        const inactiveGroup = await GroupsMother.createRandomGroup(groupRepository, null, {
            codigo_externo: 'INACTIVE_CODE',
            status: StatusEnum.INACTIVE.value,
        });
        const defaultGroup = await GroupsMother.createRandomGroup(groupRepository);
        const classification = await ClassificationsMother.create(classificationRepository, {
            default_group_id: defaultGroup.id.value,
        });

        const caseEntity = await CasesMother.createCase(caseRepository, {
            clasificacion_id: classification.id.value,
        });
        await AuxCasesMother.createAuxCase(auxCaseRepository, {
            caso_id: caseEntity.id.value,
            data: { a: { b: { code: 'INACTIVE_CODE' } } },
        });

        const action = Action.create(ActionMother.dto({ external_group_dynamic_code: 'a.b.code' }));

        await assignGroupByExternalDynamicCode.execute(caseEntity, action);

        expect(selectedGroupId()).not.toBe(inactiveGroup.id.value);
        expect(selectedGroupId()).toBe(defaultGroup.id.value);
    });

    it('should return false when the classification default group is also inactive', async () => {
        const defaultGroup = await GroupsMother.createRandomGroup(groupRepository, null, {
            status: StatusEnum.INACTIVE.value,
        });
        const classification = await ClassificationsMother.create(classificationRepository, {
            default_group_id: defaultGroup.id.value,
        });

        const caseEntity = await CasesMother.createCase(caseRepository, {
            clasificacion_id: classification.id.value,
        });
        await AuxCasesMother.createAuxCase(auxCaseRepository, {
            caso_id: caseEntity.id.value,
            data: { a: { b: { code: 'NO_GROUP_HAS_THIS_CODE' } } },
        });

        const action = Action.create(ActionMother.dto({ external_group_dynamic_code: 'a.b.code' }));

        const result = await assignGroupByExternalDynamicCode.execute(caseEntity, action);
        expect(result).toBe(false);
        // The action bails out before ever handing the inactive default group over.
        expect(assignationServiceMock.execute).not.toHaveBeenCalled();
    });

    it('should log an event when group is assigned by AssignGroupByExternalDynamicCode', async () => {
        const externalCodePath = 'a.b.code';
        const codeValue = 'DYNAMIC_MATCH';

        const group = await GroupsMother.createRandomGroup(groupRepository, null, {
            codigo_externo: codeValue,
        });

        const kase = await CasesMother.createCase(caseRepository);
        kase.updated_by = uuidv4();

        const auxData = {
            a: {
                b: {
                    code: codeValue,
                },
            },
        };

        await AuxCasesMother.createAuxCase(auxCaseRepository, {
            caso_id: kase.id.value,
            data: auxData,
        });

        const originalValues = kase.toJson();
        const mockTrigger = 'cron_job';
        const action = Action.create(ActionMother.dto({ external_group_dynamic_code: externalCodePath }));

        const result = await assignGroupByExternalDynamicCode.execute(kase, action, mockTrigger);
        expect(result).toBe(true);

        const eventLog = await caseRepository
            .connection('event_logs')
            .select('*')
            .where({ aggregate_id: action.id.value, event_name: 'action.executed' })
            .first();

        expect(eventLog).toBeDefined();

        const body = eventLog.body;
        expect(body).toBeDefined();
        expect(body.description).toBe(action.description.value);
        expect(body.actionType).toBe(AssignGroupByExternalDynamicCode.ACTION_TYPE);
        expect(body.trigger).toBe(mockTrigger);
        expect(body.success).toBe(true);
        expect(body.grupo_id).toBe(group.id.value);
        expect(body.transicion_id).toBe(kase.transicion_id.value);
        expect(body.state).toBeDefined();

        const oldData = eventLog.old_data;
        expect(oldData).toBeDefined();
        expect(oldData.grupo_id).toBe(originalValues.grupo_id);
        expect(oldData.transicion_id).toBe(originalValues.transicion_id);
        expect(oldData.responsable_id).toBe(originalValues.responsable_id);
        expect(oldData.state).toBeDefined();
    });
});
