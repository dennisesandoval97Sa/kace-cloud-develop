import { CustomError, Helper } from '../../../shared/index.js';
import { DomainWSRestFlowFinder, WSRestFlowResponse } from '../../index.js';
import { WSRestFlowDiagramHelper as Diagram } from '../services/WSRestFlowDiagramHelper.js';

export class WSRestFlowFinder {
    /** @type {DomainWSRestFlowFinder} is initialized in the constructor */
    #finder;
    /** @type {import('../../../users').User} is initialized in the constructor */
    #currentUser;

    /**
     * Creates an instance of the `WSRestFlowFinder` class.
     *
     * @param {KnexWSRestFlowRepository} repository - An instance of the repository that manages WS REST flow records.
     * @param {import('../../../users').User} currentUser - The currently authenticated user object.
     */
    constructor(repository, currentUser) {
        this.#finder = new DomainWSRestFlowFinder(repository);
        this.#currentUser = currentUser;
    }

    /**
     * Reconstructs a complete flow by fetching subflows and rebuilding the full diagram.
     * For flows with conditional nodes, this fetches all referenced subflows and merges them
     * back into the main flow structure.
     *
     * @param {Object} wsRestFlow - The main flow object.
     * @returns {Promise<Object>} The reconstructed flow with all subflows merged.
     * @private
     */
    async #reconstructFlowWithSubflows(wsRestFlow) {
        const { nodes, edges } = Diagram.parseDiagram(wsRestFlow.json_diagram_properties?.value);
        const conditionalNodes = Diagram.getConditionalNodes(nodes);

        if (conditionalNodes.length === 0) return;

        const subflowIds = conditionalNodes.flatMap((cond) => Object.values(cond.data.subflows || {}));

        const subflowsMap = await this.#fetchSubflows(subflowIds);
        if (subflowsMap.size === 0) return;

        const nodesMap = new Map(nodes.map((n) => [n.id, n]));
        const edgesMap = new Map();
        for (const e of edges) {
            edgesMap.set(e.id, e);
        }

        for (const cond of conditionalNodes) {
            for (const subflowId of Object.values(cond.data.subflows || {})) {
                const subflow = subflowsMap.get(subflowId);
                if (!subflow) continue;

                const sub = Diagram.parseDiagram(subflow.json_diagram_properties?.value);

                for (const node of sub.nodes) {
                    if (node.id !== cond.id && !nodesMap.has(node.id)) {
                        nodesMap.set(node.id, node);
                    }
                }
                for (const edge of sub.edges) {
                    if (!edgesMap.has(edge.id)) edgesMap.set(edge.id, edge);
                }
            }
        }

        try {
            wsRestFlow.update({
                json_diagram_properties: {
                    nodes: Array.from(nodesMap.values()),
                    edges: Array.from(edgesMap.values()),
                },
            });
        } catch (error) {
            Helper.logError(error);
            throw new CustomError(`Failed to reconstruct flow diagram: ${error.message}`, 500);
        }
    }

    async #fetchSubflows(subflowIds) {
        const map = new Map();
        for (const subflowId of subflowIds) {
            try {
                const subflow = await this.#finder.execute(subflowId);
                if (subflow && !subflow.isDeleted()) map.set(subflowId, subflow);
            } catch (error) {
                Helper.logError(error);
            }
        }
        return map;
    }

    /**
     * Finds a WSRestFlow by ID. When it contains conditional nodes with subflows,
     * all referenced subflows are fetched and merged back into a single diagram.
     *
     * @param {string} id - The unique identifier of the `WSRestFlow` object to find.
     * @returns {Promise<WSRestFlowResponse>} A promise that resolves to a `WSRestFlowResponse` object containing the found flow data.
     */
    async execute(id) {
        const wsRestFlow = await this.#finder.execute(id);
        if (!wsRestFlow || wsRestFlow.isDeleted()) {
            throw new CustomError('Ws rest flow not found', 404);
        }

        await this.#reconstructFlowWithSubflows(wsRestFlow);

        return new WSRestFlowResponse(wsRestFlow);
    }
}
