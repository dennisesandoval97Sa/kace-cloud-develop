import { useQuery } from "@tanstack/react-query";
import { S3_FILES_DOWNLOAD_SERVICE, HELPS_SERVICE } from "../../../../utils/URL";
import { useState, useEffect } from "react";
import { sendInformation } from "../../../../services/generic-send-information";
import { genericSearch } from "../../../../services/genericSearch";

export const useHelpsData = () => {
    const [helps, setHelps] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const {
        data: dataHelps = [],
        isLoading: isLoadingHelps,
        isFetching: isFetchingHelps,
    } = useQuery({
        queryKey: ["helpsData"],
        queryFn: async () =>
            genericSearch(`${HELPS_SERVICE}/search`, [{
                field: "is_active",
                operator: "eq",
                value: 1,
                type: "AND",
            }]),
        staleTime: 1000 * 60 * 60,
        retry: 1,
    });

    const sortAttachments = async (data) => {
        try {
            setIsLoading(true);
            const url = `${S3_FILES_DOWNLOAD_SERVICE}`;
            const updatedHelps = [...data];
            for (const help of updatedHelps) {
                if (help.attachments) {
                    for (const attachment of help.attachments) {
                        if (Object.keys(attachment).length > 0) {
                            const dataToSend = {
                                id: help.id,
                                url,
                                dataPost: {
                                    url: "helps",
                                    id: help.id,
                                    fileName: attachment.path,
                                    contentType: attachment.tipo,
                                },
                            };

                            try {
                                const response = await sendInformation(dataToSend);
                                const { uploadUrl } = response.data.data;

                                attachment.url = uploadUrl;
                            } catch {
                                // NO-SONAR: Si hay un error al procesar el archivo, se omite y se continúa con el siguiente archivo.
                                continue;
                            }
                        }
                    }
                }
            }
            setHelps(updatedHelps);
        } catch {
            // NO-SONAR: En caso de error general, se limpia el estado de "helps" para evitar mostrar datos incompletos o incorrectos.
            setHelps([]);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (dataHelps?.data && dataHelps.data.length > 0) {
            sortAttachments(dataHelps.data);
        }
    }, [dataHelps]);

    return {
        helps,
        isLoading: isLoading || isLoadingHelps || isFetchingHelps,
    };
};
