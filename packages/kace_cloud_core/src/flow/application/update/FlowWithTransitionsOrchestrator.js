import { v4 as uuidv4 } from 'uuid';
import { Transitions } from '../../../transition';

const TRIANGULAR_NULL = '0';

export class FlowWithTransitionsOrchestrator {
    #flowRepo;
    #transitionRepo;

    constructor({ flowRepo, transitionRepo }) {
        this.#flowRepo = flowRepo;
        this.#transitionRepo = transitionRepo;
    }

    async executeUpdate(flowDto, { userId, now, trx = null }) {
        const edges = (flowDto.json_flujo?.edges ?? []).map((edge) => this.#mapEdge(edge));
        const activeIds = [];

        for (const edge of edges) {
            const existing = await this.#transitionRepo.findByFlowAndTriplet(
                flowDto.id,
                edge.estadoActualId,
                edge.siguienteEstadoId
            );

            if (existing) {
                existing.update({
                    ans_id: edge.ansId,
                    rule_id: edge.ruleId,
                    is_visible: edge.isVisible,
                    updated_at: now,
                    updated_by: userId,
                });
                await this.#transitionRepo.update(existing, trx);
                activeIds.push(existing.id.value);
                continue;
            }

            const created = new Transitions({
                id: uuidv4(),
                estado_actual_id: edge.estadoActualId,
                siguiente_estado_id: edge.siguienteEstadoId,
                flujo_id: flowDto.id,
                status: 1,
                ans_id: edge.ansId,
                rule_id: edge.ruleId,
                is_visible: edge.isVisible,
                created_at: now,
                created_by: userId,
                updated_at: now,
                updated_by: userId,
            });
            await this.#transitionRepo.save(created, trx);
            activeIds.push(created.id.value);
        }

        if (activeIds.length > 0) {
            await this.#flowRepo.updateTransitionStatus(flowDto.id, activeIds, trx);
        }
    }

    #mapEdge(edge) {
        const source = edge.source === TRIANGULAR_NULL || edge.source === 0 ? null : edge.source;
        return {
            estadoActualId: source,
            siguienteEstadoId: edge.target,
            ansId: edge.ans_id ?? null,
            ruleId: edge.rule_id ?? null,
            isVisible: edge.data?.is_visible ?? true,
        };
    }
}
