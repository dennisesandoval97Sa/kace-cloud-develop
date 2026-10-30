import { jest } from '@jest/globals';
import { AssignGroupByExternalCodeCase } from '../../../src/actions/domain/types/AssignGroupByExternalCodeCase.js';
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
import { v4 as uuidv4 } from 'uuid';
import { knexConfig } from '../../knexfile.js';
import { ensureParentRow } from '../../support/ensureParentRow.js';

describe('Integration tests AssignGroupByExternalCodeCase', () => {
    let trx, caseRepository, userRepository, groupRepository, classificationRepository, assignGroupByExternalCodeCase;
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

        assignGroupByExternalCodeCase = new AssignGroupByExternalCodeCase(
            caseRepository,
            userRepository,
            groupRepository,
            classificationRepository,
            assignationServiceMock
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

    it('should return false if no group is found with the given external_group_code', async () => {
        const validCase = await CasesMother.createCase(caseRepository);
        const validAction = Action.create(ActionMother.dto({ external_group_code: 'non_existing_code' }));

        const result = await assignGroupByExternalCodeCase.execute(validCase, validAction);

        expect(result).toBe(false);
    });

    it('should update case with found group and return true', async () => {
        const group = await GroupsMother.createRandomGroup(groupRepository);
        group.codigos_externos = { test_group_code: 'test_group_code' };
        await groupRepository.update(group);

        const validCase = await CasesMother.createCase(caseRepository);
        const validAction = Action.create(ActionMother.dto({ external_group_code: 'test_group_code' }));

        const result = await assignGroupByExternalCodeCase.execute(validCase, validAction);
        expect(result).toBe(true);

        const updatedCase = await caseRepository
            .connection(caseRepository.tableName)
            .select('*')
            .where('id', validCase.id.value)
            .first();

        expect(updatedCase.grupo_id).toBe(group.id.value);
    });

    it('should assign default group from classification if no group found with external code', async () => {
        const defaultGroup = await GroupsMother.createRandomGroup(groupRepository);
        const classification = await ClassificationsMother.create(classificationRepository, {
            default_group_id: defaultGroup.id.value,
        });

        const validCase = await CasesMother.createCase(caseRepository, { clasificacion_id: classification.id.value });
        const validAction = Action.create(ActionMother.dto({ external_group_code: 'non_existing_code' }));

        const result = await assignGroupByExternalCodeCase.execute(validCase, validAction);

        expect(result).toBe(true);

        const updatedCase = await caseRepository
            .connection(caseRepository.tableName)
            .select('*')
            .where('id', validCase.id.value)
            .first();

        expect(updatedCase.grupo_id).toBe(defaultGroup.id.value);
    });

    it('should not assign an inactive group, falling back to the classification default group', async () => {
        const inactiveGroup = await GroupsMother.createRandomGroup(groupRepository, null, {
            codigo_externo: 'inactive_group_code',
            status: StatusEnum.INACTIVE.value,
        });
        const defaultGroup = await GroupsMother.createRandomGroup(groupRepository);
        const classification = await ClassificationsMother.create(classificationRepository, {
            default_group_id: defaultGroup.id.value,
        });

        const validCase = await CasesMother.createCase(caseRepository, { clasificacion_id: classification.id.value });
        const validAction = Action.create(ActionMother.dto({ external_group_code: 'inactive_group_code' }));

        await assignGroupByExternalCodeCase.execute(validCase, validAction);

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

        const validCase = await CasesMother.createCase(caseRepository, { clasificacion_id: classification.id.value });
        const validAction = Action.create(ActionMother.dto({ external_group_code: 'non_existing_code' }));

        const result = await assignGroupByExternalCodeCase.execute(validCase, validAction);
        expect(result).toBe(false);
        // The action bails out before ever handing the inactive default group over.
        expect(assignationServiceMock.execute).not.toHaveBeenCalled();
    });

    it('should log an event when group is assigned by AssignGroupByExternalCodeCase', async () => {
        const externalCode = 'code_for_log_test';
        const group = await GroupsMother.createRandomGroup(groupRepository);
        group.codigos_externos = { code_for_log_test: externalCode };
        await groupRepository.update(group);

        const validCase = await CasesMother.createCase(caseRepository);
        const originalValues = validCase.toJson();
        const mockTrigger = 'cron_job';
        const validAction = Action.create(ActionMother.dto({ external_group_code: externalCode }));

        const result = await assignGroupByExternalCodeCase.execute(validCase, validAction, mockTrigger);
        expect(result).toBe(true);

        const eventLog = await caseRepository
            .connection('event_logs')
            .select('*')
            .where({ aggregate_id: validAction.id.value, event_name: 'action.executed' })
            .first();

        expect(eventLog).toBeDefined();

        const body = eventLog.body;
        expect(body).toBeDefined();
        expect(body.description).toBe(validAction.description.value);
        expect(body.actionType).toBe(AssignGroupByExternalCodeCase.ACTION_TYPE);
        expect(body.trigger).toBe(mockTrigger);
        expect(body.success).toBe(true);
        expect(body.grupo_id).toBe(group.id.value);
        expect(body.transicion_id).toBe(validCase.transicion_id.value);
        expect(body.state).toBeDefined();

        const oldData = eventLog.old_data;
        expect(oldData).toBeDefined();
        expect(oldData.grupo_id).toBe(originalValues.grupo_id);
        expect(oldData.transicion_id).toBe(originalValues.transicion_id);
        expect(oldData.responsable_id).toBe(originalValues.responsable_id);
        expect(oldData.state).toBeDefined();
    });
});
