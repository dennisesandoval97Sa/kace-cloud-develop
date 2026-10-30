import { jest } from '@jest/globals';
import { CaseCreator } from '../../src/cases/application/create/CaseCreator.js';
import { TransitionRuleValidator } from '../../src/transition-rules/domain/TransitionRuleValidator.js';
import CasesMother from './domain/CasesMother.js';

/**
 * Builds a minimal repository fake that satisfies every method CaseCreator.execute() calls:
 *   - find          (via DomainCaseFinder.execute)
 *   - findByIdForAns (via DomainCaseFinder.executeForAns — called by updateSLATimers, wrapped in try/catch)
 *   - save
 *   - saveHistory
 *   - update
 *   - findByExternalCode
 *   - connection    (required by EventLogger constructor — must be a function so KnexRepository
 *                    skips its own Knex(config) call and uses it directly)
 */
function buildRepositoryFake() {
    // KnexRepository checks `typeof config !== 'function'`; if connection IS a function it uses it
    // directly as this.#connection. The function also doubles as a query-builder factory for any
    // table() calls EventLogger makes internally (all wrapped in try/catch so errors are swallowed).
    const queryBuilderFake = {
        insert: jest.fn().mockResolvedValue([]),
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(null),
        select: jest.fn().mockReturnThis(),
        returning: jest.fn().mockReturnThis(),
    };
    // connection must be a function (typeof === 'function') to bypass Knex(config) in KnexRepository
    const connection = Object.assign(
        function connectionFn() {
            return queryBuilderFake;
        },
        {
            // Knex instances expose .raw; add a no-op so any internal call doesn't throw
            raw: jest.fn().mockResolvedValue({ rows: [] }),
        }
    );

    return {
        connection,
        // DomainCaseFinder.execute → find()
        find: jest.fn().mockResolvedValue(null), // null → no duplicate id
        // DomainCaseFinder.executeForAns → findByIdForAns() — updateSLATimers wraps this in try/catch
        findByIdForAns: jest.fn().mockResolvedValue([]),
        // save() must return the same Case so CaseResponse can wrap it
        save: jest.fn().mockImplementation(async (kase) => kase),
        // saveHistory()
        saveHistory: jest.fn().mockResolvedValue(undefined),
        // update() used by updateSLATimers (inside try/catch)
        update: jest.fn().mockResolvedValue(undefined),
        // findByExternalCode — not needed when external_code is null, but present for safety
        findByExternalCode: jest.fn().mockResolvedValue(null),
        // buildCaseContextFromDto — called by TransitionRuleValidator.validateFromDto if NOT skipped
        buildCaseContextFromDto: jest.fn().mockResolvedValue({}),
    };
}

/**
 * Builds minimal fakes for both transition repositories.
 * enforceRuleForTransition is spied on (not calling real implementations),
 * so these fakes only need to exist to satisfy the null-checks inside CaseCreator.
 */
function buildTransitionRepoFakes() {
    const transitionRuleRepository = {
        find: jest.fn().mockResolvedValue(null),
    };
    const transitionsCaseRepository = {
        findById: jest.fn().mockResolvedValue(null),
    };
    return { transitionRuleRepository, transitionsCaseRepository };
}

function buildActionExecutionService() {
    return { execute: jest.fn().mockResolvedValue(true) };
}

describe('CaseCreator – skipTransitionValidation flag', () => {
    let enforceRuleSpy;

    beforeEach(() => {
        enforceRuleSpy = jest.spyOn(TransitionRuleValidator, 'enforceRuleForTransition').mockResolvedValue(undefined);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('does NOT call enforceRuleForTransition when skipTransitionValidation is true', async () => {
        // Arrange
        const dto = CasesMother.dto(); // transicion_id is a uuid (truthy) by default
        const repository = buildRepositoryFake();
        const { transitionRuleRepository, transitionsCaseRepository } = buildTransitionRepoFakes();
        const actionExecutionService = buildActionExecutionService();

        const creator = new CaseCreator(
            repository,
            actionExecutionService,
            null, // eventPublisher – optional
            null, // tenant  – TenantContext.getTenant() is called internally; ok in unit context
            null, // currentUser
            transitionRuleRepository,
            transitionsCaseRepository
        );

        // Act
        await creator.execute(dto, { skipTransitionValidation: true });

        // Assert
        expect(enforceRuleSpy).not.toHaveBeenCalled();
    });

    it('DOES call enforceRuleForTransition once when skipTransitionValidation is absent (default)', async () => {
        // Arrange
        const dto = CasesMother.dto(); // transicion_id is a uuid (truthy) by default
        const repository = buildRepositoryFake();
        const { transitionRuleRepository, transitionsCaseRepository } = buildTransitionRepoFakes();
        const actionExecutionService = buildActionExecutionService();

        const creator = new CaseCreator(
            repository,
            actionExecutionService,
            null,
            null,
            null,
            transitionRuleRepository,
            transitionsCaseRepository
        );

        // Act
        await creator.execute(dto); // no config → defaults to null → flag absent

        // Assert – validator was called exactly once with the correct positional args
        expect(enforceRuleSpy).toHaveBeenCalledTimes(1);
        expect(enforceRuleSpy).toHaveBeenCalledWith(
            dto.transicion_id,
            transitionsCaseRepository,
            transitionRuleRepository,
            dto,
            repository,
            'dto'
        );
    });

    it('does NOT call enforceRuleForTransition when transition repositories are absent (default guard)', async () => {
        // Arrange — both repositories omitted; the condition in CaseCreator requires all three
        const dto = CasesMother.dto(); // transicion_id is present (truthy)
        const repository = buildRepositoryFake();

        const creator = new CaseCreator(
            repository,
            buildActionExecutionService(),
            null,
            null,
            null
            // transitionRuleRepository and transitionsCaseRepository are intentionally omitted
        );

        // Act
        await creator.execute(dto);

        // Assert — original guard: needs dto.transicion_id AND both repos; repos absent → skipped
        expect(enforceRuleSpy).not.toHaveBeenCalled();
    });
});
