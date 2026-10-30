import { Action } from '../../../src/actions/index.js';
import { KnexCaseRepository } from '../../../src/cases/index.js';
import { KnexUsersRepository } from '../../../src/users/index.js';
import ActionMother from '../../actions/domain/ActionMother.js';
import CasesMother from '../../cases/domain/CasesMother.js';
import UsersMother from '../../users/domain/UsersMother.js';
import { v4 as uuidv4 } from 'uuid';
import { KnexAuxCasesRepository } from '../../../src/aux_casos/index.js';
import { AuxCasesMother } from '../../aux_casos/domain/AuxCasesMother.js';
import { AssignUserByExternalDynamicCode } from '../../../src/actions/domain/types/AssignUserByExternalDynamicCode.js';
import { knexConfig } from '../../knexfile.js';
import { ensureParentRow } from '../../support/ensureParentRow.js';
import ShiftManagementMother from '../../shift-management/domain/ShiftManagementMother.js';

describe('Integration tests AssignUserByExternalDynamicCode', () => {
    let trx, caseRepository, userRepository, auxCaseRepository, assignUserByExternalDynamicCode;

    beforeEach(async () => {
        trx = await knexConfig.transaction();
        const trxProvider = () => trx;
        caseRepository = new KnexCaseRepository(trxProvider());
        userRepository = new KnexUsersRepository(trxProvider());
        auxCaseRepository = new KnexAuxCasesRepository(trxProvider());
        assignUserByExternalDynamicCode = new AssignUserByExternalDynamicCode(
            caseRepository,
            userRepository,
            auxCaseRepository
        );
    });

    afterEach(async () => {
        await trx.rollback();
    });

    it('should return false if caseEntity is not an instance of Case', async () => {
        const action = Action.create(
            ActionMother.dto({
                external_user_code: 'a.b.code',
            })
        );

        const result = await assignUserByExternalDynamicCode.execute({}, action);
        expect(result).toBe(false);
    });

    it('should return false if action is not an instance of Action', async () => {
        const caseEntity = await CasesMother.createCase(caseRepository);
        const result = await assignUserByExternalDynamicCode.execute(caseEntity, {});
        expect(result).toBe(false);
    });

    it('should return false if no aux case exists for the given case', async () => {
        const caseEntity = await CasesMother.createCase(caseRepository);
        const action = Action.create(
            ActionMother.dto({
                external_user_code: 'a.b.code',
            })
        );

        const result = await assignUserByExternalDynamicCode.execute(caseEntity, action);
        expect(result).toBe(false);
    });

    it('should return false if external_user_code path does not exist in auxCase data', async () => {
        const caseEntity = await CasesMother.createCase(caseRepository);
        await AuxCasesMother.createAuxCase(auxCaseRepository, {
            caso_id: caseEntity.id.value,
            data: { something: { else: 'not_found' } },
        });

        const action = Action.create(
            ActionMother.dto({
                external_user_code: 'a.b.code',
            })
        );

        const result = await assignUserByExternalDynamicCode.execute(caseEntity, action);
        expect(result).toBe(false);
    });

    it('should return false if no user matches external_user_code in the repository', async () => {
        const caseEntity = await CasesMother.createCase(caseRepository);

        await AuxCasesMother.createAuxCase(auxCaseRepository, {
            caso_id: caseEntity.id.value,
            data: {
                a: {
                    b: {
                        code: 'NON_EXISTENT',
                    },
                },
            },
        });

        const action = Action.create(
            ActionMother.dto({
                external_user_code: 'a.b.code',
            })
        );

        const result = await assignUserByExternalDynamicCode.execute(caseEntity, action);
        expect(result).toBe(false);
    });

    it('should assign user if found via external_user_code in aux data', async () => {
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
        user.codigos_externos = { EXTERNAL123: 'EXTERNAL123' };
        user.grupo_activo = grupoActivoId;
        await userRepository.update(user);

        const caseEntity = await CasesMother.createCase(caseRepository);

        await AuxCasesMother.createAuxCase(auxCaseRepository, {
            caso_id: caseEntity.id.value,
            data: {
                a: {
                    b: {
                        userCode: 'EXTERNAL123',
                    },
                },
            },
        });

        const action = Action.create(
            ActionMother.dto({
                external_user_dynamic_code: 'a.b.userCode',
            })
        );

        const result = await assignUserByExternalDynamicCode.execute(caseEntity, action);
        expect(result).toBe(true);

        const updated = await caseRepository
            .connection(caseRepository.tableName)
            .select('*')
            .where('id', caseEntity.id.value)
            .first();

        expect(updated.responsable_id).toBe(user.id.value);
        expect(updated.grupo_id).toBe(user.grupo_activo.value);
    });

    it('should log an event when user is assigned by AssignUserByExternalDynamicCode', async () => {
        const externalCode = 'EXTERNAL_DYNAMIC';
        const user = await UsersMother.createUser(userRepository, {
            nombres: 'Usuario Dinámico',
        });

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

        const auxData = {
            a: {
                b: {
                    code: externalCode,
                },
            },
        };

        await AuxCasesMother.createAuxCase(auxCaseRepository, {
            caso_id: kase.id.value,
            data: auxData,
        });

        const action = Action.create(
            ActionMother.dto({
                external_user_dynamic_code: 'a.b.code',
            })
        );

        const mockTrigger = 'cron_job';
        const result = await assignUserByExternalDynamicCode.execute(kase, action, mockTrigger);
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
        expect(body.actionType).toBe(AssignUserByExternalDynamicCode.ACTION_TYPE);
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
