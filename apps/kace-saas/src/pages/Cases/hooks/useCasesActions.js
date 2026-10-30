import { useCallback, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { setIdSelected, setOpenModal } from "../../../redux/state/modalBehavior";
import { setReference } from "../../../redux/state/states";
import { useTranslation } from "react-i18next";
import usePermissionsUser from "@kace/hooks/usePermissionsUser";
import useConfigAgentData from "@kace/hooks/useConfigAgentData";
import useCasesBulkPermissions from "@kace_v2/shared/hooks/useCasesBulkPermissions.hook";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { genericView } from "@/services/genericView";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";

const useCasesActions = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const configAgent = useConfigAgentData();
    const [type, setType] = useState("");
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const queryClient = useQueryClient();

    const hasClosedCases = (cases) => cases.some((c) => c?.fecha_resolucion !== null);

    const handleReassignCase = useCallback(
        (id) => {
            dispatch(setIdSelected(id));
            dispatch(setOpenModal(true));
            setType("reassign");
            setTitle(t("actions.title.reassignCase"));
            setDescription(t("generalSetup.form.labels.reassignCaseAgent"));
        },
        [dispatch, t],
    );

    const handleCloseCase = useCallback(
        (id) => {
            dispatch(setIdSelected(id));
            dispatch(setOpenModal(true));
            setType("close");
            setTitle(t("actions.title.closeCase"));
            setDescription(t("actions.labels.closeCase"));
        },
        [dispatch, t],
    );

    const handleReopenCase = useCallback(
        (id) => {
            dispatch(setIdSelected(id));
            dispatch(setOpenModal(true));
            setType("reopen");
            setTitle(t("actions.title.reopenCase"));
            setDescription(t("generalSetup.form.labels.reOpenCase"));
        },
        [dispatch, t],
    );

    const handleCloneCase = useCallback(
        (id) => {
            dispatch(setIdSelected(id));
            dispatch(setOpenModal(true));
            setType("clone");
            setTitle(t("actions.title.cloneCase"));
            setDescription(t("actions.labels.cloneCase"));
        },
        [dispatch, t],
    );

    const handleSeeCase = useCallback(
        (id, reference) => {
            dispatch(setReference(reference));
            navigate(`/cases/update/${id}`);
        },
        [dispatch, navigate],
    );

    const handleCalendarCase = useCallback((id) => navigate(`/cases/calendar/${id}`), [navigate]);

    const handleBulkCombinedAction = (cases) => {
        if (!cases?.length) return;

        if (hasClosedCases(cases)) {
            toast.error(t("errors.cases.closedBulkAction"));
            return;
        }

        /*
         * Calienta las transiciones del caso de referencia antes de abrir: la key/fn
         * replican las de SelectByUrl en ChangeStateCaseFields ([keyQuery] anidada,
         * staleTime 1h) para que la primera apertura no pinte la sección "fría".
         */
        const referenceCaseId = cases[0]?.id;
        if (referenceCaseId) {
            queryClient.prefetchQuery({
                queryKey: [[URL_AND_KEYS.cases.urlCaseAvailableStates, referenceCaseId]],
                queryFn: () => genericView(`${URL_AND_KEYS.cases.urlCaseAvailableStates}/${referenceCaseId}`),
                staleTime: 1000 * 60 * 60,
            });
        }

        queryClient.setQueryData(["selectedCaseData"], null);
        queryClient.setQueryData(["selectedCases"], cases);
        dispatch(setOpenModal(true));
        setType("combined_bulk");
        setTitle(t("combinedBulkActions.title"));
        setDescription(t("combinedBulkActions.description"));
    };

    /*
     * Se memoiza para que `usePermissionsUser` (cuyo useMemo interno depende de esta
     * referencia) no recalcule en cada render de este hook — antes era un literal
     * nuevo por render y anulaba el memo interno.
     */
    const permissionActions = useMemo(
        () => [
            {
                name: "CasesRead",
                label: "Ver caso",
                handler: handleSeeCase,
                customizable: true,
            },
            {
                name: "CaseClose",
                label: "Cerrar caso",
                handler: handleCloseCase,
                customizable: true,
            },
            {
                name: "CaseReclassify",
                label: "Re-asignar caso",
                handler: handleReassignCase,
                customizable: true,
            },
            {
                name: "CaseClone",
                label: "Clonar caso",
                handler: handleCloneCase,
                customizable: true,
            },
            {
                name: "CaseReOpen",
                label: "Re-abrir caso",
                handler: handleReopenCase,
                customizable: true,
            },
        ],
        [handleSeeCase, handleCloseCase, handleReassignCase, handleCloneCase, handleReopenCase],
    );

    const { arrayAction } = usePermissionsUser({
        moduleId: "cases",
        actions: permissionActions,
        nameCreate: "",
    });

    const arrayActions = useMemo(
        () =>
            configAgent?.cases?.show_sheduler
                ? [
                      {
                          name: "Calendario",
                          action: handleCalendarCase,
                          customizable: false,
                      },
                      ...arrayAction,
                  ]
                : arrayAction,
        [configAgent?.cases?.show_sheduler, arrayAction],
    );

    const { canBulkAssign, canBulkTransition, canBulkClose } = useCasesBulkPermissions();

    return {
        arrayActions,
        type,
        title,
        description,
        handleBulkCombinedAction,
        canReassign: canBulkAssign,
        canChangeState: canBulkTransition,
        canClose: canBulkClose,
    };
};

export default useCasesActions;
