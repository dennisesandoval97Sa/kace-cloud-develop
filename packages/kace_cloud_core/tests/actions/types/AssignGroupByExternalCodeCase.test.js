import { AssignGroupByExternalCodeCase } from '../../../src/actions/domain/types/AssignGroupByExternalCodeCase.js';
import { Action } from '../../../src/actions/index.js';
import { Groups, KnexGroupsRepository } from '../../../src/grupos/index.js';
import { Case, KnexCaseRepository } from '../../../src/cases/index.js';
import { knexConfig } from '../../knexfile.js';
import { KnexUsersRepository } from '../../../src/users/index.js';
import { KnexClassificationRepository } from '../../../src/classifications/index.js';
import ActionMother from '../../actions/domain/ActionMother.js';
import CasesMother from '../../cases/domain/CasesMother.js';
import { GroupsMother } from '../../grupos/domain/GroupsMother.js';
import { v4 as uuidV4 } from 'uuid';

describe('AssignGroupByExternalCodeCase', () => {
    const caseRepository = new KnexCaseRepository(knexConfig);
    const userRepository = new KnexUsersRepository(caseRepository.connection);
    const groupRepository = new KnexGroupsRepository(caseRepository.connection);
    const classificationRepository = new KnexClassificationRepository(caseRepository.connection);
    const assignationServiceMock = { execute: async (grupo) => (grupo ? uuidV4() : null) };

    const assignGroupByExternalCodeCase = new AssignGroupByExternalCodeCase(
        caseRepository,
        userRepository,
        groupRepository,
        classificationRepository,
        assignationServiceMock
    );

    it('should throw an error if the caseEntity is not a valid instance of Case', async () => {
        const invalidCase = {};
        const validAction = Action.create(ActionMother.dto({ external_group_code: '123' }));
        const result = await assignGroupByExternalCodeCase.execute(invalidCase, validAction);
        expect(result).toBe(false);
    });

    it('should throw an error if the action is not a valid instance of Action', async () => {
        const validCase = Case.create(CasesMother.dto());
        const invalidAction = {};
        const result = await assignGroupByExternalCodeCase.execute(validCase, invalidAction);
        expect(result).toBe(false);
    });

    it('should return false if the case is not found', async () => {
        const validCase = Case.create(CasesMother.dto());
        const validAction = Action.create(ActionMother.dto({ external_group_code: '123' }));
        const result = await assignGroupByExternalCodeCase.execute(validCase, validAction);
        expect(result).toBe(false);
    });

    it('should return false if no group is found and no default group in classification', async () => {
        const validCase = await CasesMother.createCase(caseRepository);
        const validAction = Action.create(ActionMother.dto({ external_group_code: '123' }));

        const result = await assignGroupByExternalCodeCase.execute(validCase, validAction);
        expect(result).toBe(false);
    });
});
