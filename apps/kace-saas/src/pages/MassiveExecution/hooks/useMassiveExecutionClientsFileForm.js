import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { URL_AND_KEYS } from "../../../utils/urlAndKeys";
import { genericSearchService } from "../../../services/genericSearchService";
import { toast } from "sonner";
import { genericHandleSendInformation } from "../../../services/genericHandleSendInformation";
import { useEffect, useState } from "react";
import useGeneralMutation from "../../../hooks/useGeneralMutation";
import { sendInformation } from "../../../services/generic-send-information";
import { ONLY_CSV_ERROR, readCsvFile } from "../utils/massiveExecutionFileUtils";

const useMassiveExecutionClientsForm = () => {
    const filterRedux = [];
    const queryClient = useQueryClient();
    const { t } = useTranslation();

    const {
        mutate,
        isSuccess,
        isError: isErrorMutate,
        isPending: isPendingClients,
    } = useGeneralMutation({
        keyQuery: URL_AND_KEYS.actionJobs.key,
        path: "/massive-execution",
    });

    const [executionData, setExecutionData] = useState({
        type: "file_clients",
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
            const documentType = columns[0].trim();
            const documentNumber = columns[1].trim();

            if (!documentType || !documentNumber) {
                if (index === 0 && lines.length > 1) {
                    return;
                }
                skippedCount++;
                return;
            }

            if (index === 0 && lines.length > 1 && (/tipo/i.test(documentType) || /documento/i.test(documentNumber))) {
                return;
            }

            data.push({
                documentType,
                documentNumber,
            });
        });

        return { data, skippedCount };
    };

    const handleFilterClients = async (formData) => {
        if (!formData?.file || !formData.file.length) {
            toast.info(t("massiveExecution.message.fileRequired"), {
                duration: 10000,
                closeButton: true,
            });
            return;
        }

        try {
            const fileContent = await readCsvFile(formData.file);
            const { data: clients, skippedCount } = parseCSV(fileContent, formData.delimiter);
            const isThereData = clients.length;
            const clientsURLKeys = {
                ...URL_AND_KEYS.clients,
                key: URL_AND_KEYS.actionJobs.actionJobsFilterClients,
            };

            if (!isThereData) {
                toast.info(t("massiveExecution.message.notFound"), {
                    duration: 10000,
                    closeButton: true,
                });
                handleClearClientsFilter();
                return;
            }

            if (skippedCount > 0) {
                toast.warning(t("massiveExecution.message.skippedRowsWarning", { count: skippedCount }), {
                    duration: 8000,
                    closeButton: true,
                });
            }

            const filter = clients.map((element) => ({
                field: `${clientsURLKeys.view}.documento`,
                operator: "like",
                value: element.documentNumber,
                type: "OR",
            }));

            const response = await queryClient.fetchQuery({
                queryKey: [clientsURLKeys.key, [filterRedux]],
                queryFn: async () =>
                    genericSearchService(
                        `${clientsURLKeys.url}/search`,
                        filter,
                        {
                            limit: 0,
                            offset: 0,
                        },
                        clientsURLKeys.view,
                        false,
                    ),
                staleTime: 0,
                gcTime: 0,
                refetchOnWindowFocus: false,
            });

            const clientSet = new Set(
                clients.map(({ documentType, documentNumber }) => `${documentType.toUpperCase()}-${documentNumber}`),
            );

            const parsedClients = response.data.filter(({ tipo_documento, documento }) =>
                clientSet.has(`${tipo_documento.toUpperCase()}-${documento}`),
            );

            if (!parsedClients?.length) {
                toast.info(t("massiveExecution.message.notFound"), {
                    duration: 10000,
                    closeButton: true,
                });
                handleClearClientsFilter();
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

            await queryClient.setQueryData([clientsURLKeys.key, [], null], {
                data: parsedClients,
            });
            await queryClient.setQueryData([clientsURLKeys.key, filterToSend], {
                data: parsedClients,
            });

            setExecutionData({
                ...executionData,
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
                handleClearClientsFilter();
                return;
            }
            // NO-SONAR: Se maneja el error mostrando un mensaje amigable al usuario a través del toast
            toast.info(t("massiveExecution.message.notFound"), {
                duration: 10000,
                closeButton: true,
            });
            handleClearClientsFilter();
        }
    };

    const handleClearClientsFilter = () => {
        queryClient.setQueryData([URL_AND_KEYS.actionJobs.actionJobsFilterClients, [], null], {
            data: [],
        });
        queryClient.setQueryData([URL_AND_KEYS.actionJobs.actionJobsFilterClients, []], {
            data: [],
        });
        queryClient.invalidateQueries({ queryKey: [URL_AND_KEYS.actionJobs.actionJobsFilterClients] });
        setExecutionData({
            type: "file_clients",
            s3_file_key: "",
            separator: ",",
        });
    };

    const handleExecutionActions = async () => {
        const data = genericHandleSendInformation({
            values: executionData,
            urlService: URL_AND_KEYS.actionJobs.url,
        });

        mutate(data);
    };

    useEffect(() => {
        if (isSuccess) {
            handleClearClientsFilter();
            sendInformation({
                url: `${URL_AND_KEYS.actionJobs.url}/process-queue`,
            });
        }
    }, [isSuccess]);

    useEffect(() => {
        if (isErrorMutate) {
            toast.info(t("massiveExecution.message.notFound"), {
                duration: 10000,
                closeButton: true,
            });
            handleClearClientsFilter();
        }
    }, [isErrorMutate]);

    return {
        handleFilterClients,
        handleClearClientsFilter,
        handleExecutionActions,
        isPendingClients,
    };
};

export default useMassiveExecutionClientsForm;
