import { Uuid } from "@kace/plugins";
import { setApplicationSelected } from "@/redux/state/applicationSelectedSlice";
import { setIsCreatedClient } from "@/redux/state/client";
import { setLoadingCaseInformation } from "../../../../../redux/state/loadingCaseInformation";
import { clearStates, setCaseId, setInputSearchFilter, setReference } from "../../../../../redux/state/states";
import { TYPE_APPLICATION } from "@/utils/main";

export const openCaseAction = ({ dispatch, navigate, id, reference }) => {
    dispatch(setLoadingCaseInformation(true));
    dispatch(setReference(reference));
    dispatch(setCaseId(id));
    dispatch(setInputSearchFilter());
    dispatch(setApplicationSelected(TYPE_APPLICATION.AGENT));
    navigate(`/agent/update/${id}`);
};

const buildCreateCaseUrl = ({ clientId, canCreateSubcases, interactionId }) => {
    const searchParams = new URLSearchParams({ action: "create" });

    if (canCreateSubcases || interactionId) {
        searchParams.set("parent_id", "null");
    }

    if (interactionId) {
        searchParams.set("interaction_id", interactionId);
    }

    return `/agent/create/${clientId}?${searchParams.toString()}`;
};

export const createCaseAction = ({ dispatch, navigate, clientId, canCreateSubcases = false, interactionId = null }) => {
    if (!clientId) return;

    dispatch(setLoadingCaseInformation(false));
    dispatch(clearStates());
    dispatch(setCaseId(Uuid()));
    dispatch(setIsCreatedClient(true));
    dispatch(setInputSearchFilter());
    dispatch(setApplicationSelected(TYPE_APPLICATION.AGENT));
    navigate(buildCreateCaseUrl({ clientId, canCreateSubcases, interactionId }));
};
