import { CaseUpdater, KnexCaseRepository } from '@kace/core/src/cases';
import { production as knexConfig } from '@kace/database/knexfile';
import { TestHelper } from '@kace/api-common';

import { CaseFactory } from '@kace/core/src/factories/CaseFactory';

describe('ActionUpdateModelController test', () => {
    const repository = new KnexCaseRepository(knexConfig);
    const actionExecutionServiceMock = {
        execute: async (trigger, caso) => (trigger && caso ? true : null),
    };

    const baseUrl =
        process.env.APPS_ENVIRONMENT === 'staging'
            ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/case-available-states`
            : 'http://127.0.0.1:60060';

    afterAll(async () => {
        try {
            repository.connection.destroy();
        } catch (error) {
            console.log(error);
        }
    });

    it('can fetch available states for case', async () => {
        const kase = await CaseFactory.create();
        const updater = new CaseUpdater(repository, actionExecutionServiceMock);

        updater.execute(kase.id.value, { vista: 'Vista actualizada' });

        const caseCalculate = await TestHelper.getRequest(`${baseUrl}/${kase.id.value}`);
        const response = caseCalculate.data.data;
        expect(response.items).toBeDefined();
    });
});
