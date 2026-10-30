import { Uuid } from "@kace/plugins";
import { removeKey } from "@kace/utils";

export const genericHandleSendInformation = ({
    values,
    urlService = "",
    fields = [],
    setFormikErrors = null,
    setFormikStatus = null,
    pending = false,
    options = {},
}) => {
    if (pending) return;
    const { id } = values;
    const usesCollectionCreateUrl =
        options?.isCreate === true || (options?.serverGeneratedId === true && options?.isCreate !== false);
    const url = id && !usesCollectionCreateUrl ? `${urlService}/${id}` : `${urlService}`;
    const dataPost = formatDataBeforePost(values, id, fields, options);
    const data = {
        id,
        url,
        dataPost,
        setFormikErrors,
        setFormikStatus,
        options,
    };
    return data;
};

export const formatDataBeforePost = (data, id, fields, options = {}) => {
    const {
        keepId = false,
        keepEmptyStrings = false,
        fieldsToKeepEmpty = [],
        fieldsToKeepNull = [],
        serverGeneratedId = false,
        generateId = !serverGeneratedId,
    } = options;

    const keysToRemove = [
        ...(keepId ? [] : ["id"]),
        "created_at",
        "created_by",
        "updated_at",
        "updated_by",
        "deleted_at",
        "deleted_by",
        ...fields,
    ];

    let cleanedData = removeKey(data, keysToRemove);

    cleanedData = Object.keys(cleanedData).reduce((acc, key) => {
        const value = cleanedData[key];
        const keepEmpty = fieldsToKeepEmpty.includes(key);

        if (value === null && fieldsToKeepNull.includes(key)) {
            acc[key] = value;
            return acc;
        }

        if (
            value !== null &&
            value !== undefined &&
            (keepEmptyStrings || keepEmpty ? true : value !== "") &&
            !(Array.isArray(value) && value.length === 0 && !keepEmpty) &&
            !(typeof value === "object" && !Array.isArray(value) && Object.keys(value)?.length === 0 && !keepEmpty)
        ) {
            acc[key] = value;
        }
        return acc;
    }, {});

    if (!id && generateId) {
        cleanedData.id = Uuid();
    }

    return cleanedData;
};
