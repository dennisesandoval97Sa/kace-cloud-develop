const hasText = (value) => (typeof value === "string" ? value.trim() !== "" : Boolean(value));

export const hasRegisteredChannelHubRule = (workspace) => hasText(workspace?.rules?.ruleId);

/**
 * A usable account (with a connection) is pending until its relation carries a
 * channel_hub_rule_id. The legacy scalar rules.ruleId (ADR-016 era) covers a single
 * account. When the account list is unknown (older row shapes) fall back to the legacy
 * scalar semantics.
 */
export const hasPendingChannelHubAccounts = (workspace) => {
    const accounts = workspace?.channel_hub_accounts;
    if (!Array.isArray(accounts)) {
        return !hasRegisteredChannelHubRule(workspace);
    }

    const usableAccounts = accounts.filter((account) => hasText(account?.channel_hub_connection_id));
    if (usableAccounts.length === 0) return false;
    if (hasRegisteredChannelHubRule(workspace) && usableAccounts.length === 1) return false;

    return usableAccounts.some((account) => !hasText(account?.channel_hub_rule_id));
};
