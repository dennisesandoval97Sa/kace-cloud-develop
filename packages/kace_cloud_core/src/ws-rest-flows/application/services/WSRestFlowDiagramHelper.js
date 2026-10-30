export class WSRestFlowDiagramHelper {
    /**
     * Deduplicates an array of nodes by their `id`.
     *
     * @param {Array} rawNodes
     * @returns {Array} unique nodes
     */
    static deduplicateNodes(rawNodes) {
        return Array.from(new Map(rawNodes.map((n) => [n.id, n])).values());
    }

    /**
     * Deduplicates an array of edges by their `id`.
     *
     * @param {Array} rawEdges
     * @returns {Array} unique edges
     */
    static deduplicateEdges(rawEdges) {
        return Array.from(new Map(rawEdges.map((e) => [e.id, e])).values());
    }

    /**
     * Extracts `nodes` and `edges` from a raw diagram object,
     * deduplicating both in a single pass.
     *
     * @param {Object|null|undefined} diagramProps - `json_diagram_properties` or similar.
     * @returns {{ nodes: Array, edges: Array, nodesMap: Map<string, Object> }}
     */
    static parseDiagram(diagramProps) {
        const diagram = diagramProps ?? {};
        const rawNodes = Array.isArray(diagram.nodes) ? diagram.nodes : [];
        const rawEdges = Array.isArray(diagram.edges) ? diagram.edges : [];

        const nodesMap = new Map(rawNodes.map((n) => [n.id, n]));
        const nodes = Array.from(nodesMap.values());
        const edges = WSRestFlowDiagramHelper.deduplicateEdges(rawEdges);

        return { nodes, edges, nodesMap };
    }

    /**
     * Returns only nodes whose `data.type === 'conditional'`.
     *
     * @param {Array} nodes
     * @returns {Array}
     */
    static getConditionalNodes(nodes) {
        return nodes.filter((n) => n?.data?.type === 'conditional');
    }

    /**
     * Maps a React Flow `sourceHandle` value to the domain branch key.
     *   - `'yes'`  → `'satisfied'`
     *   - `'no'`   → `'unsatisfied'`
     *   - any other non-empty string → itself
     *   - falsy    → first available between `'satisfied'` / `'unsatisfied'`
     *
     * @param {string|null|undefined} sourceHandle
     * @param {Object} existingSubflows - already-assigned subflows for the conditional
     * @returns {string}
     */
    static mapBranchKey(sourceHandle, existingSubflows = {}) {
        if (sourceHandle === 'yes') return 'satisfied';
        if (sourceHandle === 'no') return 'unsatisfied';
        if (sourceHandle) return sourceHandle;
        return !existingSubflows.satisfied ? 'satisfied' : 'unsatisfied';
    }

    /**
     * Marks only non-conditional nodes as assigned for subflow extraction.
     * Conditional nodes are intentionally preserved in main flow so their
     * branches can be reconstructed when reading the flow.
     *
     * @param {Set<string>} nodeIdsSet
     * @param {Map<string, Object>} nodesMap
     * @param {Set<string>} assignedSet
     */
    static assignNonConditionalNodes(nodeIdsSet, nodesMap, assignedSet) {
        for (const nodeId of nodeIdsSet) {
            const node = nodesMap.get(nodeId);
            if (!node || node.data?.type === 'conditional') continue;
            assignedSet.add(nodeId);
        }
    }

    /**
     * Builds main-flow edges preserving:
     * - internal edges between main nodes
     * - conditional branch connectors (yes/no handles) from main conditionals
     *
     * @param {Array} edges
     * @param {Set<string>} mainNodeIds
     * @param {Map<string, Object>} nodesMap
     * @returns {Array}
     */
    static buildMainEdges(edges, mainNodeIds, nodesMap) {
        return edges.filter((edge) => {
            const isInternalMainEdge = mainNodeIds.has(edge.source) && mainNodeIds.has(edge.target);
            if (isInternalMainEdge) return true;

            const sourceNode = nodesMap.get(edge.source);
            const isConditionalBranchEdge =
                mainNodeIds.has(edge.source) && sourceNode?.data?.type === 'conditional' && Boolean(edge.sourceHandle);

            return isConditionalBranchEdge;
        });
    }

    /**
     * Graph traversal that collects all node IDs reachable from `startId`,
     * **stopping** at conditional nodes (they are included but their outgoing
     * edges are not followed — those belong to a different subflow).
     *
     * @param {string} startId
     * @param {Map<string, Object>} nodesMap - lookup map (`id → node`)
     * @param {Array} edges
     * @param {Set<string>} assignedSet - nodes already claimed by another subflow
     * @returns {string[]}
     */
    static getReachableNodes(startId, nodesMap, edges, assignedSet) {
        const adjacency = new Map();
        for (const edge of edges) {
            if (!adjacency.has(edge.source)) adjacency.set(edge.source, []);
            adjacency.get(edge.source).push(edge);
        }

        const stack = [startId];
        const visited = new Set();
        const result = new Set();

        while (stack.length) {
            const current = stack.pop();
            if (visited.has(current)) continue;
            visited.add(current);

            const currentNode = nodesMap.get(current);
            if (!currentNode) continue;

            result.add(current);

            if (currentNode.data?.type === 'conditional') {
                continue;
            }

            const outgoing = adjacency.get(current) || [];
            for (const edge of outgoing) {
                if (!visited.has(edge.target) && !assignedSet.has(edge.target) && nodesMap.has(edge.target)) {
                    stack.push(edge.target);
                }
            }
        }

        return Array.from(result);
    }

    /**
     * Collects edges that belong to a specific branch subgraph.
     *
     * @param {Object} branchEdge    - the edge leaving the conditional toward this branch
     * @param {Set<string>} nodeIds  - node IDs in this subflow
     * @param {Array} allEdges       - every edge in the full diagram
     * @param {Map<string, Object>} nodesMap
     * @param {string} condId        - the conditional node's id
     * @returns {Array}
     */
    static collectSubflowEdges(branchEdge, nodeIds, allEdges, nodesMap, condId) {
        const subEdges = [branchEdge];
        for (const e of allEdges) {
            if (e === branchEdge) continue;
            if (
                nodeIds.has(e.source) &&
                nodesMap.has(e.source) &&
                (nodeIds.has(e.target) || e.target === condId || nodesMap.get(e.target)?.data?.type === 'conditional')
            ) {
                subEdges.push(e);
            }
        }
        return subEdges;
    }
}
