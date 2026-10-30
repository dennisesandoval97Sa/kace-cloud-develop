import { JsonWebToken } from '../auth/JsonWebToken.js';
import { NestedValueManager } from '../utilities/NestedValueManager.js';
import { GlobalContext } from '../global-context/GlobalContext.js';
import { GlobalContextProcessor } from '../global-context/GlobalContextProcessor.js';
import {
    CustomError,
    Helper,
    InvalidArgumentError,
    TenantContext,
    ValidationFailError,
    ValueObjectUuid,
} from '../../index.js';
import { WSRestFunctionTypeEnum } from '../enum/WSRestFunctionTypeEnum.js';
import { EventPublisher } from '../../application/events/EventPublisher.js';
import { InMemoryEventBus } from '../../infrastructure/events/InMemoryEventBus.js';
import { buildRoutingEventBusFromTenant } from '../../infrastructure/events/buildRoutingEventBusFromTenant.js';
import { WSRestFlowExecution } from '../../../ws-rest-flow-executions/domain/WSRestFlowExecution.js';
import { WSRestFlowExecutionRequested } from '../../../ws-rest-flow-executions/domain/events/WSRestFlowExecutionRequested.js';
import { KnexWSRestFlowExecutionRepository } from '../../../ws-rest-flow-executions/infrastructure/persistence/KnexWSRestFlowExecutionRepository.js';

/**
 * Domain service for executing workflow steps
 */
export class WorkflowStepExecutorService {
    /**
     * Execute a conditional step
     *
     * - Reads `input_path_a` and `input_path_b` from the conditional definition
     * - Validates both values exist in the global context
     * - Evaluates the conditional using the configured operator
     * - If a satisfied/unsatisfied external code is configured, triggers it asynchronously
     *
     * @param {Object} conditional - Conditional configuration object
     * @returns {Promise<Object>} - Object containing metadata about evaluation and hook execution
     * @private
     */
    async #executeConditional(conditional) {
        const getRaw = (prop) => (prop && typeof prop === 'object' && 'value' in prop ? prop.value : prop);

        const inputAPath = getRaw(conditional.input_path_a);
        const inputBPath = getRaw(conditional.input_path_b);
        const operator = (getRaw(conditional.operator) || '').toString();
        const satisfiedHook = getRaw(conditional.satisfied) || null;
        const unsatisfiedHook = getRaw(conditional.unsatisfied) || null;

        Helper.logDebug('Executing conditional', { inputAPath, inputBPath, operator });

        const inputBIsNotRequired = ['null', 'notNull', 'jsonNotEmpty', 'jsonEmpty', 'stringEmpty', 'stringNotEmpty'];
        const isUnaryOperator = operator && inputBIsNotRequired.includes(operator.toString());

        const missing = [];
        if (!inputAPath) {
            missing.push('a');
        }
        if (!inputBPath && !isUnaryOperator) {
            missing.push('b');
        }

        if (missing.length > 0) {
            Helper.logDebug('Conditional inputs missing in global context', { missing, inputAPath, inputBPath });
            return {
                metadata: {
                    evaluated: false,
                    reason: 'missing_inputs',
                    missing,
                },
            };
        }

        const getValueOrStatic = async (inputPath, label) => {
            Helper.logDebug(`Getting value for ${label}`, { inputPath, typeof: typeof inputPath });

            if (inputPath === null || inputPath === undefined) {
                Helper.logDebug(`Input path for ${label} is null/undefined, returning null`, { inputPath });
                return null;
            }

            const fullContext = this.#globalContext.get();
            Helper.logDebug(`Full global context for ${label}`, {
                fullContext: JSON.stringify(fullContext, null, 2),
            });

            const normalizedInputPath = typeof inputPath === 'string' ? inputPath.replace(/^context\./, '') : inputPath;

            const ctx = await this.#globalContext.getByFilterInput([normalizedInputPath]);
            Helper.logDebug(`Context lookup result for ${label}`, {
                hasCtx: Boolean(ctx),
                hasDataProcessed: Boolean(ctx?.dataProcessed),
                dataProcessed: ctx?.dataProcessed,
                keys: ctx?.dataProcessed ? Object.keys(ctx.dataProcessed) : [],
                values: ctx?.dataProcessed ? Object.values(ctx.dataProcessed) : [],
            });

            if (
                ctx &&
                ctx.dataProcessed &&
                Object.keys(ctx.dataProcessed).length > 0 &&
                operator.toString() !== 'jsonNotEmpty'
            ) {
                const allValues = Object.values(ctx.dataProcessed);
                const value = allValues[0];
                Helper.logDebug(`Conditional ${label} found in context`, {
                    inputPath,
                    value,
                    allValues,
                    dataProcessed: ctx.dataProcessed,
                });
                if (value !== undefined) {
                    return value;
                }
            }

            if (['jsonEmpty', 'jsonNotEmpty'].includes(operator.toString())) {
                return ctx.dataProcessed;
            }

            if (!ctx.resolved && ['null', 'notNull'].includes(operator.toString())) {
                return undefined;
            }

            Helper.logDebug(`Conditional ${label} not in context, using as static value`, { inputPath });

            if (typeof normalizedInputPath === 'string') {
                try {
                    const parts = normalizedInputPath.split('.');
                    let current = fullContext.context ?? fullContext;
                    let missingPart = false;
                    for (const part of parts) {
                        if (current && Object.prototype.hasOwnProperty.call(current, part)) {
                            current = current[part];
                        } else {
                            missingPart = true;
                            current = undefined;
                            break;
                        }
                    }
                    if (!missingPart) {
                        Helper.logDebug(`Resolved ${label} from fullContext`, { inputPath, resolved: current });
                        return current;
                    }
                } catch (e) {
                    Helper.logDebug(`Error resolving nested path for ${label}`, { inputPath, err: String(e) });
                }
            }

            let staticValue = inputPath;

            const asNumber = Number(inputPath);
            if (!isNaN(asNumber) && typeof inputPath === 'string' && inputPath.trim() === asNumber.toString()) {
                staticValue = asNumber;
                Helper.logDebug(`Parsed ${label} as number`, { original: inputPath, parsed: staticValue });
            }

            return staticValue;
        };

        const aValue = await getValueOrStatic(inputAPath, 'input A');
        Helper.logDebug('Got aValue', { aValue, typeof: typeof aValue });
        const bValue = await getValueOrStatic(inputBPath, 'input B');
        Helper.logDebug('Got bValue', { bValue, typeof: typeof bValue });

        const normalize = (v) => (v && typeof v === 'object' && 'value' in v ? v.value : v);

        const left = normalize(aValue);
        const right = normalize(bValue);

        Helper.logDebug('Conditional values extracted from context', {
            inputAPath,
            inputBPath,
            rawAValue: aValue,
            rawBValue: bValue,
            normalizedLeft: left,
            normalizedRight: right,
            leftType: typeof left,
            rightType: typeof right,
        });

        const sqlLikeToRegex = (pattern) => {
            const escaped = pattern.replace(/[-/\\^$+?.()|[\]{}]/g, '\\$&');
            const replaced = escaped.replace(/%/g, '.*').replace(/_/g, '.');
            return new RegExp('^' + replaced + '$');
        };

        const isEqual = (x, y) => {
            if (x === y) return true;
            if (typeof x === 'object' && typeof y === 'object') {
                try {
                    return JSON.stringify(x) === JSON.stringify(y);
                } catch {
                    // SI: No es necesario capturar la excepcion solo no cumple un condicional la funcion en caso de fallo
                    return false;
                }
            }
            return false;
        };

        const deepContains = (container, subset) => {
            if (subset === null || subset === undefined) return subset === container;
            if (typeof subset !== 'object' || subset instanceof Date) return isEqual(container, subset);
            if (typeof container !== 'object' || container === null) return false;
            if (Array.isArray(subset)) {
                if (!Array.isArray(container)) return false;
                return subset.every((s) => container.some((c) => deepContains(c, s)));
            }
            return Object.keys(subset).every((k) => deepContains(container[k], subset[k]));
        };

        const COMPARISON_MAP = {
            eq: '=',
            neq: '!=',
            gt: '>',
            gte: '>=',
            lt: '<',
            lte: '<=',
            between: 'between',
            in: 'in',
            notIn: 'not in',
            like: 'like',
            ilike: 'ilike',
            null: 'null',
            notNull: 'notNull',
            jsonContains: 'json contains',
            jsonArrayValue: 'json array value',
            jsonEmpty: 'json empty',
            jsonNotEmpty: 'json not empty',
            stringEmpty: 'string empty',
            stringNotEmpty: 'string not empty',
        };

        const normalizeOperator = (op) => {
            if (!op && op !== 0) return op;
            const s = op.toString();
            if (Object.prototype.hasOwnProperty.call(COMPARISON_MAP, s)) return s;
            for (const [key, val] of Object.entries(COMPARISON_MAP)) {
                if (s === val) return key;
            }
            return s;
        };

        const normalizedOperator = normalizeOperator(operator);

        const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;
        const asDateTimestamp = (v) => {
            if (v instanceof Date) {
                const t = v.getTime();
                return Number.isNaN(t) ? null : t;
            }
            if (typeof v === 'string' && ISO_DATE_RE.test(v.trim())) {
                const t = Date.parse(v.trim());
                return Number.isNaN(t) ? null : t;
            }
            return null;
        };

        let evaluation = false;
        try {
            switch (normalizedOperator) {
                case 'eq':
                    evaluation = isEqual(left, right);
                    break;
                case 'neq':
                    evaluation = !isEqual(left, right);
                    break;
                case 'gt': {
                    const lT = asDateTimestamp(left);
                    const rT = asDateTimestamp(right);
                    evaluation = lT !== null && rT !== null ? lT > rT : Number(left) > Number(right);
                    break;
                }
                case 'gte': {
                    const lT = asDateTimestamp(left);
                    const rT = asDateTimestamp(right);
                    evaluation = lT !== null && rT !== null ? lT >= rT : Number(left) >= Number(right);
                    break;
                }
                case 'lt': {
                    const lT = asDateTimestamp(left);
                    const rT = asDateTimestamp(right);
                    evaluation = lT !== null && rT !== null ? lT < rT : Number(left) < Number(right);
                    break;
                }
                case 'lte': {
                    const lT = asDateTimestamp(left);
                    const rT = asDateTimestamp(right);
                    evaluation = lT !== null && rT !== null ? lT <= rT : Number(left) <= Number(right);
                    break;
                }
                case 'between': {
                    if (!Array.isArray(right) || right.length < 2) {
                        throw new InvalidArgumentError(
                            '`between` operator requires an array [min, max] as second argument'
                        );
                    }
                    const lT = asDateTimestamp(left);
                    const minT = asDateTimestamp(right[0]);
                    const maxT = asDateTimestamp(right[1]);
                    if (lT !== null && minT !== null && maxT !== null) {
                        evaluation = lT >= minT && lT <= maxT;
                    } else {
                        evaluation = Number(left) >= Number(right[0]) && Number(left) <= Number(right[1]);
                    }
                    break;
                }
                case 'in':
                    if (!Array.isArray(right)) {
                        throw new InvalidArgumentError('`in` operator requires an array as second argument');
                    }
                    evaluation = right.includes(left) || right.some((r) => isEqual(r, left));
                    break;
                case 'notIn':
                    if (!Array.isArray(right)) {
                        throw new InvalidArgumentError('`notIn` operator requires an array as second argument');
                    }
                    evaluation = !(right.includes(left) || right.some((r) => isEqual(r, left)));
                    break;
                case 'like': {
                    if (typeof left !== 'string' || typeof right !== 'string') {
                        throw new InvalidArgumentError('`like` operator requires string operands');
                    }
                    const re = sqlLikeToRegex(right);
                    evaluation = re.test(left);
                    break;
                }
                case 'ilike': {
                    if (typeof left !== 'string' || typeof right !== 'string') {
                        throw new InvalidArgumentError('`ilike` operator requires string operands');
                    }
                    const re = sqlLikeToRegex(right);
                    evaluation = re.test(left.toString());
                    if (re.flags.indexOf('i') === -1) {
                        evaluation = new RegExp(re.source, 'i').test(left);
                    }
                    break;
                }
                case 'null':
                    evaluation = left === null || left === undefined;
                    break;
                case 'notNull':
                    evaluation = !(left === null || left === undefined);
                    break;
                case 'jsonContains':
                    evaluation = deepContains(left, right);
                    break;
                case 'jsonArrayValue':
                    if (!Array.isArray(left)) {
                        evaluation = false;
                    } else {
                        evaluation = left.some((el) => deepContains(el, right) || isEqual(el, right));
                    }
                    break;
                case 'jsonEmpty':
                    evaluation =
                        left === undefined ||
                        left === null ||
                        JSON.stringify(left) === '{}' ||
                        (typeof left === 'object' && Object.keys(left).length === 0);
                    break;
                case 'jsonNotEmpty':
                    evaluation = left && typeof left === 'object' && Object.keys(left).length > 0;
                    break;
                case 'stringEmpty':
                    // Non-string types (number, object, array) return false intentionally (fail-safe).
                    evaluation = left === undefined || left === null || left === '';
                    break;
                case 'stringNotEmpty':
                    // Non-string types (number, object, array) return true intentionally (fail-safe).
                    evaluation = left !== undefined && left !== null && left !== '';
                    break;
                default:
                    throw new InvalidArgumentError(`Unsupported operator: ${operator}`);
            }
        } catch (err) {
            Helper.logError('Error evaluating conditional', err);
            throw err;
        }

        Helper.logDebug('Conditional evaluation result', {
            operator,
            left,
            right,
            evaluation,
            satisfiedHook,
            unsatisfiedHook,
            willExecuteSatisfied: evaluation && satisfiedHook,
            willExecuteUnsatisfied: !evaluation && unsatisfiedHook,
        });

        let executedBranch = null;
        if (evaluation && satisfiedHook) {
            executedBranch = 'satisfied';
            Helper.logDebug('Conditional evaluated to TRUE, executing satisfied branch', { flow_id: satisfiedHook });

            const subflowSteps = await this.#finderService.findByFlowIdentifier({
                flowId: satisfiedHook,
                options: {
                    loadEndpoint: true,
                    loadFunction: true,
                    loadConditional: true,
                },
            });

            if (subflowSteps.length > 0) {
                Helper.logInfo(`Executing ${subflowSteps.length} steps from satisfied branch`);
            }
            for (const subStep of subflowSteps) {
                await this.#executeWorkflowStep(subStep);
            }
        } else if (!evaluation && unsatisfiedHook) {
            executedBranch = 'unsatisfied';
            Helper.logDebug('Conditional evaluated to FALSE, executing unsatisfied branch', {
                flow_id: unsatisfiedHook,
            });

            const subflowSteps = await this.#finderService.findByFlowIdentifier({
                flowId: unsatisfiedHook,
                options: {
                    loadEndpoint: true,
                    loadFunction: true,
                    loadConditional: true,
                },
            });

            if (subflowSteps.length > 0) {
                Helper.logInfo(`Executing ${subflowSteps.length} steps from unsatisfied branch`);
            }
            for (const subStep of subflowSteps) {
                await this.#executeWorkflowStep(subStep);
            }
        }

        return {
            metadata: {
                evaluated: true,
                result: evaluation,
                operator,
                aValue: left,
                bValue: right,
                executedBranch,
            },
        };
    }

    /**
     * @type {AxiosHttpClient}
     */
    #httpClient;

    /**
     * @type {SecretReplacer}
     */
    #secretReplacer;

    /**
     * @type {GlobalContext}
     */
    #globalContext;

    /**
     * @type {GlobalContextProcessor}
     */
    #contextProcessor;

    /**
     * @type {import('../../../ws-rest-workflow-step/domain/services/WSRestWorkflowStepFinderService.js').WSRestWorkflowStepFinderService}
     */
    #finderService;
    /** @type {import('../../../users').User} is initialized in the constructor */
    #currentUser;
    /** @type {import('../../../shared/EventLogger').EventLogger} is initialized in the constructor */
    #eventLogger;
    /** @type {Array} */
    #executionSteps = [];

    /**
     * In-memory cache for auth tokens, keyed by authorization endpoint ID.
     * Stores token and optional expiration for both JWT and opaque tokens.
     * @type {Map<string, {token: string|null, expiresAt: Date|null}>}
     */
    #authTokenCache = new Map();

    /**
     * Optional DB-level cache service for any auth endpoint responses.
     * Persists the full response in `ws_rest_endpoint_token_cache` using a TTL cascade strategy.
     * @type {import('../../../ws-rest-endpoints/domain/services/EndpointTokenCacheService.js').EndpointTokenCacheService|null}
     */
    #endpointTokenCacheService = null;

    /** @type {boolean} */
    #failOnHttpError = false;

    /** @type {number} */
    #requestTimeoutMs = 600000;

    /** @type {null|(() => number)} */
    #requestTimeoutResolver = null;

    /**
     * Validates an in-memory cache entry. Supports both JWT tokens (decoded exp claim)
     * and opaque tokens (explicit expiresAt timestamp).
     *
     * @param {{token: string|null, expiresAt: Date|null}} entry
     * @returns {boolean}
     */
    #isMemoryCacheValid(entry) {
        if (!entry) return false;
        if (entry.expiresAt != null) {
            return entry.expiresAt > new Date();
        }
        if (typeof entry.token === 'string') {
            return !JsonWebToken.isExpired(entry.token);
        }
        return true;
    }

    /**
     * Constructor for workflow step execution service
     *
     * @param {AxiosHttpClient} httpClient - HTTP client for making requests
     * @param {SecretReplacer} secretReplacer - Service for replacing secrets
     * @param {WSRestWorkflowStepFinderService} finderService - Service for finding workflow steps
     * @param {import('../../../shared/EventLogger').EventLogger} eventLogger - Event logging service
     * @param {import('../../../users').User} currentUser - The currently authenticated user object.
     * @param {import('../../../ws-rest-endpoints/domain/services/EndpointTokenCacheService.js').EndpointTokenCacheService|null} [endpointTokenCacheService=null] - Optional DB-level cache for any auth endpoint responses.
     * @param {{failOnHttpError?: boolean, requestTimeoutMs?: number, requestTimeoutResolver?: null|(() => number)}} [options] - Per-executor HTTP policy.
     */
    constructor(
        httpClient,
        secretReplacer,
        finderService,
        eventLogger,
        currentUser,
        endpointTokenCacheService = null,
        { failOnHttpError = false, requestTimeoutMs = 600000, requestTimeoutResolver = null } = {}
    ) {
        this.#httpClient = httpClient;
        this.#secretReplacer = secretReplacer;
        this.#finderService = finderService;
        this.#currentUser = currentUser;
        this.#eventLogger = eventLogger;
        this.#endpointTokenCacheService = endpointTokenCacheService;
        this.#failOnHttpError = failOnHttpError === true;
        this.#requestTimeoutMs = Number.isFinite(requestTimeoutMs) && requestTimeoutMs > 0 ? requestTimeoutMs : 600000;
        this.#requestTimeoutResolver = requestTimeoutResolver;

        this.#globalContext = new GlobalContext();
        this.#contextProcessor = new GlobalContextProcessor(this.#globalContext);
    }

    /**
     * Add initial data to the internal global context before executing endpoints.
     * @param {Object} initialContext
     */
    addInitialContext(initialContext) {
        if (initialContext && Object.keys(initialContext).length > 0) {
            this.#initializeContext(initialContext);
        }
    }

    /**
     * Execute all steps in a workflow identified by either flow ID or external code
     *
     * @param {Object} params - Workflow identification and execution parameters
     * @param {?string} [params.flow_id] - ID of the flow to execute (either this or externalCode must be provided)
     * @param {?string} [params.external_code] - External code of the flow to execute (either this or flowId must be provided)
     * @param {?Object} [params.initial_context={}] - Initial global context data
     *
     * @returns {Promise<GlobalContext>} - Global context after execution
     */
    async execute(params, trigger) {
        const { flow_id, external_code, initial_context = {} } = params;
        let aggregateId = null;
        let totalSteps = null;

        const caseId = initial_context?.case?.id || null;
        const clientId = initial_context?.client?.id || null;
        this.#executionSteps = [];

        try {
            const workflowSteps = await this.#finderService.findByFlowIdentifier({
                flowId: flow_id,
                externalCode: external_code,
                options: {
                    loadEndpoint: true,
                    loadFunction: true,
                    loadConditional: true,
                },
            });

            if (!workflowSteps || workflowSteps.length === 0) {
                throw new InvalidArgumentError('No workflow steps found for the provided flow identifier.');
            }

            totalSteps = workflowSteps.length;
            aggregateId = flow_id || workflowSteps[0].flow_id.value;

            Helper.logDebug(`Loaded ${totalSteps} workflow steps for flow ${aggregateId}`, {
                steps: workflowSteps.map((s) => ({
                    id: s.id?.value,
                    order: s.order?.value,
                    has_endpoint: Boolean(s.endpoint_id?.value),
                    has_function: Boolean(s.function_id?.value),
                    has_conditional: Boolean(s.conditional_id?.value),
                })),
            });

            const finalInitialContext = initial_context ?? workflowSteps[0].flow?.initial_context?.value ?? {};

            this.#initializeContext(finalInitialContext);
            Helper.logDebug('Contexto inicializado', JSON.stringify(this.#globalContext.get()));

            for (const step of workflowSteps) {
                await this.#executeWorkflowStep(step);
            }
        } catch (error) {
            const flowRef = aggregateId || flow_id || external_code || 'unknown';
            Helper.logError(`Error during workflow execution flow ${flowRef}`, error);
            throw error;
        } finally {
            if (aggregateId) {
                const eventData = {
                    trigger,
                    steps_executed: this.#executionSteps,
                    total_steps: totalSteps,
                    execution_summary: {
                        successful_steps: this.#executionSteps.filter((step) => !step.error).length,
                        endpoint_steps: this.#executionSteps.filter((step) => step.step_type === 'endpoint').length,
                        function_steps: this.#executionSteps.filter((step) => step.step_type === 'function').length,
                    },
                    execution_status: this.#executionSteps.some((step) => step.error) ? 'failed' : 'success',
                };
                let oldData = {};

                let resolvedCaseId = caseId;
                if (!resolvedCaseId) {
                    const finalGlobalContext = this.#globalContext.get()?.context || {};
                    if (finalGlobalContext.event_logger_case_id) {
                        resolvedCaseId = finalGlobalContext.event_logger_case_id;
                    }
                }

                if (resolvedCaseId) {
                    oldData = {
                        grupo_id: initial_context?.case?.grupo_id,
                        transicion_id: initial_context?.case?.transicion_id,
                        responsable_id: initial_context?.case?.responsable_id,
                    };
                }

                await this.#eventLogger.log(
                    'ws-rest-flows.executed',
                    aggregateId,
                    this.#currentUser.id.value,
                    eventData,
                    resolvedCaseId,
                    clientId,
                    oldData
                );
            }
        }
        return this.#globalContext;
    }

    /**
     * Initialize global context with provided initial data
     *
     * @param {Object} initialContext - Initial context data
     * @private
     */
    #initializeContext(initialContext) {
        if (Object.keys(initialContext).length > 0) {
            for (const [key, value] of Object.entries(initialContext)) {
                this.#globalContext.addDataProcessedToGlobalContext(key, value);
            }
        }
    }

    /**
     * Execute a single workflow step based on its type
     *
     * @param {import('../../../ws-rest-workflow-step/domain/WSRestWorkflowStep.js').WSRestWorkflowStep} step - Workflow step to execute
     * @returns {Promise<Object>} - Result of the step execution
     * @private
     */
    async #executeWorkflowStep(step) {
        const isFunctionStep = Boolean(step.function);
        const isConditionalStep = Boolean(step.conditional);
        const stepData = isFunctionStep ? step.function : isConditionalStep ? step.conditional : step.endpoint;

        const stepType = isFunctionStep ? 'function' : isConditionalStep ? 'conditional' : 'endpoint';
        Helper.logDebug(`Executing ${stepType} step`, {
            step_id: step.id?.value,
            order: step.order?.value,
            description: stepData?.description?.value,
        });

        const stepExecution = {
            step_id: step.id.value,
            step_type: isFunctionStep ? 'function' : isConditionalStep ? 'conditional' : 'endpoint',
            description: stepData?.description?.value ?? null,
            type: stepData?.type?.value ?? null,
            metadata: null,
            duration_ms: null,
            error: false,
        };

        const executionStart = new Date();

        try {
            if (step.function) {
                const { metadata } = await this.#executeFunction(stepData);
                stepExecution.metadata = metadata;
                const executionEnd = new Date();
                stepExecution.duration_ms = executionEnd.getTime() - executionStart.getTime();

                return;
            }

            if (step.endpoint) {
                const { result, metadata } = await this.executeEndpoint(stepData);
                stepExecution.metadata = metadata;

                if (!result || result.status >= 400) {
                    stepExecution.error = true;
                }
                const executionEnd = new Date();
                stepExecution.duration_ms = executionEnd.getTime() - executionStart.getTime();
                return;
            }

            if (step.conditional) {
                const { metadata } = await this.#executeConditional(step.conditional);
                const executionEnd = new Date();
                stepExecution.metadata = metadata;
                stepExecution.duration_ms = executionEnd.getTime() - executionStart.getTime();
                return;
            }

            return null;
        } catch (error) {
            Helper.logError(error);
            stepExecution.error = true;
            const executionEnd = new Date();
            stepExecution.duration_ms = executionEnd.getTime() - executionStart.getTime();
            throw error;
        } finally {
            Helper.logDebug('WorkflowStepExecutorService: stepExecution', JSON.stringify(stepExecution));
            this.#executionSteps.push(stepExecution);
        }
    }

    /**
     * Extracts the token string from the auth response using filter_input paths.
     * Returns the first string value found in the filter_input paths.
     *
     * @param {Object} responseData - The response data from the auth endpoint
     * @param {Array<string>} filterInput - Paths from filter_input (e.g., ["data.id_token"])
     * @returns {string|null} The token string, or null if not found
     */
    #extractTokenFromResponse(responseData, filterInput) {
        if (!responseData || filterInput.length === 0) return null;

        for (const path of filterInput) {
            const val = NestedValueManager.getValue(responseData, path);
            if (typeof val === 'string' && JsonWebToken.decode(val)) {
                return val;
            }
        }
        return null;
    }

    /**
     * Resolves and executes the authorization workflow for an endpoint.
     * Handles in-memory, database, and HTTP execution caches.
     *
     * @param {WSRestEndpoint} endpoint - The endpoint whose authorization needs to be handled.
     * @returns {Promise<void>}
     * @private
     */
    async #handleEndpointAuthorization(endpoint) {
        const authEndpoint = endpoint.authorization;
        const authId = authEndpoint.id.value;
        const memoryEntry = this.#authTokenCache.get(authId);
        const isMemoryValid = memoryEntry && this.#isMemoryCacheValid(memoryEntry);

        if (isMemoryValid) {
            Helper.logDebug(`[AuthTokenCache] In-memory hit – reusing token for auth endpoint ${authId}`);
            return;
        }

        Helper.logDebug(`[AuthTokenCache] In-memory miss for auth endpoint ${authId} – checking database caches`);

        let authHandled = false;
        let token = null;
        let memoryExpiresAt = null;

        if (!authHandled && this.#endpointTokenCacheService) {
            const cachedResponseData = await this.#endpointTokenCacheService.getValidCachedResponse(authId);
            if (cachedResponseData) {
                Helper.logDebug(`[AuthTokenCache] Database endpoint cache HIT for ${authId}`);
                const filterInput = authEndpoint.filter_input?.value?.filter_input || [];
                this.#updateContextFromResponse(authEndpoint, filterInput, cachedResponseData);
                authHandled = true;
            }
        }

        if (!authHandled) {
            Helper.logDebug(`[AuthTokenCache] Database cache miss – executing auth endpoint ${authId}`);
            const { result: authResult } = await this.executeEndpoint(authEndpoint);

            const filterInput = authEndpoint.filter_input?.value?.filter_input || [];
            token = this.#extractTokenFromResponse(authResult?.data, filterInput);

            if (this.#endpointTokenCacheService && authResult?.data) {
                await this.#endpointTokenCacheService.cacheResponse(authId, authResult.data, {
                    cacheExpiresInPath: authEndpoint.cache_expires_in_path?.value ?? null,
                    cacheDefaultTtlSeconds: authEndpoint.cache_default_ttl_seconds?.value ?? null,
                });
            }
        }

        if (token || authHandled) {
            this.#authTokenCache.set(authId, { token: token ?? null, expiresAt: memoryExpiresAt });
        }
    }

    async executeEndpoint(endpoint, { processResponse = true } = {}) {
        let response = null;

        if (endpoint.authorization) {
            await this.#handleEndpointAuthorization(endpoint);
        }

        const requestConfig = await this.#prepareRequestConfig(endpoint);
        const requestTimeoutMs =
            this.#requestTimeoutResolver === null ? this.#requestTimeoutMs : this.#requestTimeoutResolver();
        if (!Number.isFinite(requestTimeoutMs) || requestTimeoutMs <= 0) {
            throw new CustomError('REST endpoint request deadline exceeded', 504, {
                reason: 'request_deadline_exceeded',
            });
        }
        requestConfig.timeout = requestTimeoutMs;
        Helper.logDebug('requestConfig', requestConfig);
        try {
            response = await this.#httpClient.request(requestConfig);
        } catch (error) {
            Helper.logError(`Error executing endpoint: ${endpoint.url.value}`, error);
            response = error?.response || {
                status: 500,
                data: {
                    error: error?.message || 'Unknown transport error',
                },
            };
        }

        Helper.logDebug(
            'Response received from endpoint',
            JSON.stringify({
                endpointId: endpoint.id.value,
                status: response?.status,
                data: response?.data,
            })
        );

        Helper.logDebug('WorkflowStepExecutorService: endpoint', endpoint?.id?.value);
        Helper.logDebug('WorkflowStepExecutorService: user', this.#currentUser?.id?.value);

        const metadata = this.#createEndpointMetadata(requestConfig, response);

        if (
            this.#failOnHttpError &&
            (!Number.isInteger(response?.status) || response.status < 200 || response.status >= 300)
        ) {
            const status = Number.isInteger(response?.status) && response.status >= 400 ? response.status : 502;
            throw new CustomError('REST endpoint request failed', status, {
                reason: 'http_error',
                endpoint_id: endpoint.id.value,
                method: requestConfig.method,
                status: response?.status ?? null,
            });
        }

        if (processResponse) {
            const filter_input = endpoint.filter_input?.value?.filter_input || [];
            await this.#processEndpointResponse(response, endpoint, filter_input);
        }

        return {
            result: response,
            metadata,
        };
    }

    /**
     * Create metadata object for endpoint execution
     *
     * @param {Object} requestConfig - Request configuration
     * @param {Object} response - HTTP response or error response
     * @returns {Object} - Metadata object
     * @private
     */
    #createEndpointMetadata(requestConfig, response) {
        return {
            method: requestConfig.method,
            url: requestConfig.url,
            response: response?.data,
            status: response?.status,
        };
    }

    /**
     * Prepare HTTP request configuration
     *
     * @param {WSRestEndpoint} endpoint - Endpoint configuration
     * @returns {Promise<Object>} - Request configuration object
     * @private
     */
    async #prepareRequestConfig(endpoint) {
        let url = endpoint.url.value;
        let headers = endpoint.headers.value || {};
        let body = endpoint.body.value || null;

        [url, headers, body] = await this.#replaceSecrets(url, headers, body);
        [url, headers, body] = await this.#processDynamicContent(endpoint, headers, body, url);

        const method = endpoint.method.value?.toUpperCase();

        const requestConfig = {
            method,
            url,
            headers: headers.headers,
        };

        const requestBody = body?.body;
        const bodyType = endpoint.body_type?.value ?? 'json';

        const hasRealContent =
            requestBody !== undefined &&
            requestBody !== null &&
            ((typeof requestBody === 'object' && Object.keys(requestBody).length > 0) ||
                typeof requestBody !== 'object');

        if (hasRealContent) {
            if (bodyType === 'json' && typeof requestBody === 'string') {
                throw new ValidationFailError(
                    'body_type is "json" but body resolved to a string. Check endpoint configuration.',
                    'body_type'
                );
            } else {
                requestConfig.data = requestBody;
            }
        }

        return requestConfig;
    }

    /**
     * Replace secrets in request components
     *
     * @param {string} url - Request URL
     * @param {Object} headers - Request headers
     * @param {Object|null} body - Request body
     * @returns {Promise<Array>} - Array with processed url, headers, and body
     * @private
     */
    async #replaceSecrets(url, headers, body) {
        const processedUrl = await this.#secretReplacer.replaceSecretsInUrl(url);
        const processedHeaders = await this.#secretReplacer.replaceSecretsInHeader(headers);
        const processedBody = await this.#secretReplacer.replaceSecretsInBody(body);

        return [processedUrl, processedHeaders, processedBody];
    }

    /**
     * Process dynamic content in headers and body
     *
     * @param {WSRestEndpoint} endpoint - Endpoint configuration
     * @param {Object} headers - Request headers
     * @param {Object|null} body - Request body
     * @param {string} url - Request URL
     * @returns {Promise<Array>} - Array with processed url, headers and body
     * @private
     */
    async #processDynamicContent(endpoint, headers, body, url) {
        let processedHeaders = headers;
        let processedBody = body;
        Helper.logDebug(
            'Response received from endpoint',
            JSON.stringify({
                url,
                headers,
                body,
            })
        );

        let processedUrl = await this.#contextProcessor.replace(url);

        if (endpoint.is_dynamic_header?.value && headers) {
            const replacedHeaders = await this.#contextProcessor.replace(headers);
            processedHeaders = { headers: replacedHeaders.headers || headers };
        }

        if (endpoint.is_dynamic_body?.value && body) {
            const replacedBody = await this.#contextProcessor.replace(body);
            processedBody = { body: replacedBody.body !== undefined ? replacedBody.body : body?.body };
        }
        Helper.logDebug(
            'Processed request components',
            JSON.stringify({
                url: processedUrl,
                headers: processedHeaders,
                body: processedBody,
            })
        );

        return [processedUrl, processedHeaders, processedBody];
    }

    /**
     * Process endpoint response including hooks and context updates
     *
     * @param {Object} response - HTTP response
     * @param {WSRestEndpoint} endpoint - Endpoint configuration
     * @param {Array} filter_input - Filter input settings
     * @returns {Promise<void>}
     * @private
     */
    async #processEndpointResponse(response, endpoint, filter_input) {
        const { hookExternalCode: errorHookCode } = this.#getHookByResponseStatus(
            endpoint.on_error?.value,
            response.status
        );

        const { hookExternalCode: successHookCode } = this.#getHookByResponseStatus(
            endpoint.on_success?.value,
            response.status
        );

        if (errorHookCode) {
            await this.#executeErrorHook(errorHookCode, endpoint.id.value, response);
            throw new CustomError(
                `Endpoint ${endpoint.id.value} responded with status ${response.status}, which matched a ` +
                    `configured error condition; the error flow '${errorHookCode}' was triggered. Execution terminated.`,
                400,
                {
                    reason: 'error_condition_triggered',
                    endpoint_id: endpoint.id.value,
                    endpoint_description: endpoint.description?.value ?? null,
                    status: response.status,
                    triggered_flow: errorHookCode,
                }
            );
        }

        if (successHookCode) {
            await this.#executeSuccessHook(successHookCode, endpoint.id.value, response);
        }

        this.#updateContextFromResponse(endpoint, filter_input, response.data);
    }

    /**
     * Update global context with response data
     *
     * @param {WSRestEndpoint} endpoint - Endpoint configuration
     * @param {Array} filter_input - Filter input settings
     * @param {Object} response - HTTP response
     * @returns {void}
     * @private
     */
    #updateContextFromResponse(endpoint, filter_input, response) {
        if (endpoint.context_position?.value && filter_input.length > 0) {
            this.#globalContext.processDataReceived(filter_input, endpoint.context_position.value, response);
            return;
        }
        if (endpoint.context_position?.value) {
            this.#globalContext.addDataProcessedToGlobalContext(endpoint.context_position.value, response);
        }
    }

    /**
     * Gets the hook's external code configured for a specific response code
     *
     * @param {Object} hookConfig - Hook configuration (on_success or on_error)
     * @param {number} statusCode - HTTP status code of the response
     * @returns {Object} Object with the hook's external code
     */
    #getHookByResponseStatus(hookConfig, statusCode) {
        if (!hookConfig) {
            return { hookExternalCode: null };
        }

        const hooksMap = hookConfig.on_success || hookConfig.on_error || hookConfig;

        const strStatusCode = statusCode.toString();

        return {
            hookExternalCode: hooksMap[strStatusCode] || null,
        };
    }

    /**
     * Executes an error hook and waits for it to start before terminating.
     * The main flow's accumulated context is forwarded to the hook flow, plus a
     * `trigger_error` block describing the endpoint failure that triggered it.
     *
     * @param {string} errorHookCode - External code of the error flow
     * @param {string} endpointId - ID of the endpoint that failed
     * @param {Object} [response] - HTTP response that matched the error condition
     */
    async #executeErrorHook(errorHookCode, endpointId, response = null) {
        try {
            Helper.logDebug(`Requesting error hook flow before terminating: ${endpointId}`, {
                externalCode: errorHookCode,
            });

            const hookContext = {
                ...this.#globalContext.get()?.context,
                trigger_error: {
                    endpoint_id: endpointId,
                    status: response?.status ?? null,
                    response_data: response?.data ?? null,
                },
            };

            await this.#triggerHookFlow(errorHookCode, hookContext);

            Helper.logDebug(`Error hook flow requested, terminating: ${endpointId}`, {
                externalCode: errorHookCode,
            });
        } catch (error) {
            Helper.logError(`Error requesting error hook flow: ${endpointId}`, { externalCode: errorHookCode }, error);
        }
    }

    /**
     * Requests asynchronous execution of a success hook flow.
     * The main flow's accumulated context is forwarded to the hook flow, plus a
     * `trigger_success` block identifying the endpoint and status that triggered it.
     *
     * @param {string} successHookCode - External code for the success flow
     * @param {string} [endpointId] - ID of the endpoint whose response matched
     * @param {Object} [response] - HTTP response that matched the success condition
     * @returns {Promise<void>}
     */
    async #executeSuccessHook(successHookCode, endpointId = null, response = null) {
        Helper.logDebug('Requesting success hook flow', { externalCode: successHookCode });

        try {
            const hookContext = {
                ...this.#globalContext.get()?.context,
                trigger_success: {
                    endpoint_id: endpointId,
                    status: response?.status ?? null,
                },
            };

            await this.#triggerHookFlow(successHookCode, hookContext);
            Helper.logDebug('Success hook flow requested', { externalCode: successHookCode });
        } catch (error) {
            Helper.logError('Error requesting success hook flow', error);
        }
    }

    /**
     * Execute a function step
     *
     * @param {WSRestFunction} restFunction - Function to execute
     * @returns {Promise<Object>} - Object with result and metadata
     */
    async #executeFunction(restFunction) {
        const filter_input = restFunction.filter_input?.value?.filter_input || [];
        const staticValue = await this.#prepareStaticValue(restFunction);
        let metadata = null;
        let result;

        if (restFunction.type.value === WSRestFunctionTypeEnum.MAP_PROPERTY.value) {
            const sourcePath = restFunction.value_static?.value;
            const destinationPath = restFunction.context_position?.value ?? null;

            const context = this.#globalContext.get().context;
            const rawValue = NestedValueManager.getValue(context, sourcePath);
            const found = rawValue !== undefined;

            result = restFunction.execute(rawValue);
            metadata = {
                map_property: {
                    from: sourcePath,
                    to: destinationPath,
                    found,
                    value: result,
                },
            };
        } else {
            result = await this.#executeFunctionWithContext(restFunction, filter_input, staticValue);
        }

        this.#updateContextFromFunctionResult(restFunction, result);
        return { result, metadata };
    }

    /**
     * Prepare static value for function execution
     *
     * @param {WSRestFunction} restFunction - Function configuration
     * @returns {Promise<any>} - Processed static value
     * @private
     */
    async #prepareStaticValue(restFunction) {
        const isDynamic = restFunction.value_dynamic?.value;
        let staticValue = restFunction.value_static?.value;

        if (!staticValue || typeof staticValue !== 'string' || !isDynamic) {
            return staticValue;
        }

        if (staticValue.startsWith('SECRET_')) {
            return this.#secretReplacer.replaceSecretsInValue(staticValue);
        }

        const embeddedContextPattern = /^(.+?)(!=|=)(context\..+)$/;
        const embeddedMatch = staticValue.match(embeddedContextPattern);
        if (embeddedMatch) {
            const [, conditionKey, operator, contextRef] = embeddedMatch;
            const cleanPath = contextRef.replace(/^context\./, '');
            const embeddedData = await this.#globalContext.getByFilterInput([cleanPath]);
            if (embeddedData && embeddedData.dataProcessed && Object.keys(embeddedData.dataProcessed).length > 0) {
                const resolvedValue = Object.values(embeddedData.dataProcessed)[0];
                return `${conditionKey}${operator}${resolvedValue}`;
            }
            return staticValue;
        }

        const contextData = await this.#globalContext.getByFilterInput([staticValue]);
        if (
            restFunction.type.value === WSRestFunctionTypeEnum.FIND_NEW_ELEMENTS.value ||
            restFunction.type.value === WSRestFunctionTypeEnum.REVERSE_ARRAY.value
        ) {
            return contextData.dataProcessed;
        }
        if (contextData && contextData.dataProcessed && Object.keys(contextData.dataProcessed).length > 0) {
            return Object.values(contextData.dataProcessed)[0];
        }

        return staticValue;
    }

    /**
     * Execute function with context data
     *
     * @param {WSRestFunction} restFunction - Function configuration
     * @param {Array} filter_input - Filter input settings
     * @param {any} staticValue - Static value for function execution
     * @returns {Promise<Object>} - Function results
     * @private
     */
    async #executeFunctionWithContext(restFunction, filter_input, staticValue) {
        if (filter_input.length === 0 || restFunction.type.value === WSRestFunctionTypeEnum.CURRENT_DATE.value) {
            return restFunction.execute(staticValue);
        }

        const result = {};
        const contextData = await this.#globalContext.getByFilterInput(filter_input);

        if (!contextData?.dataProcessed) {
            return result;
        }

        if (restFunction.type.value === WSRestFunctionTypeEnum.REGEX_OR.value) {
            const [val1Path, val2Path] = filter_input;
            let val1 = null;
            let val2 = null;
            if (val1Path) {
                const data1 = await this.#globalContext.getByFilterInput([val1Path]);
                if (data1?.dataProcessed && Object.keys(data1.dataProcessed).length > 0) {
                    val1 = Object.values(data1.dataProcessed)[0];
                }
            }
            if (val2Path) {
                const data2 = await this.#globalContext.getByFilterInput([val2Path]);
                if (data2?.dataProcessed && Object.keys(data2.dataProcessed).length > 0) {
                    val2 = Object.values(data2.dataProcessed)[0];
                }
            }
            return restFunction.execute(val1, val2, staticValue);
        }

        if (restFunction.type.value === WSRestFunctionTypeEnum.NORMALIZE_CHANNEL_HUB_RULE.value) {
            return restFunction.execute(contextData.dataProcessed);
        }

        if (
            restFunction.type.value === WSRestFunctionTypeEnum.FIND_NEW_ELEMENTS.value ||
            restFunction.type.value === WSRestFunctionTypeEnum.REVERSE_ARRAY.value ||
            restFunction.type.value === WSRestFunctionTypeEnum.FILTER_ARRAY.value ||
            restFunction.type.value === WSRestFunctionTypeEnum.FILTER_ARRAY_ALL.value ||
            restFunction.type.value === WSRestFunctionTypeEnum.SELECT_ARRAY.value
        ) {
            return restFunction.execute(contextData.dataProcessed, staticValue);
        }

        if (restFunction.type.value === WSRestFunctionTypeEnum.FILTER_ARRAY_IN.value) {
            const [lookupPath, targetPath] = filter_input;
            let lookupArray = null;
            let targetArray = null;

            if (lookupPath) {
                const lookupData = await this.#globalContext.getByFilterInput([lookupPath]);
                if (lookupData?.resolved) {
                    lookupArray = lookupData.dataProcessed;
                }
            }
            if (targetPath) {
                const targetData = await this.#globalContext.getByFilterInput([targetPath]);
                if (targetData?.resolved) {
                    targetArray = targetData.dataProcessed;
                }
            }

            return restFunction.execute(lookupArray, targetArray, staticValue);
        }

        for (const [key, dataValue] of Object.entries(contextData.dataProcessed)) {
            result[key] = await this.#executeFunctionForValue(restFunction, dataValue, staticValue);
        }

        return result;
    }

    /**
     * Execute function for a specific value
     *
     * @param {import('../../../ws_rest_functions/domain/WSRestFunction.js').WSRestFunction} restFunction - Function configuration
     * @param {any} dataValue - Value to process
     * @param {any} staticValue - Static value for function execution
     * @returns {Promise<any>} - Function result for the value
     * @private
     */
    async #executeFunctionForValue(restFunction, dataValue, staticValue) {
        if (Array.isArray(dataValue)) {
            return dataValue.map((value) => {
                return staticValue != null ? restFunction.execute(value, staticValue) : restFunction.execute(value);
            });
        }

        return staticValue != null ? restFunction.execute(dataValue, staticValue) : restFunction.execute(dataValue);
    }

    /**
     * Update context with function result
     *
     * @param {WSRestFunction} restFunction - Function configuration
     * @param {Object} result - Function execution result
     * @private
     */
    #updateContextFromFunctionResult(restFunction, result) {
        if (restFunction.context_position?.value) {
            this.#globalContext.addDataProcessedToGlobalContext(restFunction.context_position.value, result);
        }
    }

    /**
     * Execute the REST hook service
     *
     * @param {string} externalCode - External code of the endpoint
     * @returns {Promise<void>}
     */
    /**
     * Triggers a configured hook flow (on_error / on_success) the same way actions do:
     * by requesting an asynchronous flow execution through a domain event, instead of an
     * authenticated HTTP call to the `ws-hook-rest-flows` API.
     *
     * A `WSRestFlowExecution` record is persisted (so the async consumer can track status)
     * and a `WSRestFlowExecutionRequested` event is published to the tenant's SQS queue. The
     * `event_processor` Lambda then runs the flow with the user from the event metadata, so the
     * flow performs its own authentication and no caller token is required.
     *
     * @param {string} externalCodeOrId - Flow external code or flow UUID configured for the hook.
     * @param {Object|null} [initialContext=null] - Optional initial context for the flow.
     * @returns {Promise<void>}
     */
    async #triggerHookFlow(externalCodeOrId, initialContext = null) {
        const isUuid = (v) =>
            typeof v === 'string' &&
            /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(v);

        const tenant = TenantContext.getTenant();
        const flowId = isUuid(externalCodeOrId) ? externalCodeOrId : null;
        const externalCode = isUuid(externalCodeOrId) ? null : externalCodeOrId;
        const userId = this.#currentUser?.id?.value ?? null;

        // SQS messages are capped at 256 KB; keep a margin and fall back to the
        // trigger_* metadata only so the hook flow still fires when the context is too big.
        const MAX_CONTEXT_BYTES = 200 * 1024;
        let hookContext = initialContext || null;
        if (hookContext && JSON.stringify(hookContext).length > MAX_CONTEXT_BYTES) {
            Helper.logError('WorkflowStepExecutorService: hook context exceeds size limit, truncating', {
                externalCodeOrId,
            });
            hookContext = {
                ...(hookContext.trigger_error
                    ? { trigger_error: { ...hookContext.trigger_error, response_data: null } }
                    : {}),
                ...(hookContext.trigger_success ? { trigger_success: hookContext.trigger_success } : {}),
            };
        }

        const execution = new WSRestFlowExecution({
            id: ValueObjectUuid.random(),
            flow_id: flowId,
            external_code: externalCode,
            initial_context: hookContext,
            status: 'pending',
            created_by: userId,
            created_at: new Date(),
        });

        const executionRepository = new KnexWSRestFlowExecutionRepository(this.#finderService.repository.connection);
        await executionRepository.save(execution);

        const domainEvent = new WSRestFlowExecutionRequested({
            executionId: execution.id.value,
            flowId,
            externalCode,
            initialContext: hookContext,
            metadata: {
                tenant_id: tenant?.id?.value,
                user_id: userId,
            },
        });

        await this.#buildEventPublisher(tenant).publish(domainEvent);
    }

    /**
     * Builds an EventPublisher from the tenant configuration, falling back to a no-op
     * in-memory bus when the tenant is missing required AWS event configuration (so a
     * misconfigured tenant does not break the main flow execution).
     *
     * @param {import('../../../tenant/domain/Tenant.js').Tenant} tenant
     * @returns {EventPublisher}
     */
    #buildEventPublisher(tenant) {
        try {
            return new EventPublisher(buildRoutingEventBusFromTenant(tenant));
        } catch (error) {
            Helper.logError('WorkflowStepExecutorService: event publishing disabled (tenant misconfigured)', {
                tenantId: tenant?.id?.value,
                reason: error.message,
            });
            return new EventPublisher(new InMemoryEventBus());
        }
    }
}
