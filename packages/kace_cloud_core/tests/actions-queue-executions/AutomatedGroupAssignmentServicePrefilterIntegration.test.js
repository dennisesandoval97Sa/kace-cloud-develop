import { jest } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';

import { globalRoleId } from '@kace/database/seeds/20241125105900_usuario_base.js';
import { knexConfig } from '../knexfile.js';
import TestHelper from '../TestHelper.js';

import { AutomatedGroupAssignmentService } from '../../src/actions-queue-executions/domain/services/AutomatedGroupAssignmentService.js';
import { LegacyAutomatedGroupAssignmentService } from '../../src/actions-queue-executions/domain/services/LegacyAutomatedGroupAssignmentService.js';
import { EntityCandidateFinder } from '../../src/actions-queue-executions/domain/services/EntityCandidateFinder.js';
import { CaseContextBatchLoader } from '../../src/actions-queue-executions/domain/services/CaseContextBatchLoader.js';
import { ActionConditionsToSqlTranslator } from '../../src/actions/domain/QueryTranslator/ActionConditionsToSqlTranslator.js';
import { createCasesFieldCatalog } from '../../src/actions/domain/QueryTranslator/FieldCatalog.js';
import { CaseFindAllActiveService } from '../../src/cases/domain/services/CaseFindAllActiveService.js';
import { CaseActionValidator } from '../../src/shared/domain/services/CaseActionValidator.js';
import { AssignationService } from '../../src/shared/assignation/AssignationService.js';

import { KnexGroupsRepository } from '../../src/grupos/index.js';
import { KnexCaseRepository } from '../../src/cases/index.js';
import { KnexActionRepository } from '../../src/actions/infrastructure/KnexActionRepository.js';
import { KnexUsersRepository } from '../../src/users/index.js';
import { KnexUserListsRepository } from '../../src/user-lists/index.js';
import { KnexShiftManagementRepository } from '../../src/shift-management/index.js';
import { KnexGlobalConfigurationRepository } from '../../src/global-config/index.js';
import { KnexUserGroupRelationshipRepository } from '../../src/user-group-relationships/index.js';

import { ActionTypes } from '../../src/actions/domain/ActionTypes.js';
import { StatusEnum } from '../../src/shared/domain/enum/StatusEnum.js';

import { GroupsMother } from '../grupos/domain/GroupsMother.js';
import UsersMother from '../users/domain/UsersMother.js';
import UserGroupRelationshipMother from '../user-group-relationships/domain/UserGroupRelationshipMother.js';
import UserListMother from '../user-lists/domain/UserListMother.js';
import ActionMother from '../actions/domain/ActionMother.js';
import CasesMother from '../cases/domain/CasesMother.js';
import ShiftManagementMother from '../shift-management/domain/ShiftManagementMother.js';
import { GlobalConfigurationsMother } from '../global-config/domain/GlobalConfigurationsMother.js';
import { SETTINGS_WITH_WORK_QUEUE_PARAMS } from '../global-config/domain/SettingsMother.js';

/**
 * SQL prefilter bit-exact parity test.
 *
 * Spec: docs/superpowers/specs/2026-05-15-automated-assignment-sql-prefilter-design.md §9.2.
 * Plan: docs/superpowers/plans/2026-05-15-automated-assignment-sql-prefilter.md Task 14.
 *
 * Verifies that the new `AutomatedGroupAssignmentService` (wired with
 * `CaseCandidateFinder` + `CaseContextBatchLoader`) produces the *exact same*
 * diff of `(case_id, responsable_id, grupo_id)` as the legacy passive-mode path,
 * over a seed covering the 4 cron action subtypes:
 *   - ASIGNAR_LISTA_ASESORES
 *   - ASIGNAR_GRUPO_POR_CODIGO_EXTERNO
 *   - ASIGNAR_GRUPO_EN_CURSO
 *   - ASIGNAR_GRUPO_POR_CODIGO_EXTERNO_DINAMICO
 *
 * Between runs the `cases.responsable_id` / `cases.grupo_id` columns are
 * restored from a snapshot so the second run starts from the exact same
 * baseline as the first.
 *
 * NOTE: this test requires a real Postgres instance (uses `knexConfig`).
 * Run in CI or with a local Postgres pointed at via `DB_TEST_*` env vars.
 */

const activeSessionDate = () => new Date(Date.now() + 60000).toISOString();
describe('AutomatedGroupAssignmentService — SQL prefilter parity (Integration)', () => {
    const groupsRepository = new KnexGroupsRepository(knexConfig);
    const db = groupsRepository.connection;
    const caseRepository = new KnexCaseRepository(db);
    const actionRepository = new KnexActionRepository(db);
    const usersRepository = new KnexUsersRepository(db);
    const userListRepository = new KnexUserListsRepository(db);
    const shiftManagementRepository = new KnexShiftManagementRepository(db);
    const globalConfigurationRepository = new KnexGlobalConfigurationRepository(db);
    const userGroupRelationshipRepository = new KnexUserGroupRelationshipRepository(db);

    /**
     * Builds the dependency bag for the assignment service.
     *
     * Uses the REAL `CaseActionValidator` (not a stub) so the parity assertion
     * is meaningful: both pipelines apply the same condition evaluation against
     * the same seeded data. Legacy's `validate()` invokes `getCasoInfo` which
     * queries `aux_cases` directly; new's `validateWithContext` consumes the
     * bulk-loaded context produced by `CaseContextBatchLoader`. Both contexts
     * have identical shape per spec §7.1.
     */
    function buildDeps() {
        const caseActionValidator = new CaseActionValidator(actionRepository);
        const assignationService = new AssignationService(
            groupsRepository,
            globalConfigurationRepository,
            usersRepository
        );

        // Minimal adapter: persists responsable_id / grupo_id update, records
        // history. Skips SLA timer recomputation (orthogonal to assignment).
        const caseUserAssignmentService = {
            execute: async (kase, userId, groupId) => {
                const originalValues = kase.toJson();
                kase.responsable_id = userId;
                kase.grupo_id = groupId;
                kase.updated_by = kase.updated_by?.value || kase.created_by?.value;
                kase.updated_at = new Date();

                await caseRepository.update(kase);
                await caseRepository.saveHistory(kase, originalValues);
            },
        };

        return {
            caseActionValidator,
            deps: {
                groupsRepository,
                userListsRepository: userListRepository,
                caseRepository,
                assignationService,
                dynamicGroupAssignmentHandler: null,
                caseUserAssignmentService,
                caseFindAllActiveService: new CaseFindAllActiveService(caseRepository),
            },
        };
    }

    async function snapshotCases() {
        const rows = await db('cases').select('id', 'responsable_id', 'grupo_id');
        return rows.reduce((acc, row) => {
            acc[row.id] = {
                responsable_id: row.responsable_id ?? null,
                grupo_id: row.grupo_id ?? null,
            };
            return acc;
        }, {});
    }

    function computeDiff(before, after) {
        const changes = [];
        for (const [id, afterRow] of Object.entries(after)) {
            const beforeRow = before[id] || {};
            if (afterRow.responsable_id !== beforeRow.responsable_id || afterRow.grupo_id !== beforeRow.grupo_id) {
                changes.push({
                    id,
                    responsable_id: afterRow.responsable_id,
                    grupo_id: afterRow.grupo_id,
                });
            }
        }
        return changes.sort((a, b) => a.id.localeCompare(b.id));
    }

    async function createWorkQueueGroup(settingsOverrides = {}, groupOverrides = {}) {
        const baseSettings = JSON.parse(JSON.stringify(SETTINGS_WITH_WORK_QUEUE_PARAMS));
        Object.assign(baseSettings.behaviors.application.agente.casos, settingsOverrides);

        const config = await GlobalConfigurationsMother.createConfiguration(globalConfigurationRepository, {
            settings: baseSettings,
        });

        const shiftManagement = await ShiftManagementMother.createShiftManagement(shiftManagementRepository);
        const group = await GroupsMother.createWithCustomShiftManagementAndConfig(
            groupsRepository,
            shiftManagement,
            config,
            { rol_id: globalRoleId }
        );

        if (Object.keys(groupOverrides).length > 0) {
            await db('grupos').where({ id: group.id.value }).update(groupOverrides);
        }

        return { config, group, groupId: group.id.value };
    }

    async function createActiveUser(groupId) {
        const user = await UsersMother.createUserWithRole(usersRepository, {
            is_active: StatusEnum.ACTIVE.value,
            grupo_activo: groupId,
            last_seen_at: activeSessionDate(),
        });
        await UserGroupRelationshipMother.create(userGroupRelationshipRepository, {
            usuario_id: user.id.value,
            grupo_id: groupId,
        });
        return user;
    }

    async function createOpenCaseInGroup(groupId, responsibleId, { aux_data, alto_impacto, vista } = {}) {
        const kase = await CasesMother.createCase(caseRepository, {
            grupo_id: groupId,
            responsable_id: responsibleId,
            alto_impacto: alto_impacto ?? 0,
            vista: vista ?? 'normal',
        });
        if (aux_data) {
            await db('aux_cases').insert({
                id: uuidv4(),
                caso_id: kase.id.value,
                data: aux_data,
            });
        }
        return kase;
    }

    /**
     * Builds a single seed scenario that covers all 4 cron action subtypes and
     * exercises a handful of SQL-translatable operators against `cases.*` and
     * `aux_cases.data` JSON paths (depth 1 and 2).
     *
     * Returns the list of action ids the test should run, in deterministic
     * (priority) order.
     */
    async function seedRealisticScenario() {
        const EXTERNAL_CODE = `GRP-EXTERNAL-${uuidv4().slice(0, 8)}`;

        // --- Group A: ASIGNAR_GRUPO_EN_CURSO + ASIGNAR_LISTA_ASESORES target ---
        const { groupId: groupAId } = await createWorkQueueGroup({ max_cases_per_user: 5 });

        const advisorA1 = await createActiveUser(groupAId);
        const advisorA2 = await createActiveUser(groupAId);
        const defaultUserA = await UsersMother.createUserWithRole(usersRepository);

        // --- Group B: ASIGNAR_GRUPO_POR_CODIGO_EXTERNO target ---
        const { groupId: groupBId } = await createWorkQueueGroup(
            { max_cases_per_user: 5 },
            { codigo_externo: EXTERNAL_CODE }
        );
        const advisorB1 = await createActiveUser(groupBId);
        const defaultUserB = await UsersMother.createUserWithRole(usersRepository);

        // Advisor list pointing at group A.
        const advisorList = await UserListMother.createUserList(userListRepository, {
            group_id: groupAId,
            lista_usuarios: [
                { id: advisorA1.id.value, name: 'Listed Advisor A1' },
                { id: advisorA2.id.value, name: 'Listed Advisor A2' },
            ],
        });

        // --- Seed cases distributed across the two groups ---
        // 30 cases per group is more than enough to verify partition + capacity
        // logic without making the test slow.
        const SEEDS_PER_GROUP = 30;
        const yesterday = dayjs().subtract(1, 'day').toISOString();

        for (let i = 0; i < SEEDS_PER_GROUP; i += 1) {
            await createOpenCaseInGroup(groupAId, defaultUserA.id.value, {
                aux_data: {
                    field1: `value-${i % 5}`,
                    parent: {
                        child: i % 2 === 0 ? 'even' : 'odd',
                        numeric: i,
                    },
                    note: i % 3 === 0 ? 'matchable-substring' : null,
                },
                alto_impacto: i % 4 === 0 ? 1 : 0,
                vista: i % 7 === 0 ? 'highlighted' : 'normal',
            });
        }

        for (let i = 0; i < SEEDS_PER_GROUP; i += 1) {
            await createOpenCaseInGroup(groupBId, defaultUserB.id.value, {
                aux_data: {
                    field1: `b-value-${i % 3}`,
                    parent: {
                        child: i % 2 === 0 ? 'B-even' : 'B-odd',
                    },
                },
                alto_impacto: i % 5 === 0 ? 1 : 0,
                vista: i % 6 === 0 ? 'highlighted' : 'normal',
            });
        }

        // --- 4 cron actions, one per subtype, each with conditions that the
        //     SQL translator can partially translate. Operators exercised:
        //     `=`, `>=`, `contains`, `notNull`, `in`. ---
        const actionListaAsesores = await ActionMother.create(actionRepository, {
            action_type: ActionTypes.ASIGNAR_LISTA_ASESORES.value,
            advisor_list_id: advisorList.id.value,
            priority: 1,
            conditions: {
                id: uuidv4(),
                combinator: 'and',
                rules: [
                    {
                        id: uuidv4(),
                        field: 'cases.alto_impacto',
                        operator: '=',
                        type: 'manual_input',
                        value: 1,
                        value_type: 'number',
                    },
                    {
                        id: uuidv4(),
                        field: 'aux_cases.parent.child',
                        operator: '=',
                        type: 'manual_input',
                        value: 'even',
                        value_type: 'text',
                    },
                ],
            },
        });

        const actionPorCodigoExterno = await ActionMother.create(actionRepository, {
            action_type: ActionTypes.ASIGNAR_GRUPO_POR_CODIGO_EXTERNO.value,
            external_group_code: EXTERNAL_CODE,
            priority: 2,
            conditions: {
                id: uuidv4(),
                combinator: 'and',
                rules: [
                    {
                        id: uuidv4(),
                        field: 'cases.created_at',
                        operator: '>=',
                        type: 'manual_input',
                        value: yesterday,
                        value_type: 'date',
                    },
                    {
                        id: uuidv4(),
                        field: 'aux_cases.field1',
                        operator: 'contains',
                        type: 'manual_input',
                        value: 'b-value',
                        value_type: 'text',
                    },
                ],
            },
        });

        const actionEnCurso = await ActionMother.create(actionRepository, {
            action_type: ActionTypes.ASIGNAR_GRUPO_EN_CURSO.value,
            priority: 3,
            conditions: {
                id: uuidv4(),
                combinator: 'and',
                rules: [
                    {
                        id: uuidv4(),
                        field: 'cases.vista',
                        operator: 'in',
                        type: 'manual_input',
                        value: ['normal', 'highlighted'],
                        value_type: 'text',
                    },
                    {
                        id: uuidv4(),
                        field: 'aux_cases.note',
                        operator: 'notNull',
                        type: 'manual_input',
                        value: null,
                        value_type: 'text',
                    },
                ],
            },
        });

        // Subtype 4: ASIGNAR_GRUPO_POR_CODIGO_EXTERNO_DINAMICO. The legacy and
        // new paths share the same handler-less branch (handler is null in
        // buildDeps()), so they both record an action-level error without
        // mutating cases. Including it ensures the orchestration loop is
        // exercised end-to-end across subtypes.
        const actionDinamico = await ActionMother.create(actionRepository, {
            action_type: ActionTypes.ASIGNAR_GRUPO_POR_CODIGO_EXTERNO_DINAMICO.value,
            external_group_dynamic_code: 'aux_cases.field1',
            priority: 4,
            conditions: {
                id: uuidv4(),
                combinator: 'and',
                rules: [
                    {
                        id: uuidv4(),
                        field: 'cases.alto_impacto',
                        operator: '=',
                        type: 'manual_input',
                        value: 0,
                        value_type: 'number',
                    },
                ],
            },
        });

        // Reload through the repository so we exercise the same hydration path
        // production uses. KnexActionRepository.find expects a value object
        // shaped { value: <id> }.
        const idRefs = [
            { value: actionListaAsesores.id.value },
            { value: actionPorCodigoExterno.id.value },
            { value: actionEnCurso.id.value },
            { value: actionDinamico.id.value },
        ];
        const hydrated = [];
        for (const ref of idRefs) {
            const action = await actionRepository.find(ref);
            expect(action).not.toBeNull();
            hydrated.push(action);
        }
        return hydrated;
    }

    /**
     * Restores `cases.responsable_id` / `cases.grupo_id` to the snapshotted
     * values so the second run starts from an identical baseline.
     *
     * We avoid wrapping each run in a knex transaction because the assignment
     * service is built against repositories bound to the root connection — re-
     * binding every repo to a trx for one test is too invasive. Manually
     * resetting the two columns we care about is sufficient for parity.
     */
    async function restoreSnapshot(snapshot) {
        const updates = Object.entries(snapshot);
        for (const [id, row] of updates) {
            await db('cases').where({ id }).update({
                responsable_id: row.responsable_id,
                grupo_id: row.grupo_id,
            });
        }
        // history_cases rows accumulated during the first run are harmless for
        // the second run's logic (PrioritizedAssignmentStrategy queries them,
        // but the test's actions don't use it). We still purge them to keep
        // both runs starting from byte-identical state.
        await db('history_cases')
            .whereIn(
                'entity_id',
                updates.map(([id]) => id)
            )
            .del();
    }

    it('produces an identical (case_id, responsable_id, grupo_id) diff for legacy vs prefilter pipelines', async () => {
        // 1. Seed the scenario once and capture the baseline snapshot. Both
        //    runs are reset back to this baseline before they begin.
        const actions = await seedRealisticScenario();
        expect(actions).toHaveLength(4);

        const baseline = await snapshotCases();
        expect(Object.keys(baseline).length).toBeGreaterThan(0);

        // --- LEGACY RUN (passive mode: no caseCandidateFinder/Loader) ---
        const legacy = new LegacyAutomatedGroupAssignmentService(buildDeps().caseActionValidator, buildDeps().deps);
        await legacy.assign({ actions });

        const afterLegacy = await snapshotCases();
        const legacyDiff = computeDiff(baseline, afterLegacy);

        // Restore baseline for the second run.
        await restoreSnapshot(baseline);
        const baselineAfterRestore = await snapshotCases();
        expect(baselineAfterRestore).toEqual(baseline);

        // --- NEW RUN (active mode: caseCandidateFinder + caseContextBatchLoader) ---
        const newRunDeps = buildDeps();
        const finder = new EntityCandidateFinder({
            entityRepository: caseRepository,
            translator: new ActionConditionsToSqlTranslator({ catalog: createCasesFieldCatalog() }),
            buildBaseQuery: (conn, t) => conn(t).select(`${t}.id`).whereNull(`${t}.fecha_resolucion`),
        });
        const loader = new CaseContextBatchLoader(caseRepository);
        const next = new AutomatedGroupAssignmentService(newRunDeps.caseActionValidator, {
            ...newRunDeps.deps,
            caseCandidateFinder: finder,
            caseContextBatchLoader: loader,
        });
        await next.assign({ actions });

        const afterNew = await snapshotCases();
        const newDiff = computeDiff(baseline, afterNew);

        // Bit-exact parity: the resulting set of mutations must be identical.
        expect(newDiff).toEqual(legacyDiff);
    }, 180_000);
});
