import { KnexClassificationTemplateRelationsRepository } from '@kace/core/src/classification-template-relations';
import { production as knexConfig } from '@kace/database/knexfile';
import { TestHelper } from '@kace/api-common';
import { uuidv4 } from '@kace/core/src/factories/Factory.js';

import { KnexClassificationRepository } from '@kace/core/src/classifications';
import { KnexTemplatesRepository } from '@kace/core/src/templates';
import { KnexFlowRepository } from '@kace/core/src/flow';
import { KnexAnsRepository } from '@kace/core/src/ans';

import ClassificationTemplateMother from '@kace/core/tests/classification-template-relations/domain/ClassificationTemplateMother';
import AnsMother from '@kace/core/tests/ans/domain/AnsMother';
import ClassificationsMother from '@kace/core/tests/classifications/domain/ClassificationsMother';
import FlowsMother from '@kace/core/tests/flows/domain/FlowsMother';
import TemplatesMother from '@kace/core/tests/templates/domain/TemplatesMother';
import { Helper } from '@kace/core/src/shared/index.js';

describe('ClassificationTemplateRelationsController test', () => {
    const repository = new KnexClassificationTemplateRelationsRepository(knexConfig);
    const classificationRepository = new KnexClassificationRepository(knexConfig);
    const templateRepository = new KnexTemplatesRepository(knexConfig);
    const flowRepository = new KnexFlowRepository(knexConfig);
    const ansRepository = new KnexAnsRepository(knexConfig);

    let flujo, ans;
    const baseUrl =
        process.env.APPS_ENVIRONMENT === 'staging'
            ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/classification-template-relationships`
            : 'http://127.0.0.1:60017';

    beforeAll(async () => {
        try {
            flujo = await FlowsMother.createFlow(flowRepository);
            ans = await AnsMother.createAns(ansRepository);
        } catch (error) {
            Helper.logInfo(error);
        }
    });

    afterAll(async () => {
        try {
            repository.connection.destroy();
        } catch (error) {
            Helper.logInfo(error);
        }
    });

    it('should fetch a classification template relationship', async () => {
        const response = await TestHelper.getRequest(baseUrl);
        expect(response.status).toBe(200);
        expect(response.data.data.items).toBeDefined();
    });

    it('return statusCode 400 when validation fails to create a Template', async () => {
        const payload = {};

        const response = await TestHelper.postRequest(baseUrl, payload);
        expect(response).toHaveProperty('status', 400);
    });

    it('should batch add classifications to a template', async () => {
        const classificationIds = [uuidv4(), uuidv4()];

        const template = await TemplatesMother.createTemplate(templateRepository);
        for (const classificationId of classificationIds) {
            await ClassificationsMother.createClassification(classificationRepository, {
                id: classificationId,
                flujo_id: flujo.id.value,
                ans_id: ans.id.value,
            });
        }

        const payload = classificationIds.map((classificationId) => ({
            classification_id: classificationId,
            template_id: template.id.value,
        }));

        const response = await TestHelper.postRequest(`${baseUrl}`, payload);

        expect(response.status).toBe(201);
    });

    it('should batch remove classifications from a template', async () => {
        const classificationIds = [uuidv4(), uuidv4()];

        const { id: templateId } = await TemplatesMother.createTemplate(templateRepository);
        for (const classificationId of classificationIds) {
            await ClassificationsMother.createClassification(classificationRepository, {
                id: classificationId,
                flujo_id: flujo.id.value,
                ans_id: ans.id.value,
            });
            await ClassificationTemplateMother.create(repository, {
                classification_id: classificationId,
                template_id: templateId.value,
            });
        }

        const payload = classificationIds.map((classificationId) => ({
            classification_id: classificationId,
            template_id: templateId.value,
        }));
        const response = await TestHelper.postRequest(`${baseUrl}/delete`, payload);

        expect(response.status).toBe(200);
    });

    it('should return 400 if any classificationId in batch add is invalid', async () => {
        const templateId = uuidv4();
        const payload = [
            { classification_id: uuidv4(), template_id: templateId },
            { classification_id: 'invalid-uuid', template_id: templateId },
        ];

        const response = await TestHelper.postRequest(`${baseUrl}`, payload);
        expect(response).toHaveProperty('status', 400);
    });

    it('should return 400 if any classificationId in batch remove is invalid', async () => {
        const templateId = uuidv4();
        const payload = [
            { classification_id: uuidv4(), template_id: templateId },
            { classification_id: 'invalid-uuid', template_id: templateId },
        ];

        const response = await TestHelper.postRequest(`${baseUrl}/delete`, payload);
        expect(response).toHaveProperty('status', 400);
    });

    it('should return notFound when the resource does not exist', async () => {
        const response = await TestHelper.getRequest(`${baseUrl}/${uuidv4()}/invalid`);
        expect(response).toHaveProperty('status', 403);
    });
});
