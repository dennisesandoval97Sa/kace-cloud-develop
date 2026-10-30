const FORMATTED_DATE_PATTERN = /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}$/;

const UNFORMATTED_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}[T ]/;

export const isAlreadyFormattedDate = (value) => typeof value === "string" && FORMATTED_DATE_PATTERN.test(value);

export const shouldFormatDateValue = (value) => {
    if (value === null || value === undefined || value === "" || value === "null" || value === "undefined") {
        return false;
    }

    if (value instanceof Date) {
        return !Number.isNaN(value.getTime());
    }

    if (typeof value === "number") {
        return Number.isFinite(value) && value > 0;
    }

    if (typeof value !== "string") {
        return false;
    }

    if (isAlreadyFormattedDate(value)) {
        return false;
    }

    if (UNFORMATTED_DATE_PATTERN.test(value)) {
        return true;
    }

    const parsed = new Date(value);
    return !Number.isNaN(parsed.getTime());
};
