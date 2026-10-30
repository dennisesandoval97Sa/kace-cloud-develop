import React, { useState, useEffect, useCallback, useMemo, forwardRef } from "react";
import PropTypes from "prop-types";
import { format, set } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { Calendar as CalendarIcon, Clock } from "lucide-react";
import { es, enUS } from "date-fns/locale";
import { Calendar } from "@kace/ui-shared";
import { cn } from "@kace_v2/shared/utils/cn.util";
import Button from "@kace_v2/shared/ui/atoms/Button";
import Label from "@kace_v2/shared/ui/atoms/Label";
import Popover from "@kace_v2/shared/ui/molecules/Popover";
import Input from "@kace_v2/shared/ui/atoms/Input";
import { useTranslation } from "react-i18next";

const LOCALE_MAP = {
    es,
    en: enUS,
};

const DEFAULT_TIME = "00:00";

const isValidDate = (date) => date instanceof Date && !isNaN(date);

const hasValue = (val) => val !== undefined && val !== null && String(val).length > 0;

const formatDateForDisplay = (date) => (isValidDate(date) ? format(date, "yyyy-MM-dd") : "no_date");

const formatDateTimeForDisplay = (date, time) =>
    `${formatInTimeZone(format(date, "yyyy-MM-dd'T'00:00:00.000'Z'"), "UTC", "LLL dd, y")} ${time}`;

/**
 * Formats a Date object and time string to UTC format "YYYY-MM-DD HH:mm:ss"
 * @param {Date} date - The date object
 * @param {string} timeStr - Time string in format "HH:mm"
 * @returns {string} Formatted string in UTC "YYYY-MM-DD HH:mm:ss"
 */
const formatDateTimeToUTC = (date, timeStr) => {
    if (!isValidDate(date) || !timeStr) return "";

    const [hours, minutes] = timeStr.split(":").map(Number);

    const dateTime = set(date, {
        hours,
        minutes,
        seconds: 0,
        milliseconds: 0,
    });

    // Format to UTC string "YYYY-MM-DD HH:mm:ss"
    return formatInTimeZone(dateTime, "UTC", "yyyy-MM-dd HH:mm:ss");
};

const DateTimePickerSingle = forwardRef(
    (
        {
            className,
            value = null,
            onChange,
            error = false,
            touched = false,
            initialValue = null,
            isTitle = false,
            noInitialDate = false,
            idBase = "datetime_picker_single",
            placeholder,
        },
        ref
    ) => {
        const { t, i18n } = useTranslation();

        const [date, setDate] = useState(() => {
            if (noInitialDate) {
                return undefined;
            }
            return new Date();
        });

        const [time, setTime] = useState(DEFAULT_TIME);
        const [isInitialized, setIsInitialized] = useState(false);

        const currentLocale = useMemo(() => LOCALE_MAP[i18n.language] || es, [i18n.language]);

        const handleDateChange = useCallback(
            (newDate) => {
                if (!newDate) {
                    setDate(undefined);
                    onChange?.("");
                    return;
                }

                const selectedDate = newDate instanceof Date ? newDate : new Date(newDate);
                setDate(selectedDate);

                if (onChange && selectedDate) {
                    const formattedValue = formatDateTimeToUTC(selectedDate, time);
                    onChange(formattedValue);
                }
            },
            [onChange, time]
        );

        const handleTimeChange = useCallback(
            (newTime) => {
                setTime(newTime);

                if (onChange && date) {
                    const formattedValue = formatDateTimeToUTC(date, newTime);
                    onChange(formattedValue);
                }
            },
            [onChange, date]
        );

        useEffect(() => {
            if (!noInitialDate && !value && !initialValue && !date) {
                const defaultDate = new Date();
                setDate(defaultDate);
                if (onChange) {
                    const formattedValue = formatDateTimeToUTC(defaultDate, DEFAULT_TIME);
                    onChange(formattedValue);
                }
            }
        }, [noInitialDate, value, initialValue, date, onChange]);

        useEffect(() => {
            if (initialValue && !isInitialized) {
                if (hasValue(initialValue)) {
                    const dateValue = new Date(initialValue);
                    if (isValidDate(dateValue)) {
                        setDate(dateValue);
                        setTime(format(dateValue, "HH:mm"));
                        setIsInitialized(true);

                        if (onChange) {
                            const formattedValue = formatDateTimeToUTC(dateValue, format(dateValue, "HH:mm"));
                            onChange(formattedValue);
                        }
                    }
                }
            }
        }, [initialValue, isInitialized, onChange]);

        useEffect(() => {
            if (value) {
                // Parse UTC string "YYYY-MM-DD HH:mm:ss"
                const [datePart, timePart] = value.split(" ");
                if (datePart && timePart) {
                    const [year, month, day] = datePart.split("-").map(Number);
                    const [hours, minutes] = timePart.split(":").map(Number);
                    const dateValue = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0));
                    if (isValidDate(dateValue)) {
                        setDate(dateValue);
                        setTime(format(dateValue, "HH:mm"));
                    }
                }
            } else {
                setDate(undefined);
                setTime(DEFAULT_TIME);
            }
        }, [value]);

        const hasError = error && touched;
        const displayText = useMemo(() => {
            if (!date) {
                return placeholder || t("app.forms.selectDate");
            }
            return formatDateTimeForDisplay(date, time);
        }, [date, time, placeholder, t]);

        const buttonId = `btn_datetime_picker_single_${formatDateForDisplay(date)}`;
        const spanId = `datetimepicker_single_span_${formatDateForDisplay(date)}`;

        return (
            <div
                className={cn("grid gap-2", className)}
                id={`${idBase}_container`}
                data-testid={`${idBase}_container`}
            >
                {isTitle && (
                    <div className={`flex justify-between text-sm font-semibold ${hasError && "text-redCustom"}`}>
                        <Label className="text-sm" id={`${idBase}_label`} data-testid={`${idBase}_label`}>
                            {t("app.forms.dateRange")}
                        </Label>
                        {hasError && (
                            <span id={`${idBase}_error`} data-testid={`${idBase}_error`}>
                                {t("app.forms.required")}
                            </span>
                        )}
                    </div>
                )}
                <Popover
                    trigger={
                        <Button
                            variant="outline"
                            className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}
                            data-testid={buttonId}
                            id={buttonId}
                        >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {date ? (
                                displayText
                            ) : (
                                <span id={spanId} data-testid={spanId}>
                                    {placeholder || t("app.forms.selectDate")}
                                </span>
                            )}
                        </Button>
                    }
                    className="w-auto p-0"
                >
                    <div className="p-3">
                        <Calendar
                            initialFocus
                            mode="single"
                            defaultMonth={date}
                            selected={date}
                            onSelect={handleDateChange}
                            numberOfMonths={1}
                            locale={currentLocale}
                            ref={ref}
                            id={`${idBase}_calendar`}
                            data-testid={`${idBase}_calendar`}
                        />
                        <div className="border-t pt-3 mt-3">
                            <div className="space-y-2">
                                <Label className="text-xs flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {t("app.forms.timeFrom") || "Hora"}
                                </Label>
                                <Input
                                    type="time"
                                    value={time}
                                    onChange={(e) => handleTimeChange(e.target.value)}
                                    className="h-8"
                                />
                            </div>
                        </div>
                    </div>
                </Popover>
            </div>
        );
    }
);

DateTimePickerSingle.displayName = "DateTimePickerSingle";

DateTimePickerSingle.propTypes = {
    value: PropTypes.string,
    onChange: PropTypes.func,
    error: PropTypes.oneOfType([PropTypes.bool, PropTypes.string]),
    touched: PropTypes.bool,
    initialValue: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
    isTitle: PropTypes.bool,
    className: PropTypes.string,
    noInitialDate: PropTypes.bool,
    idBase: PropTypes.string,
    placeholder: PropTypes.string,
};

export default DateTimePickerSingle;

