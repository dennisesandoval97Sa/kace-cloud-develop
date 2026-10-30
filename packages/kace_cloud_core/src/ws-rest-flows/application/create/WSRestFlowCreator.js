import { CustomError } from '../../../shared/errors/CustomError';
import { UniquenessValidator } from '../../../shared/validation/UniquenessValidator';
import { DomainWSRestFlowFinder, WSRestFlow } from '../../index';
import { ValidationFailError } from '../../../shared/index.js';
import { v4 as uuidv4 } from 'uuid';
import { WSRestConditionalCreator } from '../../../ws-rest-conditionals/application/create/WSRestConditionalCreator.js';
import { KnexWSRestConditionalRepository } from '../../../ws-rest-conditionals/infrastructure/persistence/KnexWSRestConditionalRepository.js';
import { WSRestFlowStepManager } from '../services/WSRestFlowStepManager.js';
import { WSRestFlowDiagramHelper as Diagram } from '../services/WSRestFlowDiagramHelper.js';

export class WSRestFlowCreator {
    /** @type {KnexWSRestFlowRepository} is initialized in the constructor */
    #repository;
    /** @type {DomainWSRestFlowFinder} is initialized in the constructor */
    #flowFinder;
    /** @type {UniquenessValidator} is initialized in the constructor */
    #uniquenessValidator;

    /**
     * Creates an instance of `WSRestFlowCreator`.
     *
     * @param {KnexWSRestFlowRepository} repository - The repository used to save WS REST flows.
     * @param {KnexWSRestWorkflowStepRepository} stepRepository - The repository used to save workflow steps.
     */
    constructor(repository, stepRepository) {
        this.#repository = repository;
        this.#flowFinder = new DomainWSRestFlowFinder(repository);
        this.#uniquenessValidator = new UniquenessValidator(repository);
        this.conditionalRepository = new KnexWSRestConditionalRepository(repository.connection);
        this.conditionalCreator = new WSRestConditionalCreator(this.conditionalRepository);
        this.stepManager = new WSRestFlowStepManager(stepRepository);
    }

    /**
     * Creates a WSRestFlow. When the diagram contains conditional nodes the flow
     * is automatically partitioned into a main flow + subflows.
     *
     * @param {Object} dto - The data transfer object containing the properties for the WSRestFlow object.
     * @returns {Promise<void>} A promise that resolves when the WSRestFlow object is saved.
     */
    async execute(dto) {
        if (dto === null || dto === undefined) throw new Error('dto cannot be null or undefined');

        const { nodes, edges, nodesMap } = Diagram.parseDiagram(dto.json_diagram_properties);
        const conditionalNodes = Diagram.getConditionalNodes(nodes);

        if (conditionalNodes.length === 0) {
            return this.#createSimpleFlow(dto, nodes, edges);
        }

        return this.#createFlowWithConditionals(dto, nodes, edges, nodesMap, conditionalNodes);
    }

    async #createSimpleFlow(dto, nodes, edges) {
        const wsRestFlow = WSRestFlow.create({
            ...dto,
            is_primary: dto.is_primary !== false,
            json_diagram_properties: { nodes, edges },
        });

        await this.#ensureFlowDoesNotExist(wsRestFlow.id.value);
        await this.#ensureExternalCodeIsUnique(dto.external_code);
        await this.#uniquenessValidator.validate('description', dto.description);

        await this.#repository.save(wsRestFlow);
        await this.#repository.saveHistory(wsRestFlow);
        await this.stepManager.createStepsForFlows(wsRestFlow, dto, []);
    }

    async #createFlowWithConditionals(dto, nodes, edges, nodesMap, conditionalNodes) {
        const assignedNodes = new Set();
        const subflows = [];

        for (const cond of conditionalNodes) {
            this.#partitionBranches(cond, nodes, edges, nodesMap, assignedNodes, subflows, dto);
        }

        const mainNodes = nodes.filter((n) => !assignedNodes.has(n.id));
        const mainNodeIds = new Set(mainNodes.map((n) => n.id));
        const mainEdges = Diagram.buildMainEdges(edges, mainNodeIds, nodesMap);

        const mainDto = Object.assign({}, dto, {
            json_diagram_properties: {
                nodes: mainNodes,
                edges: mainEdges,
            },
        });

        const mainFlow = WSRestFlow.create({ ...mainDto, is_primary: mainDto.is_primary !== false });

        await this.#ensureFlowDoesNotExist(mainFlow.id.value);
        await this.#ensureExternalCodeIsUnique(mainDto.external_code);
        await this.#uniquenessValidator.validate('description', mainDto.description);

        await this.#repository.save(mainFlow);
        await this.#repository.saveHistory(mainFlow);

        for (const cond of conditionalNodes) {
            await this.conditionalCreator.execute({
                id: cond.data.id,
                satisfied: cond.data.subflows?.satisfied || null,
                unsatisfied: cond.data.subflows?.unsatisfied || null,
                operator: cond.data.conditionType || null,
                input_path_a: cond.data.filter || cond.data.input_path_a || null,
                input_path_b: cond.data.value || cond.data.input_path_b || null,
                created_at: mainFlow.created_at.value,
                created_by: mainFlow.created_by.value,
            });
        }

        for (const s of subflows) {
            const subFlow = WSRestFlow.create({
                ...s.dto,
                is_primary: false,
                external_code: `${s.dto.external_code}_subflow_${s.index}`,
            });
            await this.#ensureFlowDoesNotExist(subFlow.id.value);
            await this.#repository.save(subFlow);
            await this.#repository.saveHistory(subFlow);
        }

        await this.stepManager.createStepsForFlows(mainFlow, mainDto, subflows);
    }

    #partitionBranches(cond, nodes, edges, nodesMap, assignedNodes, subflows, dto) {
        const outgoingEdges = edges.filter((e) => e.source === cond.id);

        if (outgoingEdges.length < 1) {
            throw new ValidationFailError(
                `Conditional node ${cond.id} must have at least one outgoing branch`,
                'json_diagram_properties'
            );
        }
        if (outgoingEdges.length > 2) {
            throw new ValidationFailError(
                `Conditional node ${cond.id} can have at most two outgoing branches`,
                'json_diagram_properties'
            );
        }

        cond.data.subflows = cond.data.subflows || {};
        const { is_primary, ...dtoWithoutPrimary } = dto;

        for (const edge of outgoingEdges) {
            const handleKey = Diagram.mapBranchKey(edge.sourceHandle, cond.data.subflows);

            const sharedHead = subflows.find((s) => s.entryNodeId === edge.target);
            if (sharedHead) {
                cond.data.subflows[handleKey] = sharedHead.id;
                continue;
            }

            const reachable = Diagram.getReachableNodes(edge.target, nodesMap, edges, new Set());
            if (!reachable.includes(edge.target) && edge.target !== cond.id) reachable.push(edge.target);

            const nodeIdsSet = new Set(reachable);
            Diagram.assignNonConditionalNodes(nodeIdsSet, nodesMap, assignedNodes);

            const subflowId = uuidv4();
            cond.data.subflows[handleKey] = subflowId;

            const subNodes = [cond, ...nodes.filter((n) => nodeIdsSet.has(n.id))];
            const subEdges = Diagram.collectSubflowEdges(edge, nodeIdsSet, edges, nodesMap, cond.id);

            subflows.push({
                id: subflowId,
                dto: {
                    ...dtoWithoutPrimary,
                    id: subflowId,
                    description: `${dto.description} (subflow ${handleKey})`,
                    is_primary: false,
                    json_diagram_properties: { nodes: subNodes, edges: subEdges },
                },
                nodeIds: nodeIdsSet,
                index: subflows.length + 1,
                entryNodeId: edge.target,
            });
        }
    }

    async #ensureFlowDoesNotExist(id) {
        const result = await this.#flowFinder.execute(id);
        if (result) throw new CustomError(`WSRestFlow with id ${id} already exists`, 400);
    }

    async #ensureExternalCodeIsUnique(externalCode) {
        if (!externalCode) return;
        const existing = await this.#repository.findByExternalCode(externalCode);
        if (existing) throw new ValidationFailError(`External code ${externalCode} already exists`, 'external_code');
    }
}
