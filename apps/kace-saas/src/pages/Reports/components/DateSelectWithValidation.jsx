import PropTypes from "prop-types";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { MAX_DAYS_RANGE } from "../data/constants";
import { DateSelect } from "./DataSelect";

/**
 * Calcula la diferencia en días entre dos fechas
 * @param {Date|string} date1 - Primera fecha
 * @param {Date|string} date2 - Segunda fecha
 * @returns {number} Diferencia en días
 */
const getDaysDifference = (date1, date2) => {
    if (!date1 || !date2) return 0;

    const d1 = new Date(date1 instanceof Date ? date1 : new Date(date1));
    const d2 = new Date(date2 instanceof Date ? date2 : new Date(date2));

    // Use local date parts to avoid UTC offset shifting the date (e.g. UTC-5 turns June 1 00:00 UTC → May 31 local)
    const utc1 = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate());
    const utc2 = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate());

    return Math.round(Math.abs(utc2 - utc1) / (1000 * 60 * 60 * 24)) + 1;
};

export const DateSelectWithValidation = ({ dateRange, setDateRange, setFieldValue, formatDate }) => {
    const { t } = useTranslation();

    const validateDateRange = useCallback(
        (from, to) => {
            if (!from || !to) return true;

            const daysDiff = getDaysDifference(from, to);

            if (daysDiff > MAX_DAYS_RANGE) {
                toast.error(
                    t("reports.form.dateRangeError", {
                        max: MAX_DAYS_RANGE,
                        selected: daysDiff,
                    }),
                    {
                        duration: 5000,
                    },
                );
                return false;
            }

            return true;
        },
        [t],
    );

    const getDisabledDates = useCallback(
        (date) => {
            if (dateRange.from && !dateRange.to) {
                const fromDate = dateRange.from instanceof Date ? dateRange.from : new Date(dateRange.from);
                const checkDate = date instanceof Date ? date : new Date(date);

                const maxDateAfter = new Date(fromDate);
                maxDateAfter.setDate(maxDateAfter.getDate() + MAX_DAYS_RANGE - 1);

                const maxDateBefore = new Date(fromDate);
                maxDateBefore.setDate(maxDateBefore.getDate() - MAX_DAYS_RANGE + 1);

                return checkDate > maxDateAfter || checkDate < maxDateBefore;
            }

            if (dateRange.to && !dateRange.from) {
                const toDate = dateRange.to instanceof Date ? dateRange.to : new Date(dateRange.to);
                const checkDate = date instanceof Date ? date : new Date(date);

                const maxDateAfter = new Date(toDate);
                maxDateAfter.setDate(maxDateAfter.getDate() + MAX_DAYS_RANGE - 1);

                const maxDateBefore = new Date(toDate);
                maxDateBefore.setDate(maxDateBefore.getDate() - MAX_DAYS_RANGE + 1);

                return checkDate > maxDateAfter || checkDate < maxDateBefore;
            }

            return false;
        },
        [dateRange.from, dateRange.to],
    );

    const handleDateChangeWithValidation = useCallback(
        (updatedDateRange) => {
            const { from, to } = updatedDateRange;

            if (from && to) {
                const isValid = validateDateRange(from, to);

                if (!isValid) {
                    return;
                }
            }

            setDateRange(updatedDateRange);
        },
        [setDateRange, validateDateRange],
    );

    const handleSetFieldValue = useCallback(
        (name, value) => {
            if (name === "period.initialDate") {
                // Starting a new range selection — skip validation; the old to is stale
                setFieldValue(name, value);
                return;
            }

            if (name === "period.endDate") {
                const newFrom = dateRange.from;
                const newTo = value;

                if (newFrom && newTo) {
                    const isValid = validateDateRange(newFrom, newTo);
                    if (!isValid) {
                        return;
                    }
                }

                setFieldValue(name, value);
            }
        },
        [dateRange.from, setFieldValue, validateDateRange],
    );

    return (
        <>
            <DateSelect
                dateRange={dateRange}
                setDateRange={handleDateChangeWithValidation}
                setFieldValue={handleSetFieldValue}
                formatDate={formatDate}
                disabled={getDisabledDates}
            />
            <p className="text-xs text-gray-500 mt-2 -mt-4 ml-4">
                {t("reports.form.maxDaysHint", { max: MAX_DAYS_RANGE })}
            </p>
        </>
    );
};

DateSelectWithValidation.propTypes = {
    dateRange: PropTypes.object.isRequired,
    setDateRange: PropTypes.func.isRequired,
    setFieldValue: PropTypes.func.isRequired,
    formatDate: PropTypes.func.isRequired,
};
