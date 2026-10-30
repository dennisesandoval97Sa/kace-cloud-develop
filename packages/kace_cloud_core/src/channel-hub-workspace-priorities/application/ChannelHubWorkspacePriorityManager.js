import { createHash } from 'node:crypto';
import { ValueObjectUuid } from '../../shared/domain/value-object/ValueObjectUuid.js';
import { CustomError } from '../../shared/errors/CustomError.js';
import {
    CHANNEL_HUB_MAIL_RULE_LIST_FLOW_INVALID,
    CHANNEL_HUB_MAIL_RULE_PRIORITY_UPDATE_FLOW_INVALID,
} from '@kace/error-codes';

const revisionFor = (rules) =>
    createHash('sha256')
        .update(rules.map((rule) => `${rule.id}:${rule.priority}`).join('|'))
        .digest('base64url');

const unprioritizedItems = (mappings) =>
    mappings.map((mapping) => ({
        workspaceId: mapping.workspaceId,
        description: mapping.description?.trim() ?? '',
        tag: mapping.tag,
        priority: null,
    }));

const workspaceLabel = (mapping) => mapping.description || mapping.workspaceId;

const assertExactWorkspaceSet = (currentItems, orderedWorkspaceIds) => {
    const expectedWorkspaceIds = currentItems.map((item) => item.workspaceId).sort();
    const requestedWorkspaceIds = Array.isArray(orderedWorkspaceIds) ? [...orderedWorkspaceIds].sort() : [];
    if (
        expectedWorkspaceIds.length !== requestedWorkspaceIds.length ||
        expectedWorkspaceIds.some((workspaceId, index) => workspaceId !== requestedWorkspaceIds[index])
    ) {
        throw new CustomError('orderedWorkspaceIds must contain every workspace exactly once', 409);
    }
};

export class ChannelHubWorkspacePriorityManager {
    #accountRepository;
    #workspaceRepository;
    #mailRules;
    #restFlowValidator;

    constructor({ accountRepository, workspaceRepository, mailRules, restFlowValidator }) {
        this.#accountRepository = accountRepository;
        this.#workspaceRepository = workspaceRepository;
        this.#mailRules = mailRules;
        this.#restFlowValidator = restFlowValidator;
    }

    async #validateRestFlow(restFlowId, field, publicErrorCode, conflicts) {
        try {
            await this.#restFlowValidator.execute(restFlowId, field);
            return true;
        } catch (error) {
            if (error?.publicErrorCode !== publicErrorCode) throw error;

            conflicts.push({
                code: publicErrorCode,
                message: error.message,
            });
            return false;
        }
    }

    async #loadSnapshot(accountId) {
        const account = await this.#accountRepository.find(new ValueObjectUuid('id', accountId));
        if (!account) {
            throw new CustomError('Channel Hub account not found', 404);
        }

        const mappings = (await this.#workspaceRepository.findChannelHubPriorityMappingsByAccountId(accountId)).map(
            (mapping) => ({
                ...mapping,
                description: mapping.description?.trim() ?? '',
            })
        );
        const configurationConflicts = [];

        for (const mapping of mappings) {
            if (!mapping.description) {
                configurationConflicts.push({
                    code: 'MISSING_WORKSPACE_DESCRIPTION',
                    message: `Workspace "${mapping.workspaceId}" needs a description to be shown in the priority list.`,
                    workspaceId: mapping.workspaceId,
                });
            }
        }

        const connectionId = account.channel_hub_connection_id.value;
        if (!connectionId) {
            configurationConflicts.push({
                code: 'ACCOUNT_NOT_REGISTERED',
                message: 'The Channel Hub account is not registered.',
            });
        }
        const listRestFlowId = account.mail_rule_list_rest_flow_id.value;
        const updateRestFlowId = account.mail_rule_priority_update_rest_flow_id.value;
        if (!listRestFlowId) {
            configurationConflicts.push({
                code: 'LIST_FLOW_NOT_CONFIGURED',
                message: 'A mail-rule listing RestFlow must be selected.',
            });
        }
        if (!updateRestFlowId) {
            configurationConflicts.push({
                code: 'UPDATE_FLOW_NOT_CONFIGURED',
                message: 'A mail-rule priority update RestFlow must be selected.',
            });
        }

        const isListRestFlowValid = listRestFlowId
            ? await this.#validateRestFlow(
                  listRestFlowId,
                  'mail_rule_list_rest_flow_id',
                  CHANNEL_HUB_MAIL_RULE_LIST_FLOW_INVALID,
                  configurationConflicts
              )
            : false;
        if (updateRestFlowId) {
            await this.#validateRestFlow(
                updateRestFlowId,
                'mail_rule_priority_update_rest_flow_id',
                CHANNEL_HUB_MAIL_RULE_PRIORITY_UPDATE_FLOW_INVALID,
                configurationConflicts
            );
        }

        if (!connectionId || !isListRestFlowValid) {
            return {
                account,
                ruleIdByWorkspaceId: new Map(mappings.map((mapping) => [mapping.workspaceId, mapping.ruleId])),
                result: {
                    items: unprioritizedItems(mappings),
                    revision: revisionFor([]),
                    canReorder: false,
                    conflicts: configurationConflicts,
                },
            };
        }

        let rules;
        try {
            rules = await this.#mailRules.listRules(account);
        } catch (error) {
            if (error?.upstreamStatus !== 404) throw error;

            return {
                account,
                ruleIdByWorkspaceId: new Map(mappings.map((mapping) => [mapping.workspaceId, mapping.ruleId])),
                result: {
                    items: unprioritizedItems(mappings),
                    revision: revisionFor([]),
                    canReorder: false,
                    conflicts: [
                        ...configurationConflicts,
                        {
                            code: 'REMOTE_RULES_NOT_FOUND',
                            message: 'Channel Hub has no mail rules for this account.',
                        },
                    ],
                },
            };
        }
        const orderedRules = [...rules].sort((left, right) => left.priority - right.priority);
        const ruleById = new Map(orderedRules.map((rule) => [rule.id, rule]));
        const remoteRuleCounts = new Map();
        for (const rule of orderedRules) {
            remoteRuleCounts.set(rule.id, (remoteRuleCounts.get(rule.id) ?? 0) + 1);
        }
        const localRuleIds = new Set(mappings.map((mapping) => mapping.ruleId).filter(Boolean));
        const localRuleCounts = new Map();
        for (const mapping of mappings) {
            if (mapping.ruleId) {
                localRuleCounts.set(mapping.ruleId, (localRuleCounts.get(mapping.ruleId) ?? 0) + 1);
            }
        }
        const conflicts = [...configurationConflicts];
        const items = [];

        if (mappings.length === 0) {
            conflicts.push({
                code: 'NO_LINKED_WORKSPACES',
                message: 'The Channel Hub account has no linked workspaces to prioritize.',
            });
        }

        if (orderedRules.some((rule, index) => !Number.isInteger(rule.priority) || rule.priority !== index + 1)) {
            conflicts.push({
                code: 'INVALID_PRIORITY_SEQUENCE',
                message: 'Channel Hub returned a non-contiguous or duplicate priority sequence.',
            });
        }

        for (const [ruleId, count] of remoteRuleCounts) {
            if (count > 1) {
                conflicts.push({
                    code: 'DUPLICATE_REMOTE_RULE',
                    message: `Channel Hub returned rule "${ruleId}" more than once.`,
                });
            }
        }

        for (const [ruleId, count] of localRuleCounts) {
            if (count > 1) {
                conflicts.push({
                    code: 'DUPLICATE_RULE_ID',
                    message: `Channel Hub rule "${ruleId}" is linked to multiple KACE workspaces.`,
                });
            }
        }

        for (const mapping of mappings) {
            const rule = mapping.ruleId ? ruleById.get(mapping.ruleId) : null;
            items.push({
                workspaceId: mapping.workspaceId,
                description: mapping.description,
                tag: mapping.tag,
                priority: rule?.priority ?? null,
            });

            if (!mapping.ruleId) {
                conflicts.push({
                    code: 'MISSING_RULE_ID',
                    message: `Workspace "${workspaceLabel(mapping)}" is not registered as a Channel Hub mail rule.`,
                    workspaceId: mapping.workspaceId,
                });
                continue;
            }

            if (!rule) {
                conflicts.push({
                    code: 'REMOTE_RULE_NOT_FOUND',
                    message: `Channel Hub rule "${mapping.ruleId}" for workspace "${workspaceLabel(mapping)}" was not found.`,
                    workspaceId: mapping.workspaceId,
                });
                continue;
            }

            if (rule.actionRules?.classifyAs !== mapping.tag) {
                conflicts.push({
                    code: 'TAG_MISMATCH',
                    message:
                        `Workspace "${workspaceLabel(mapping)}" uses tag "${mapping.tag}", but Channel Hub rule ` +
                        `"${rule.id}" classifies as "${rule.actionRules?.classifyAs}".`,
                    workspaceId: mapping.workspaceId,
                });
            }
        }

        for (const rule of orderedRules) {
            if (!localRuleIds.has(rule.id)) {
                conflicts.push({
                    code: 'UNMAPPED_REMOTE_RULE',
                    message: `Channel Hub rule "${rule.id}" is not linked to a KACE workspace.`,
                });
            }
        }

        items.sort(
            (left, right) =>
                (left.priority ?? Number.POSITIVE_INFINITY) - (right.priority ?? Number.POSITIVE_INFINITY) ||
                left.description.localeCompare(right.description) ||
                left.workspaceId.localeCompare(right.workspaceId)
        );

        return {
            account,
            ruleIdByWorkspaceId: new Map(mappings.map((mapping) => [mapping.workspaceId, mapping.ruleId])),
            result: {
                items,
                revision: revisionFor(orderedRules),
                canReorder: conflicts.length === 0,
                conflicts,
            },
        };
    }

    async get(accountId) {
        return (await this.#loadSnapshot(accountId)).result;
    }

    #validateReorderSnapshot(snapshot, { revision, orderedWorkspaceIds }, { checkRevision = true } = {}) {
        const current = snapshot.result;
        if (!current.canReorder) {
            throw new CustomError('Workspace priorities cannot be changed while configuration conflicts exist', 409);
        }
        if (checkRevision && revision !== current.revision) {
            throw new CustomError('Workspace priority order has changed; reload it before updating', 409);
        }

        assertExactWorkspaceSet(current.items, orderedWorkspaceIds);
    }

    async validateReorderRequestWithSnapshot(
        accountId,
        { revision, orderedWorkspaceIds },
        { checkRevision = true } = {}
    ) {
        const snapshot = await this.#loadSnapshot(accountId);
        this.#validateReorderSnapshot(snapshot, { revision, orderedWorkspaceIds }, { checkRevision });
        return snapshot;
    }

    async validateReorderRequest(accountId, command, options = {}) {
        const snapshot = await this.validateReorderRequestWithSnapshot(accountId, command, options);
        const current = snapshot.result;
        return current;
    }

    async reconcileNext(accountId, orderedWorkspaceIds, { snapshot = null } = {}) {
        const currentSnapshot = snapshot ?? (await this.#loadSnapshot(accountId));
        const current = currentSnapshot.result;
        if (!current.canReorder) {
            throw new CustomError('Workspace priorities cannot be changed while configuration conflicts exist', 409);
        }
        assertExactWorkspaceSet(current.items, orderedWorkspaceIds);
        const currentOrder = current.items.map((item) => item.workspaceId);
        const moveIndex = orderedWorkspaceIds.findIndex((workspaceId, index) => currentOrder[index] !== workspaceId);

        if (moveIndex === -1) {
            return { completed: true, moved: null, result: current, snapshot: currentSnapshot };
        }

        const workspaceId = orderedWorkspaceIds[moveIndex];
        await this.#mailRules.updatePriority(
            currentSnapshot.account,
            currentSnapshot.ruleIdByWorkspaceId.get(workspaceId),
            moveIndex + 1
        );

        const verifiedSnapshot = await this.#loadSnapshot(accountId);
        const verified = verifiedSnapshot.result;
        const completed =
            verified.canReorder &&
            verified.items.map((item) => item.workspaceId).join('|') === orderedWorkspaceIds.join('|');
        if (!completed && verified.revision === current.revision) {
            throw new CustomError('Channel Hub did not apply the requested workspace priority move', 502, verified);
        }
        return {
            completed,
            moved: { workspaceId, priority: moveIndex + 1 },
            result: verified,
            snapshot: verifiedSnapshot,
        };
    }
}
