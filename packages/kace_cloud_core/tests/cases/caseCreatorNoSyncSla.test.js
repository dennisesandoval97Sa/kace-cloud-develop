import { describe, it, expect, jest } from '@jest/globals';
import { CaseCreator } from '../../src/cases/application/create/CaseCreator.js';
import CasesMother from '../cases/domain/CasesMother.js';

/**
 * Minimal repository fake satisfying every method CaseCreator.execute() (no trx) calls:
 *   - find             (via DomainCaseFinder.execute → duplicate id check)
 *   - save / saveHistory
 *   - findByExternalCode
 *   - connection       (required by EventLogger constructor — must be a function so
 *                       KnexRepository skips its own Knex(config) call and uses it directly)
 */
function buildRepositoryFake() {
    const queryBuilderFake = {
        insert: jest.fn().mockResolvedValue([]),
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(null),
        select: jest.fn().mockReturnThis(),
        returning: jest.fn().mockReturnThis(),
    };
    const connection = Object.assign(
        function connectionFn() {
            return queryBuilderFake;
        },
        {
            raw: jest.fn().mockResolvedValue({ rows: [] }),
        }
    );

    return {
        connection,
        find: jest.fn().mockResolvedValue(null),
        save: jest.fn().mockImplementation(async (kase) => kase),
        saveHistory: jest.fn().mockResolvedValue(undefined),
        update: jest.fn().mockResolvedValue(undefined),
        findByExternalCode: jest.fn().mockResolvedValue(null),
        findByIdForAns: jest.fn().mockResolvedValue([]),
    };
}

function buildActionExecutionService() {
    return { execute: jest.fn().mockResolvedValue(true) };
}

describe('CaseCreator ya no calcula SLA timers de forma síncrona', () => {
    it('no llama executeForAns durante execute()', async () => {
        // Arrange
        const dto = CasesMother.dto();
        const repository = buildRepositoryFake();

        const creator = new CaseCreator(
            repository,
            buildActionExecutionService(),
            null, // eventPublisher
            null, // tenant (TenantContext.getTenant() used internally; ok in unit context)
            null // currentUser
        );

        // The SLA path runs through finder.executeForAns(). Spy on it to assert it is never called.
        const forAnsSpy = jest.spyOn(creator.finder, 'executeForAns');

        // Act
        await creator.execute(dto, {});

        // Assert
        expect(forAnsSpy).not.toHaveBeenCalled();
    });
});
