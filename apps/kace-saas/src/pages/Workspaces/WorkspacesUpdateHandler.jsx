import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { initialValues } from "./data";
import { genericView } from "@/services/genericView";
import { ROUTES } from "@/config/routesDictionary";
import WorkspaceForm from "./components/WorkspaceForm";
import { GeneralLoader } from "@kace/ui-shared";
import { formatDataBeforePost } from "@/services/genericHandleSendInformation";
import useGeneralMutation from "@/hooks/useGeneralMutation";
import NotFound from "@/pages/NotFound/NotFound";
import { isSystemInboxWorkspaceId } from "@/utils/systemInboxWorkspace";

const TAG_REST_FLOW_FIELDS = ["tag_creation_flow_id", "tag_update_flow_id", "tag_deletion_flow_id"];

const WorkspacesUpdateHandler = () => {
    const [workspace, setWorkspace] = useState(initialValues);
    const { id } = useParams();
    const isSystemInboxWorkspace = isSystemInboxWorkspaceId(id);
    const { data: dataWorkspaceSelected, isLoading } = useQuery({
        queryKey: ["workspacesData", id],
        queryFn: () => genericView(`${ROUTES.WORKSPACE.path}/${id}`),
        enabled: !!id && !isSystemInboxWorkspace,
    });

    useEffect(() => {
        if (dataWorkspaceSelected) {
            setWorkspace(dataWorkspaceSelected.data);
        }
    }, [dataWorkspaceSelected]);

    const { mutate, isPending: isSending } = useGeneralMutation({
        keyQuery: "workspacesData",
        path: ROUTES.WORKSPACE.path,
    });

    const handleWorkspaceUpdate = async (values) => {
        const { id } = values;
        const suffix = values.is_active === false ? "/deactivate" : "";
        const url = id ? `${ROUTES.WORKSPACE.path}/${id}${suffix}` : `${ROUTES.WORKSPACE.path}`;
        const dataPost = formatDataBeforePost(values, id, []);
        if (Array.isArray(values.channel_hub_accounts)) {
            dataPost.channel_hub_accounts = values.channel_hub_accounts;
        }
        if (Array.isArray(values.groups)) {
            dataPost.groups = values.groups;
        }
        TAG_REST_FLOW_FIELDS.forEach((field) => {
            if (Object.prototype.hasOwnProperty.call(values, field)) {
                dataPost[field] = values[field] || null;
            }
        });
        const data = { id, url, dataPost };
        mutate(data);
    };

    return (
        <>
            {isSystemInboxWorkspace ? (
                <NotFound />
            ) : isLoading ? (
                <GeneralLoader />
            ) : (
                <WorkspaceForm data={workspace} dataHandler={handleWorkspaceUpdate} isSending={isSending} />
            )}
        </>
    );
};

export default WorkspacesUpdateHandler;
