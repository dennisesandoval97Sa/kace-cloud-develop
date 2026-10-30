import { v4 as uuidv4 } from 'uuid';
import { production as knexConfig } from '@kace/database/knexfile';
import { KnexAuxCasesRepository } from '@kace/core/src/aux_casos/infrastructure/persitance/KnexAuxCasesRepository';
import { KnexCaseRepository } from '@kace/core/src/cases';
import { AuxCasesMother } from '@kace/core/tests/aux-cases/domain/AuxCasesMother';
import { TestHelper } from '@kace/api-common';
import CasesMother from '@kace/core/tests/case/domain/CasesMother';
import { CaseFactory } from '@kace/core/src/factories/CaseFactory';

describe('Aux cases controller test', () => {
    const repository = new KnexAuxCasesRepository(knexConfig);
    const caseRepository = new KnexCaseRepository(knexConfig);

    const baseUrl =
        process.env.APPS_ENVIRONMENT === 'staging'
            ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/aux-cases`
            : `http://127.0.0.1:60005`;

    afterAll(async () => {
        try {
            await repository.connection.destroy();
        } catch (error) {
            console.log(error);
        }
    });

    it('should create a aux-cases record', async () => {
        const payloadCase = await CaseFactory.generateAttributes();

        const testCase = await CasesMother.createCase(caseRepository, payloadCase);

        const payload = AuxCasesMother.dto();

        delete payload.updated_at;
        payload.caso_id = testCase.id.value;

        const response = await TestHelper.postRequest(baseUrl, payload);
        expect(response.status).toBe(201);
    });

    it('should return statusCode 400 when validation fails to create a aux-cases record', async () => {
        const payload = {};

        let response;
        try {
            response = await TestHelper.postRequest(baseUrl, payload);
        } catch (error) {
            response = error.response;
        }

        expect(response.status).toBe(400);
    });

    it('should fetch a aux-case record', async () => {
        const payloadCase = await CaseFactory.generateAttributes();

        const testCase = await CasesMother.createCase(caseRepository, payloadCase);

        const payload = AuxCasesMother.dto();

        delete payload.updated_at;
        payload.caso_id = testCase.id.value;

        await AuxCasesMother.createAuxCase(repository, payload);

        const response = await TestHelper.getRequest(`${baseUrl}/${testCase.id.value}`);

        expect(response.status).toBe(200);
        expect(response.data.data.caso_id).toBe(testCase.id.value);
    });

    it('should update a aux-case record', async () => {
        const payloadCase = await CaseFactory.generateAttributes();

        const testCase = await CasesMother.createCase(caseRepository, payloadCase);

        const payload = AuxCasesMother.dto();

        delete payload.updated_at;
        payload.caso_id = testCase.id.value;

        const testAuxCase = await AuxCasesMother.createAuxCase(repository, payload);

        const updatePayload = {
            data: {
                spc: 'update test value',
            },
        };

        const response = await TestHelper.postRequest(`${baseUrl}/${testAuxCase.id.value}`, updatePayload);

        expect(response.status).toBe(200);
    });

    it('should return an empty object when fetching a non-existent aux-case record', async () => {
        const response = await TestHelper.getRequest(`${baseUrl}/${uuidv4()}`);

        expect(response.status).toBe(200);
        expect(response.data.data).toMatchObject({});
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

    it('actionHistory: debe devolver error con id inválido', async () => {
        const dtoCriteria = {
            filter: [],
            relationship: null,
            limit: 1,
            offset: 0,
            order: { field: 'created_at', direction: 'desc' },
        };
        const response = await TestHelper.postRequest(`${baseUrl}/invalid-id/history`, dtoCriteria);
        expect(response.status).toBeGreaterThanOrEqual(400);
    });
    it('actionHistory: debe devolver objeto vacío para uuid aleatorio', async () => {
        const dtoCriteria = {
            filter: [],
            relationship: null,
            limit: 1,
            offset: 0,
            order: { field: 'created_at', direction: 'desc' },
        };
        const randomId = uuidv4();
        const response = await TestHelper.postRequest(`${baseUrl}/${randomId}/history`, dtoCriteria);
        expect(response.status).toBeGreaterThanOrEqual(200);
        expect(typeof response.data.data).toBe('object');
    });
});
