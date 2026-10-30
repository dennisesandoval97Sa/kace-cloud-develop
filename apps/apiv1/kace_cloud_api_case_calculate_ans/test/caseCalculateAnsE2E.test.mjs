import { KnexCaseRepository } from '@kace/core/src/cases';
import { production as knexConfig } from '@kace/database/knexfile';
import { TestHelper } from '@kace/api-common';

import { CaseFactory } from '@kace/core/src/factories/CaseFactory';

describe('CaseCalculateAnsController test', () => {
    const repository = new KnexCaseRepository(knexConfig);

    const baseUrl =
        process.env.APPS_ENVIRONMENT === 'staging'
            ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/case-calculate-ans`
            : 'http://127.0.0.1:60059';

    afterAll(async () => {
        try {
            repository.connection.destroy();
        } catch (error) {
            console.log(error);
        }
    });

    it('can fetch transitions for case', async () => {
        const kase = await CaseFactory.create();

        const caseCalculate = await TestHelper.getRequest(`${baseUrl}/${kase.id.value}`);
        const response = caseCalculate.data.data;
        expect(caseCalculate.status).toBe(200);
        expect(response).toBeInstanceOf(Object);
        expect(response.id).toEqual(kase.id.value);
        expect(response.position).toBeDefined();
    });
});
