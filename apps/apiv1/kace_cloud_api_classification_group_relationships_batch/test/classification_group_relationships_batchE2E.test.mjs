import { KnexClassificationGroupRelationshipRepository } from '@kace/core/src/classification-group-relationships/index.js';
import { ClassificationFactory } from '@kace/core/src/factories/ClassificationFactory.js';
import { GroupFactory } from '@kace/core/src/factories/GroupFactory.js';
import { OneScriptFactory } from '@kace/core/src/factories/OneScriptFactory.js';
import { production as knexConfig } from '@kace/database/knexfile';
import { TestHelper } from '@kace/api-common';
import { v4 as uuidv4 } from 'uuid';
import { Helper } from '@kace/core/src/shared/index.js';

describe('ClassificationGroupController test', () => {
    const repository = new KnexClassificationGroupRelationshipRepository(knexConfig);

    const baseUrl =
        process.env.APPS_ENVIRONMENT === 'staging'
            ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/classification-group-relationships-batch`
            : `http://127.0.0.1:60065`;

    afterAll(async () => {
        try {
            await repository.connection.destroy();
        } catch (error) {
            Helper.logInfo(error);
        }
    });

    it('should batch add classifications to a group', async () => {
        const classification1 = await ClassificationFactory.create();
        const classification2 = await ClassificationFactory.create();
        const group = await GroupFactory.create();
        const onescript = await OneScriptFactory.create();

        const payload = [
            {
                classification_id: classification1.id.value,
                group_id: group.id.value,
                form: onescript.id.value,
            },
            {
                classification_id: classification2.id.value,
                group_id: group.id.value,
                form: onescript.id.value,
            },
        ];

        const response = await TestHelper.postRequest(`${baseUrl}`, payload);

        expect(response.status).toBe(201);
    });

    it('should return 400 if any classificationId in batch add is invalid', async () => {
        const groupId = uuidv4();
        const payload = [
            { classification_id: uuidv4(), group_id: groupId },
            { classification_id: 'invalid-uuid', group_id: groupId },
        ];

        let response;
        try {
            response = await TestHelper.postRequest(baseUrl, payload);
        } catch (error) {
            response = error.response;
        }

        expect(response.status).toBe(400);
    });

    it('should return notFound when the resource doesnt exist', async () => {
        let response;
        try {
            const url = `${baseUrl}/invalid/resource/sure`;
            response = await TestHelper.getRequest(url);
        } catch (error) {
            response = error.response;
        }

        expect(response.status).toBe(403);
        expect(response.response.data.message).toBe('Missing Authentication Token');
    });
});
