import PropTypes from "prop-types";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { findPublicErrorCode, getPublicErrorCodeI18nKey, PUBLIC_ERROR_CODES } from "@kace/error-codes";

const workspacePriorityErrorMessageKey = (error) => {
    const responseData = error?.response?.data;
    const publicErrorCode = findPublicErrorCode(error?.code, responseData?.data?.code, responseData?.code);

    if (publicErrorCode === PUBLIC_ERROR_CODES.CHANNEL_HUB_CONNECTION_UNAVAILABLE) {
        return "channelHub.workspacePriorities.connectionUnavailable";
    }

    return (
        getPublicErrorCodeI18nKey(publicErrorCode, "app.errors.public") ?? "channelHub.workspacePriorities.loadError"
    );
};

const workspacePriorityConflictMessageKeys = {
    ACCOUNT_NOT_REGISTERED: "accountNotRegistered",
    LIST_FLOW_NOT_CONFIGURED: "listFlowNotConfigured",
    UPDATE_FLOW_NOT_CONFIGURED: "updateFlowNotConfigured",
    MISSING_WORKSPACE_DESCRIPTION: "missingWorkspaceDescription",
    REMOTE_RULES_NOT_FOUND: "remoteRulesNotFound",
    NO_LINKED_WORKSPACES: "noLinkedWorkspaces",
    INVALID_PRIORITY_SEQUENCE: "invalidPrioritySequence",
    DUPLICATE_REMOTE_RULE: "duplicateRemoteRule",
    DUPLICATE_RULE_ID: "duplicateRuleId",
    MISSING_RULE_ID: "missingRuleId",
    REMOTE_RULE_NOT_FOUND: "remoteRuleNotFound",
    TAG_MISMATCH: "tagMismatch",
    UNMAPPED_REMOTE_RULE: "unmappedRemoteRule",
};

const workspacePriorityConflictMessageKey = (code) => {
    const messageKey = Object.hasOwn(workspacePriorityConflictMessageKeys, code)
        ? workspacePriorityConflictMessageKeys[code]
        : undefined;
    return `channelHub.workspacePriorities.conflicts.${messageKey ?? "unknown"}`;
};

const StatusMessage = ({ children, tone = "muted", testId }) => {
    let toneClass = "border-border bg-muted/40 text-muted-foreground";
    if (tone === "error") toneClass = "border-red-200 bg-red-50 text-red-700";
    if (tone === "warning") toneClass = "border-orange-200 bg-orange-50 text-orange-700";

    return (
        <div className={`rounded-md border p-4 text-sm ${toneClass}`} data-testid={testId}>
            {children}
        </div>
    );
};

StatusMessage.propTypes = {
    children: PropTypes.node.isRequired,
    tone: PropTypes.oneOf(["muted", "warning", "error"]),
    testId: PropTypes.string,
};

const WorkspacePriorityList = ({
    items = [],
    conflicts = [],
    canReorder = false,
    isLoading = false,
    isApplying = false,
    error,
    isReadOnly = false,
    isConfigured = false,
    isRegistered = false,
    isConfigurationStale = false,
    onOrderChange,
    onRetry,
}) => {
    const { t } = useTranslation();
    const controlsDisabled = isReadOnly || isConfigurationStale || isApplying || !canReorder;

    const move = (index, offset) => {
        const targetIndex = index + offset;
        if (controlsDisabled || targetIndex < 0 || targetIndex >= items.length) return;

        const nextItems = [...items];
        [nextItems[index], nextItems[targetIndex]] = [nextItems[targetIndex], nextItems[index]];
        onOrderChange(nextItems);
    };

    let content;
    if (isLoading) {
        content = (
            <StatusMessage testId="workspace-priorities-loading">
                {t("channelHub.workspacePriorities.loading")}
            </StatusMessage>
        );
    } else if (!isConfigured) {
        content = (
            <StatusMessage tone="warning" testId="workspace-priorities-configuration-required">
                {t("channelHub.workspacePriorities.configurationRequired")}
            </StatusMessage>
        );
    } else if (!isRegistered) {
        content = (
            <StatusMessage tone="warning" testId="workspace-priorities-registration-required">
                {t("channelHub.workspacePriorities.registrationRequired")}
            </StatusMessage>
        );
    } else if (isConfigurationStale) {
        content = (
            <StatusMessage tone="warning" testId="workspace-priorities-configuration-changed">
                {t("channelHub.workspacePriorities.configurationChanged")}
            </StatusMessage>
        );
    } else if (error) {
        content = (
            <StatusMessage tone="error" testId="workspace-priorities-error">
                <div className="flex items-center justify-between gap-4">
                    <span>{t(workspacePriorityErrorMessageKey(error))}</span>
                    {onRetry && (
                        <button
                            type="button"
                            className="rounded-md border border-current px-3 py-1 font-medium"
                            onClick={onRetry}
                        >
                            {t("channelHub.workspacePriorities.retry")}
                        </button>
                    )}
                </div>
            </StatusMessage>
        );
    } else if (conflicts.length > 0) {
        content = (
            <StatusMessage tone="error" testId="workspace-priorities-conflicts">
                <ul className="list-disc space-y-1 pl-5">
                    {conflicts.map((conflict, index) => (
                        <li key={`${conflict.code || "conflict"}-${conflict.workspaceId || index}`}>
                            {t(workspacePriorityConflictMessageKey(conflict.code))}
                        </li>
                    ))}
                </ul>
            </StatusMessage>
        );
    } else if (items.length === 0) {
        content = (
            <StatusMessage testId="workspace-priorities-empty">
                {t("channelHub.workspacePriorities.empty")}
            </StatusMessage>
        );
    } else {
        content = (
            <div className="space-y-3" data-testid="workspace-priority-list">
                {isApplying && (
                    <StatusMessage testId="workspace-priorities-applying">
                        {t("channelHub.workspacePriorities.applying")}
                    </StatusMessage>
                )}
                {!canReorder && !isReadOnly && (
                    <StatusMessage tone="warning" testId="workspace-priorities-unavailable">
                        {t("channelHub.workspacePriorities.unavailable")}
                    </StatusMessage>
                )}
                {items.map((item, index) => (
                    <div
                        key={item.workspaceId}
                        className="flex min-h-16 items-center gap-4 rounded-lg border border-border bg-background p-3"
                        data-testid={`workspace-priority-row-${item.workspaceId}`}
                    >
                        <span
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-lg font-semibold"
                            data-testid="workspace-priority-number"
                        >
                            {index + 1}
                        </span>
                        <span className="min-w-0 flex-1 font-medium" data-testid="workspace-priority-name">
                            {item.description}
                        </span>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-input disabled:cursor-not-allowed disabled:opacity-40"
                                aria-label={t("channelHub.workspacePriorities.moveUp", { name: item.description })}
                                disabled={controlsDisabled || index === 0}
                                onClick={() => move(index, -1)}
                            >
                                <ArrowUp aria-hidden="true" size={18} />
                            </button>
                            <button
                                type="button"
                                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-input disabled:cursor-not-allowed disabled:opacity-40"
                                aria-label={t("channelHub.workspacePriorities.moveDown", { name: item.description })}
                                disabled={controlsDisabled || index === items.length - 1}
                                onClick={() => move(index, 1)}
                            >
                                <ArrowDown aria-hidden="true" size={18} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <section className="rounded-md bg-background p-4 shadow-md" data-testid="workspace-priorities-section">
            <div className="mb-4">
                <h3 className="text-xl font-semibold">{t("channelHub.workspacePriorities.title")}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{t("channelHub.workspacePriorities.subtitle")}</p>
            </div>
            {content}
        </section>
    );
};

WorkspacePriorityList.propTypes = {
    items: PropTypes.arrayOf(
        PropTypes.exact({
            workspaceId: PropTypes.string.isRequired,
            description: PropTypes.string.isRequired,
            tag: PropTypes.string,
            priority: PropTypes.number,
        }),
    ),
    conflicts: PropTypes.arrayOf(
        PropTypes.exact({
            code: PropTypes.string,
            message: PropTypes.string,
            workspaceId: PropTypes.string,
        }),
    ),
    canReorder: PropTypes.bool,
    isLoading: PropTypes.bool,
    isApplying: PropTypes.bool,
    error: PropTypes.any,
    isReadOnly: PropTypes.bool,
    isConfigured: PropTypes.bool,
    isRegistered: PropTypes.bool,
    isConfigurationStale: PropTypes.bool,
    onOrderChange: PropTypes.func.isRequired,
    onRetry: PropTypes.func,
};

export default WorkspacePriorityList;
