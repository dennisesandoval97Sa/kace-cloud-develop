import { removeKey } from "../../../utils/main";
import { sendInformation } from "../../../services/generic-send-information";
import { TEMPLATES_ATTACHMENT_SERVICE } from "../../../utils/URL";

const useTemplateAttachments = () => {
    const transformData = (data) => {
        return Object.keys(data).reduce((acc, key) => {
            acc[key] = data[key] === "" ? null : data[key];
            return acc;
        }, {});
    };

    const formatDataBeforePost = (data) => removeKey(transformData(data), ["adjuntos", "campo"]);

    const saveAttachmentsTemplate = async (idTemplate, files) => {
        const url = `${TEMPLATES_ATTACHMENT_SERVICE}`;
        const dataPosts = files.map((file) => {
            /*
             * The attachment id is generated server-side; the created record is
             * adopted from the response so later actions (delete/download) use it.
             */
            return formatDataBeforePost({
                template_id: idTemplate,
                path: file.fileData.name,
                type: file.fileData.type,
                is_active: "true",
                usage_type: file.usageType ?? null,
            });
        });

        const results = await Promise.all(
            dataPosts.map(async (dataPost, index) => {
                const data = { id: null, url, dataPost };
                const result = await sendInformation(data);
                return {
                    ...dataPost,
                    fileData: files[index]?.fileData,
                    ...(result?.data?.data ?? {}),
                };
            }),
        );

        return results;
    };

    return { saveAttachmentsTemplate };
};

export default useTemplateAttachments;
