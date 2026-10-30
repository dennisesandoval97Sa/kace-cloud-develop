import { production as knexConfig } from '@kace/database/knexfile';
import { v4 as uuidv4 } from 'uuid';
import { KnexFlowRepository } from '@kace/core/src/flow/index.js';
import FlowsMother from '@kace/core/tests/flows/domain/FlowsMother.js';
import { TestHelper } from '@kace/api-common';
import { Helper } from '@kace/core/src/shared/index.js';

describe('FlowsE2E test', () => {
    const repository = new KnexFlowRepository(knexConfig);

    const baseUrl =
        process.env.APPS_ENVIRONMENT === 'staging'
            ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/flows`
            : `http://127.0.0.1:60025`;

    afterAll(async () => {
        try {
            await repository.connection.destroy();
        } catch (error) {
            Helper.logInfo(error);
        }
    });

    it('should create a Flow', async () => {
        const payload = FlowsMother.dto();

        const response = await TestHelper.postRequest(baseUrl, payload);

        expect(response.status).toBe(201);
    });

    it('return statusCode 400 when validation fails to create a Flow', async () => {
        const payload = {};

        let response;
        try {
            response = await TestHelper.postRequest(baseUrl, payload);
        } catch (error) {
            response = error.response;
        }

        expect(response.status).toBe(400);
    });

    it('should fetch a Flow', async () => {
        const flow = await FlowsMother.createFlow(repository);
        const dataExpected = {
            id: flow.id.value,
            nombre: flow.nombre.value,
            json_flujo: flow.json_flujo.value,
            status: flow.status.value,
            created_by: flow.created_by.value,
            created_at: flow.created_at.value,
        };

        const response = await TestHelper.getRequest(`${baseUrl}/${flow.id.value}`);

        expect(response.status).toBe(200);
        expect(response.data.data.id).toEqual(dataExpected.id);
        expect(response.data.data.nombre).toBe(dataExpected.nombre);
        expect(response.data.data.json_flujo).toEqual(dataExpected.json_flujo);
        expect(response.data.data.created_by).toEqual(dataExpected.created_by);
        expect(response.data.data.created_at).toEqual(dataExpected.created_at);
    });

    it('should fetch all Flows', async () => {
        const flow = await FlowsMother.createRandomFlow(repository);
        const flow2 = await FlowsMother.createRandomFlow(repository);

        const response = await TestHelper.getRequest(`${baseUrl}/${flow.id.value}`);
        const response2 = await TestHelper.getRequest(`${baseUrl}/${flow2.id.value}`);

        expect(response.status).toBe(200);
        expect(response2.status).toBe(200);
        expect(response.data.data.id).toEqual(flow.id.value);
        expect(response2.data.data.id).toEqual(flow2.id.value);
    });

    it('should delete a Flow', async () => {
        const flow = await FlowsMother.createFlow(repository);

        const response = await TestHelper.getRequest(`${baseUrl}/${flow.id.value}/delete`);

        expect(response.status).toBe(200);
    });

    it('should update a Flow', async () => {
        const flow = await FlowsMother.createFlow(repository);

        const payload = {
            nombre: `${flow.nombre.value} updated`,
        };

        const response = await TestHelper.postRequest(`${baseUrl}/${flow.id.value}`, payload);

        expect(response.status).toBe(200);
    });

    it('should return a empty object when fetch a Flow that is deleted', async () => {
        const flow = await FlowsMother.createFlow(repository);

        await TestHelper.getRequest(`${baseUrl}/delete/${flow.id.value}`);

        const response = await TestHelper.getRequest(`${baseUrl}/${flow.id.value}`);

        expect(response.status).toBe(200);
        expect(response.data.data).toMatchObject({});
    });

    it('should return a empty object when fetch a Flow that is not exist', async () => {
        const response = await TestHelper.getRequest(`${baseUrl}/${uuidv4()}`);

        expect(response.status).toBe(200);
        expect(response.data.data).toMatchObject({});
    });

    it('should return a empty object when delete a Flow that is deleted', async () => {
        const flow = await FlowsMother.createFlow(repository);

        await TestHelper.getRequest(`${baseUrl}/${flow.id.value}/delete`);

        let response;
        try {
            response = await TestHelper.getRequest(`${baseUrl}/${flow.id.value}/delete`);
        } catch (error) {
            response = error.response;
        }

        expect(response.status).toBe(500);
    });

    it('should return notFound when the resource doesnt exist', async () => {
        let response;
        try {
            response = await TestHelper.getRequest(`${baseUrl}/invalid`);
        } catch (error) {
            response = error.response;
        }

        expect(response.status).toBe(400);
    });
});
