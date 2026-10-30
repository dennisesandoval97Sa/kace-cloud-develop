import { JSON_FIELDS } from "./constants.jsx";
import { toast } from "sonner";

const CONTEXT_REFERENCE_PATTERN = /^context(?:\.[A-Za-z_$][\w$]*|\[\d+\])+$/;
const INCOMPLETE_CONTEXT_REFERENCE_PATTERN = /^context(?:\.?$|(?:\.[A-Za-z_$][\w$]*|\[\d+\])+\.)$/;

export const isContextReferenceBody = (value) =>
    typeof value === "string" && CONTEXT_REFERENCE_PATTERN.test(value.trim());

const isIncompleteContextReferenceBody = (value) =>
    typeof value === "string" && INCOMPLETE_CONTEXT_REFERENCE_PATTERN.test(value.trim());

export const prepareDataSee = (field, values) => {
    let value = "";
    if (JSON_FIELDS.includes(field)) {
        if (field === "body" && values.body_type === "plain_text") {
            value = values.body?.body ?? "";
        } else if (field === "body" && isContextReferenceBody(values.body?.body)) {
            value = values.body.body.trim();
        } else {
            const { [field]: extractedValue } = values[field] ?? {};
            extractedValue && (value = JSON.stringify(extractedValue));
        }
    }

    if (field === "filter_input") {
        const { filter_input } = values[field] ?? {};
        value = filter_input?.join(",") ?? "";
    }
    return value;
};

export const prepareJsonDataSave = (values, t) => {
    const tempValues = {};
    let fieldError = null;
    try {
        for (const field of JSON_FIELDS) {
            fieldError = field;
            if (field === "body" && values.body_type === "plain_text") {
                tempValues[field] = { body: values.body ?? "" };
            } else if (field === "body" && isContextReferenceBody(values.body)) {
                tempValues[field] = { body: values.body.trim() };
            } else if (field === "body" && isIncompleteContextReferenceBody(values.body)) {
                toast.error(
                    t(
                        "restEndPoint.validation.incompleteContextReference",
                        "Complete the context reference path before saving.",
                    ),
                );
                return;
            } else {
                tempValues[field] = prepareDataSave(field, values);
            }
        }
    } catch {
        /* NO-SONAR: Se maneja el error de forma silenciosa y se muestra un mensaje amigable al usuario. */
        const label = t(`restEndPoint.label.${fieldError}`);
        toast.error(`${label} debe ser JSON valido, ejemplo: {"key":"value"}`);
        return;
    }
    return tempValues;
};

const prepareDataSave = (field, values) => {
    return {
        [field]: JSON.parse(values[field] || "{}"),
    };
};
