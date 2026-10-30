import { v4 as uuidv4 } from 'uuid';
import { production as knexConfig } from '@kace/database/knexfile';
import FlowsMother from '@kace/core/tests/flows/domain/FlowsMother.js';
import { TransitionsMother } from '@kace/core/tests/transitions/domain/TransitionsMother.js';
import { StateMother } from '@kace/core/tests/state/domain/StateMother.js';
import { KnexTransitionsRepository } from '@kace/core/src/transition/infrastructure/persistance/KnexTransitionsRepository.js';
import { KnexFlowRepository } from '@kace/core/src/flow/index.js';
import { KnexStateRepository } from '@kace/core/src/state/index.js';
import { TestHelper } from '@kace/api-common';

describe('Transitions test', () => {
    const repository = new KnexTransitionsRepository(knexConfig);
    const flowRepository = new KnexFlowRepository(knexConfig);
    const stateRepository = new KnexStateRepository(knexConfig);

    const baseUrl =
        process.env.APPS_ENVIRONMENT === 'staging'
            ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/transitions`
            : `http://127.0.0.1:60047`;

    afterAll(async () => {
        try {
            repository.connection.destroy();
        } catch (error) {
            console.log(error);
        }
    });

    it('should create a Transitions', async () => {
        const flow = await FlowsMother.createFlow(flowRepository);
        const states = [await StateMother.createState(stateRepository), await StateMother.createState(stateRepository)];
        const payload = TransitionsMother.createPayloadForNewTransition(states, flow.id.value);

        const response = await TestHelper.postRequest(baseUrl, payload);

        expect(response.status).toBe(201);
    });

    it('return statusCode 400 when validation fails to create a Transitions', async () => {
        const payload = {};

        let response;
        try {
            response = await TestHelper.postRequest(baseUrl, payload);
        } catch (error) {
            response = error.response;
        }

        expect(response.status).toBe(400);
    });

    it('should fetch a Transitions', async () => {
        const flow = await FlowsMother.createFlow(flowRepository);
        const state = await StateMother.createState(stateRepository);
        const nextState = await StateMother.createState(stateRepository);
        const transitions = await TransitionsMother.createTransition(repository, state, flow, nextState);

        const response = await TestHelper.getRequest(`${baseUrl}/${transitions.id.value}`);

        const data = response.data.data;

        expect(response.status).toBe(200);
        expect(data.id).toEqual(transitions.id.value);
        expect(data.estado_actual_id).toBe(transitions.estado_actual_id.value);
        expect(data.siguiente_estado_id).toEqual(transitions.siguiente_estado_id.value);
        expect(data.flujo_id).toEqual(transitions.flujo_id.value);
        expect(data.status).toEqual(transitions.status.value);
        expect(data.created_by).toEqual(transitions.created_by.value);
        expect(data.created_at).toEqual(transitions.created_at.value);
        expect(data.flujo.data.nombre).toEqual(flow.nombre.value);
    });

    it('should fetch all Transitions', async () => {
        const flow = await FlowsMother.createFlow(flowRepository);
        const state = await StateMother.createState(stateRepository);
        const nextState = await StateMother.createState(stateRepository);
        const transitions = await TransitionsMother.createTransition(repository, state, flow, nextState);
        const transitions2 = await TransitionsMother.createTransition(repository, state, flow, nextState);

        const response = await TestHelper.getRequest(baseUrl);

        expect(response.status).toBe(200);
        expect(response.data.data.items[0].id).toEqual(transitions2.id.value);
        expect(response.data.data.items[1].id).toEqual(transitions.id.value);
    });

    it('should update a Transitions', async () => {
        const flow = await FlowsMother.createFlow(flowRepository);
        const flow2 = await FlowsMother.createFlow(flowRepository);
        const state = await StateMother.createState(stateRepository);
        const nextState = await StateMother.createState(stateRepository);
        const transitions = await TransitionsMother.createTransition(repository, state, flow, nextState);

        const payload = {
            flujo_id: flow2.id.value,
        };

        const response = await TestHelper.postRequest(`${baseUrl}/${transitions.id.value}`, payload);

        expect(response.status).toBe(200);
    });

    it('should return a status code 404 when fetch a Transitions that is not exist', async () => {
        const response = await TestHelper.getRequest(`${baseUrl}/${uuidv4()}`);

        expect(response.status).toBe(404);
        expect(response.response.data.data).toMatchObject({});
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
