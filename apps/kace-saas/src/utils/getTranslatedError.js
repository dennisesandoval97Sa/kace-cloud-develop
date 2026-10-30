import { findPublicErrorCode, getPublicErrorCodeI18nKey } from "@kace/error-codes";

const KNOWN_API_ERROR_ENTRIES = [
    {
        substring: "Cases must share the same current transition",
        i18nKey: "boards.bulkActions.apiErrors.sameTransitionRequired",
    },
    {
        substring: "The provided transition is not allowed from the current state",
        i18nKey: "boards.bulkActions.apiErrors.transitionNotAllowed",
    },
    {
        substring: "The conditions configured for this transition are not met",
        i18nKey: "boards.bulkActions.apiErrors.transitionConditionsNotMet",
    },
    {
        substring: "You do not have permission",
        i18nKey: "boards.bulkActions.apiErrors.noPermission",
    },
    {
        substring: "Could not assign a person responsible",
        i18nKey: "boards.bulkActions.apiErrors.couldNotAssignResponsible",
    },
    {
        substring: "The group you are trying to assign does not exist",
        i18nKey: "app.errors.public.CASE_ASSIGNMENT_GROUP_UNAVAILABLE",
    },
    {
        substring: "The user you are trying to assign does not exist",
        i18nKey: "app.errors.public.CASE_ASSIGNMENT_USER_UNAVAILABLE",
    },
    {
        substring: "The user does not belong to the specified group",
        i18nKey: "app.errors.public.CASE_ASSIGNMENT_USER_GROUP_UNAVAILABLE",
    },
    {
        substring: "Some interactions are already closed",
        i18nKey: "interactions.bulk.apiErrors.alreadyClosed",
    },
    {
        substring: "Some interactions are already deleted",
        i18nKey: "interactions.bulk.apiErrors.alreadyDeleted",
    },
    {
        substring: "Some interactions are deleted",
        i18nKey: "interactions.bulk.apiErrors.deleted",
    },
    {
        substring: "Interactions are already in the destination workspace",
        i18nKey: "interactions.bulk.apiErrors.alreadyInDestination",
    },
    {
        substring: "Destination workspace does not exist or is inactive",
        i18nKey: "interactions.bulk.apiErrors.destinationInactive",
    },
    {
        substring: "Interactions not found",
        i18nKey: "interactions.bulk.apiErrors.notFound",
    },
    {
        substring: "Invalid interaction motive",
        i18nKey: "interactions.bulk.apiErrors.invalidMotive",
    },
];

const toMessage = (value) => {
    if (typeof value === "string") {
        return value;
    }

    if (value == null) {
        return "";
    }

    return String(value);
};

const compactMessages = (messages) => {
    return messages
        .map(toMessage)
        .map((message) => message.trim())
        .filter(Boolean);
};

const getLegacyErrorMessages = (rawErrors) => {
    if (typeof rawErrors === "string") {
        return [rawErrors];
    }

    if (Array.isArray(rawErrors)) {
        return rawErrors.map((error) => error?.message ?? error);
    }

    return [];
};

export const getTranslatedPublicErrorCode = (code, t, interpolation = {}) => {
    const i18nKey = getPublicErrorCodeI18nKey(code, "app.errors.public");
    if (!i18nKey) {
        return undefined;
    }

    const fallback = t("app.errors.generic");
    const translated = t(i18nKey, { defaultValue: fallback, replace: interpolation });

    return translated && translated !== i18nKey ? translated : fallback;
};

export const getTranslatedError = (error, t) => {
    const responseData = error?.response?.data;
    const publicErrorCode = findPublicErrorCode(responseData?.data?.code, responseData?.code);
    if (publicErrorCode) {
        const { code: _code, ...publicData } =
            responseData?.data && typeof responseData.data === "object" ? responseData.data : {};
        return getTranslatedPublicErrorCode(publicErrorCode, t, publicData) ?? t("app.errors.generic");
    }

    const messageCandidates = compactMessages([
        responseData?.message,
        responseData?.error,
        error?.message,
        ...getLegacyErrorMessages(responseData?.errors),
    ]);

    for (const { substring, i18nKey } of KNOWN_API_ERROR_ENTRIES) {
        if (messageCandidates.some((message) => message.includes(substring))) {
            return t(i18nKey);
        }
    }

    return compactMessages([responseData?.message, responseData?.error, error?.message])[0] ?? t("app.errors.generic");
};
