import { Action } from '../../../src/actions/index.js';
import { AssignUserByExternalCodeCase } from '../../../src/actions/domain/types/AssignUserByExternalCodeCase.js';
import { Case, KnexCaseRepository } from '../../../src/cases/index.js';
import { knexConfig } from '../../knexfile.js';
import { KnexUsersRepository } from '../../../src/users/index.js';
import ActionMother from '../../actions/domain/ActionMother.js';
import CasesMother from '../../cases/domain/CasesMother.js';
import UsersMother from '../../users/domain/UsersMother.js';

describe('AssignUserByExternalCodeCase', () => {
    const caseRepository = new KnexCaseRepository(knexConfig);
    const userRepository = new KnexUsersRepository(caseRepository.connection);
    const assignUserByExternalCodeCase = new AssignUserByExternalCodeCase(caseRepository, userRepository);

    it('should return false if the caseEntity is not an instance of Case', async () => {
        const invalidCase = {};
        const validAction = Action.create(ActionMother.dto({ external_user_code: '123' }));

        const result = await assignUserByExternalCodeCase.execute(invalidCase, validAction);
        expect(result).toBe(false);
    });

    it('should return false if the action is not an instance of Action', async () => {
        const validCase = Case.create(CasesMother.dto());
        const invalidAction = {};

        const result = await assignUserByExternalCodeCase.execute(validCase, invalidAction);
        expect(result).toBe(false);
    });

    it('should return false if the case is not found', async () => {
        const validCase = Case.create(CasesMother.dto());
        const validAction = Action.create(ActionMother.dto({ external_user_code: '123' }));

        const result = await assignUserByExternalCodeCase.execute(validCase, validAction);
        expect(result).toBe(false);
    });

    it('should return false if no user is found with the given external user code', async () => {
        const validCase = await CasesMother.createCase(caseRepository);
        const validAction = Action.create(ActionMother.dto({ external_user_code: '123' }));

        const result = await assignUserByExternalCodeCase.execute(validCase, validAction);
        expect(result).toBe(false);
    });
});
