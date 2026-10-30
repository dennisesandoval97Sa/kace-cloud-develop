import { describe, expect, it, jest } from '@jest/globals';
import { Controller } from '../src/controller.mjs';
import { RegisterController } from '../src/RegisterController.mjs';
import { WorkspacePriorityListController } from '../src/WorkspacePriorityListController.mjs';
import { WorkspacePriorityReorderController } from '../src/WorkspacePriorityReorderController.mjs';
import { WorkspacePriorityReorderStatusController } from '../src/WorkspacePriorityReorderStatusController.mjs';

describe('Channel Hub custom controllers', () => {
    it.each([
        [RegisterController, 'actionCreate', 'actionRegister'],
        [WorkspacePriorityListController, 'actionRead', 'actionWorkspacePriorityList'],
        [WorkspacePriorityReorderController, 'actionCreate', 'actionWorkspacePriorityReorder'],
        [WorkspacePriorityReorderStatusController, 'actionRead', 'actionWorkspacePriorityReorderStatus'],
    ])(
        '%p is a dedicated BaseController composition for its public action',
        async (ControllerClass, action, target) => {
            expect(ControllerClass.prototype).toBeInstanceOf(Controller);
            const expected = { toJson: () => ({ statusCode: 200 }) };
            const context = { [target]: jest.fn().mockResolvedValue(expected) };

            await expect(ControllerClass.prototype[action].call(context)).resolves.toBe(expected);
            expect(context[target]).toHaveBeenCalledTimes(1);
        }
    );
});
