import { WorkspacePrioritiesConflictError } from "../errors/workspacePrioritiesConflictError";

const reloadAfterPriorityFailure = async ({ error, reloadWorkspacePriorities }) => {
    if (error instanceof WorkspacePrioritiesConflictError) {
        if (error.recovery?.data) return { data: error.recovery.data };
        if (error.recovery?.error) return { error: error.recovery.error };
    }

    return reloadWorkspacePriorities();
};

export const submitChannelHubAccount = async ({
    isReadOnly,
    values,
    setErrors,
    setStatus,
    workspacePriorityUpdate,
    buildPayload,
    saveAccount,
    updateWorkspacePriorities,
    reloadWorkspacePriorities,
    onRecoveryError,
    translate,
    translateError,
    notifySaved,
    navigateToIndex,
}) => {
    if (isReadOnly) return;

    const payload = buildPayload(values, setErrors, setStatus);
    let accountWasSaved = false;

    try {
        await saveAccount(payload);
        accountWasSaved = true;
        if (workspacePriorityUpdate) await updateWorkspacePriorities(workspacePriorityUpdate);
        notifySaved(translate("channelHub.saved"));
        navigateToIndex();
    } catch (error) {
        if (error?.errors) setErrors(error.errors);
        if (accountWasSaved && workspacePriorityUpdate) {
            const reloadResult = await reloadAfterPriorityFailure({ error, reloadWorkspacePriorities });
            const recoveryError = reloadResult?.error ?? null;
            onRecoveryError(recoveryError);
            setStatus(
                translate(
                    recoveryError
                        ? "channelHub.workspacePriorities.partialUpdateReloadError"
                        : "channelHub.workspacePriorities.partialUpdateError",
                ),
            );
            return;
        }

        setStatus(translateError(error, translate));
        throw error;
    }
};

export const isChannelHubEditMode = ({ id, pathname }) => Boolean(id) || pathname.includes("/channel-hub/update");
