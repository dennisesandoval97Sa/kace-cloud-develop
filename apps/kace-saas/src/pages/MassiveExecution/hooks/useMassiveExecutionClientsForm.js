import { URL_AND_KEYS } from "../../../utils/urlAndKeys";
import { useQueryClient } from "@tanstack/react-query";
import { useSelector } from "react-redux";
import { genericSearchService } from "../../../services/genericSearchService";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { genericHandleSendInformation } from "../../../services/genericHandleSendInformation";
import { useEffect, useState } from "react";
import useGeneralMutation from "../../../hooks/useGeneralMutation";
import { sendInformation } from "../../../services/generic-send-information";

const useMassiveExecutionCasesForm = () => {
    const filterRedux = useSelector((state) => state.filterCases.filter);
    const queryClient = useQueryClient();
    const { t } = useTranslation();

    const {
        mutate,
        isSuccess,
        isError: isErrorMutate,
        isPending: isPendingCases,
    } = useGeneralMutation({
        keyQuery: URL_AND_KEYS.actionJobs.key,
        path: "/massive-execution",
    });

    const [executionData, setExecutionData] = useState({
        type: "filter",
        action_id: "",
        search_filter: [],
        s3_file_key: "",
        separator: ",",
    });

    const handleChangeExecutionData = (key, value) => {
        setExecutionData({ ...executionData, [key]: value });
    };

    const handleFilterCases = async (formData) => {
        try {
            const cases = await handleFile(formData.file, formData.delimiter);
            const isThereData = cases.length;
            const casesURLKeys = {
                ...URL_AND_KEYS.cases,
                key: URL_AND_KEYS.actionJobs
                    .actionJobsFilterCases,
            };

            if (!isThereData) {
                toast.info(t("massiveExecution.message.notFound"), {
                    duration: 10000,
                    closeButton: true,
                });
                return;
            }

            const filter = cases.map((element) => ({
                field: `${casesURLKeys.view}.reference`,
                operator: "eq",
                value: element,
                type: "OR",
            }));

            const response = await queryClient.fetchQuery({
                queryKey: [casesURLKeys.key, [filterRedux]],
                queryFn: async () =>
                    genericSearchService(
                        `${casesURLKeys.url}/search`,
                        filter,
                        {
                            limit: 0,
                            offset: 0,
                        },
                        casesURLKeys.view,
                        false,
                    ),
                refetchOnWindowFocus: false,
            });

            let filterToSend = [];
            if (filterRedux) {
                if (Array.isArray(filterRedux)) {
                    filterToSend = filterRedux.map((filter) => {
                        return {
                            field: filter.column,
                            value: filter.value,
                            type: filter.type,
                            operator: filter.operator,
                        };
                    });
                } else {
                    const newArray = [
                        ...filterToSend,
                        {
                            field: filterRedux.column,
                            value: filterRedux.value,
                            type: filterRedux.type,
                            operator: filterRedux.operator,
                        },
                    ];
                    filterToSend = newArray;
                }
            }

            await queryClient.setQueryData([casesURLKeys.key, filterToSend], {
                data: response.data,
            });

            setExecutionData({
                ...executionData,
                type: "file",
                separator: formData.delimiter,
                s3_file_key: formData.file[0].s3Path,
            });
        } catch {
            // NO-SONAR: Se maneja el error mostrando un mensaje amigable al usuario a través del toast
            toast.info(t("massiveExecution.message.notFound"), {
                duration: 10000,
                closeButton: true,
            });
            handleClearCasesFilter();
        }
    };

    const handleClearCasesFilter = () => {
        queryClient.setQueryData(
            [
                URL_AND_KEYS.actionJobs.actionJobsFilterCases,
                [],
            ],
            {
                data: [],
            },
        );
        setExecutionData({
            type: "filter",
            action_id: "",
            search_filter: [],
            s3_file_key: "",
            separator: ",",
        });
    };

    const handleExecutionActions = async () => {
        if (executionData.type === "filter" && !executionData.action_id) {
            toast.info(t("massiveExecution.message.notAction"), {
                duration: 10000,
                closeButton: true,
            });
            return;
        }

        const data = genericHandleSendInformation({
            values: executionData,
            urlService: URL_AND_KEYS.actionJobs.url,
        });

        mutate(data);
    };

    useEffect(() => {
        if (isSuccess) {
            handleClearCasesFilter();
            sendInformation({
                url: `${URL_AND_KEYS.actionJobs.url}/process-queue`,
            });
        }
    }, [isSuccess]);

    useEffect(() => {
        if (isErrorMutate) {
            toast.info(
                t(
                    `massiveExecution.message.${executionData.type === "filter" ? "notExectued" : "notFound"}`,
                ),
                {
                    duration: 10000,
                    closeButton: true,
                },
            );
            handleClearCasesFilter();
        }
    }, [isErrorMutate]);

    return {
        handleFilterCases,
        handleClearCasesFilter,
        handleChangeExecutionData,
        handleExecutionActions,
        isPendingCases,
    };
};

export default useMassiveExecutionCasesForm;
