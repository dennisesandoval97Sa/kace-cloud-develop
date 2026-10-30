import { jest } from '@jest/globals';
import { AssignCurrentGroupCase } from '../../../src/actions/domain/types/AssignCurrentGroupCase.js';
import { Case, KnexCaseRepository } from '../../../src/cases/index.js';
import { knexConfig } from '../../knexfile.js';
import { KnexUsersRepository } from '../../../src/users/index.js';
import { KnexAnsRepository } from '../../../src/ans/index.js';
import { KnexShiftManagementRepository } from '../../../src/shift-management/index.js';
import { KnexGroupsRepository } from '../../../src/grupos/index.js';
import { v4 as uuidV4 } from 'uuid';
import CasesMother from '../../cases/domain/CasesMother.js';
import UsersMother from '../../users/domain/UsersMother.js';
import AnsMother from '../../ans/domain/AnsMother.js';
import ShiftManagementMother from '../../shift-management/domain/ShiftManagementMother.js';
import { GroupsMother } from '../../grupos/domain/GroupsMother.js';
import { Action } from '../../../src/actions/index.js';
import ActionMother from '../domain/ActionMother.js';
import { ensureParentRow } from '../../support/ensureParentRow.js';

describe('AssignCurrentGroupCase', () => {
    const caseRepository = new KnexCaseRepository(knexConfig);
    const userRepository = new KnexUsersRepository(caseRepository.connection);
    // El servicio real devuelve el id de un asesor que YA existe; el mock devolvia un
    // uuid inventado que acaba escrito en cases.responsable_id, y postgres exige que ese
    // usuario exista. El asesor se siembra en el `beforeEach` de abajo y no dentro del
    // doble: el `AssignationService` real no toca la base para responder, asi que meterle
    // I/O al stub lo aleja del colaborador que imita.
    const assignedAdvisorId = uuidV4();
    const assignationServiceMock = {
        execute: async () => assignedAdvisorId,
    };
    const assignCurrentGroupCase = new AssignCurrentGroupCase(caseRepository, userRepository, assignationServiceMock);

    // El reset a la plantilla es un `beforeEach` registrado desde `setupFilesAfterEnv`,
    // o sea antes que este, y jest-circus corre los `beforeEach` en orden de registro:
    // la fila sembrada aqui sobrevive al reset. Lo que no sobreviviria es un `beforeAll`.
    beforeEach(async () => {
        await ensureParentRow(caseRepository.connection, 'usuarios', assignedAdvisorId);
    });

    async function createAnsRelations(grupoActivoId, clasificacionId) {
        const ansRepository = new KnexAnsRepository(caseRepository.connection);
        const shiftManagementRepository = new KnexShiftManagementRepository(caseRepository.connection);
        const groupsRepository = new KnexGroupsRepository(caseRepository.connection);

        const ans = await AnsMother.createAns(ansRepository);
        const shiftManagement = await ShiftManagementMother.createShiftManagement(shiftManagementRepository);

        await caseRepository.connection('clasificaciones').insert({
            id: clasificacionId,
            ans_id: ans.id.value,
            created_by: uuidV4(),
        });

        await GroupsMother.createGroupWithRelations(groupsRepository, {
            id: grupoActivoId,
            horario_id: shiftManagement.id.value,
        });
    }

    it('should throw an error if the caseEntity is not a valid instance of Case', async () => {
        const invalidCase = {};
        const result = await assignCurrentGroupCase.execute(invalidCase);
        expect(result).toBe(false);
    });

    it('should return false if the case is not found', async () => {
        const validCase = Case.create(CasesMother.dto());
        const result = await assignCurrentGroupCase.execute(validCase);
        expect(result).toBe(false);
    });

    it('should return false if the advisor is not found', async () => {
        const validCase = await CasesMother.createCase(caseRepository);
        validCase.updated_by = uuidV4();

        const result = await assignCurrentGroupCase.execute(validCase);
        expect(result).toBe(false);
    });

    it('should return false without attempting a case assignment when no responsible user is found for the group', async () => {
        const advisor = await UsersMother.createUser(userRepository);
        const noOneAvailableService = { execute: async () => null };
        const caseWithNoAssignee = new AssignCurrentGroupCase(caseRepository, userRepository, noOneAvailableService);
        // A spy (not just an outcome assertion) is required here: `caseUserAssignmentService`
        // rejects a null `responsibleId` on its own, so a mutated `if (responsibleId)` guard
        // that calls it unconditionally would still land on `result === false` via that
        // downstream rejection, indistinguishable from the guard skipping the call outright.
        const assignmentSpy = jest.spyOn(caseWithNoAssignee.caseUserAssignmentService, 'execute');
        const validCase = await CasesMother.createCase(caseRepository);
        validCase.updated_by = advisor.id.value;

        const result = await caseWithNoAssignee.execute(validCase);
        expect(result).toBe(false);
        expect(assignmentSpy).not.toHaveBeenCalled();

        const updatedCase = await caseRepository
            .connection(caseRepository.tableName)
            .select('grupo_id')
            .where('id', validCase.id.value)
            .first();
        expect(updatedCase.grupo_id).toBe(validCase.grupo_id.value);
    });

    it('should return true and update the case if successful', async () => {
        const grupoActivoId = uuidV4();
        const clasificacionId = uuidV4();
        await createAnsRelations(grupoActivoId, clasificacionId);

        const user = await UsersMother.createUser(userRepository);
        user.grupo_activo = grupoActivoId;
        await userRepository.update(user);

        const validCase = await CasesMother.createCase(caseRepository, { clasificacion_id: clasificacionId });
        validCase.updated_by = user.id.value;

        const responsibleBefore = validCase.responsable_id.value;
        const result = await assignCurrentGroupCase.execute(validCase);
        expect(result).toBe(true);

        const updatedCase = await caseRepository
            .connection(caseRepository.tableName)
            .select('*')
            .where('id', validCase.id.value)
            .first();

        expect(updatedCase.grupo_id).toBe(user.grupo_activo.value);
        expect(updatedCase.responsable_id).not.toBe(responsibleBefore);
    });

    it('should log an event when responsible is assigned by AssignCurrentGroupCase', async () => {
        const grupoActivoId = uuidV4();
        const clasificacionId = uuidV4();
        await createAnsRelations(grupoActivoId, clasificacionId);

        const user = await UsersMother.createUser(userRepository, { nombres: 'Group Assignee' });
        user.grupo_activo = grupoActivoId;
        await userRepository.update(user);

        const kase = await CasesMother.createCase(caseRepository, { clasificacion_id: clasificacionId });
        kase.updated_by = user.id.value;

        const originalValues = kase.toJson();

        const action = new Action(ActionMother.dto());
        const mockTrigger = 'cron_job';

        const result = await assignCurrentGroupCase.execute(kase, action, mockTrigger);
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
        expect(body.actionType).toBe(AssignCurrentGroupCase.ACTION_TYPE);
        expect(body.trigger).toBe(mockTrigger);
        expect(body.success).toBe(true);
        expect(body.responsable_id).toBeDefined();
        expect(body.responsable).toBeDefined();
        expect(body.grupo_id).toBe(user.grupo_activo.value);
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
