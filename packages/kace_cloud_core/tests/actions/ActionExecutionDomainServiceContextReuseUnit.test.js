import { jest } from '@jest/globals';
import { ActionExecutionDomainService } from '../../src/actions/domain/ActionExecutionDomainService.js';
import { Action } from '../../src/actions/domain/Action.js';
import ActionMother from './domain/ActionMother.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Fixed UUIDs so they pass ValueObjectUuid validation inside CaseFinder
const CASE_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

/**
 * Builds a minimal Action object whose entity value is 'case' and whose
 * conditions always evaluate to TRUE (empty combinator rule-set).
 */
const makeCaseAction = (overrides = {}) => {
    const dto = ActionMother.dto({ entity: 'case', ...overrides });
    // Override conditions to an always-true (empty rules) condition set
    if (!overrides.conditions) {
        dto.conditions = { id: 'c', combinator: 'and', rules: [] };
    } else {
        dto.conditions = overrides.conditions;
    }
    return Action.create(dto);
};

/**
 * A minimal fake Case entity that satisfies entity.id.value / toJson().
 */
const makeFakeCase = (id = CASE_ID) => ({
    id: { value: id },
    toJson: () => ({ cases: { id, responsable_id: 'user-abc' } }),
});

// ---------------------------------------------------------------------------
// Suite A – No mutations: getCasoInfo called EXACTLY ONCE for N case-actions
// ---------------------------------------------------------------------------

describe('ActionExecutionDomainService – context reuse (no mutations)', () => {
    it('calls getCasoInfo exactly once when N case-actions are evaluated and none passes validation', async () => {
        const N = 3;
        const fakeCase = makeFakeCase('case-001');

        // Use entity='case' actions with conditions that will ALWAYS FAIL
        // (rule requires responsable_id === 'NEVER_MATCHES').
        // In the old code: validate() calls getCasoInfo N times (once per action).
        // After the fix: getCasoInfo called once (preload), then validateWithContext
        // reuses the context for all N actions → getCasoInfo called exactly 1 time.
        // Since all conditions fail, actionExecutor.execute is never called and the
        // caseFinder refresh branch is never reached, keeping this test focused.
        const neverMatchConditions = {
            id: 'c',
            combinator: 'and',
            rules: [
                {
                    id: 'r1',
                    field: 'cases.responsable_id',
                    operator: '=',
                    value: 'NEVER_MATCHES',
                    value_type: 'text',
                },
            ],
        };
        const actions = Array.from({ length: N }, () =>
            makeCaseAction({ entity: 'case', conditions: neverMatchConditions })
        );

        // The context returned by getCasoInfo for the case — responsable_id does
        // NOT match 'NEVER_MATCHES', so all conditions evaluate to false.
        const fakeContext = { cases: { id: CASE_ID, responsable_id: 'user-abc' } };
        const getCasoInfoMock = jest.fn().mockResolvedValue(fakeContext);

        const actionRepository = {
            getCasoInfo: getCasoInfoMock,
            // FinderByTrigger calls actionRepository.search(criteria)
            search: jest.fn().mockResolvedValue(actions),
        };

        const actionExecutor = {
            execute: jest.fn().mockResolvedValue(undefined),
        };

        // caseRepository not reached (no action passes → no caseFinder call)
        const caseRepository = {
            find: jest.fn().mockResolvedValue(fakeCase),
        };

        const service = new ActionExecutionDomainService(actionRepository, actionExecutor, caseRepository);

        await service.execute('crear_caso', fakeCase);

        // THE KEY ASSERTION:
        // Before fix: getCasoInfo called N (3) times — once per action inside validate().
        // After fix:  getCasoInfo called exactly 1 time — preloaded once, reused in loop.
        expect(getCasoInfoMock).toHaveBeenCalledTimes(1);
        // No action passed conditions → executor never called
        expect(actionExecutor.execute).toHaveBeenCalledTimes(0);
    });
});

// ---------------------------------------------------------------------------
// Suite B – Refresh after mutation: getCasoInfo called again after case-action
// ---------------------------------------------------------------------------

describe('ActionExecutionDomainService – context refresh after mutation', () => {
    it('calls getCasoInfo again after a case-entity action executes', async () => {
        const fakeContext1 = { cases: { id: CASE_ID, responsable_id: 'user-abc' } };
        const fakeContext2 = { cases: { id: CASE_ID, responsable_id: 'user-xyz' } };
        const fakeCase1 = makeFakeCase(CASE_ID);
        const fakeCase2 = makeFakeCase(CASE_ID);

        // One action with entity='case' (always-true conditions) — triggers the
        // caseFinder/context-refresh branch.
        const mutatingAction = makeCaseAction({ entity: 'case' });

        const getCasoInfoMock = jest
            .fn()
            .mockResolvedValueOnce(fakeContext1) // initial preload
            .mockResolvedValueOnce(fakeContext2); // refresh after mutation

        const actionRepository = {
            getCasoInfo: getCasoInfoMock,
            search: jest.fn().mockResolvedValue([mutatingAction]),
        };

        const actionExecutor = {
            execute: jest.fn().mockResolvedValue(undefined),
        };

        const caseRepository = {
            // CaseFinder.execute calls caseRepository.find
            find: jest.fn().mockResolvedValue(fakeCase2),
        };

        const service = new ActionExecutionDomainService(actionRepository, actionExecutor, caseRepository);

        await service.execute('crear_caso', fakeCase1);

        // Initial preload (1) + one refresh after the mutating action (2) = 2
        expect(getCasoInfoMock).toHaveBeenCalledTimes(2);
        expect(actionExecutor.execute).toHaveBeenCalledTimes(1);
    });
});
