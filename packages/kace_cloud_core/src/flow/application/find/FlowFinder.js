import { FlowFinderDomain, FlowResponse } from '../..';

export class FlowFinder {
    /**
     * It is initialized in the constructor
     * @type {FlowFinderDomain}
     */
    #finder;

    /**
     * Optional repository used to enrich each edge with its matching transition id.
     * @type {object|null}
     */
    #transitionRepo;

    /**
     *
     * @param {KnexFlowRepository} repository
     * @param {object} [transitionRepo] Optional transitions repository with `findByFlowId`.
     */
    constructor(repository, transitionRepo = null) {
        this.#finder = new FlowFinderDomain(repository);
        this.#transitionRepo = transitionRepo;
    }

    /**
     *
     * @param {string} id
     * @returns {Promise<FlowResponse|null>}
     */
    async execute(id) {
        const flow = await this.#finder.execute(id);

        if (!flow || flow.deleted_by.value) {
            return null;
        }

        const response = new FlowResponse(flow);

        if (this.#transitionRepo) {
            const transitions = await this.#transitionRepo.findByFlowId(id);
            const byTriplet = new Map();
            for (const transition of transitions) {
                const data = transition.toJson();
                const sourceKey = data.estado_actual_id ?? 'null';
                const key = `${sourceKey}|${data.siguiente_estado_id}`;
                if (!byTriplet.has(key)) {
                    byTriplet.set(key, data.id);
                }
            }

            const edges = response.toJson().data.json_flujo?.edges ?? [];
            for (const edge of edges) {
                const source = edge.source === '0' || edge.source === 0 ? 'null' : edge.source;
                const key = `${source}|${edge.target}`;
                if (byTriplet.has(key)) {
                    edge.kace_transition = byTriplet.get(key);
                }
            }
        }

        return response;
    }
}
