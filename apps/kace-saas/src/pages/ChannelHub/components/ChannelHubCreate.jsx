import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import useIsSeeMode from "@/hooks/useIsSeeMode";
import useGenericViewQuery from "@/hooks/useGenericViewQuery";
import useGeneralMutation from "@/hooks/useGeneralMutation";
import { genericHandleSendInformation } from "@/services/genericHandleSendInformation";
import ChannelHubCreateForm from "./ChannelHubCreateForm";
import { DashboardSectionCard } from "@/components/core/Cards/DashboardSectionCard";
import { ROUTES } from "@/config/routesDictionary";
import { getTranslatedError } from "@/utils/getTranslatedError";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";
import useWorkspacePriorities from "../hooks/useWorkspacePriorities";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { parseChannelHubAccount } from "../data/channelHubAccount";
import { isChannelHubEditMode, submitChannelHubAccount } from "../services/channelHubSubmission";
import PropTypes from "prop-types";

const ChannelHubCreateContent = ({ isEditMode, isReadOnly, data, isFetching, workspacePriorities }) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [workspacePriorityRecoveryError, setWorkspacePriorityRecoveryError] = useState(null);

    const retryWorkspacePriorities = async () => {
        const result = await workspacePriorities.refetch().catch((error) => ({ error }));
        setWorkspacePriorityRecoveryError(result?.error ?? null);
        return result;
    };

    const { mutate, isPending } = useGeneralMutation({
        keyQuery: URL_AND_KEYS.channel_hub.key,
        onSuccessToast: false,
    });
    const isSending = isPending || isFetching || workspacePriorities.isUpdating;

    const dataHandler = async (values, setErrors, setStatus, { workspacePriorityUpdate = null } = {}) => {
        await submitChannelHubAccount({
            isReadOnly,
            values,
            setErrors,
            setStatus,
            workspacePriorityUpdate,
            buildPayload: (formValues, formErrors, formStatus) =>
                genericHandleSendInformation({
                    values: formValues,
                    urlService: URL_AND_KEYS.channel_hub.url,
                    fields: isEditMode ? ["email"] : [],
                    setFormikErrors: formErrors,
                    setFormikStatus: formStatus,
                    pending: isPending,
                }),
            saveAccount: mutate,
            updateWorkspacePriorities: workspacePriorities.updateWorkspacePriorities,
            reloadWorkspacePriorities: retryWorkspacePriorities,
            onRecoveryError: setWorkspacePriorityRecoveryError,
            translate: t,
            translateError: getTranslatedError,
            notifySaved: toast.success,
            navigateToIndex: () => navigate(ROUTES.CHANNEL_HUB.path),
        });
    };

    return (
        <DashboardSectionCard>
            <ChannelHubCreateForm
                dataHandler={dataHandler}
                data={data}
                isSending={isSending}
                isEditMode={isEditMode}
                isReadOnly={isReadOnly}
                workspacePriorities={workspacePriorities.data}
                isLoadingWorkspacePriorities={workspacePriorities.isLoading || workspacePriorities.isFetching}
                isUpdatingWorkspacePriorities={workspacePriorities.isUpdating}
                workspacePrioritiesError={workspacePriorityRecoveryError ?? workspacePriorities.error}
                onRetryWorkspacePriorities={retryWorkspacePriorities}
            />
        </DashboardSectionCard>
    );
};

const accountPropertyType = PropTypes.exact({
    id: PropTypes.string,
    email: PropTypes.string,
    name: PropTypes.string,
    country_id: PropTypes.string,
    operator_id: PropTypes.string,
    rest_flow_id: PropTypes.string,
    mail_rule_list_rest_flow_id: PropTypes.string,
    mail_rule_priority_update_rest_flow_id: PropTypes.string,
    channel_hub_connection_id: PropTypes.string,
});

const workspacePrioritiesPropertyType = PropTypes.exact({
    data: PropTypes.object,
    error: PropTypes.any,
    isLoading: PropTypes.bool.isRequired,
    isFetching: PropTypes.bool.isRequired,
    isUpdating: PropTypes.bool.isRequired,
    refetch: PropTypes.func.isRequired,
    updateWorkspacePriorities: PropTypes.func.isRequired,
});

const channelHubCreateContentPropertyTypes = {
    isEditMode: PropTypes.bool.isRequired,
    isReadOnly: PropTypes.bool.isRequired,
    data: accountPropertyType.isRequired,
    isFetching: PropTypes.bool.isRequired,
};

ChannelHubCreateContent.propTypes = {
    ...channelHubCreateContentPropertyTypes,
    workspacePriorities: workspacePrioritiesPropertyType.isRequired,
};

const ChannelHubCreate = ({ useWorkspacePrioritiesHook = useWorkspacePriorities }) => {
    const { pathname } = useLocation();
    const params = useParams();
    const isReadOnly = useIsSeeMode();
    const id = params?.id;
    const isEditMode = isChannelHubEditMode({ id, pathname });
    const { data: fetchedData, isLoading: isFetching } = useGenericViewQuery({
        keyQuery: `channel-hub-${id}`,
        url: id ? `${URL_AND_KEYS.channel_hub.url}/${id}` : "",
        enabled: !!id,
    });
    const data = useMemo(() => parseChannelHubAccount(fetchedData), [fetchedData]);
    const contentProps = { isEditMode, isReadOnly, data, isFetching };
    const canLoadWorkspacePriorities = Boolean(
        isEditMode &&
        data.channel_hub_connection_id &&
        data.mail_rule_list_rest_flow_id &&
        data.mail_rule_priority_update_rest_flow_id,
    );
    const workspacePriorities = useWorkspacePrioritiesHook({
        accountId: id,
        enabled: canLoadWorkspacePriorities,
    });

    return <ChannelHubCreateContent {...contentProps} workspacePriorities={workspacePriorities} />;
};

ChannelHubCreate.propTypes = {
    useWorkspacePrioritiesHook: PropTypes.func,
};

export default ChannelHubCreate;
