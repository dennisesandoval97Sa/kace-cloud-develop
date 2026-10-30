import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import AssignViewForm from "./components/AssignViewForm";
import { genericView } from "../../services/genericView";
import { CLASSIFICATIONS_SERVICE, formatClassifications } from "@kace/utils";
import { GeneralLoader } from "@kace/ui-shared";

import { toast } from "sonner";
import { sendInformation } from "../../services/generic-send-information";
import { formatDataBeforePostAssingForm } from "./helpers";
import { DashboardSectionCard } from "../../components/core/Cards/DashboardSectionCard";
import { useTranslation } from "react-i18next";
import { findPublicErrorCode, PUBLIC_ERROR_CODES } from "@kace/error-codes";
import { getTranslatedError } from "@/utils/getTranslatedError";

const ClassificationsAssingFormHandler = () => {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const [classificationTitle, setClassificationTitle] = useState("");
    const navigate = useNavigate();
    const { id } = useParams();
    const { data, isLoading } = useQuery({
        queryKey: ["classificationsForm", id],
        queryFn: async () => genericView(`${CLASSIFICATIONS_SERVICE}/${id}`),
        enabled: !!id,
    });

    const {
        mutate,
        isLoading: isSending,
        isPending,
    } = useMutation({
        mutationFn: sendInformation,
        onMutate: async (data) => {
            await queryClient.cancelQueries(["classificationAssignData"]);
            const previousClassifications = queryClient.getQueryData(["classificationAssignData"]);
            if (previousClassifications) {
                queryClient.setQueryData(["classificationAssignData"], (old) => ({
                    ...old,
                    data: [...old.data, data.dataPost],
                }));
            }

            return { previousClassifications };
        },
        onError: (err, id, context) => {
            if (context?.previousClassifications !== undefined) {
                queryClient.setQueryData(["classificationAssignData"], context.previousClassifications);
            }
            const responseData = err?.response?.data;
            const publicErrorCode = findPublicErrorCode(responseData?.data?.code, responseData?.code);
            const legacyErrorMessage = typeof responseData?.errors === "string" ? responseData.errors : "";

            if (
                publicErrorCode === PUBLIC_ERROR_CODES.CLASSIFICATION_GROUP_RELATION_NOT_FOUND ||
                legacyErrorMessage.includes("Relation with classificationId")
            ) {
                toast.error(t("app.alerts.relationclassificationGroup"));
            } else {
                toast.error(getTranslatedError(err, t));
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries(["classificationAssignData"]);
            toast.success(t("app.title.relationshipClassification"));
            navigate("/clasificaciones");
        },
        onSettled: () => {
            queryClient.invalidateQueries(["classificationAssignData"]);
        },
    });
    const handleClassification = async (values, groups) => {
        const url = `classifications-groups-relationships-batch`;
        const dataPost = formatDataBeforePostAssingForm(values, groups, id);
        const data = { id: null, url, dataPost };
        mutate(data);
    };

    useEffect(() => {
        if (data) {
            setClassificationTitle(formatClassifications(data, "nivel"));
        }
    }, [data]);

    return (
        <DashboardSectionCard title={"app.title.classifications"} data-testid="dashboardCardClassificationUpdate">
            {isLoading ? (
                <GeneralLoader />
            ) : (
                <AssignViewForm
                    dataHandler={handleClassification}
                    isSending={isSending || isPending}
                    titulo={classificationTitle}
                    idClassification={id}
                />
            )}
        </DashboardSectionCard>
    );
};

export default ClassificationsAssingFormHandler;
