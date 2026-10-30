import { production as knexConfig } from '@kace/database/knexfile';
import { KnexCaseRepository } from '@kace/core/src/cases/index.js';
import { CaseFactory } from '@kace/core/src/factories/CaseFactory.js';
import { TransitionFactory } from '@kace/core/src/factories/TransitionFactory.js';
import { StateFactory } from '@kace/core/src/factories/StateFactory.js';
import { GroupFactory } from '@kace/core/src/factories/GroupFactory.js';
import { KnexCommentsRepository } from '@kace/core/src/comments/index.js';
import { KnexClassificationRepository } from '@kace/core/src/classifications/index.js';
import { TestHelper } from '@kace/api-common';
import { v4 as uuidv4 } from 'uuid';
import { Helper } from '@kace/core/src/shared/index.js';

describe('CaseController test', () => {
    const repository = new KnexCaseRepository(knexConfig);
    const commentRepository = new KnexCommentsRepository(knexConfig);
    const classificationRepository = new KnexClassificationRepository(knexConfig);
    let grupo_id;
    let initialStats;
    const baseUrl =
        process.env.APPS_ENVIRONMENT === 'staging'
            ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/cases-count-by-group`
            : 'http://127.0.0.1:60011';

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
        grupo_id = uuidv4();
        await GroupFactory.create({ id: grupo_id });

        initialStats = await TestHelper.getRequest(`${baseUrl}/${grupo_id}`);

        initialStats = initialStats.data.data;
    });

    it('increments ans counters accurately for different case positions and resolutions within a group', async () => {
        await CaseFactory.create({ ans_posicion: 1, grupo_id });
        await CaseFactory.create({ fecha_resolucion: new Date(), grupo_id });
        await CaseFactory.create({ ans_posicion: 3, grupo_id });

        const expectedStats = {
            toOvercome: initialStats.ans.toOvercome + 1,
            defeated: initialStats.ans.defeated + 1,
            managed: initialStats.ans.managed + 1,
            pending: initialStats.ans.pending + 2,
        };

        const updatedStatsResponse = await TestHelper.getRequest(`${baseUrl}/${grupo_id}`);

        const updatedStats = updatedStatsResponse.data.data;

        expect(updatedStats.ans.toOvercome).toEqual(expectedStats.toOvercome);
        expect(updatedStats.ans.defeated).toEqual(expectedStats.defeated);
        expect(updatedStats.ans.managed).toEqual(expectedStats.managed);
        expect(updatedStats.ans.pending).toEqual(expectedStats.pending);
    });

    it('increments state count accurately when a case with a specific transition and group is created', async () => {
        const stateId = await StateFactory.create();
        const transicion3 = await TransitionFactory.create({
            estado_actual_id: stateId.id.value,
        });

        await CaseFactory.create({ transicion_id: transicion3.id.value, grupo_id });

        const responseStats = await TestHelper.getRequest(`${baseUrl}/${grupo_id}`);
        const { states } = responseStats.data.data;
        const findState = states.find((statsItem) => statsItem.id === stateId.id.value);

        expect(findState.count).toEqual('1');
    });
});
