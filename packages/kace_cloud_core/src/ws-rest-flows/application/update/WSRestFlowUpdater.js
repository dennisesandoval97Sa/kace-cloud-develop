import { CustomError } from '../../../shared/errors/CustomError.js';
import { UniquenessValidator } from '../../../shared/validation/UniquenessValidator.js';
import { DomainWSRestFlowFinder } from '../../index.js';
import { Helper, ValidationFailError } from '../../../shared/index.js';
import { WSRestFlowStepManager } from '../services/WSRestFlowStepManager.js';
import { KnexWSRestConditionalRepository } from '../../../ws-rest-conditionals/infrastructure/persistence/KnexWSRestConditionalRepository.js';
import { WSRestConditionalCreator } from '../../../ws-rest-conditionals/application/create/WSRestConditionalCreator.js';
import { WSRestConditionalUpdater } from '../../../ws-rest-conditionals/application/update/WSRestConditionalUpdater.js';
import { WSRestConditionalFinder } from '../../../ws-rest-conditionals/domain/WSRestConditionalFinder.js';
import { v4 as uuidv4 } from 'uuid';
import { WSRestFlow } from '../../domain/WSRestFlow.js';
import { WSRestFlowDiagramHelper as Diagram } from '../services/WSRestFlowDiagramHelper.js';

export class WSRestFlowUpdater {
    /** @type {KnexWSRestFlowRepository} is initialized in the constructor */
    #repository;
    /** @type {DomainWSRestFlowFinder} is initialized in the constructor */
    #flowFinder;
    /** @type {UniquenessValidator} is initialized in the constructor */
    #uniquenessValidator;
    /** @type {WSRestFlowStepManager} is initialized in the constructor */
    #stepManager;
    /** @type {KnexWSRestConditionalRepository} is initialized in the constructor */
    #conditionalRepository;
    /** @type {WSRestConditionalCreator} is initialized in the constructor */
    #conditionalCreator;
    /** @type {WSRestConditionalUpdater} is initialized in the constructor */
    #conditionalUpdater;
    /** @type {WSRestConditionalFinder} is initialized in the constructor */
    #conditionalFinder;

    /**
     * Creates an instance of the `WSRestFlowUpdater` class.
     *
     * @param {KnexWSRestFlowRepository} repository - An instance of the repository that manages WS REST flows.
     * @param {KnexWSRestWorkflowStepRepository} stepRepository - An instance of the repository that manages workflow steps.
     */
    constructor(repository, stepRepository) {
        this.#repository = repository;
        this.#flowFinder = new DomainWSRestFlowFinder(repository);
        this.#uniquenessValidator = new UniquenessValidator(repository);
        this.#stepManager = new WSRestFlowStepManager(stepRepository);
        this.#conditionalRepository = new KnexWSRestConditionalRepository(repository.connection);
        this.#conditionalCreator = new WSRestConditionalCreator(this.#conditionalRepository);
        this.#conditionalUpdater = new WSRestConditionalUpdater(this.#conditionalRepository);
        this.#conditionalFinder = new WSRestConditionalFinder(this.#conditionalRepository);
    }

    /**
     * Updates a WSRestFlow by its ID.
     *
     * @param {string} id - The unique identifier of the WSRestFlow object to update.
     * @param {Object} dto - The data transfer object containing the properties to update in the WSRestFlow object.
     * @returns {Promise<void>} A promise that resolves when the WSRestFlow object is updated.
     */
    async execute(id, dto) {
        const wsRestFlow = await this.#flowFinder.execute(id);

        if (!wsRestFlow) {
            throw new CustomError(`WSRestFlow with id ${id} does not exist.`, 404);
        }

        if (dto.description) {
            await this.#uniquenessValidator.validate('description', dto.description, id);
        }

        if (dto.external_code) {
            const existingByCode = await this.#repository.findByExternalCode(dto.external_code);
            if (existingByCode && existingByCode.id.value !== wsRestFlow.id.value && existingByCode.is_primary.value) {
                throw new ValidationFailError(`External code ${dto.external_code} already exists`, 400);
            }
        }

        const originalValues = wsRestFlow.toJson();
        wsRestFlow.update(dto);

        await this.#repository.update(wsRestFlow);
        await this.#repository.saveHistory(wsRestFlow, originalValues);

        if (dto.json_diagram_properties) {
            await this.#updateDiagram(wsRestFlow, dto, originalValues);
        }

        wsRestFlow.flushChanges();
    }

    async #updateDiagram(wsRestFlow, dto, originalValues) {
        const { nodes, edges, nodesMap } = Diagram.parseDiagram(dto.json_diagram_properties);
        const conditionalNodes = Diagram.getConditionalNodes(nodes);

        await this.#cleanRemovedConditionals(originalValues, conditionalNodes);

        const context = {
            wsRestFlow,
            nodes,
            edges,
            nodesMap,
            oldSubflowMap: this.#buildOldSubflowMap(originalValues),
            assignedNodes: new Set(),
            subflows: [],
            reusedSubflowIds: new Set(),
            conditionalsToSave: [],
            updatedBy: dto.updated_by,
        };

        for (const cond of conditionalNodes) {
            await this.#partitionAndSaveBranches(cond, context);
        }

        const mainNodes = nodes.filter((n) => !context.assignedNodes.has(n.id));
        const mainNodeIds = new Set(mainNodes.map((n) => n.id));
        const mainEdges = Diagram.buildMainEdges(edges, mainNodeIds, nodesMap);

        const mainDiagram = {
            nodes: mainNodes,
            edges: mainEdges,
        };

        wsRestFlow.update({ json_diagram_properties: mainDiagram });
        await this.#repository.update(wsRestFlow);

        for (const conditionalDto of context.conditionalsToSave) {
            await this.#upsertConditional(conditionalDto);
        }

        await this.#deleteOrphanedSubflows(context.oldSubflowMap, context.reusedSubflowIds, dto.updated_by);
        await this.#stepManager.updateStepsForFlows(
            wsRestFlow,
            { ...dto, json_diagram_properties: mainDiagram },
            context.subflows
        );
    }

    async #partitionAndSaveBranches(cond, ctx) {
        cond.data.subflows = cond.data.subflows || {};

        const conditionalDto = {
            id: cond.data.id,
            name: cond.data.name || 'Conditional',
            input_path_a: cond.data.filter || cond.data.input_path_a || null,
            operator: cond.data.conditionType || cond.data.operator || null,
            input_path_b: cond.data.value || cond.data.input_path_b || null,
            satisfied: null,
            unsatisfied: null,
            created_by: ctx.updatedBy,
            created_at: new Date().toISOString(),
        };

        const outgoingEdges = ctx.edges.filter((e) => e.source === cond.id).filter((e) => ctx.nodesMap.has(e.target));

        for (const edge of outgoingEdges) {
            const branch = Diagram.mapBranchKey(edge.sourceHandle, conditionalDto);

            const sharedHead = ctx.subflows.find((s) => s.entryNodeId === edge.target);
            if (sharedHead) {
                cond.data.subflows[branch] = sharedHead.id;
                conditionalDto[branch] = sharedHead.id;
                continue;
            }

            const reachable = Diagram.getReachableNodes(edge.target, ctx.nodesMap, ctx.edges, new Set());
            if (!reachable.includes(edge.target) && edge.target !== cond.id) reachable.push(edge.target);

            const nodeIdsSet = new Set(reachable);
            Diagram.assignNonConditionalNodes(nodeIdsSet, ctx.nodesMap, ctx.assignedNodes);

            const subflowKey = `${cond.data.id}_${branch}`;
            let subflowId = ctx.oldSubflowMap.get(subflowKey);

            if (!subflowId || ctx.reusedSubflowIds.has(subflowId)) {
                subflowId = uuidv4();
            }

            ctx.reusedSubflowIds.add(subflowId);

            cond.data.subflows[branch] = subflowId;
            conditionalDto[branch] = subflowId;

            const subNodes = [cond, ...ctx.nodes.filter((n) => nodeIdsSet.has(n.id))];
            const subEdges = Diagram.collectSubflowEdges(edge, nodeIdsSet, ctx.edges, ctx.nodesMap, cond.id);

            const subflowDto = {
                id: subflowId,
                description: `${ctx.wsRestFlow.description.value} - ${branch} branch`,
                external_code: `${ctx.wsRestFlow.external_code.value}_${branch}`,
                json_diagram_properties: { nodes: subNodes, edges: subEdges },
                is_primary: false,
                updated_at: new Date().toISOString(),
                updated_by: ctx.updatedBy,
            };

            await this.#upsertSubflow({ id: subflowId, dto: subflowDto }, ctx.updatedBy);
            ctx.subflows.push({
                id: subflowId,
                dto: subflowDto,
                nodeIds: nodeIdsSet,
                index: ctx.subflows.length + 1,
                branch,
                entryNodeId: edge.target,
            });
        }

        ctx.conditionalsToSave.push(conditionalDto);
    }

    async #cleanRemovedConditionals(originalValues, newConditionalNodes) {
        const oldDiagram = originalValues.json_diagram_properties || {};
        const oldNodes = Array.isArray(oldDiagram.nodes) ? oldDiagram.nodes : [];

        const oldIds = oldNodes.filter((n) => n?.data?.type === 'conditional' && n.data.id).map((n) => n.data.id);

        const newIds = newConditionalNodes.filter((n) => n.data?.id).map((n) => n.data.id);

        for (const conditionalId of oldIds) {
            if (!newIds.includes(conditionalId)) {
                try {
                    await this.#conditionalRepository
                        .connection(this.#conditionalRepository.qualifiedName('ws_rest_conditionals'))
                        .where({ id: conditionalId })
                        .del();
                } catch (error) {
                    Helper.logError('Error deleting removed conditional:', error);
                }
            }
        }
    }

    #buildOldSubflowMap(originalValues) {
        const oldDiagram = originalValues.json_diagram_properties || {};
        const oldNodes = Array.isArray(oldDiagram.nodes) ? oldDiagram.nodes : [];
        const map = new Map();

        for (const cond of oldNodes.filter((n) => n?.data?.type === 'conditional')) {
            for (const [branch, subflowId] of Object.entries(cond.data.subflows || {})) {
                map.set(`${cond.data.id}_${branch}`, subflowId);
            }
        }
        return map;
    }

    async #upsertConditional(conditionalDto) {
        let existing = null;
        try {
            existing = await this.#conditionalFinder.execute(conditionalDto.id);
        } catch (error) {
            Helper.logError('Error finding conditional for upsert:', error);
            existing = null;
        }

        try {
            if (existing) {
                await this.#conditionalUpdater.execute(conditionalDto.id, conditionalDto);
            } else {
                await this.#conditionalCreator.execute(conditionalDto);
            }
        } catch (error) {
            if (error.message?.includes('already exists')) {
                await this.#conditionalUpdater.execute(conditionalDto.id, conditionalDto);
            } else {
                throw error;
            }
        }
    }

    /**
     * Attempts to find and update an existing subflow by ID.
     * Returns true if the subflow was found and updated, false otherwise.
     *
     * @param {{ id: string, dto: Object }} data
     * @returns {Promise<boolean>}
     */
    async #tryUpdateExistingSubflow(data) {
        const existing = await this.#flowFinder.execute(data.id);
        if (!existing) return false;

        if (existing.isDeleted()) {
            await this.#restoreSoftDeletedSubflow(data);
            return true;
        }

        existing.update(data.dto);
        await this.#repository.update(existing);
        return true;
    }

    async #restoreSoftDeletedSubflow(data) {
        const { dto } = data;
        await this.#repository
            .connection(this.#repository.tableName)
            .where({ id: data.id })
            .update({
                description: dto.description,
                external_code: dto.external_code,
                json_diagram_properties: JSON.stringify(dto.json_diagram_properties),
                is_primary: dto.is_primary,
                updated_at: dto.updated_at,
                updated_by: dto.updated_by,
                deleted_at: null,
                deleted_by: null,
            });
    }

    async #upsertSubflow(data, updatedBy) {
        if (await this.#tryUpdateExistingSubflow(data)) return;

        try {
            await this.#createNewSubflow(data, updatedBy);
        } catch (error) {
            const isDuplicateError =
                error?.code === '23505' ||
                /already exists|duplicate key|UNIQUE constraint failed/i.test(error?.message ?? '') ||
                /already exists|duplicate key|UNIQUE constraint failed/i.test(error?.originalMessage ?? '');

            Helper.logInfo('[WSRestFlowUpdater] Subflow create failed during upsert', {
                subflow_id: data.id,
                error_code: error?.code ?? null,
                is_duplicate_error: isDuplicateError,
            });

            if (!isDuplicateError) {
                throw error;
            }

            Helper.logError('Subflow create failed due to duplicate, retrying as update:', error);

            if (await this.#tryUpdateExistingSubflow(data)) return;

            Helper.logError('[WSRestFlowUpdater] Subflow not found after duplicate error, skipping upsert', {
                subflow_id: data.id,
            });
        }
    }

    async #createNewSubflow(data, createdBy) {
        data.dto.created_at = new Date().toISOString();
        data.dto.created_by = createdBy;
        const subFlow = WSRestFlow.create(data.dto);
        await this.#repository.save(subFlow);
    }

    async #deleteOrphanedSubflows(oldSubflowMap, reusedSubflowIds, deletedBy) {
        for (const [, subflowId] of oldSubflowMap.entries()) {
            if (reusedSubflowIds.has(subflowId)) continue;
            try {
                const subflow = await this.#flowFinder.execute(subflowId);
                if (subflow && !subflow.isDeleted() && !subflow.is_primary.value) {
                    await this.#stepManager.deleteStepsForFlow(subflowId);
                    subflow.delete({ deleted_at: new Date().toISOString(), deleted_by: deletedBy });
                    await this.#repository.delete(subflow);
                }
            } catch (error) {
                Helper.logError('Error deleting orphaned subflow:', error);
            }
        }
    }
}
