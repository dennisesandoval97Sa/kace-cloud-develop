import { jest } from '@jest/globals';
import { AssignSelectedGroupsCase } from '../../../src/actions/domain/types/AssignSelectedGroupsCase.js';
import { Case, KnexCaseRepository } from '../../../src/cases/index.js';
import { KnexUsersRepository } from '../../../src/users/index.js';
import { Classification, KnexClassificationRepository } from '../../../src/classifications/index.js';
import CasesMother from '../../cases/domain/CasesMother.js';
import ClassificationsMother from '../../classifications/domain/ClassificationsMother.js';
import { knexConfig } from '../../knexfile.js';
import { v4 as uuidV4 } from 'uuid';
import { Action } from '../../../src/actions/index.js';
import ActionMother from '../domain/ActionMother.js';
import { ensureParentRow } from '../../support/ensureParentRow.js';
import ShiftManagementMother from '../../shift-management/domain/ShiftManagementMother.js';

/**
 * `ClassificationsMother.dto()` applies `default_group_id ?? uuidv4()`, so passing
 * `default_group_id: null` through its own `override` param is silently replaced by a
 * fresh uuid (the `??` treats `null` as "not provided"). This helper builds the dto first
 * and overrides `default_group_id` on the *returned* object, bypassing that fallback, to
 * get a classification that genuinely has no default group.
 */
async function createClassificationWithNullDefaultGroup(repository) {
    const dto = { ...ClassificationsMother.dto(), default_group_id: null };
    await ClassificationsMother.ensureRelations(repository.connection, dto);
    const classification = Classification.create(dto);
    await repository.save(classification);
    return classification;
}

describe('AssignSelectedGroupsCase', () => {
    const caseRepository = new KnexCaseRepository(knexConfig);
    const userRepository = new KnexUsersRepository(caseRepository.connection);
    const classificationRepository = new KnexClassificationRepository(caseRepository.connection);
    // El servicio real devuelve el id de un asesor que YA existe; el mock devolvia un
    // uuid inventado que acaba escrito en cases.responsable_id, y postgres exige que ese
    // usuario exista. El asesor se siembra en el `beforeEach` de abajo y no dentro del
    // doble: el `AssignationService` real no toca la base para responder, asi que meterle
    // I/O al stub lo aleja del colaborador que imita.
    const assignedAdvisorId = uuidV4();
    const assignationServiceMock = {
        execute: async (grupo) => (grupo ? assignedAdvisorId : null),
    };
    const assignSelectedGroupsCase = new AssignSelectedGroupsCase(
        caseRepository,
        userRepository,
        classificationRepository,
        assignationServiceMock
    );

    // El reset a la plantilla es un `beforeEach` registrado desde `setupFilesAfterEnv`,
    // o sea antes que este, y jest-circus corre los `beforeEach` en orden de registro:
    // la fila sembrada aqui sobrevive al reset. Lo que no sobreviviria es un `beforeAll`.
    beforeEach(async () => {
        await ensureParentRow(caseRepository.connection, 'usuarios', assignedAdvisorId);
    });

    it('should throw an error if the caseEntity is not a valid instance of Case', async () => {
        const invalidCase = {};
        const result = await assignSelectedGroupsCase.execute(invalidCase);
        expect(result).toBe(false);
    });

    it('should return false if the case is not found', async () => {
        const validCase = Case.create(CasesMother.dto());
        const result = await assignSelectedGroupsCase.execute(validCase);
        expect(result).toBe(false);
    });

    it('should return false if the classification has no default group', async () => {
        const classificationWithoutGroup = await ClassificationsMother.createClassification(classificationRepository);
        const validCase = await CasesMother.createCase(caseRepository);
        validCase.clasificacion_id = classificationWithoutGroup.id.value;

        const result = await assignSelectedGroupsCase.execute(validCase);
        expect(result).toBe(false);
    });

    // NOTE (documented, not fixed): `Case#asignacion_grupo` is a purely in-memory field
    // (no `asignacion_grupo` DB column exists), initialized as the raw value `null` — not
    // wrapped in a Value Object. `AssignSelectedGroupsCase.execute()` reads
    // `caseEntity.asignacion_grupo.value` unconditionally at its very first line, so a case
    // that never had `asignacion_grupo` explicitly set crashes with
    // "Cannot read properties of null (reading 'value')" — caught by the surrounding
    // try/catch, so it resolves as `false` regardless of the classification-fallback logic
    // the test intends to exercise. Every test below sets `asignacion_grupo` to a real UUID
    // (its own setter also rejects null/undefined) so the classification-fallback branches
    // are the actual thing under test, not this incidental crash. The two pre-existing
    // tests above ("should return false if the case is not found" and "...has no default
    // group") never set it either, so they likely pass via this same crash rather than the
    // logic their names describe — left as-is since altering pre-existing tests is out of
    // scope for this task.

    it('should return false when neither the selected group nor a default_group_id-less classification resolve', async () => {
        const selectedGroupId = uuidV4();
        // A spy (not a plain stub) so the assertion below can prove the `&&` guard actually
        // short-circuits on `classification.default_group_id.value` being falsy, instead of
        // merely landing on `result === false` via a second, equally-failing lookup — a
        // mutation that drops the `default_group_id.value` half of the guard (leaving only
        // `if (classification)`) would still resolve to `false` (a second `execute(null, ...)`
        // call also resolves to null), but would call this spy TWICE instead of once.
        const noOneAvailableService = { execute: jest.fn(async () => null) };
        const caseWithNoFallback = new AssignSelectedGroupsCase(
            caseRepository,
            userRepository,
            classificationRepository,
            noOneAvailableService
        );
        const classificationWithoutGroup = await createClassificationWithNullDefaultGroup(classificationRepository);
        const validCase = await CasesMother.createCase(caseRepository);
        validCase.clasificacion_id = classificationWithoutGroup.id.value;
        validCase.asignacion_grupo = selectedGroupId;

        const result = await caseWithNoFallback.execute(validCase);
        expect(result).toBe(false);
        expect(noOneAvailableService.execute).toHaveBeenCalledTimes(1);
        expect(noOneAvailableService.execute).toHaveBeenCalledWith(selectedGroupId, validCase.id.value);

        const updatedCase = await caseRepository
            .connection(caseRepository.tableName)
            .select('grupo_id')
            .where('id', validCase.id.value)
            .first();
        expect(updatedCase.grupo_id).toBe(validCase.grupo_id.value);
    });

    it('should return false when the selected group has no user and the classification itself does not resolve', async () => {
        const selectedGroupId = uuidV4();
        const noOneAvailableService = { execute: async () => null };
        const caseWithNoFallback = new AssignSelectedGroupsCase(
            caseRepository,
            userRepository,
            classificationRepository,
            noOneAvailableService
        );
        const validCase = await CasesMother.createCase(caseRepository);
        validCase.clasificacion_id = uuidV4(); // does not resolve to any classification
        validCase.asignacion_grupo = selectedGroupId;

        const result = await caseWithNoFallback.execute(validCase);
        expect(result).toBe(false);
    });

    it('should fall back to the classification default group when the selected group has no available user', async () => {
        const defaultGroupId = uuidV4();
        await ensureParentRow(caseRepository.connection, 'grupos', defaultGroupId, {
            horario_id: await ShiftManagementMother.ensureRow(caseRepository.connection),
        });
        const classificationWithGroup = await ClassificationsMother.createClassification(classificationRepository, {
            default_group_id: defaultGroupId,
        });
        const selectedGroupId = uuidV4();
        await ensureParentRow(caseRepository.connection, 'grupos', selectedGroupId, {
            horario_id: await ShiftManagementMother.ensureRow(caseRepository.connection),
        });
        // Only the classification's default group actually has an available user.
        const fallbackAwareService = {
            execute: async (grupo) => (grupo === defaultGroupId ? assignedAdvisorId : null),
        };
        const caseWithFallback = new AssignSelectedGroupsCase(
            caseRepository,
            userRepository,
            classificationRepository,
            fallbackAwareService
        );
        const validCase = await CasesMother.createCase(caseRepository);
        validCase.clasificacion_id = classificationWithGroup.id.value;
        validCase.asignacion_grupo = selectedGroupId;

        const result = await caseWithFallback.execute(validCase);
        expect(result).toBe(true);

        // The responsible user is resolved from the classification's default group, but the
        // case's own `grupo_id` still ends up as the originally *selected* group
        // (`caseEntity.asignacion_grupo.value`, passed unconditionally to
        // `caseUserAssignmentService.execute` at AssignSelectedGroupsCase.js:79) — the
        // default group only ever supplies a responsible user, never the recorded group.
        const updatedCase = await caseRepository
            .connection(caseRepository.tableName)
            .select('grupo_id', 'responsable_id')
            .where('id', validCase.id.value)
            .first();
        expect(updatedCase.grupo_id).toBe(selectedGroupId);
        expect(updatedCase.responsable_id).toBe(assignedAdvisorId);
    });

    it('should return false when neither the selected group nor the classification default group resolve to a responsible user', async () => {
        const selectedGroupId = uuidV4();
        const neverResolvingAssignationService = { execute: async () => null };
        const caseWithNoAssignee = new AssignSelectedGroupsCase(
            caseRepository,
            userRepository,
            classificationRepository,
            neverResolvingAssignationService
        );
        const classificationWithGroup = await ClassificationsMother.createClassification(classificationRepository, {
            default_group_id: uuidV4(),
        });
        const validCase = await CasesMother.createCase(caseRepository);
        validCase.clasificacion_id = classificationWithGroup.id.value;
        validCase.asignacion_grupo = selectedGroupId;

        const result = await caseWithNoAssignee.execute(validCase);
        expect(result).toBe(false);

        const updatedCase = await caseRepository
            .connection(caseRepository.tableName)
            .select('grupo_id')
            .where('id', validCase.id.value)
            .first();
        expect(updatedCase.grupo_id).toBe(validCase.grupo_id.value);
    });

    it('should return true and update the case if the group and responsible are assigned successfully', async () => {
        const validCase = await CasesMother.createCase(caseRepository);
        // El grupo asignado acaba en cases.grupo_id, que es FK real en postgres.
        const grupoId = uuidV4();
        await ensureParentRow(caseRepository.connection, 'grupos', grupoId, {
            // `grupos.horario_id` es el segundo eslabon de la cadena que recorre
            // `KnexCaseRepository.#buildBaseQueryAns`. Sin el, el caso que reciba
            // este grupo no tiene horario y el calculo de ANS lanza un 422.
            horario_id: await ShiftManagementMother.ensureRow(caseRepository.connection),
        });
        validCase.asignacion_grupo = grupoId;

        const responsableBefore = validCase.responsable_id?.value;
        const result = await assignSelectedGroupsCase.execute(validCase);
        expect(result).toBe(true);

        const updatedCase = await caseRepository
            .connection(caseRepository.tableName)
            .select('*')
            .where('id', validCase.id.value)
            .first();

        expect(updatedCase.grupo_id).toBe(validCase.asignacion_grupo.value);
        expect(updatedCase.responsable_id).not.toBe(responsableBefore);
    });

    it('should log an event when group is assigned by AssignSelectedGroupsCase', async () => {
        const grupoId = uuidV4();

        const validCase = await CasesMother.createCase(caseRepository);
        // El grupo asignado acaba en cases.grupo_id, que es FK real en postgres.
        await ensureParentRow(caseRepository.connection, 'grupos', grupoId, {
            // `grupos.horario_id` es el segundo eslabon de la cadena que recorre
            // `KnexCaseRepository.#buildBaseQueryAns`. Sin el, el caso que reciba
            // este grupo no tiene horario y el calculo de ANS lanza un 422.
            horario_id: await ShiftManagementMother.ensureRow(caseRepository.connection),
        });
        validCase.asignacion_grupo = grupoId;
        validCase.updated_by = uuidV4();

        const originalValues = validCase.toJson();
        const mockTrigger = 'cron_job';
        const action = new Action(ActionMother.dto());

        const result = await assignSelectedGroupsCase.execute(validCase, action, mockTrigger);
        expect(result).toBe(true);

        const eventLog = await caseRepository
            .connection('event_logs')
            .select('*')
            .where({ aggregate_id: action.id.value, event_name: 'action.executed' })
            .first();

        expect(eventLog).toBeDefined();

        const body = eventLog.body;
        expect(body).toBeDefined();
        expect(body.actionType).toBe(AssignSelectedGroupsCase.ACTION_TYPE);
        expect(body.trigger).toBe(mockTrigger);
        expect(body.success).toBe(true);
        expect(body.grupo_id).toBe(grupoId);
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
