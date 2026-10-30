import { Uuid } from "@kace/plugins";
import { useCallback, useMemo } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import useUserInformation from "../../../../../../../hooks/useUserInformation";
import { setApplicationSelected } from "../../../../../../../redux/state/applicationSelectedSlice";
import { setIsCreatedClient } from "../../../../../../../redux/state/client";
import { setLoadingCaseInformation } from "../../../../../../../redux/state/loadingCaseInformation";
import { clearStates, setCaseId, setInputSearchFilter } from "../../../../../../../redux/state/states";
import { TYPE_APPLICATION } from "../../../../../../../utils/main";
import useConfigAgentData from "@/hooks/useConfigAgentData";
import { useFormikContext } from "formik";

const useButtonSection = ({ clientId, isNewClient, configClients, resetUser = () => {} }) => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { permissionsAgent } = useUserInformation();
    const { cases: configCases } = useConfigAgentData();
    const { resetForm } = useFormikContext();

    const canCreateCase = useMemo(
        () => permissionsAgent.find((item) => item.name === "CasesCreate")?.granted,
        [permissionsAgent],
    );

    const canCreate = useMemo(
        () => permissionsAgent.find((item) => item.name === "ClientsCreate")?.granted,
        [permissionsAgent],
    );

    const canUpdate = useMemo(
        () => permissionsAgent.find((item) => item.name === "ClientsUpdate")?.granted,
        [permissionsAgent],
    );

    const handleNewCase = useCallback(() => {
        dispatch(setLoadingCaseInformation(false));
        dispatch(clearStates());
        dispatch(setCaseId(Uuid()));
        dispatch(setIsCreatedClient(true));
        dispatch(setInputSearchFilter());
        dispatch(setApplicationSelected(TYPE_APPLICATION.AGENT));
        navigate(
            configCases?.case_enable_subcases
                ? `/agent/create/${clientId}?action=create&parent_id=null`
                : `/agent/create/${clientId}?action=create`,
        );
    }, [dispatch, navigate, clientId]);

    const showCreateButton = useMemo(
        () => canCreate && !configClients?.custom_form_id && isNewClient,
        [canCreate, configClients?.custom_form_id, isNewClient],
    );

    const showNewCaseButton = useMemo(
        () => clientId?.length > 0 && !isNewClient && canCreateCase,
        [clientId, isNewClient, canCreateCase],
    );

    const showUpdateButton = useMemo(
        () => canUpdate && configClients?.custom_form_id === "" && !isNewClient,
        [canUpdate, configClients?.custom_form_id, isNewClient],
    );

    const handleReset = () => {
        resetForm();
        resetUser();
        dispatch(setInputSearchFilter());
        if (location.pathname.includes("/agent/")) {
            navigate("/agent");
        }
    };

    return {
        handleNewCase,
        showCreateButton,
        showNewCaseButton,
        showUpdateButton,
        handleReset,
    };
};

export default useButtonSection;
