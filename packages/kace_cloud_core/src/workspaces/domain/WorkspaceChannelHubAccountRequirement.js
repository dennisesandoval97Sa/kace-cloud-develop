import { ValidationFailError } from '../../shared/index.js';
import { WORKSPACE_CHANNEL_HUB_ACCOUNT_REQUIRED } from '@kace/error-codes';

export const WORKSPACE_CHANNEL_HUB_ACCOUNTS_FIELD = 'channel_hub_accounts';
export const WORKSPACE_CHANNEL_HUB_ACCOUNT_REQUIRED_MESSAGE = 'Workspace must have at least one Channel Hub Account.';

const relationId = (relation) => (typeof relation === 'string' ? relation : relation?.id);

export const workspaceChannelHubAccountIds = (channelHubAccounts) =>
    Array.isArray(channelHubAccounts)
        ? [...new Set(channelHubAccounts.map((relation) => relationId(relation)).filter(Boolean))]
        : [];

export const workspaceChannelHubAccountRequirementError = () =>
    new ValidationFailError(
        WORKSPACE_CHANNEL_HUB_ACCOUNT_REQUIRED_MESSAGE,
        WORKSPACE_CHANNEL_HUB_ACCOUNTS_FIELD,
        [],
        WORKSPACE_CHANNEL_HUB_ACCOUNT_REQUIRED
    );

export async function assertWorkspaceHasNonDeletedChannelHubAccount(repository, channelHubAccounts) {
    const accountIds = workspaceChannelHubAccountIds(channelHubAccounts);
    if (accountIds.length === 0) {
        throw workspaceChannelHubAccountRequirementError();
    }

    const accountCount = await repository.countNonDeletedChannelHubAccounts(accountIds);
    if (accountCount < 1) {
        throw workspaceChannelHubAccountRequirementError();
    }
}
