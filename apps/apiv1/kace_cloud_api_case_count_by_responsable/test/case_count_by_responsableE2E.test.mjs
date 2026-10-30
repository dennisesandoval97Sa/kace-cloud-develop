import { production as knexConfig } from '@kace/database/knexfile';
import { KnexCaseRepository } from '@kace/core/src/cases/index.js';
import { v4 as uuidv4 } from 'uuid';
import { CaseFactory } from '@kace/core/src/factories/CaseFactory.js';
import { TransitionFactory } from '@kace/core/src/factories/TransitionFactory.js';
import { StateFactory } from '@kace/core/src/factories/StateFactory.js';
import { KnexClassificationRepository } from '@kace/core/src/classifications/index.js';
import { KnexCommentsRepository } from '@kace/core/src/comments/index.js';
import { UserFactory } from '@kace/core/src/factories/UserFactory.js';
import { TestHelper } from '@kace/api-common';
import { Helper } from '@kace/core/src/shared/index.js';

describe('CaseController test', () => {
    const repository = new KnexCaseRepository(knexConfig);
    const commentRepository = new KnexCommentsRepository(knexConfig);
    const classificationRepository = new KnexClassificationRepository(knexConfig);
    let responsable_id;
    let initialStats;
    const baseUrl =
        process.env.APPS_ENVIRONMENT === 'staging'
            ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/cases-count-by-responsable`
            : 'http://127.0.0.1:60012';

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
        responsable_id = uuidv4();
        await UserFactory.create({ id: responsable_id });
        initialStats = await TestHelper.getRequest(`${baseUrl}/${responsable_id}`);
        initialStats = initialStats.data.data;
    });

    it('updates ans counters accurately when cases with different statuses are created', async () => {
        await CaseFactory.create({ ans_posicion: 1, responsable_id });
        await CaseFactory.create({ fecha_resolucion: new Date(), responsable_id });
        await CaseFactory.create({ ans_posicion: 3, responsable_id });

        const expectedStats = {
            toOvercome: initialStats.ans.toOvercome + 1,
            defeated: initialStats.ans.defeated + 1,
            managed: initialStats.ans.managed + 1,
            pending: initialStats.ans.pending + 2,
        };

        const updatedStatsResponse = await TestHelper.getRequest(`${baseUrl}/${responsable_id}`);
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

        await CaseFactory.create({
            transicion_id: transicion3.id.value,
            responsable_id,
        });

        const responseStats = await TestHelper.getRequest(`${baseUrl}/${responsable_id}`);
        const { states } = responseStats.data.data;
        const findState = states.find((statsItem) => statsItem.id === stateId.id.value);

        expect(findState.count).toEqual('1');
    });
});
