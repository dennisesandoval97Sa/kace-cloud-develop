import { Uuid } from "@kace/plugins";
import { removeKey } from "@kace/utils";
import { toast } from "sonner";
import { getTranslatedError } from "@/utils/getTranslatedError";
import { findPublicErrorCode, PUBLIC_ERROR_CODES } from "@kace/error-codes";

export const formatDataBeforePost = (data, id) => {
    return id
        ? removeKey(data, ["id", "created_at", "updated_at", "created_by", "updated_by"])
        : { ...data, id: Uuid() };
};

const isDuplicateNameError = (error) => {
    const responseData = error?.response?.data;
    const code = findPublicErrorCode(responseData?.data?.code, responseData?.code);

    return code === PUBLIC_ERROR_CODES.LITERAL_NAME_ALREADY_EXISTS;
};

export const handleLiteralMutationError = (error, t) => {
    if (isDuplicateNameError(error)) {
        toast.info(getTranslatedError(error, t));
        return;
    }
    toast.error(getTranslatedError(error, t));
};
