import { Uuid } from "@kace/plugins";
import { removeKey } from "@kace/utils";
import useGenericSearchQuery from "@kace/hooks/useGenericSearchQuery";
import { sendInformation } from "../../../../../../../services/generic-send-information";
import { URL_AND_KEYS } from "../../../../../../../utils/urlAndKeys";
import useAdminCaseCacheData from "../../../hooks/useAdminCaseCacheData";
import { useCallback, useMemo } from "react";

const useAdminCaseAttachments = () => {
    const { caseCacheData } = useAdminCaseCacheData();

    const caseId = useMemo(() => caseCacheData?.id, [caseCacheData?.id]);

    const transformData = useCallback((data) => {
        return Object.keys(data).reduce((acc, key) => {
            acc[key] = data[key] === "" ? null : data[key];
            return acc;
        }, {});
    }, []);

    const formatDataBeforePost = useCallback(
        (data, id) => {
            data = transformData(data);
            data = removeKey(data, ["adjuntos", "campo"]);
            return id
                ? removeKey(data, [
                    "id",
                    "created_at",
                    "updated_at",
                    "created_by",
                    "deleted_by",
                    "deleted_at",
                    "adjuntos",
                    "attachments",
                ])
                : { ...data, id: Uuid() };
        },
        [transformData, removeKey],
    );

    const saveAttachmentsCase = useCallback(
        async (caseId, files) => {
            const url = `${URL_AND_KEYS.cases.urlAttachments}`;
            const dataPosts = files.map((file) => {
                return formatDataBeforePost(
                    {
                        case_id: caseId,
                        path: file.fileData.name,
                        type: 1,
                        description: file.fileData.type,
                        size: 1,
                        is_active: "true",
                    },
                    null,
                );
            });

            const results = await Promise.all(
                dataPosts.map(async (dataPost) => {
                    const data = { id: null, url, dataPost };
                    const result = await sendInformation(data);
                    if (result.status === 200 || result.status === 201) {
                        return dataPost;
                    }
                }),
            );

            return results;
        },
        [sendInformation],
    );

    const { data: dataAttachments, isLoading: isLoadingAttachments } =
        useGenericSearchQuery({
            url: `${URL_AND_KEYS.cases.urlAttachments}/search`,
            keyQuery: URL_AND_KEYS.cases.caseAttachmentsForm,
            select: (data) => data.data,
            filter: [
                {
                    field: "case_id",
                    operator: "eq",
                    value: caseId,
                    type: "AND",
                },
            ],
            enabled: !!caseId,
            staleTime: 0,
            gcTime: 0,
        });

    return { saveAttachmentsCase, dataAttachments, isLoadingAttachments };
};

export default useAdminCaseAttachments;
