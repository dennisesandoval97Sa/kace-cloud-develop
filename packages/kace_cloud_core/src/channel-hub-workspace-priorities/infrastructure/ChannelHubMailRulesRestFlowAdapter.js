import { CHANNEL_HUB_CONNECTION_UNAVAILABLE } from '@kace/error-codes';

const isConnectionUnavailableProblem = (response) =>
    response?.status === 400 &&
    response?.type === 'urn:problem:bad-request' &&
    response?.detail === 'connection entity not exists or the user is not authorized';

const executionContext = (response) => response.toJson()?.data?.context ?? null;

const isNonEmptyString = (value) => {
    try {
        const parsed = String.prototype.valueOf.call(value);
        return parsed === value && parsed.trim() !== '';
    } catch {
        return false;
    }
};
const isRecord = (value) => value != null && Object.getPrototypeOf(value) === Object.prototype;

const satisfiesMailRuleContract = (rule) =>
    isRecord(rule) &&
    isNonEmptyString(rule.id) &&
    isNonEmptyString(rule.connectionId) &&
    isRecord(rule.actionRules) &&
    Number.isInteger(rule.priority) &&
    rule.priority >= 1;

export class ChannelHubMailRulesRestFlowError extends Error {
    constructor(message, { upstreamStatus = null, publicErrorCode = null, cause = undefined } = {}) {
        super(message, { cause });
        this.name = 'ChannelHubMailRulesRestFlowError';
        this.statusCode = 502;
        this.upstreamStatus = upstreamStatus;
        this.publicErrorCode = publicErrorCode;
    }
}

const parseMailRule = (rule, invalidMessage) => {
    if (!satisfiesMailRuleContract(rule)) {
        throw new ChannelHubMailRulesRestFlowError(invalidMessage, {
            upstreamStatus: Number.isInteger(rule?.status) ? rule.status : null,
        });
    }
    return rule;
};

export class ChannelHubMailRulesRestFlowAdapter {
    #workflowExecutorProvider;

    constructor(workflowExecutor) {
        this.#workflowExecutorProvider = workflowExecutor.execute ? () => workflowExecutor : workflowExecutor;
    }

    async #execute(dto, failureMessage) {
        try {
            const workflowExecutor = this.#workflowExecutorProvider();
            return await workflowExecutor.execute(dto);
        } catch (error) {
            if (error instanceof ChannelHubMailRulesRestFlowError) throw error;
            throw new ChannelHubMailRulesRestFlowError(failureMessage, {
                upstreamStatus: Number.isInteger(error?.statusCode) ? error.statusCode : null,
                cause: error,
            });
        }
    }

    async listRules(account) {
        const response = await this.#execute(
            {
                flow_id: account.mail_rule_list_rest_flow_id.value,
                initial_context: {
                    channel_hub_mail_rules: {
                        connectionId: account.channel_hub_connection_id.value,
                    },
                },
            },
            'Unable to list Channel Hub mail rules'
        );
        const listResponse = executionContext(response)?.channel_hub_mail_rules?.list_response;

        if (isConnectionUnavailableProblem(listResponse)) {
            throw new ChannelHubMailRulesRestFlowError('Channel Hub connection could not be found or accessed', {
                upstreamStatus: listResponse.status,
                publicErrorCode: CHANNEL_HUB_CONNECTION_UNAVAILABLE,
            });
        }

        if (!Array.isArray(listResponse)) {
            throw new ChannelHubMailRulesRestFlowError('Channel Hub did not return a valid mail-rule list', {
                upstreamStatus: Number.isInteger(listResponse?.status) ? listResponse.status : null,
            });
        }

        const rules = listResponse.map((rule, index) =>
            parseMailRule(rule, `Channel Hub returned an invalid mail rule at index ${index}`)
        );

        const connectionId = account.channel_hub_connection_id.value;
        const mismatchedConnectionIndex = rules.findIndex((rule) => rule.connectionId !== connectionId);
        if (mismatchedConnectionIndex !== -1) {
            throw new ChannelHubMailRulesRestFlowError(
                `Channel Hub returned a mail rule for a different connection at index ${mismatchedConnectionIndex}`
            );
        }

        return rules;
    }

    async updatePriority(account, ruleId, priority) {
        const response = await this.#execute(
            {
                flow_id: account.mail_rule_priority_update_rest_flow_id.value,
                initial_context: {
                    channel_hub_mail_rules: {
                        connectionId: account.channel_hub_connection_id.value,
                        ruleId,
                        priority,
                    },
                },
            },
            `Unable to update Channel Hub mail rule "${ruleId}" priority`
        );
        const updateResponse = executionContext(response)?.channel_hub_mail_rules?.update_response;

        const updatedRule = parseMailRule(updateResponse, 'Channel Hub did not return a valid updated mail rule');
        if (updatedRule.connectionId !== account.channel_hub_connection_id.value) {
            throw new ChannelHubMailRulesRestFlowError(
                'Channel Hub returned an updated mail rule for a different connection'
            );
        }
        if (updatedRule.id !== ruleId || updatedRule.priority !== priority) {
            throw new ChannelHubMailRulesRestFlowError(
                'Channel Hub returned a different rule or priority after the update'
            );
        }

        return updatedRule;
    }
}
