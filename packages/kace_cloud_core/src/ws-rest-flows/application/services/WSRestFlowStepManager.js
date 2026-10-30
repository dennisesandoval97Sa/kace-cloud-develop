import { v4 as uuidv4 } from 'uuid';
import { WSRestWorkflowStep } from '../../../ws-rest-workflow-step/domain/WSRestWorkflowStep.js';
import { Helper } from '../../../shared/index.js';

/**
 * Service class for managing workflow steps associated with flows
 */
export class WSRestFlowStepManager {
    /** @type {KnexWSRestWorkflowStepRepository} */
    #stepRepository;

    /**
     * @param {KnexWSRestWorkflowStepRepository} stepRepository
     */
    constructor(stepRepository) {
        this.#stepRepository = stepRepository;
    }

    /**
     * Generates the sequential path of steps for a given flow diagram.
     * Follows edges from start node to create an ordered sequence of steps.
     *
     * @param {Array} nodes - The nodes in the flow diagram
     * @param {Array} edges - The edges in the flow diagram
     * @param {string} flowId - The ID of the flow these steps belong to
     * @param {string} startNodeId - Optional start node ID, defaults to "0"
     * @returns {Array} Array of step objects with id, flow_id, order, and function_id or endpoint_id
     */
    generateStepsForFlow(nodes, edges, flowId, startNodeId = "0") {
        Helper.logInfo(`[WSRestFlowStepManager] Generating steps for flow ${flowId}, starting from node ${startNodeId}`);
        const steps = [];
        const visitedNodes = new Set();
        let currentNode = startNodeId;

        while (currentNode && !visitedNodes.has(currentNode)) {
            visitedNodes.add(currentNode);
            const nodeInfo = nodes?.find((nd) => nd.id === currentNode);

            if (nodeInfo && nodeInfo.data && nodeInfo.type !== 'input' && currentNode !== '0') {
                const stepData = {
                    id: uuidv4(),
                    flow_id: flowId,
                    order: steps.length + 1,
                };

                if (nodeInfo.data.type === "function") {
                    stepData.function_id = nodeInfo.data.id;
                    stepData.endpoint_id = null;
                    stepData.conditional_id = null;
                } else if (nodeInfo.data.type === "conditional") {
                    stepData.function_id = null;
                    stepData.endpoint_id = null;
                    stepData.conditional_id = nodeInfo.data.id;
                    Helper.logInfo('[WSRestFlowStepManager] Generated step with conditional', {
                        step_order: stepData.order,
                        conditional_id: stepData.conditional_id,
                        node_id: currentNode,
                    });
                } else {
                    stepData.endpoint_id = nodeInfo.data.id;
                    stepData.function_id = null;
                    stepData.conditional_id = null;
                }

                steps.push(stepData);
            }

            const nextEdge = edges.find(e => e.source === currentNode && !e.sourceHandle);
            currentNode = nextEdge ? nextEdge.target : null;
        }

        Helper.logInfo(`[WSRestFlowStepManager] Generated ${steps.length} steps for flow ${flowId}`);
        Helper.logInfo(`[WSRestFlowStepManager] Step details:`, JSON.stringify(steps.map(s => ({
            order: s.order,
            endpoint_id: s.endpoint_id,
            function_id: s.function_id,
            conditional_id: s.conditional_id
        })), null, 2));
        return steps;
    }

    /**
     * Creates steps for the main flow and all subflows.
     *
     * @param {Object} mainFlow - The main WSRestFlow object
     * @param {Object} mainDto - The DTO containing the main flow's diagram properties
     * @param {Array} subflows - Array of subflow objects containing { id, dto, nodeIds, index }
     * @returns {Promise<void>}
     */
    async createStepsForFlows(mainFlow, mainDto, subflows) {
        Helper.logInfo(`[WSRestFlowStepManager] Creating steps for main flow ${mainFlow.id.value} and ${subflows.length} subflows`);
        const mainDiagram = mainDto.json_diagram_properties ?? {};
        const mainSteps = this.generateStepsForFlow(
            mainDiagram.nodes ?? [],
            mainDiagram.edges ?? [],
            mainFlow.id.value
        );

        for (const step of mainSteps) {
            const stepDto = {
                ...step,
                created_at: mainFlow.created_at.value,
                created_by: mainFlow.created_by.value,
            };
            const stepEntity = WSRestWorkflowStep.create(stepDto);
            await this.#stepRepository.save(stepEntity);
        }
        Helper.logInfo(`[WSRestFlowStepManager] Saved ${mainSteps.length} steps for main flow`);

        for (const subflow of subflows) {
            const subflowDiagram = subflow.dto.json_diagram_properties ?? {};
            const subflowNodes = subflowDiagram.nodes ?? [];
            const subflowEdges = subflowDiagram.edges ?? [];
            const conditionalNode = subflowNodes.find(n => n.data && n.data.type === 'conditional');
            if (!conditionalNode) continue;
            
            const firstEdge = subflowEdges.find(e => e.source === conditionalNode.id);
            if (!firstEdge) continue;
            
            const startNodeId = firstEdge.target;
            
            const subflowSteps = this.generateStepsForFlow(
                subflowNodes,
                subflowEdges,
                subflow.id,
                startNodeId
            );

            for (const step of subflowSteps) {
                const stepDto = {
                    ...step,
                    created_at: mainFlow.created_at.value,
                    created_by: mainFlow.created_by.value,
                };
                const stepEntity = WSRestWorkflowStep.create(stepDto);
                await this.#stepRepository.save(stepEntity);
            }
            Helper.logInfo(`[WSRestFlowStepManager] Saved ${subflowSteps.length} steps for subflow ${subflow.id}`);
        }
        Helper.logInfo(`[WSRestFlowStepManager] Finished creating all steps`);
    }

    /**
     * Deletes all steps for a given flow ID
     *
     * @param {string} flowId - The ID of the flow
     * @returns {Promise<void>}
     */
    async deleteStepsForFlow(flowId) {
        Helper.logInfo(`[WSRestFlowStepManager] Deleting all steps for flow ${flowId}`);
        const deletedCount = await this.#stepRepository.deleteByFlowId(flowId);
        Helper.logInfo(`[WSRestFlowStepManager] Deleted ${deletedCount || 0} steps for flow ${flowId}`);
    }

    /**
     * Updates steps for a flow by deleting existing ones and creating new ones
     *
     * @param {Object} mainFlow - The main WSRestFlow object
     * @param {Object} mainDto - The DTO containing the main flow's diagram properties
     * @param {Array} subflows - Array of subflow objects
     * @returns {Promise<void>}
     */
    async updateStepsForFlows(mainFlow, mainDto, subflows) {
        Helper.logInfo(`[WSRestFlowStepManager] Starting update: deleting old steps and creating new ones`);
        Helper.logInfo(`[WSRestFlowStepManager] Main flow ID: ${mainFlow.id.value}`);
        Helper.logInfo(`[WSRestFlowStepManager] Number of subflows: ${subflows.length}`);
        
        await this.deleteStepsForFlow(mainFlow.id.value);
        for (const subflow of subflows) {
            await this.deleteStepsForFlow(subflow.id);
        }

        await this.createStepsForFlows(mainFlow, mainDto, subflows);
        Helper.logInfo(`[WSRestFlowStepManager] Update complete`);
    }

    /**
     * Deletes steps for multiple flow IDs (main flow and all subflows)
     *
     * @param {Array<string>} flowIds - Array of flow IDs
     * @returns {Promise<void>}
     */
    async deleteStepsForMultipleFlows(flowIds) {
        Helper.logInfo(`[WSRestFlowStepManager] Deleting steps for ${flowIds.length} flows`);
        for (const flowId of flowIds) {
            await this.deleteStepsForFlow(flowId);
        }
        Helper.logInfo(`[WSRestFlowStepManager] Finished deleting steps for all flows`);
    }
}
