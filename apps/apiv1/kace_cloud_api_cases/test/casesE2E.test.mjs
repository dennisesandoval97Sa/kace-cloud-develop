import { KnexCaseRepository } from '@kace/core/src/cases';
import { testPostgres as knexConfig } from '@kace/database/knexfile';
import { TestHelper } from '@kace/api-common';
import { uuidv4 } from '@kace/core/src/factories/Factory.js';
import { CaseFactory } from '@kace/core/src/factories/CaseFactory';
import { ClassificationFactory } from '@kace/core/src/factories/ClassificationFactory';
import axios from 'axios';

describe('CasesController test', () => {
    const repository = new KnexCaseRepository(knexConfig);

    const baseUrl =
        process.env.APPS_ENVIRONMENT === 'staging'
            ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/cases`
            : 'http://127.0.0.1:60008';

    beforeAll(async () => {
        await TestHelper.setupAxiosInterceptors();
    });

    afterAll(async () => {
        if (repository?.connection) {
            await repository.connection.destroy();
        }
        axios.interceptors.request.handlers = [];
    });

    it('can create a Case', async () => {
        const caseFactory = new CaseFactory(knexConfig);

        const creatingFactory = await caseFactory.create();

        const payload = await caseFactory.generateAttributes();

        const response = await TestHelper.postRequest(baseUrl, payload);
    });
});
