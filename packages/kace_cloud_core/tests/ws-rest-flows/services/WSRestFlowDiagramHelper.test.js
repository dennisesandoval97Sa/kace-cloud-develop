import { WSRestFlowDiagramHelper as Diagram } from '../../../src/ws-rest-flows/application/services/WSRestFlowDiagramHelper.js';

describe('WSRestFlowDiagramHelper', () => {
    describe('deduplicateNodes', () => {
        it('removes duplicate nodes by id', () => {
            const nodes = [
                { id: '1', data: { label: 'a' } },
                { id: '2', data: { label: 'b' } },
                { id: '1', data: { label: 'a-copy' } },
            ];
            const result = Diagram.deduplicateNodes(nodes);
            expect(result).toHaveLength(2);
            expect(result.map((n) => n.id)).toEqual(['1', '2']);
        });

        it('returns empty array for empty input', () => {
            expect(Diagram.deduplicateNodes([])).toEqual([]);
        });
    });

    describe('deduplicateEdges', () => {
        it('removes duplicate edges by id', () => {
            const edges = [
                { id: 'e1', source: 'a', target: 'b' },
                { id: 'e1', source: 'a', target: 'b' },
            ];
            expect(Diagram.deduplicateEdges(edges)).toHaveLength(1);
        });

        it('keeps edges with different ids', () => {
            const edges = [
                { id: 'e1', source: 'a', target: 'b' },
                { id: 'e2', source: 'a', target: 'c' },
            ];
            expect(Diagram.deduplicateEdges(edges)).toHaveLength(2);
        });
    });

    describe('parseDiagram', () => {
        it('parses and deduplicates nodes and edges', () => {
            const diagram = {
                nodes: [
                    { id: '1', data: {} },
                    { id: '1', data: {} },
                    { id: '2', data: {} },
                ],
                edges: [
                    { id: 'e1', source: '1', target: '2' },
                    { id: 'e1', source: '1', target: '2' },
                ],
            };
            const { nodes, edges, nodesMap } = Diagram.parseDiagram(diagram);
            expect(nodes).toHaveLength(2);
            expect(edges).toHaveLength(1);
            expect(nodesMap.size).toBe(2);
        });

        it('handles null/undefined input', () => {
            const { nodes, edges } = Diagram.parseDiagram(null);
            expect(nodes).toEqual([]);
            expect(edges).toEqual([]);
        });

        it('handles missing nodes/edges gracefully', () => {
            const { nodes, edges } = Diagram.parseDiagram({ extra: true });
            expect(nodes).toEqual([]);
            expect(edges).toEqual([]);
        });
    });

    describe('getConditionalNodes', () => {
        it('filters only conditional nodes', () => {
            const nodes = [
                { id: '1', data: { type: 'endpoint' } },
                { id: '2', data: { type: 'conditional' } },
                { id: '3', data: { type: 'function' } },
                { id: '4', data: { type: 'conditional' } },
            ];
            const result = Diagram.getConditionalNodes(nodes);
            expect(result).toHaveLength(2);
            expect(result.map((n) => n.id)).toEqual(['2', '4']);
        });

        it('returns empty array when no conditionals exist', () => {
            expect(Diagram.getConditionalNodes([{ id: '1', data: { type: 'task' } }])).toEqual([]);
        });

        it('skips nodes with null or missing data', () => {
            expect(Diagram.getConditionalNodes([null, { id: '1' }, { id: '2', data: null }])).toEqual([]);
        });
    });

    describe('mapBranchKey', () => {
        it('maps "yes" to "satisfied"', () => {
            expect(Diagram.mapBranchKey('yes')).toBe('satisfied');
        });

        it('maps "no" to "unsatisfied"', () => {
            expect(Diagram.mapBranchKey('no')).toBe('unsatisfied');
        });

        it('passes through any other non-empty handle', () => {
            expect(Diagram.mapBranchKey('custom-handle')).toBe('custom-handle');
        });

        it('defaults to satisfied when no handle and no existing satisfied', () => {
            expect(Diagram.mapBranchKey(null, {})).toBe('satisfied');
        });

        it('defaults to unsatisfied when satisfied is already taken', () => {
            expect(Diagram.mapBranchKey(null, { satisfied: 'some-id' })).toBe('unsatisfied');
        });
    });

    describe('getReachableNodes', () => {
        it('collects all reachable non-conditional nodes', () => {
            const nodesMap = new Map([
                ['A', { id: 'A', data: { type: 'task' } }],
                ['B', { id: 'B', data: { type: 'task' } }],
                ['C', { id: 'C', data: { type: 'task' } }],
            ]);
            const edges = [
                { source: 'A', target: 'B' },
                { source: 'B', target: 'C' },
            ];

            const result = Diagram.getReachableNodes('A', nodesMap, edges, new Set());
            expect(result.sort()).toEqual(['A', 'B', 'C']);
        });

        it('stops at conditional nodes', () => {
            const nodesMap = new Map([
                ['A', { id: 'A', data: { type: 'task' } }],
                ['B', { id: 'B', data: { type: 'conditional' } }],
                ['C', { id: 'C', data: { type: 'task' } }],
            ]);
            const edges = [
                { source: 'A', target: 'B' },
                { source: 'B', target: 'C' },
            ];

            const result = Diagram.getReachableNodes('A', nodesMap, edges, new Set());
            expect(result.sort()).toEqual(['A', 'B']);
        });

        it('respects already-assigned nodes', () => {
            const nodesMap = new Map([
                ['A', { id: 'A', data: { type: 'task' } }],
                ['B', { id: 'B', data: { type: 'task' } }],
            ]);
            const edges = [{ source: 'A', target: 'B' }];
            const assigned = new Set(['B']);

            const result = Diagram.getReachableNodes('A', nodesMap, edges, assigned);
            expect(result).toEqual(['A']);
        });
    });

    describe('collectSubflowEdges', () => {
        it('collects the branch edge plus internal edges', () => {
            const nodesMap = new Map([
                ['cond', { id: 'cond', data: { type: 'conditional' } }],
                ['A', { id: 'A', data: { type: 'task' } }],
                ['B', { id: 'B', data: { type: 'task' } }],
            ]);
            const branchEdge = { source: 'cond', target: 'A', sourceHandle: 'yes' };
            const allEdges = [branchEdge, { source: 'A', target: 'B' }, { source: 'X', target: 'Y' }];
            const nodeIds = new Set(['A', 'B']);

            const result = Diagram.collectSubflowEdges(branchEdge, nodeIds, allEdges, nodesMap, 'cond');
            expect(result).toHaveLength(2);
            expect(result).toContain(branchEdge);
        });
    });

    describe('assignNonConditionalNodes', () => {
        it('assigns only non-conditional nodes', () => {
            const nodeIdsSet = new Set(['condA', 'taskA', 'endpointA']);
            const nodesMap = new Map([
                ['condA', { id: 'condA', data: { type: 'conditional' } }],
                ['taskA', { id: 'taskA', data: { type: 'task' } }],
                ['endpointA', { id: 'endpointA', data: { type: 'endpoint' } }],
            ]);
            const assigned = new Set();

            Diagram.assignNonConditionalNodes(nodeIdsSet, nodesMap, assigned);

            expect(assigned.has('condA')).toBe(false);
            expect(assigned.has('taskA')).toBe(true);
            expect(assigned.has('endpointA')).toBe(true);
        });

        it('skips node IDs not present in nodesMap', () => {
            const nodeIdsSet = new Set(['taskA', 'ghost']);
            const nodesMap = new Map([['taskA', { id: 'taskA', data: { type: 'task' } }]]);
            const assigned = new Set();

            Diagram.assignNonConditionalNodes(nodeIdsSet, nodesMap, assigned);

            expect(assigned.has('taskA')).toBe(true);
            expect(assigned.has('ghost')).toBe(false);
        });
    });

    describe('buildMainEdges', () => {
        it('keeps branch edge from main conditional even when target is outside main set', () => {
            const nodesMap = new Map([
                ['condA', { id: 'condA', data: { type: 'conditional' } }],
                ['sharedEndpoint', { id: 'sharedEndpoint', data: { type: 'endpoint' } }],
            ]);
            const mainNodeIds = new Set(['condA']);
            const edges = [
                {
                    id: 'e-branch',
                    source: 'condA',
                    target: 'sharedEndpoint',
                    sourceHandle: 'yes',
                },
            ];

            const result = Diagram.buildMainEdges(edges, mainNodeIds, nodesMap);

            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('e-branch');
        });

        it('does not keep non-branch edge that leaves main set', () => {
            const nodesMap = new Map([
                ['taskA', { id: 'taskA', data: { type: 'task' } }],
                ['taskB', { id: 'taskB', data: { type: 'task' } }],
            ]);
            const mainNodeIds = new Set(['taskA']);
            const edges = [
                {
                    id: 'e-out',
                    source: 'taskA',
                    target: 'taskB',
                    sourceHandle: null,
                },
            ];

            const result = Diagram.buildMainEdges(edges, mainNodeIds, nodesMap);

            expect(result).toHaveLength(0);
        });
    });
});
