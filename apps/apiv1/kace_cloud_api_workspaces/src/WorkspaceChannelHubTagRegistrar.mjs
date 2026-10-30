import { WorkspaceResponse } from '@kace/core/src/workspaces/application/WorkspaceResponse.js';
import { buildChannelHubTagContext } from './WorkspaceTagUpdateFlowQueuer.mjs';

export class WorkspaceChannelHubTagRegistrarError extends Error {
    constructor(message, statusCode = 400, details = undefined) {
        super(message);
        this.name = 'WorkspaceChannelHubTagRegistrarError';
        this.statusCode = statusCode;
        this.details = details;
    }
}

const trimString = (value) => (typeof value === 'string' ? value.trim() : '');

const hasContent = (value) => {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim() !== '';
    if (Array.isArray(value)) return value.length > 0;
    return true;
};

const isPlainObject = (value) => {
    if (value == null || typeof value !== 'object' || Array.isArray(value)) return false;

    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
};

const normalizeBaseUrl = (url) => (typeof url === 'string' ? url.replace(/\/+$/, '') : url);

const workspaceToJson = (workspace) => {
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

const parseRules = (rules) => {
    if (rules == null) return {};

    let parsedRules = rules;
    if (typeof rules === 'string') {
        try {
            parsedRules = JSON.parse(rules);
        } catch {
            throw new WorkspaceChannelHubTagRegistrarError(
                'Workspace rules must be an object to register Channel Hub rule id',
                409
            );
        }
    }

    if (parsedRules == null) return {};
    if (!isPlainObject(parsedRules)) {
        throw new WorkspaceChannelHubTagRegistrarError(
            'Workspace rules must be an object to register Channel Hub rule id',
            409
        );
    }

    return { ...parsedRules };
};

const usableChannelHubAccounts = (workspace) =>
    (Array.isArray(workspace?.channel_hub_accounts) ? workspace.channel_hub_accounts : []).filter((account) =>
        hasContent(account?.channel_hub_connection_id)
    );

const workflowResponseToJson = (response) => {
    if (typeof response?.toJson === 'function') {
        const json = response.toJson();
        return json?.data ?? json;
    }
    return response?.data ?? response;
};

const channelHubResponseFromExecution = (response) =>
    workflowResponseToJson(response)?.context?.channel_hub_tag?.response ?? null;

export class WorkspaceChannelHubTagRegistrar {
    #workspaceRepository;
    #workflowExecutor;
    #metadata;
    #currentUser;
    #kaceApiBaseUrl;
    #now;
    #logger;

    constructor({
        workspaceRepository,
        workflowExecutor,
        metadata = {},
        currentUser,
        kaceApiBaseUrl = null,
        now = () => new Date(),
        logger = console,
    }) {
        this.#workspaceRepository = workspaceRepository;
        this.#workflowExecutor = workflowExecutor;
        this.#metadata = metadata;
        this.#currentUser = currentUser;
        this.#kaceApiBaseUrl = normalizeBaseUrl(kaceApiBaseUrl);
        this.#now = now;
        this.#logger = logger;
    }

    async execute(workspaceId) {
        const workspace = workspaceToJson(await this.#workspaceRepository.find({ value: workspaceId }));
        if (!workspace) {
            throw new WorkspaceChannelHubTagRegistrarError('Workspace not found', 404);
        }

        const rules = parseRules(workspace.rules);

        if (!hasContent(workspace.tag_creation_flow_id)) {
            throw new WorkspaceChannelHubTagRegistrarError('Workspace has no tag creation flow assigned', 409);
        }

        const accounts = usableChannelHubAccounts(workspace);
        if (accounts.length === 0) {
            throw new WorkspaceChannelHubTagRegistrarError(
                'Workspace has no usable Channel Hub account connection',
                409
            );
        }

        const pendingAccounts = this.#pendingAccounts(accounts, rules);
        if (pendingAccounts.length === 0) {
            throw new WorkspaceChannelHubTagRegistrarError('Workspace already has a Channel Hub rule registered', 409);
        }

        const registered = [];
        const failed = [];
        for (const account of pendingAccounts) {
            const outcome = await this.#registerAccount({ workspace, rules, account });
            if (outcome.rule_id) {
                registered.push(outcome);
            } else {
                failed.push(outcome);
            }
        }

        if (registered.length === 0) {
            throw new WorkspaceChannelHubTagRegistrarError(
                'Channel Hub tag registration failed for all pending accounts',
                502,
                { workspace_id: workspace.id, failed }
            );
        }

        return {
            workspace_id: workspace.id,
            registered,
            failed,
        };
    }

    /**
     * An account is pending when its relation has no rule id yet. A legacy workspace
     * registered under ADR-016 carries a scalar rules.ruleId and a single account whose
     * relation has not been backfilled yet: treat that account as already registered.
     */
    #pendingAccounts(accounts, rules) {
        const pending = accounts.filter((account) => !hasContent(account.channel_hub_rule_id));
        if (hasContent(rules.ruleId) && accounts.length === 1) {
            return [];
        }
        return pending;
    }

    async #registerAccount({ workspace, rules, account }) {
        const accountConnectionId = trimString(account.channel_hub_connection_id);
        const failure = (message, { cleanup_attempted = false, cleanup_succeeded = false } = {}) => ({
            channel_hub_account_id: account.id,
            connection_id: accountConnectionId,
            message,
            cleanup_attempted,
            cleanup_succeeded,
        });

        let createResponse;
        try {
            createResponse = await this.#workflowExecutor.execute({
                flow_id: workspace.tag_creation_flow_id,
                initial_context: this.#buildInitialContext({
                    source: 'workspaces.register_tags',
                    workspace: { ...workspace, rules },
                    connectionId: accountConnectionId,
                }),
            });
        } catch (error) {
            this.#logger?.error?.('Create-tag RESTflow execution failed', {
                workspace_id: workspace.id,
                flow_id: workspace.tag_creation_flow_id,
                channel_hub_account_id: account.id,
                connection_id: accountConnectionId,
                error,
            });
            return failure('Create-tag RESTflow execution failed');
        }

        const channelHubResponse = channelHubResponseFromExecution(createResponse);
        const ruleId = trimString(channelHubResponse?.id);
        if (!ruleId) {
            this.#logger?.error?.('Create-tag RESTflow response did not include a Channel Hub rule id', {
                workspace_id: workspace.id,
                channel_hub_account_id: account.id,
                connection_id: accountConnectionId,
            });
            return failure('Create-tag RESTflow response did not include a Channel Hub rule id');
        }

        const connectionId = trimString(channelHubResponse?.connectionId) || accountConnectionId;

        try {
            const updatedRows = await this.#workspaceRepository
                .table(this.#workspaceRepository.channelHubRelationsTable)
                .where({ workspace_id: workspace.id, channel_hub_account_id: account.id })
                .whereNull('channel_hub_rule_id')
                .update({ channel_hub_rule_id: ruleId });

            if (updatedRows === 0) {
                throw new Error('Channel Hub rule id update affected 0 relation rows');
            }
        } catch (error) {
            const cleanupSucceeded = await this.#attemptCompensation({ workspace, rules, ruleId, connectionId });
            this.#logger?.error?.('Could not persist Channel Hub rule id after create-tag RESTflow succeeded', {
                workspace_id: workspace.id,
                channel_hub_account_id: account.id,
                connection_id: connectionId,
                rule_id: ruleId,
                cleanup_attempted: true,
                cleanup_succeeded: cleanupSucceeded,
                error,
            });
            return failure('Could not persist Channel Hub rule id', {
                cleanup_attempted: true,
                cleanup_succeeded: cleanupSucceeded,
            });
        }

        return {
            channel_hub_account_id: account.id,
            connection_id: connectionId,
            rule_id: ruleId,
        };
    }

    #buildInitialContext({ source, workspace, connectionId }) {
        const channelHubTag = { ...buildChannelHubTagContext(workspace), connectionId };
        // The create flow must not receive a legacy scalar ruleId: it creates a new rule.
        delete channelHubTag.ruleId;

        return {
            source,
            tenant_id: this.#metadata.tenant_id,
            kace_api_base_url: this.#kaceApiBaseUrl,
            workspace,
            channel_hub_tag: channelHubTag,
        };
    }

    async #attemptCompensation({ workspace, rules, ruleId, connectionId }) {
        const cleanupWorkspace = {
            ...workspace,
            rules: { ...rules, ruleId },
        };
        const cleanupContext = {
            source: 'workspaces.register_tags.rollback',
            tenant_id: this.#metadata.tenant_id,
            kace_api_base_url: this.#kaceApiBaseUrl,
            workspace: cleanupWorkspace,
            channel_hub_tag: {
                ...buildChannelHubTagContext(cleanupWorkspace),
                connectionId,
                ruleId,
            },
        };

        try {
            if (!hasContent(workspace.tag_deletion_flow_id)) {
                throw new Error('Workspace has no tag deletion flow assigned');
            }

            await this.#workflowExecutor.execute({
                flow_id: workspace.tag_deletion_flow_id,
                initial_context: cleanupContext,
            });
            return true;
        } catch (error) {
            this.#logger?.error?.('Failed to clean up Channel Hub rule after workspace persistence failure', {
                workspace_id: workspace.id,
                connection_id: connectionId,
                rule_id: ruleId,
                error,
            });
            return false;
        }
    }
}
