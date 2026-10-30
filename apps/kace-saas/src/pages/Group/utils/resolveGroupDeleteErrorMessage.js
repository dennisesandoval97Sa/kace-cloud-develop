import { getTranslatedError } from "@/utils/getTranslatedError";

export function resolveGroupDeleteErrorMessage(error, t) {
    return getTranslatedError(error, t);
}
