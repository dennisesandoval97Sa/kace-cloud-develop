const parseDate = (value) => {
    if (!value) return null;

    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

export const toNotificationCalendarDate = (value) => {
    const date = parseDate(value);
    if (!date) return undefined;

    return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
};

export const formatNotificationCalendarDate = (value) => {
    const date = parseDate(value);
    if (!date) return value;

    const day = String(date.getUTCDate()).padStart(2, "0");
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    return `${day}/${month}/${date.getUTCFullYear()}`;
};

export const formatNotificationCalendarFields = (processedRows, sourceRows, fields) =>
    processedRows.map((row, index) => {
        const sourceRow = sourceRows[index] ?? row;
        return fields.reduce(
            (formattedRow, field) => ({
                ...formattedRow,
                [field]: formatNotificationCalendarDate(sourceRow[field]),
            }),
            row,
        );
    });

const formatNotificationBoundary = (value, endOfDay) => {
    const date = parseDate(value);
    if (!date) return value;

    const useLocalCalendar = value instanceof Date;
    const year = useLocalCalendar ? date.getFullYear() : date.getUTCFullYear();
    const month = (useLocalCalendar ? date.getMonth() : date.getUTCMonth()) + 1;
    const day = useLocalCalendar ? date.getDate() : date.getUTCDate();
    const datePart = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return `${datePart}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`;
};

export const normalizeNotificationDateRange = (values, { startField, endField }) => {
    const normalizedValues = { ...values };

    if (Object.prototype.hasOwnProperty.call(values, startField)) {
        normalizedValues[startField] = formatNotificationBoundary(values[startField], false);
    }
    if (Object.prototype.hasOwnProperty.call(values, endField)) {
        normalizedValues[endField] = formatNotificationBoundary(values[endField], true);
    }

    return normalizedValues;
};
