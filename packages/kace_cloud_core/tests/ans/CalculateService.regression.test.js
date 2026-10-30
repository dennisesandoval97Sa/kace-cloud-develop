import { CalculateService, KnexAnsRepository, Types } from '../../src/ans/index.js';
import { KnexCaseRepository } from '../../src/cases/index.js';
import { KnexClassificationRepository } from '../../src/classifications/index.js';
import { KnexGroupsRepository } from '../../src/grupos/index.js';
import { KnexShiftManagementRepository } from '../../src/shift-management/index.js';
import { KnexTransitionsRepository } from '../../src/transition/index.js';
import { knexConfig } from '../knexfile.js';
import AnsMother from './domain/AnsMother.js';
import CasesMother from '../cases/domain/CasesMother.js';
import ClassificationsMother from '../classifications/domain/ClassificationsMother.js';
import { GroupsMother } from '../grupos/domain/GroupsMother.js';
import ShiftManagementMother from '../shift-management/domain/ShiftManagementMother.js';
import { TransitionsMother } from '../transition/domain/TransitionsMother.js';
import createDayjsInstance from '../../src/shared/factories/DayjsFactory.js';

const dayjs = createDayjsInstance({ useTimezoneByDefault: false });

// Columns the regression test compares row-by-row.
const SLA_COLUMNS = [
    'sla_position',
    'sla_due_date',
    'sla_elapsed_time',
    'sla_elapsed_days',
    'sla_elapsed_hours',
    'sla_elapsed_minutes',
    'sla_remaining_time',
    'sla_remaining_days',
    'sla_remaining_hours',
    'sla_remaining_minutes',
    'sla_state_position',
    'sla_state_due_date',
    'sla_state_elapsed_time',
    'sla_state_remaining_time',
    'expired_at',
    'ans_posicion',
];

describe('CalculateService — regression (300-case seed)', () => {
    const repository = new KnexCaseRepository(knexConfig);
    const ansRepository = new KnexAnsRepository(repository.connection);
    const classificationRepository = new KnexClassificationRepository(repository.connection);
    const groupsRepository = new KnexGroupsRepository(repository.connection);
    const shiftManagementRepository = new KnexShiftManagementRepository(repository.connection);
    const transitionsRepository = new KnexTransitionsRepository(repository.connection);

    it('produces consistent SLA values across two runs with the same `now`', async () => {
        // Anchor every timestamp in the test to a fixed `now` so the test is hermetic against
        // system-clock drift on the runner.
        const now = dayjs('2026-05-24T12:00:00Z');

        // Seed 300 cases across the 3 measurement types
        const shift = await ShiftManagementMother.createShiftManagement(shiftManagementRepository, {
            work_days: {
                monday: { start: '08:00', end: '17:00' },
                tuesday: { start: '08:00', end: '17:00' },
                wednesday: { start: '08:00', end: '17:00' },
                thursday: { start: '08:00', end: '17:00' },
                friday: { start: '08:00', end: '17:00' },
            },
            holiday_dates: [],
        });
        const group = await GroupsMother.createWithCustomShiftManagement(groupsRepository, shift);

        const types = [Types.MINUTES.value, Types.HOURS.value, Types.DAYS.value];
        for (const type of types) {
            const ans = await AnsMother.createAns(ansRepository, {
                medicion_ans_id: type,
                intermedio: 4,
                vencido: 8,
            });
            const classification = await ClassificationsMother.create(classificationRepository, {
                ans_id: ans.id.value,
            });
            const transitionAns = await AnsMother.createAns(ansRepository, {
                medicion_ans_id: Types.HOURS.value,
                intermedio: 1,
                vencido: 2,
            });
            const transition = await TransitionsMother.createRandomTransition(transitionsRepository, {
                ans_id: transitionAns.id.value,
            });

            for (let i = 0; i < 100; i++) {
                // Spread `created_at` between ~3 min and ~7 days before `now`, deterministic.
                const createdMs = now.valueOf() - 60_000 * (i + 1) * (i + 3);
                await CasesMother.createCase(repository, {
                    clasificacion_id: classification.id.value,
                    grupo_id: group.id.value,
                    transicion_id: transition.id.value,
                    fecha_resolucion: null,
                    created_at: createdMs,
                });
            }
        }

        const service = new CalculateService(repository);

        // First run — populate
        for (const type of types) {
            await service.execute(type, now);
        }
        const firstSnapshot = await repository
            .connection('cases')
            .select(['id', ...SLA_COLUMNS])
            .whereNull('fecha_resolucion')
            .orderBy('id');

        // Second run with the same `now` — must be idempotent
        for (const type of types) {
            await service.execute(type, now);
        }
        const secondSnapshot = await repository
            .connection('cases')
            .select(['id', ...SLA_COLUMNS])
            .whereNull('fecha_resolucion')
            .orderBy('id');

        expect(JSON.parse(JSON.stringify(secondSnapshot))).toEqual(JSON.parse(JSON.stringify(firstSnapshot)));
    }, 120000); // 2 min timeout for 300-case seed + 2 runs
});
