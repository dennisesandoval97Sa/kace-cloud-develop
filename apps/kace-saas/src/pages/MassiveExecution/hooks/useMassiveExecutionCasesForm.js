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
import { ONLY_CSV_ERROR, readCsvFile } from "../utils/massiveExecutionFileUtils";

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
        restflow_id: "",
        search_filter: [],
        s3_file_key: "",
        separator: ",",
    });

    const parseCSV = (text, delimiter) => {
        const lines = text
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean);

        const containsDelimiter = lines.some((line) => line.includes(delimiter));
        if (!containsDelimiter) {
            return { data: [], skippedCount: lines.length };
        }

        let skippedCount = 0;
        const data = [];

        lines.forEach((line, index) => {
            const columns = line.split(delimiter);
            if (columns.length <= 1) {
                skippedCount++;
                return;
            }
            const rawValue = columns[0].trim();
            const value = parseInt(rawValue, 10);
            if (!Number.isFinite(value)) {
                // Si la primera fila es encabezado no numérico, no se cuenta como omitida
                if (index === 0 && lines.length > 1) {
                    return;
                }
                skippedCount++;
                return;
            }
            data.push(value);
        });

        return { data, skippedCount };
    };

    const handleChangeExecutionData = (key, value) => {
        setExecutionData({ ...executionData, [key]: value });
    };

    const handleFilterCases = async (formData) => {
        if (!formData?.file || !formData.file.length) {
            toast.info(t("massiveExecution.message.fileRequired"), {
                duration: 10000,
                closeButton: true,
            });
            return;
        }

        try {
            const fileContent = await readCsvFile(formData.file);
            const { data: cases, skippedCount } = parseCSV(fileContent, formData.delimiter);
            const isThereData = cases.length;
            const casesURLKeys = {
                ...URL_AND_KEYS.cases,
                key: URL_AND_KEYS.actionJobs.actionJobsFilterCases,
            };

            if (!isThereData) {
                toast.info(t("massiveExecution.message.notFound"), {
                    duration: 10000,
                    closeButton: true,
                });
                handleClearCasesFilter();
                return;
            }

            if (skippedCount > 0) {
                toast.warning(t("massiveExecution.message.skippedRowsWarning", { count: skippedCount }), {
                    duration: 8000,
                    closeButton: true,
                });
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
                staleTime: 0,
                gcTime: 0,
                refetchOnWindowFocus: false,
            });

            if (!response?.data?.length) {
                toast.info(t("massiveExecution.message.notFound"), {
                    duration: 10000,
                    closeButton: true,
                });
                handleClearCasesFilter();
                return;
            }

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

            await queryClient.setQueryData([casesURLKeys.key, [], null], {
                data: response.data,
            });
            await queryClient.setQueryData([casesURLKeys.key, filterToSend], {
                data: response.data,
            });

            setExecutionData({
                ...executionData,
                type: "file",
                separator: formData.delimiter,
                s3_file_key: formData.file[0].s3Path,
            });

            toast.success(t("massiveExecution.message.fileLoadedSuccess"), {
                duration: 5000,
                closeButton: true,
            });
        } catch (error) {
            if (error?.message === ONLY_CSV_ERROR) {
                toast.error(t("massiveExecution.message.onlyCsvFiles"), {
                    duration: 10000,
                    closeButton: true,
                });
                handleClearCasesFilter();
                return;
            }
            // NO-SONAR: Se maneja el error mostrando un mensaje amigable al usuario a través del toast
            toast.info(t("massiveExecution.message.notFound"), {
                duration: 10000,
                closeButton: true,
            });
            handleClearCasesFilter();
        }
    };

    const handleClearCasesFilter = () => {
        queryClient.setQueryData([URL_AND_KEYS.actionJobs.actionJobsFilterCases, [], null], {
            data: [],
        });
        queryClient.setQueryData([URL_AND_KEYS.actionJobs.actionJobsFilterCases, []], {
            data: [],
        });
        queryClient.invalidateQueries({ queryKey: [URL_AND_KEYS.actionJobs.actionJobsFilterCases] });
        setExecutionData({
            type: "filter",
            action_id: "",
            restflow_id: "",
            search_filter: [],
            s3_file_key: "",
            separator: ",",
        });
    };

    const handleExecutionActions = async (additionalData = {}) => {
        const payload = {
            ...executionData,
            ...(additionalData &&
            typeof additionalData === "object" &&
            !additionalData.nativeEvent &&
            additionalData.restflow_id
                ? { restflow_id: additionalData.restflow_id }
                : {}),
            ...(additionalData &&
            typeof additionalData === "object" &&
            !additionalData.nativeEvent &&
            additionalData.action_id
                ? { action_id: additionalData.action_id }
                : {}),
            ...(additionalData &&
            typeof additionalData === "object" &&
            !additionalData.nativeEvent &&
            additionalData.restflow_context
                ? { restflow_context: additionalData.restflow_context }
                : {}),
        };
        if (payload.type === "filter" && !payload.action_id && !payload.restflow_id) {
            toast.info(t("massiveExecution.message.notAction"), {
                duration: 10000,
                closeButton: true,
            });
            return;
        }

        const data = genericHandleSendInformation({
            values: payload,
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
            toast.info(t(`massiveExecution.message.${executionData.type === "filter" ? "notExectued" : "notFound"}`), {
                duration: 10000,
                closeButton: true,
            });
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
