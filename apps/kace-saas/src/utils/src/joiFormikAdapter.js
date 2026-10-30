import i18n from "i18next";

class ValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = "ValidationError";
        this.inner = [];
    }
}

const NESTED_ALTERNATIVE_ERROR_PRIORITY = [
    "number.max",
    "number.min",
    "number.less",
    "number.greater",
    "number.integer",
    "number.base",
    "any.required",
    "string.email",
    "string.max",
    "string.min",
    "any.only",
];

const isRawJoiMessage = (message) =>
    typeof message === "string" &&
    (/"[^"]+" must be/.test(message) || /\breferences\b|\bwhich must be\b/.test(message));

const isDefaultJoiMessage = (message) => typeof message === "string" && /^"[^"]+" /.test(message);

const looksLikeI18nKey = (message) =>
    typeof message === "string" && /^[A-Za-z][\w-]*(?:\.[A-Za-z][\w-]*)+$/.test(message);

const translateIfResolved = (key, context) => {
    const translated = i18n.t(key, { ...context });
    return translated !== key ? translated : null;
};

const getI18nMessage = (message, e) => {
    const explicit = translateIfResolved(`validations.${message}`, e.context);
    if (explicit) {
        return explicit;
    }

    if (looksLikeI18nKey(message)) {
        const unprefixed = translateIfResolved(message, e.context);
        if (unprefixed) {
            return unprefixed;
        }
    }

    if (isDefaultJoiMessage(message) || looksLikeI18nKey(message)) {
        const i18nType = translateIfResolved(`validations.${e.type}`, e.context);
        if (i18nType) {
            return i18nType;
        }
    }

    return message;
};

const pickBestAlternativeErrorMessage = (parentErr, nestedErrors) => {
    const parentTranslated = getI18nMessage(parentErr.message, parentErr);
    if (parentTranslated !== parentErr.message && !isRawJoiMessage(parentTranslated)) {
        return parentTranslated;
    }

    const sortedNested = [...nestedErrors].sort((a, b) => {
        const aIndex = NESTED_ALTERNATIVE_ERROR_PRIORITY.indexOf(a.type);
        const bIndex = NESTED_ALTERNATIVE_ERROR_PRIORITY.indexOf(b.type);
        return (aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex) - (bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex);
    });

    for (const nestedErr of sortedNested) {
        const translated = getI18nMessage(nestedErr.message, nestedErr);
        if (translated && !isRawJoiMessage(translated)) {
            return translated;
        }
    }

    return parentTranslated;
};

function formatPathForFormik(pathArray) {
    if (!pathArray || pathArray.length === 0) return "";

    let result = pathArray[0].toString();

    for (let i = 1; i < pathArray.length; i++) {
        const segment = pathArray[i];

        if (typeof segment === "number" || /^\d+$/.test(segment)) {
            result += `[${segment}]`;
        } else {
            result += `.${segment}`;
        }
    }

    return result;
}

function createErrorSchema(e) {
    const error = new ValidationError(e.message);
    const allErrors = [];
    const groupedErrors = {};

    e.details.forEach((err) => {
        if (err.type === "alternatives.match" && err.context && err.context.details) {
            const path = formatPathForFormik(err.path);
            const message = pickBestAlternativeErrorMessage(err, err.context.details);
            if (!groupedErrors[path]) {
                groupedErrors[path] = [];
            }
            groupedErrors[path].push(message);
        } else {
            const path = formatPathForFormik(err.path);
            const message = getI18nMessage(err.message, err);
            if (!groupedErrors[path]) {
                groupedErrors[path] = [];
            }
            groupedErrors[path].push(message);
        }
    });

    for (const path in groupedErrors) {
        if (Object.hasOwn(groupedErrors, path)) {
            allErrors.push({
                message: groupedErrors[path].join(", "),
                path,
            });
        }
    }

    error.inner = allErrors;
    return error;
}

export function joiFormikAdapter(schema, options = { abortEarly: false, allowUnknown: true }) {
    return {
        async validate(obj) {
            try {
                await schema.validateAsync(obj, options);
            } catch (err) {
                throw createErrorSchema(err);
            }
        },
    };
}
