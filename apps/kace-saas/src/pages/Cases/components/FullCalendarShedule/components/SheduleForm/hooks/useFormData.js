import { useQuery } from "@tanstack/react-query";
import { genericSearch } from "../../../../../../../services/genericSearch";
import { RELATIONSHIPS_SERVICE } from "../../../../../../../utils/main";

export const useFormData = (user, idCase, classificationId) => {
    return useQuery({
        queryKey: ["dataForm", idCase, user.selectedGroup, classificationId],
        queryFn: async () =>
            genericSearch(
                `${RELATIONSHIPS_SERVICE}/search`,
                [
                    {
                        field: "classification_id",
                        operator: "eq",
                        value: classificationId,
                        type: "AND",
                    },
                    {
                        field: "group_id",
                        operator: "eq",
                        value: user.selectedGroup,
                        type: "AND",
                    },
                ],
                {
                    limit: 1,
                    offset: 0,
                },
                null,
                false,
            ),
        enabled: !!user.selectedGroup && !!classificationId,
    });
};
