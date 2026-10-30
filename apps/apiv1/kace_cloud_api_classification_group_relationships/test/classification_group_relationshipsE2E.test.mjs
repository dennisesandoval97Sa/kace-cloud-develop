import ClassificationGroupMother from '@kace/core/tests/classification-group-relationships/domain/ClassificationGroupMother.js';
import {
    ClassificationGroupRelationship,
    KnexClassificationGroupRelationshipRepository,
} from '@kace/core/src/classification-group-relationships/index.js';
import { ClassificationFactory } from '@kace/core/src/factories/ClassificationFactory.js';
import { GroupFactory } from '@kace/core/src/factories/GroupFactory.js';
import { OneScriptFactory } from '@kace/core/src/factories/OneScriptFactory.js';
import { production as knexConfig } from '@kace/database/knexfile';
import { TestHelper } from '@kace/api-common';
import { Helper } from '@kace/core/src/shared/index.js';

async function createRelation() {
    const classification = await ClassificationFactory.create();
    const group = await GroupFactory.create();
    const onescript = await OneScriptFactory.create();
    const repository = new KnexClassificationGroupRelationshipRepository(knexConfig);
    const relation = new ClassificationGroupRelationship({
        classification_id: classification.id.value,
        group_id: group.id.value,
        form: onescript.id.value,
    });
    await repository.save(relation);
    return { classification, group, onescript };
}

describe('ClassificationGroupController test', () => {
    const repository = new KnexClassificationGroupRelationshipRepository(knexConfig);

    const baseUrl =
        process.env.APPS_ENVIRONMENT === 'staging'
            ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/classification-group-relationships`
            : `http://127.0.0.1:60014`;

    afterAll(async () => {
        try {
            await repository.connection.destroy();
        } catch (error) {
            Helper.logInfo(error);
        }
    });

    it('should create a classification group relationship', async () => {
        const classification = await ClassificationFactory.create();
        const group = await GroupFactory.create();
        const onescript = await OneScriptFactory.create();
        const payload = ClassificationGroupMother.dto({
            classification_id: classification.id.value,
            group_id: group.id.value,
            form: onescript.id.value,
        });

        let response;
        try {
            response = await TestHelper.postRequest(baseUrl, payload);
        } catch (e) {
            Helper.logInfo(e.response.data);
        }
        expect(response.status).toBe(201);
    });

    it('should read a specific classification-group relationship', async () => {
        const { classification, group } = await createRelation();

        const payload = {
            data: {
                groupId: group.id.value,
            },
        };

        const response = await TestHelper.getRequest(`${baseUrl}/${classification.id.value}`, payload);

        expect(response.status).toBe(200);
        expect(response.data.data).toHaveProperty('classification_id', classification.id.value);
        expect(response.data.data).toHaveProperty('group_id', group.id.value);
    });

    it('should fetch all classification-group relationship', async () => {
        let response;
        try {
            response = await TestHelper.getRequest(baseUrl);
        } catch (error) {
            Helper.logInfo(error.response.data);
        }

        expect(response.status).toBe(200);
    });

    it('should fetch all classification-group relationship whit search params', async () => {
        const payload = {
            filter: undefined,
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: null,
        };

        let response;
        try {
            response = await TestHelper.postRequest(`${baseUrl}/search`, payload);
        } catch (error) {
            Helper.logInfo(error.response.data);
        }

        expect(response.status).toBe(200);
    });

    it('should delete a classification-group relationship', async () => {
        const { classification, group } = await createRelation();

        const payload = {
            data: {
                groupId: group.id.value,
            },
        };

        const response = await TestHelper.getRequest(`${baseUrl}/${classification.id.value}/delete`, payload);

        expect(response.status).toBe(200);
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
