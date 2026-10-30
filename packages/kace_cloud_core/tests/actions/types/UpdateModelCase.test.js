import { jest } from '@jest/globals';
import { Action } from '../../../src/actions/index.js';
import { Case, KnexCaseRepository } from '../../../src/cases/index.js';
import { KnexActionUpdateModelRepository } from '../../../src/action-update-model/index.js';
import { knexConfig } from '../../knexfile.js';
import { UpdateModelCase } from '../../../src/actions/domain/types/UpdateModelCase.js';
import { v4 as uuidv4 } from 'uuid';
import ActionMother from '../../actions/domain/ActionMother.js';
import ActionUpdateModelMother from '../../action-update-model/domain/ActionUpdateModelMother.js';
import CasesMother from '../../cases/domain/CasesMother.js';

describe('UpdateModelCase', () => {
    const caseRepository = new KnexCaseRepository(knexConfig);
    const actionUpdateModelRepository = new KnexActionUpdateModelRepository(caseRepository.connection);
    const formulaEvaluator = { execute: async () => 'value' };
    const saveValueService = { execute: async () => true };

    const updateModelCase = new UpdateModelCase(
        caseRepository,
        actionUpdateModelRepository,
        formulaEvaluator,
        saveValueService
    );

    it('should return false if the caseEntity is not an instance of Case', async () => {
        const invalidCase = {};
        const validAction = Action.create(ActionMother.dto());

        await expect(updateModelCase.execute(invalidCase, validAction)).rejects.toThrow(
            'The provided entity is not a valid instance of "Case".'
        );
    });

    it('should return false if the action is not an instance of Action', async () => {
        const validCase = Case.create(CasesMother.dto());
        const invalidAction = {};

        await expect(updateModelCase.execute(validCase, invalidAction)).rejects.toThrow(
            'The provided entity is not a valid instance of "Action".'
        );
    });

    it('should throw if the case is not found', async () => {
        const validCase = Case.create(CasesMother.dto());
        const validAction = Action.create(ActionMother.dto());

        await expect(updateModelCase.execute(validCase, validAction)).rejects.toThrow(
            `Case with ID ${validCase.id.value} not found.`
        );
    });

    it('should throw if the ActionUpdateModel is not found', async () => {
        const validCase = await CasesMother.createCase(caseRepository);
        const validAction = Action.create(ActionMother.dto({ model_update_id: uuidv4() }));

        await expect(updateModelCase.execute(validCase, validAction)).rejects.toThrow(
            `No modelUpdate found with the id: ${validAction.model_update_id.value}`
        );
    });

    it('should correctly update the model value when ActionUpdateModel is found', async () => {
        const actionUpdateModel = await ActionUpdateModelMother.create(actionUpdateModelRepository);
        const validCase = await CasesMother.createCase(caseRepository);
        const validAction = Action.create(ActionMother.dto({ model_update_id: actionUpdateModel.id.value }));

        const result = await updateModelCase.execute(validCase, validAction);
        expect(result).toBe(true);
    });

    it('should NOT call logEventCaseClose when fecha_resolucion update fails', async () => {
        const failingSaveValueService = {
            execute: async () => {
                throw new Error('SLA calculation failed: dueDateTime null for end are invalid');
            },
        };

        const updateModelCaseWithFailingSave = new UpdateModelCase(
            caseRepository,
            actionUpdateModelRepository,
            formulaEvaluator,
            failingSaveValueService
        );

        const logEventCaseCloseSpy = jest
            .spyOn(updateModelCaseWithFailingSave, 'logEventCaseClose')
            .mockResolvedValue(undefined);

        const actionUpdateModel = await ActionUpdateModelMother.create(actionUpdateModelRepository, {
            aggregate: 'Case',
            field: 'fecha_resolucion',
        });
        const validCase = await CasesMother.createCase(caseRepository);
        const validAction = Action.create(ActionMother.dto({ model_update_id: actionUpdateModel.id.value }));

        const result = await updateModelCaseWithFailingSave.execute(validCase, validAction);

        expect(result).toBe(false);
        expect(logEventCaseCloseSpy).not.toHaveBeenCalled();

        logEventCaseCloseSpy.mockRestore();
    });

    it('should call logEventCaseClose when fecha_resolucion update succeeds', async () => {
        const updateModelCaseWithSucceedingSave = new UpdateModelCase(
            caseRepository,
            actionUpdateModelRepository,
            formulaEvaluator,
            saveValueService
        );

        const logEventCaseCloseSpy = jest
            .spyOn(updateModelCaseWithSucceedingSave, 'logEventCaseClose')
            .mockResolvedValue(undefined);

        const actionUpdateModel = await ActionUpdateModelMother.create(actionUpdateModelRepository, {
            aggregate: 'Case',
            field: 'fecha_resolucion',
        });
        const validCase = await CasesMother.createCase(caseRepository);
        const validAction = Action.create(ActionMother.dto({ model_update_id: actionUpdateModel.id.value }));

        const result = await updateModelCaseWithSucceedingSave.execute(validCase, validAction);

        expect(result).toBe(true);
        expect(logEventCaseCloseSpy).toHaveBeenCalledTimes(1);

        logEventCaseCloseSpy.mockRestore();
    });
});
