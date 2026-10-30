import { Action } from '../../../src/actions/index.js';
import { AssignUserByExternalCodeCase } from '../../../src/actions/domain/types/AssignUserByExternalCodeCase.js';
import { KnexCaseRepository } from '../../../src/cases/index.js';
import { KnexUsersRepository } from '../../../src/users/index.js';
import ActionMother from '../../actions/domain/ActionMother.js';
import CasesMother from '../../cases/domain/CasesMother.js';
import UsersMother from '../../users/domain/UsersMother.js';
import { v4 as uuidv4 } from 'uuid';
import { knexConfig } from '../../knexfile.js';
import { ensureParentRow } from '../../support/ensureParentRow.js';
import ShiftManagementMother from '../../shift-management/domain/ShiftManagementMother.js';

describe('Integration tests AssignUserByExternalCodeCase', () => {
    let trx, caseRepository, userRepository, assignUserByExternalCodeCase;

    beforeEach(async () => {
        trx = await knexConfig.transaction();
        const trxProvider = () => trx;
        caseRepository = new KnexCaseRepository(trxProvider());
        userRepository = new KnexUsersRepository(trxProvider());
        assignUserByExternalCodeCase = new AssignUserByExternalCodeCase(caseRepository, userRepository);
    });

    afterEach(async () => {
        await trx.rollback();
    });

    it('should return true and update the case when user is found with the given external user code', async () => {
        const user = await UsersMother.createUser(userRepository);
        // `usuarios.grupo_activo` es clave foranea a `grupos`, y la accion copia ese
        // mismo id a `cases.grupo_id`, que tambien lo es: el id lo inventa el test, asi
        // que hay que respaldarlo con una fila antes de que el update lo escriba.
        const grupoActivoId = uuidv4();
        await ensureParentRow(trx, 'grupos', grupoActivoId, {
            // `grupos.horario_id` es el segundo eslabon de la cadena que recorre
            // `KnexCaseRepository.#buildBaseQueryAns`. Sin el, el caso que reciba
            // este grupo no tiene horario y el calculo de ANS lanza un 422.
            horario_id: await ShiftManagementMother.ensureRow(trx),
        });
        user.codigos_externos = { test_uno: 'test_uno' };
        user.grupo_activo = grupoActivoId;
        await userRepository.update(user);

        const validCase = await CasesMother.createCase(caseRepository);
        const validAction = Action.create(ActionMother.dto({ external_user_code: 'test_uno' }));
        const result = await assignUserByExternalCodeCase.execute(validCase, validAction);
        expect(result).toBe(true);

        const updatedCase = await caseRepository
            .connection(caseRepository.tableName)
            .select('*')
            .where('id', validCase.id.value)
            .first();

        expect(updatedCase.responsable_id).toBe(user.id.value);
        expect(updatedCase.grupo_id).toBe(user.grupo_activo.value);
    });

    it('should return false when no user is found with the given external user code', async () => {
        const validCase = await CasesMother.createCase(caseRepository);
        const validAction = Action.create(ActionMother.dto({ external_user_code: 'non_existing_code' }));

        const result = await assignUserByExternalCodeCase.execute(validCase, validAction);

        expect(result).toBe(false);

        const notUpdatedCase = await caseRepository
            .connection(caseRepository.tableName)
            .select('*')
            .where('id', validCase.id.value)
            .first();

        expect(notUpdatedCase.responsable_id).toBe(validCase.responsable_id.value);
        expect(notUpdatedCase.grupo_id).toBe(validCase.grupo_id.value);
    });

    it('should return false when user has no active group', async () => {
        const user = await UsersMother.createUser(userRepository);
        user.codigos_externos = { no_grupo: 'no_grupo' };
        await userRepository.update(user);

        const validCase = await CasesMother.createCase(caseRepository);
        const validAction = Action.create(ActionMother.dto({ external_user_code: 'no_grupo' }));

        const result = await assignUserByExternalCodeCase.execute(validCase, validAction);

        expect(result).toBe(false);

        const notUpdatedCase = await caseRepository
            .connection(caseRepository.tableName)
            .select('*')
            .where('id', validCase.id.value)
            .first();

        expect(validCase.grupo_id.value).toBe(notUpdatedCase.grupo_id);
        expect(validCase.responsable_id.value).toBe(notUpdatedCase.responsable_id);
    });

    it('should log an event when user is assigned by AssignUserByExternalCodeCase', async () => {
        const user = await UsersMother.createUser(userRepository, {
            nombres: 'Usuario Externo',
        });

        const externalCode = 'codigo_externo_test';
        // Mismo motivo que arriba: `grupo_activo` apunta a `grupos`.
        const grupoActivoId = uuidv4();
        await ensureParentRow(trx, 'grupos', grupoActivoId, {
            // `grupos.horario_id` es el segundo eslabon de la cadena que recorre
            // `KnexCaseRepository.#buildBaseQueryAns`. Sin el, el caso que reciba
            // este grupo no tiene horario y el calculo de ANS lanza un 422.
            horario_id: await ShiftManagementMother.ensureRow(trx),
        });

        user.codigos_externos = { [externalCode]: externalCode };
        user.grupo_activo = grupoActivoId;
        await userRepository.update(user);

        const kase = await CasesMother.createCase(caseRepository);
        kase.updated_by = user.id.value;

        const originalValues = kase.toJson();
        const mockTrigger = 'cron_job';

        const action = Action.create(ActionMother.dto({ external_user_code: externalCode }));

        const result = await assignUserByExternalCodeCase.execute(kase, action, mockTrigger);
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
        expect(body.actionType).toBe(AssignUserByExternalCodeCase.ACTION_TYPE);
        expect(body.trigger).toBe(mockTrigger);
        expect(body.success).toBe(true);
        expect(body.responsable_id).toBe(user.id.value);
        expect(body.grupo_id).toBe(user.grupo_activo.value);
        expect(body.responsable.nombres).toBe(user.nombres.value);
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
