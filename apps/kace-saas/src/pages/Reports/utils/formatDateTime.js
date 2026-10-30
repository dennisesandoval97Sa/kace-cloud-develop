import { formatDate } from "@/utils/src/utils/dateUtils";

/**
 * Formats a date string using the tenant timezone.
 * Falls back to local browser timezone if tenant timezone is not configured.
 *
 * @param {Date|string} date - Date to format
 * @returns {string} Formatted date string with tenant timezone
 */
export const formatDateTime = (date) => {
    if (!date) return "";
    try {
        return formatDate(date, "yyyy/MM/dd HH:mm:ss");
    } catch {
        const d = date instanceof Date ? date : new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        const hours = String(d.getHours()).padStart(2, "0");
        const minutes = String(d.getMinutes()).padStart(2, "0");
        const seconds = String(d.getSeconds()).padStart(2, "0");
        return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
    }
};
