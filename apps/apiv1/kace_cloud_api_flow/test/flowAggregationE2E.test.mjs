import { v4 as uuidv4 } from 'uuid';
import { production as knexConfig } from '@kace/database/knexfile';
import { KnexFlowRepository, Flow } from '@kace/core/src/flow/index.js';
import { KnexTransitionsRepository } from '@kace/core/src/transition/index.js';
import { TestHelper } from '@kace/api-common';
import { Helper } from '@kace/core/src/shared/index.js';

const baseUrl =
    process.env.APPS_ENVIRONMENT === 'staging'
        ? `https://${process.env.APPS_API_SUBDOMAIN}.${process.env.APPS_DOMAIN}/flows`
        : `http://127.0.0.1:60025`;

const flowRepo = new KnexFlowRepository(knexConfig);
const transitionRepo = new KnexTransitionsRepository(knexConfig);

let createdEstadoIds = [];

const ensureEstado = async () => {
    const existing = await transitionRepo.connection('estados').select('id').limit(1);
    if (existing.length > 0) {
        return existing[0].id;
    }
    const id = uuidv4();
    await transitionRepo.connection('estados').insert({
        id,
        nombre: 'Test estado',
        status: 1,
        created_at: new Date().toISOString(),
        created_by: uuidv4(),
    });
    createdEstadoIds.push(id);
    return id;
};

const buildJsonFlujo = (nodes, edges) => ({ nodes, edges });

describe('Flow POST /flows aggregation e2e', () => {
    afterAll(async () => {
        try {
            if (createdEstadoIds.length > 0) {
                await transitionRepo.connection('estados').whereIn('id', createdEstadoIds).del();
            }
            await flowRepo.connection.destroy();
            await transitionRepo.connection.destroy();
        } catch (error) {
            Helper.logInfo(error);
        }
    });

    it('creates a flow with transitions from a clean payload without id', async () => {
        const realEstadoId = await ensureEstado();

        const secondEstadoId = uuidv4();
        await transitionRepo.connection('estados').insert({
            id: secondEstadoId,
            nombre: 'Test estado create',
            status: 1,
            created_at: new Date().toISOString(),
            created_by: uuidv4(),
        });
        createdEstadoIds.push(secondEstadoId);

        const payload = {
            nombre: `Create aggregation ${uuidv4().replace(/[^a-zA-Z]/g, '')}`,
            json_flujo: buildJsonFlujo(
                [
                    { id: '0', type: 'input', data: { label: 'inicio' } },
                    { id: realEstadoId, type: 'custom', data: { label: 'A' } },
                    { id: secondEstadoId, type: 'custom', data: { label: 'B' } },
                ],
                [
                    {
                        id: 'edge-1',
                        source: '0',
                        target: realEstadoId,
                        ans_id: null,
                        rule_id: null,
                        data: { is_visible: true },
                    },
                    {
                        id: 'edge-2',
                        source: realEstadoId,
                        target: secondEstadoId,
                        ans_id: null,
                        rule_id: null,
                        data: { is_visible: true },
                    },
                ]
            ),
            status: 1,
        };

        const response = await TestHelper.postRequest(baseUrl, payload);
        expect(response.status).toBe(201);
        expect(response.data.data.id).toBeDefined();

        const flowId = response.data.data.id;
        const transitions = await transitionRepo.connection('transiciones').where({ flujo_id: flowId });
        expect(transitions.length).toBe(2);

        await transitionRepo.connection('transiciones').where({ flujo_id: flowId }).del();
        await flowRepo.connection('flujos').where({ id: flowId }).del();
    });

    it('upserts transitions and never deletes orphan transitions', async () => {
        const realEstadoId = await ensureEstado();

        const flowId = uuidv4();
        const flow = Flow.create({
            id: flowId,
            nombre: `Aggregation test ${flowId.replace(/[^a-zA-Z]/g, '')}`,
            json_flujo: { nodes: [], edges: [] },
            status: 1,
            created_at: new Date().toISOString(),
            created_by: uuidv4(),
        });
        await flowRepo.save(flow);

        const orphanTransitionId = uuidv4();
        await transitionRepo.connection('transiciones').insert({
            id: orphanTransitionId,
            estado_actual_id: null,
            siguiente_estado_id: realEstadoId,
            flujo_id: flowId,
            status: 1,
            ans_id: null,
            rule_id: null,
            is_visible: true,
            created_at: new Date().toISOString(),
            created_by: uuidv4(),
        });

        // Create a SECOND real estado so the second edge's target exists.
        const secondEstadoId = uuidv4();
        await transitionRepo.connection('estados').insert({
            id: secondEstadoId,
            nombre: 'Test estado 2',
            status: 1,
            created_at: new Date().toISOString(),
            created_by: uuidv4(),
        });
        createdEstadoIds.push(secondEstadoId);

        const payload = {
            nombre: `Aggregation updated ${flowId.replace(/[^a-zA-Z]/g, '')}`,
            json_flujo: buildJsonFlujo(
                [
                    { id: '0', type: 'input', data: { label: 'inicio' } },
                    { id: realEstadoId, type: 'custom', data: { label: 'A' } },
                    { id: secondEstadoId, type: 'custom', data: { label: 'B' } },
                ],
                [
                    {
                        id: 'edge-1',
                        source: '0',
                        target: realEstadoId,
                        ans_id: null,
                        rule_id: null,
                        data: { is_visible: true },
                    },
                    {
                        id: 'edge-2',
                        source: realEstadoId,
                        target: secondEstadoId,
                        ans_id: null,
                        rule_id: null,
                        data: { is_visible: true },
                    },
                ]
            ),
        };

        const response = await TestHelper.postRequest(`${baseUrl}/${flowId}`, payload);
        expect(response.status).toBe(200);

        // Exactly 3 transitions should exist for the flow: 2 new + 1 orphan.
        const allTransitions = await transitionRepo.connection('transiciones').where({ flujo_id: flowId });
        expect(allTransitions.length).toBe(3);

        const newTransitions = allTransitions.filter((t) => t.id !== orphanTransitionId);
        expect(newTransitions.length).toBe(2);

        const orphan = allTransitions.find((t) => t.id === orphanTransitionId);
        expect(orphan).toBeDefined();
        expect(orphan.siguiente_estado_id).toBe(realEstadoId);
        expect(orphan.estado_actual_id).toBeNull();

        // Cleanup
        await transitionRepo.connection('transiciones').where({ flujo_id: flowId }).del();
        await flowRepo.connection('flujos').where({ id: flowId }).del();
    });

    it('rejects a body with a top-level id (strict Joi)', async () => {
        const flowId = uuidv4();
        const payload = {
            id: flowId, // strict schema rejects this
            nombre: 'Rejected payload',
            json_flujo: { nodes: [], edges: [] },
        };

        let response;
        try {
            response = await TestHelper.postRequest(`${baseUrl}/${flowId}`, payload);
        } catch (error) {
            response = error.response;
        }

        expect(response?.status).toBe(400);
    });
});
