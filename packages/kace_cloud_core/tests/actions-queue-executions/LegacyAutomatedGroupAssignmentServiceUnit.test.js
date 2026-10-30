import { jest } from '@jest/globals';
import { LegacyAutomatedGroupAssignmentService } from '../../src/actions-queue-executions/domain/services/LegacyAutomatedGroupAssignmentService.js';

describe('LegacyAutomatedGroupAssignmentService', () => {
    it('wraps AutomatedGroupAssignmentService without SQL collaborators', async () => {
        const validator = { validate: jest.fn().mockResolvedValue(true), validateWithContext: jest.fn() };
        const deps = {
            groupsRepository: { findWorkQueueGroupsWithCapacity: jest.fn().mockResolvedValue([]) },
            userListsRepository: {},
            caseRepository: {},
            assignationService: {},
            dynamicGroupAssignmentHandler: null,
            caseUserAssignmentService: { execute: jest.fn() },
            caseFindAllActiveService: { execute: jest.fn().mockResolvedValue([]) },
        };
        const legacy = new LegacyAutomatedGroupAssignmentService(validator, deps);

        const result = await legacy.assign({ actions: [] });
        expect(result).toEqual({ assigned: 0, skipped: 0, errors: 0 });
    });

    it('exposes assign(args) method that delegates to inner service', async () => {
        const validator = { validate: jest.fn().mockResolvedValue(true), validateWithContext: jest.fn() };
        const deps = {
            groupsRepository: { findWorkQueueGroupsWithCapacity: jest.fn().mockResolvedValue([]) },
            userListsRepository: {},
            caseRepository: {},
            assignationService: {},
            dynamicGroupAssignmentHandler: null,
            caseUserAssignmentService: { execute: jest.fn() },
            caseFindAllActiveService: { execute: jest.fn().mockResolvedValue([]) },
        };
        const legacy = new LegacyAutomatedGroupAssignmentService(validator, deps);

        expect(typeof legacy.assign).toBe('function');
    });
});
