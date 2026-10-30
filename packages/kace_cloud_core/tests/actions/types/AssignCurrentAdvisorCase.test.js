import { AssignCurrentAdvisorCase } from '../../../src/actions/domain/types/AssignCurrentAdvisorCase';
import { Case, KnexCaseRepository } from '../../../src/cases/index.js';
import { KnexUsersRepository } from '../../../src/users/index.js';
import { KnexAnsRepository } from '../../../src/ans/index.js';
import { KnexShiftManagementRepository } from '../../../src/shift-management/index.js';
import { KnexGroupsRepository } from '../../../src/grupos/index.js';
import CasesMother from '../../cases/domain/CasesMother.js';
import UsersMother from '../../users/domain/UsersMother.js';
import AnsMother from '../../ans/domain/AnsMother.js';
import ShiftManagementMother from '../../shift-management/domain/ShiftManagementMother.js';
import { GroupsMother } from '../../grupos/domain/GroupsMother.js';
import { knexConfig } from '../../knexfile.js';
import { v4 as uuidV4 } from 'uuid';
import { Action } from '../../../src/actions/index.js';
import ActionMother from '../domain/ActionMother.js';

describe('AssignCurrentAdvisorCase', () => {
    const caseRepository = new KnexCaseRepository(knexConfig);
    const userRepository = new KnexUsersRepository(caseRepository.connection);
    const assignCurrentAdvisorCase = new AssignCurrentAdvisorCase(caseRepository, userRepository);

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

    it('should throw an error if the caseEntity is not an instance of Case', async () => {
        const invalidCase = {};
        const result = await assignCurrentAdvisorCase.execute(invalidCase);
        expect(result).toBe(false);
    });

    it('should return false if the case is not found', async () => {
        const validCase = Case.create(CasesMother.dto());
        const result = await assignCurrentAdvisorCase.execute(validCase);
        expect(result).toBe(false);
    });

    it('should return false if the advisor is not found', async () => {
        const validCase = await CasesMother.createCase(caseRepository);
        validCase.updated_by = uuidV4();
        const result = await assignCurrentAdvisorCase.execute(validCase);
        expect(result).toBe(false);
    });

    it('should return true and update the case when successful', async () => {
        const grupoActivoId = uuidV4();
        const clasificacionId = uuidV4();
        await createAnsRelations(grupoActivoId, clasificacionId);

        const user = await UsersMother.createUser(userRepository);
        user.grupo_activo = grupoActivoId;
        await userRepository.update(user);

        const validCase = await CasesMother.createCase(caseRepository, { clasificacion_id: clasificacionId });
        validCase.updated_by = user.id.value;

        const result = await assignCurrentAdvisorCase.execute(validCase);
        expect(result).toBe(true);

        const updatedCase = await caseRepository
            .connection(caseRepository.tableName)
            .select('*')
            .where('id', validCase.id.value)
            .first();
        expect(updatedCase.responsable_id).toBe(user.id.value);
        expect(updatedCase.grupo_id).toBe(user.grupo_activo.value);
    });

    it('should log an event when responsible is assigned by AssignCurrentAdvisorCase', async () => {
        const grupoActivoId = uuidV4();
        const clasificacionId = uuidV4();
        await createAnsRelations(grupoActivoId, clasificacionId);

        const user = await UsersMother.createUser(userRepository, { nombres: 'New Advisor' });
        user.grupo_activo = grupoActivoId;
        await userRepository.update(user);

        const kase = await CasesMother.createCase(caseRepository, { clasificacion_id: clasificacionId });
        kase.updated_by = user.id.value;

        const originalValues = kase.toJson();
        const action = new Action(ActionMother.dto());
        const mockTrigger = 'cron_job';
        const result = await assignCurrentAdvisorCase.execute(kase, action, mockTrigger);
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
        expect(body.actionType).toBe(AssignCurrentAdvisorCase.ACTION_TYPE);
        expect(body.trigger).toBe(mockTrigger);
        expect(body.success).toBe(true);
        expect(body.responsable_id).toBe(user.id.value);
        expect(body.grupo_id).toBe(user.grupo_activo.value);
        expect(body.transicion_id).toBe(kase.transicion_id.value);
        expect(body.responsable.nombres).toBe(user.nombres.value);
        expect(body.state).toBeDefined();

        const oldData = eventLog.old_data;
        expect(oldData).toBeDefined();
        expect(oldData.grupo_id).toBe(originalValues.grupo_id);
        expect(oldData.transicion_id).toBe(originalValues.transicion_id);
        expect(oldData.responsable_id).toBe(originalValues.responsable_id);
        expect(oldData.state).toBeDefined();
    });

    it('should update updated_at timestamp when case is assigned by casoCreado trigger', async () => {
        const grupoActivoId = uuidV4();
        const clasificacionId = uuidV4();
        await createAnsRelations(grupoActivoId, clasificacionId);

        const user = await UsersMother.createUser(userRepository);
        user.grupo_activo = grupoActivoId;
        await userRepository.update(user);

        const validCase = await CasesMother.createCase(caseRepository, {
            updated_at: new Date(),
            clasificacion_id: clasificacionId,
        });
        validCase.updated_by = user.id.value;

        const originalUpdatedAt = validCase.updated_at.value;

        await new Promise((resolve) => setTimeout(resolve, 10));

        const action = new Action(ActionMother.dto());
        const mockTrigger = 'casoCreado';

        const result = await assignCurrentAdvisorCase.execute(validCase, action, mockTrigger);
        expect(result).toBe(true);

        const updatedCase = await caseRepository
            .connection(caseRepository.tableName)
            .select('*')
            .where('id', validCase.id.value)
            .first();

        expect(updatedCase.responsable_id).toBe(user.id.value);
        expect(updatedCase.grupo_id).toBe(user.grupo_activo.value);

        expect(new Date(updatedCase.updated_at)).toBeInstanceOf(Date);
        expect(updatedCase.updated_at).not.toBe(originalUpdatedAt);
        expect(new Date(updatedCase.updated_at).getTime()).toBeGreaterThan(new Date(originalUpdatedAt).getTime());
    });
});
