import useGenericSearchQuery from "@kace/hooks/useGenericSearchQuery";
import { useParams } from "react-router-dom";
import { COMMENTS_SERVICE } from "../../../../../../../utils/URL";
import { AdminCaseCommentsProcessData } from "../utils/AdminCaseCommentsProcessData";
import useGeneralMutation from "../../../../../../../hooks/useGeneralMutation";
import { genericHandleSendInformation } from "../../../../../../../services/genericHandleSendInformation";

const useAdminCaseComments = () => {
    const { caseId } = useParams();

    const { data: comments, isLoading } = useGenericSearchQuery({
        url: `${COMMENTS_SERVICE}/search`,
        keyQuery: ["searchComments", caseId],
        enabled: !!caseId,
        useDefault: false,
        filter: [
            {
                field: "caso_id",
                operator: "eq",
                value: caseId,
                type: "AND",
            },
        ],
        pagination: {
            limit: 0,
            offset: 0,
        },
        select: AdminCaseCommentsProcessData,
        staleTime: 0,
        gcTime: 0,
    });

    const { mutate, isPending } = useGeneralMutation({
        keyQuery: ["searchComments", caseId],
        setOpen: false,
    });

    const dataHandler = (values) => {
        const newValues = {
            ...values,
            caso_id: caseId,
        };
        const data = genericHandleSendInformation({
            values: newValues,
            urlService: COMMENTS_SERVICE,
            pending: isPending,
        });
        mutate(data);
    };

    return {
        comments,
        loading: isLoading,
        dataHandler,
        sending: isPending,
    };
};

export default useAdminCaseComments;
