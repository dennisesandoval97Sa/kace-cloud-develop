import { v4 as uuidv4 } from 'uuid';
import { production as knexConfig } from '@kace/database/knexfile';
import { KnexTransitionRuleRepository } from '@kace/core/src/transition-rules/index.js';
import { TransitionRuleMother } from '@kace/core/tests/transition-rules/domain/TransitionRuleMother.js';
import { TestHelper } from '@kace/api-common';

describe('TransitionRules E2E', () => {
    const repository = new KnexTransitionRuleRepository(knexConfig);

    const baseUrl =
        process.env.APPS_ENVIRONMENT === 'staging'
            ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/transition-rules`
            : `http://127.0.0.1:60101`;

    afterAll(async () => {
        try {
            repository.connection.destroy();
        } catch (error) {
            console.log(error);
        }
    });

    it('should create a TransitionRule', async () => {
        const payload = TransitionRuleMother.dto();

        const response = await TestHelper.postRequest(baseUrl, payload);

        expect(response.status).toBe(201);
    });

    it('returns 400 when payload is empty on create', async () => {
        let response;
        try {
            response = await TestHelper.postRequest(baseUrl, {});
        } catch (error) {
            response = error.response;
        }

        expect(response.status).toBe(400);
    });

    it('returns 400 when nombre is missing on create', async () => {
        const payload = TransitionRuleMother.dto();
        delete payload.nombre;

        let response;
        try {
            response = await TestHelper.postRequest(baseUrl, payload);
        } catch (error) {
            response = error.response;
        }

        expect(response.status).toBe(400);
    });

    it('returns 400 when conditions is missing on create', async () => {
        const payload = TransitionRuleMother.dto();
        delete payload.conditions;

        let response;
        try {
            response = await TestHelper.postRequest(baseUrl, payload);
        } catch (error) {
            response = error.response;
        }

        expect(response.status).toBe(400);
    });

    it('should fetch a TransitionRule by id', async () => {
        const rule = await TransitionRuleMother.create(repository);

        const response = await TestHelper.getRequest(`${baseUrl}/${rule.id.value}`);
        const data = response.data.data;

        expect(response.status).toBe(200);
        expect(data.id).toBe(rule.id.value);
        expect(data.nombre).toBe(rule.nombre.value);
    });

    it('returns 404 when fetching a TransitionRule that does not exist', async () => {
        const response = await TestHelper.getRequest(`${baseUrl}/${uuidv4()}`);

        expect(response.status).toBe(404);
        expect(response.response.data.data).toMatchObject({});
    });

    it('returns 400 when fetching with an invalid id', async () => {
        let response;
        try {
            response = await TestHelper.getRequest(`${baseUrl}/invalid-id`);
        } catch (error) {
            response = error.response;
        }

        expect(response.status).toBe(400);
    });

    it('should fetch all TransitionRules', async () => {
        const rule1 = await TransitionRuleMother.create(repository);
        const rule2 = await TransitionRuleMother.create(repository);

        const response = await TestHelper.getRequest(baseUrl);

        expect(response.status).toBe(200);
        expect(response.data.data.items).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ id: rule1.id.value }),
                expect.objectContaining({ id: rule2.id.value }),
            ])
        );
    });

    it('should update a TransitionRule', async () => {
        const rule = await TransitionRuleMother.create(repository);
        const newNombre = `Regla actualizada ${uuidv4().slice(0, 8)}`;

        const response = await TestHelper.postRequest(`${baseUrl}/${rule.id.value}`, {
            nombre: newNombre,
        });

        expect(response.status).toBe(200);
    });

    it('should update the conditions of a TransitionRule', async () => {
        const rule = await TransitionRuleMother.create(repository);
        const newConditions = {
            combinator: 'or',
            rules: [{ field: 'clients.nombres', operator: '=', value: 'Ana', type: 'manual_input' }],
        };

        const response = await TestHelper.postRequest(`${baseUrl}/${rule.id.value}`, {
            conditions: newConditions,
        });

        expect(response.status).toBe(200);
    });

    it('returns 400 when updating with an invalid id', async () => {
        let response;
        try {
            response = await TestHelper.postRequest(`${baseUrl}/invalid-id`, { nombre: 'test' });
        } catch (error) {
            response = error.response;
        }

        expect(response.status).toBe(400);
    });

    it('should search TransitionRules with filters', async () => {
        const uniqueName = `Regla búsqueda ${uuidv4().slice(0, 8)}`;
        const rule = await TransitionRuleMother.create(repository, { nombre: uniqueName });

        const payload = {
            filter: [{ field: 'nombre', operator: 'eq', value: uniqueName, type: 'AND' }],
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'desc' },
        };

        const response = await TestHelper.postRequest(`${baseUrl}/search`, payload);

        expect(response.status).toBe(200);
        expect(response.data.data.items).toEqual(
            expect.arrayContaining([expect.objectContaining({ id: rule.id.value })])
        );
    });

    it('returns 400 when search payload is invalid', async () => {
        let response;
        try {
            response = await TestHelper.postRequest(`${baseUrl}/search`, { invalid: true });
        } catch (error) {
            response = error.response;
        }

        expect(response.status).toBe(400);
    });
});
