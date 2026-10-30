import { ValueObjectUuid } from '@kace/core/src/shared/index.js';
import { WSRestFlowExecution, WSRestFlowExecutionRequested } from '@kace/core/src/ws-rest-flow-executions/index.js';
import { WorkspaceResponse } from '@kace/core/src/workspaces/application/WorkspaceResponse.js';

const RULE_ARRAY_FIELDS = [
    'subjectContains',
    'subjectEquals',
    'toContains',
    'toEquals',
    'bodyContains',
    'bodyEquals',
    'ccContains',
    'ccEquals',
    'fromContains',
    'fromEquals',
];

const TAG_FLOW_EXECUTION_CONFIG = {
    update: {
        flowIdField: 'tag_update_flow_id',
        source: 'workspaces.update',
    },
    delete: {
        flowIdField: 'tag_deletion_flow_id',
        source: 'workspaces.delete',
    },
};

const resolveTagFlowExecutionConfig = (operation) => {
    const config = TAG_FLOW_EXECUTION_CONFIG[operation];
    if (!config) {
        throw new Error(`Unsupported workspace tag flow operation: ${operation}`);
    }
    return config;
};

export const workspaceToJson = (workspace) => {
    if (!workspace) return null;
    if (workspace.rules?.value !== undefined) {
        return new WorkspaceResponse(workspace).toJson().data;
    }
    if (typeof workspace.toJson === 'function') {
        const json = workspace.toJson();
        return json.data ?? json;
    }
    return workspace;
};

const firstChannelHubConnectionId = (workspace) =>
    workspace?.channel_hub_accounts?.find((account) => account?.channel_hub_connection_id)?.channel_hub_connection_id ??
    workspace?.channel_hub_connection_id ??
    null;

const hasContent = (value) => {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim() !== '';
    if (Array.isArray(value)) return value.length > 0;
    return true;
};

const normalizeBaseUrl = (url) => (typeof url === 'string' ? url.replace(/\/+$/, '') : url);

export function buildChannelHubTagContext(workspace, { connectionId, ruleId } = {}) {
    const rules = workspace?.rules ?? {};
    const ruleArrays = RULE_ARRAY_FIELDS.reduce((accumulator, field) => {
        if (Array.isArray(rules[field]) && rules[field].length > 0) {
            accumulator[field] = rules[field];
        }
        return accumulator;
    }, {});

    const context = {
        connectionId: connectionId ?? firstChannelHubConnectionId(workspace),
        ruleId: ruleId ?? rules.ruleId,
        ruleName: hasContent(rules.ruleName) ? rules.ruleName : (workspace?.tag ?? workspace?.description ?? ''),
        ...ruleArrays,
        actionRules: hasContent(rules.actionRules)
            ? rules.actionRules
            : {
                  classifyAs: workspace?.tag ?? '',
              },
    };

    if (Array.isArray(rules.webhooks) && rules.webhooks.length > 0) {
        context.webhooks = rules.webhooks;
    }

    return Object.fromEntries(Object.entries(context).filter(([, value]) => hasContent(value)));
}

/**
 * One target per registered account relation: its connection and its own rule id.
 * A single account without a relation rule id falls back to the legacy scalar
 * rules.ruleId (workspaces registered under ADR-016, before the per-account backfill).
 */
export function channelHubRuleTargets(workspace) {
    const rules = workspace?.rules ?? {};
    const accounts = (Array.isArray(workspace?.channel_hub_accounts) ? workspace.channel_hub_accounts : []).filter(
        (account) => hasContent(account?.channel_hub_connection_id)
    );

    const targets = [];
    for (const account of accounts) {
        const ruleId = hasContent(account.channel_hub_rule_id)
            ? account.channel_hub_rule_id
            : accounts.length === 1 && hasContent(rules.ruleId)
              ? rules.ruleId
              : null;
        if (hasContent(ruleId)) {
            targets.push({
                channel_hub_account_id: account.id ?? null,
                connectionId: account.channel_hub_connection_id,
                ruleId,
            });
        }
    }

    if (targets.length === 0 && hasContent(workspace?.channel_hub_connection_id) && hasContent(rules.ruleId)) {
        targets.push({
            channel_hub_account_id: null,
            connectionId: workspace.channel_hub_connection_id,
            ruleId: rules.ruleId,
        });
    }

    return targets;
}

/**
 * Targets whose account was removed from the workspace: present (and registered) in the
 * previous workspace but absent from the next account set. These are the rules to delete
 * in Channel Hub after an update. Compute BEFORE persisting: the repository replaces
 * relation rows wholesale, so the previous set is unreadable afterwards.
 */
export function removedChannelHubRuleTargets(previousWorkspace, nextChannelHubAccounts) {
    const nextAccountIds = new Set(
        (Array.isArray(nextChannelHubAccounts) ? nextChannelHubAccounts : [])
            .map((account) => (typeof account === 'string' ? account : account?.id))
            .filter(Boolean)
    );

    return channelHubRuleTargets(previousWorkspace).filter(
        (target) => !nextAccountIds.has(target.channel_hub_account_id)
    );
}

/**
 * The legacy scalar rules.ruleId (ADR-016 era) belongs to one account. When an update
 * removes that account, the scalar must go with it: leaving it stale makes the workspace
 * look registered (blocking re-registration) and feeds dead rule ids to the tag flows.
 */
export function rulesWithoutRemovedLegacyRuleId(rules, removedTargets) {
    if (rules == null || typeof rules !== 'object' || Array.isArray(rules)) return rules;
    if (!hasContent(rules.ruleId)) return rules;
    if (!removedTargets.some((target) => target.ruleId === rules.ruleId)) return rules;

    const { ruleId: _removedRuleId, ...remainingRules } = rules;
    return remainingRules;
}

export class WorkspaceTagUpdateFlowQueuer {
    #workspaceRepository;
    #executionRepository;
    #eventPublisher;
    #currentUser;
    #metadata;
    #kaceApiBaseUrl;
    #idFactory;
    #now;

    constructor({
        workspaceRepository,
        executionRepository,
        eventPublisher,
        currentUser,
        metadata = {},
        kaceApiBaseUrl = null,
        idFactory = () => ValueObjectUuid.random(),
        now = () => new Date(),
    }) {
        this.#workspaceRepository = workspaceRepository;
        this.#executionRepository = executionRepository;
        this.#eventPublisher = eventPublisher;
        this.#currentUser = currentUser;
        this.#metadata = metadata;
        this.#kaceApiBaseUrl = normalizeBaseUrl(kaceApiBaseUrl);
        this.#idFactory = idFactory;
        this.#now = now;
    }

    async execute(workspaceId, operation = 'update', { targets: explicitTargets } = {}) {
        const workspace = workspaceToJson(await this.#workspaceRepository.find({ value: workspaceId }));
        const { flowIdField, source } = resolveTagFlowExecutionConfig(operation);
        const flowId = workspace?.[flowIdField];

        const targets = explicitTargets ?? channelHubRuleTargets(workspace);
        if (!hasContent(flowId) || targets.length === 0) {
            return false;
        }

        for (const target of targets) {
            await this.#queueExecution({ workspace, flowId, source, target });
        }

        return true;
    }

    async #queueExecution({ workspace, flowId, source, target }) {
        const executionId = this.#idFactory();
        const initialContext = {
            source,
            tenant_id: this.#metadata.tenant_id,
            kace_api_base_url: this.#kaceApiBaseUrl,
            workspace,
            channel_hub_tag: buildChannelHubTagContext(workspace, target),
        };

        const execution = new WSRestFlowExecution({
            id: executionId,
            flow_id: flowId,
            external_code: null,
            initial_context: initialContext,
            status: 'pending',
            created_by: this.#currentUser.id.value,
            created_at: this.#now(),
        });

        await this.#executionRepository.save(execution);
        await this.#eventPublisher.publish(
            new WSRestFlowExecutionRequested({
                executionId,
                flowId,
                externalCode: null,
                initialContext,
                metadata: this.#metadata,
            })
        );
    }
}
