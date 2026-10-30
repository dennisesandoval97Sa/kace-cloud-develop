import { toast } from "sonner";
import {
    sendInformation,
    requestPut,
} from "../services/generic-send-information";
import { removeKey } from "./main";
import {
    CASES_ATTACHMENT_SERVICE,
    S3_FILES_UPLOAD_SERVICE,
    S3_FILES_VALIDATION_SERVICE,
} from "./URL";
import { Uuid } from "@kace/plugins";

const formatDataBeforePost = (data, id) => {
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
};

const transformData = (data) => {
    return Object.keys(data).reduce((acc, key) => {
        acc[key] = data[key] === "" ? null : data[key];
        return acc;
    }, {});
};

const saveAttachments = async (idCase, files) => {
    const url = `${CASES_ATTACHMENT_SERVICE}`;
    const dataPosts = files.map((file) => {
        return formatDataBeforePost(
            {
                case_id: idCase,
                path: file.fileName,
                type: 1,
                description: file.contentType,
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
};

export const sendS3Files = async (urlS3, content, type) => {
    const data = { url: urlS3, dataPost: content, fileType: type };
    const result = await requestPut(data);
    if (result.status !== 200) {
        throw new Error(`S3 upload failed for file type ${type}`);
    }
};

export const getUrlS3File = async (
    dataFiles,
    id,
    t = null,
    newFields = null,
) => {
    const url = `${S3_FILES_UPLOAD_SERVICE}`;
    try {
        await Promise.all(
            dataFiles.map(async (file) => {
                const data = {
                    url,
                    dataPost: {
                        ...(newFields || {}),
                        fileName: file.fileName,
                        contentType: file.contentType,
                        fileContent: file.content,
                        url: "case",
                        id,
                    },
                };
                const response = await sendInformation(data);
                if (!response.data?.data?.uploadUrl) {
                    throw new Error(
                        `Failed to get S3 URL for file ${file.fileName}`,
                    );
                }

                await sendS3Files(
                    response.data.data.uploadUrl,
                    file.content,
                    file.contentType,
                );
            }),
        );

        try {
            const attachmentResults = await saveAttachments(id, dataFiles);
            return attachmentResults;
        } catch {
            // NO-SONAR: El error al guardar los adjuntos es manejado por el `catch` superior
            throw new Error("Error saving attachments");
        }
    } catch {
        // NO-SONAR: El mensaje de error se simplifica para que sea fácilmente comprendido por el usuario
        throw new Error("No es posible cargar el archivo en estos momentos");
    }
};

export const fileValidatorWithAntivirus = async (url, id, fileName, t) => {
    const validationData = { url, id, fileName };

    const validationResponse = await sendInformation({
        url: `${S3_FILES_UPLOAD_SERVICE}${S3_FILES_VALIDATION_SERVICE}`,
        dataPost: validationData,
    });

    if (validationResponse.data?.errors) {
        toast.error(t("app.alerts.UploadFileError", { fileName }));
        throw new Error(t("app.alerts.UploadFileErrorSecurity"));
    }
};
