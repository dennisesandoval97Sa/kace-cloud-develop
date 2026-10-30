export const validateStringList = (key, str) => {
    const list = str
        ?.split(",")
        .map((individualValue) => individualValue.trim())
        .filter((individualValue) => individualValue?.length);

    return { [key]: list };
};

const isDefined = (v) => v !== undefined && v !== null;

export const validateBase = (fieldData) => {
    let defaultValue;

    switch (fieldData.type) {
        case "string":
            if (typeof fieldData.default === "string") {
                defaultValue = fieldData.default;
            }
            break;

        case "number": {
            const num = Number(fieldData.default);
            if (!Number.isNaN(num)) {
                defaultValue = num;
            }
            break;
        }

        case "boolean":
            if (typeof fieldData.default === "boolean") {
                defaultValue = fieldData.default;
            } else if (fieldData.default === "true") {
                defaultValue = true;
            } else if (fieldData.default === "false") {
                defaultValue = false;
            }
            break;

        case "date":
            if (fieldData.default === "now") {
                defaultValue = "now";
            } else {
                const date = new Date(fieldData.default);
                if (!isNaN(date.getTime())) {
                    defaultValue = date;
                }
            }
            break;
    }

    return {
        type: fieldData.type,
        required: !!fieldData.required,
        unique: !!fieldData.unique,
        dependency: !!fieldData.dependency,
        dependencyValueValidation: !!fieldData.dependencyValueValidation,
        ...(fieldData.dependency && fieldData.dependsOn ? { dependsOn: fieldData.dependsOn } : {}),
        ...(fieldData.dependency && fieldData.dependencyValueValidation && fieldData.dependencyValue !== undefined
            ? { dependencyValue: fieldData.dependencyValue }
            : {}),
        ...(fieldData.restflow_id ? { restflow_id: fieldData.restflow_id } : {}),
        ...(isDefined(defaultValue) ? { default: defaultValue } : {}),
    };
};

// Re-infiere el toggle `transform` al reabrir un schema guardado; compartida con SchemasForm.jsx para no divergir de validateString.
export const inferTransformOnLoad = (fieldData) => !!(fieldData.uppercase || fieldData.lowercase);

export const validateString = (validationType, fieldData) => {
    const finalField = validateBase(fieldData);
    switch (validationType) {
        case "email":
            finalField.email = {
                ...fieldData.email,
                tlds: {
                    ...validateStringList("allow", fieldData.email?.tlds?.allow),
                },
            };
            break;
        case "pattern":
            finalField.pattern = fieldData.pattern;
            break;

        case "ip": {
            const versions = [...(fieldData?.IPv4 ? ["ipv4"] : []), ...(fieldData?.IPv6 ? ["ipv6"] : [])];
            finalField.ip = {
                ...((fieldData && fieldData.ip) || {}),
                version: versions,
                cidr: fieldData && fieldData.ip && fieldData.ip.cidr ? fieldData.ip.cidr : "optional",
            };
            break;
        }

        case "uri":
            finalField.uri = {
                ...fieldData.uri,
                ...validateStringList("scheme", fieldData.uri?.scheme),
            };
            break;
    }

    if (fieldData.fixedLength || fieldData.isFixedLength) {
        if (fieldData.length !== undefined && fieldData.length !== null && fieldData.length !== "") {
            finalField.length = Number(fieldData.length);
        }
        delete finalField.min;
        delete finalField.max;
    } else {
        delete finalField.length;
        if (fieldData.min !== undefined && fieldData.min !== null && fieldData.min !== "") {
            finalField.min = Number(fieldData.min);
        }
        if (fieldData.max !== undefined && fieldData.max !== null && fieldData.max !== "") {
            finalField.max = Number(fieldData.max);
        }
    }

    finalField.empty = !fieldData.required;
    finalField.alphanum = !!fieldData.alphanum;
    finalField.trim = !!fieldData.trim;

    // `transform` es solo un toggle del formulario: data_structure guarda el casing resultante.
    if (fieldData.transform) {
        const toUpperCase = !!fieldData.uppercase;
        finalField.uppercase = toUpperCase;
        finalField.lowercase = !toUpperCase;
    }

    if (fieldData.regexReplace?.length) {
        finalField.regexReplace = fieldData.regexReplace.filter(
            (replacementRule) => replacementRule.pattern?.trim()?.length && replacementRule.string?.trim()?.length,
        );
    }

    const withLists = {
        ...finalField,
        ...validateStringList("valid", fieldData?.valid),
        ...validateStringList("invalid", fieldData?.invalid),
    };

    delete withLists.IPv4;
    delete withLists.IPv6;

    return withLists;
};

export const validateNumber = (numberSign, fieldData) => {
    const { ...finalField } = validateBase(fieldData);

    return {
        ...finalField,
        integer: !!fieldData.integer,
        unsafe: !!fieldData.unsafe,
        positive: numberSign !== "negative",
        negative: numberSign !== "positive",
        min: fieldData?.min,
        max: fieldData?.max,
        ...(fieldData.integer ? {} : { precision: fieldData?.precision }),
        ...(!!fieldData.multiple ? { multiple: fieldData?.multiple } : {}),
        ...validateStringList("valid", fieldData?.valid),
        ...validateStringList("invalid", fieldData?.invalid),
    };
};

export const validateBoolean = (fieldData) => {
    const finalField = validateBase(fieldData);

    return {
        ...finalField,
        default: !!fieldData?.default,
        ...validateStringList("truthyValues", fieldData?.truthyValues),
        ...validateStringList("falsyValues", fieldData?.falsyValues),
    };
};

const validateMinMaxDate = (date) => {
    if (date == null) return date;
    if (typeof date === "number" && Number.isFinite(date)) return new Date(date).toISOString();
    if (date instanceof Date && !Number.isNaN(date.valueOf())) return date.toISOString();
    if (typeof date === "string") {
        const parsedDate = new Date(date);
        if (!Number.isNaN(parsedDate.valueOf())) return parsedDate.toISOString();
        return date;
    }
    return date;
};

export const validateDate = (fieldData) => {
    const finalField = validateBase(fieldData);

    const result = {
        ...finalField,
        iso: !!fieldData?.iso,
        empty: !!fieldData?.empty,
        min: validateMinMaxDate(fieldData?.min),
        max: validateMinMaxDate(fieldData?.max),
    };

    if (fieldData?.iso) {
        result.timezoneFormat = fieldData?.timezoneFormat || "withoutTimezone";
        if (fieldData?.timezoneFormat === "withoutTimezone" && fieldData?.timezone) {
            result.timezone = fieldData.timezone;
        }
    } else {
        result.timestamp = fieldData?.timestamp || "javascript";
    }

    return result;
};
