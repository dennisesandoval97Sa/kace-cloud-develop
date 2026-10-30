import { production as knexConfig } from '@kace/database/knexfile';
import { KnexCaseRepository } from '@kace/core/src/cases/index.js';
import { KnexClassificationRepository } from '@kace/core/src/classifications/index.js';
import { KnexCommentsRepository } from '@kace/core/src/comments/index.js';
import { CaseFactory } from '@kace/core/src/factories/CaseFactory.js';
import { TransitionFactory } from '@kace/core/src/factories/TransitionFactory.js';
import { StateFactory } from '@kace/core/src/factories/StateFactory.js';
import { TestHelper } from '@kace/api-common';
import { Helper } from '@kace/core/src/shared/index.js';

describe('CaseController test', () => {
    const repository = new KnexCaseRepository(knexConfig);
    const commentRepository = new KnexCommentsRepository(knexConfig);
    const classificationRepository = new KnexClassificationRepository(knexConfig);
    let initialStats;
    const baseUrl =
        process.env.APPS_ENVIRONMENT === 'staging'
            ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/cases-count`
            : 'http://127.0.0.1:60010';

    afterAll(async () => {
        try {
            repository.connection.destroy();
            commentRepository.connection.destroy();
            classificationRepository.connection.destroy();
        } catch (error) {
            Helper.logInfo(error);
        }
    });

    beforeEach(async () => {
        initialStats = await TestHelper.getRequest(`${baseUrl}`);

        console.log('initialStats', initialStats);
        initialStats = initialStats.data.data;
    });

    it('updates ans counters accurately when cases with different statuses are created', async () => {
        await CaseFactory.create({ ans_posicion: 1 });
        await CaseFactory.create({ fecha_resolucion: new Date() });
        await CaseFactory.create({ ans_posicion: 3 });

        const expectedStats = {
            toOvercome: initialStats.ans.toOvercome + 1,
            defeated: initialStats.ans.defeated + 1,
            managed: initialStats.ans.managed + 1,
            pending: initialStats.ans.pending + 2,
        };

        const updatedStatsResponse = await TestHelper.getRequest(baseUrl);
        const updatedStats = updatedStatsResponse.data.data;

        expect(updatedStats.ans.toOvercome).toEqual(expectedStats.toOvercome);
        expect(updatedStats.ans.defeated).toEqual(expectedStats.defeated);
        expect(updatedStats.ans.managed).toEqual(expectedStats.managed);
        expect(updatedStats.ans.pending).toEqual(expectedStats.pending);
    });

    it('increments the state count when a case with a specific transition is created', async () => {
        const stateId = await StateFactory.create();
        const transicion3 = await TransitionFactory.create({
            estado_actual_id: stateId.id.value,
        });

        await CaseFactory.create({ transicion_id: transicion3.id.value });

        const responseStats = await TestHelper.getRequest(baseUrl);
        const { states } = responseStats.data.data;
        const findState = states.find((statsItem) => statsItem.id === stateId.id.value);

        expect(findState.count).toEqual('1');
    });
});
