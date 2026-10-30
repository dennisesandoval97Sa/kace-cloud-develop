import { addDays, format, set } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { Calendar as CalendarIcon, Clock } from "lucide-react";
import { es, enUS } from "date-fns/locale";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import { Calendar } from "./ui/calendar";
import { Label } from "./ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Input } from "./ui/input";
import { useEffect, useState, forwardRef, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import PropTypes from "prop-types";

const LOCALE_MAP = {
    es,
    en: enUS,
};

const DEFAULT_TIME_FROM = "00:00";
const DEFAULT_TIME_TO = "23:59";
const DEFAULT_DAYS_AHEAD = 5;

const isValidDate = (date) => date instanceof Date && !isNaN(date);

const hasValue = (val) => val !== undefined && val !== null && String(val).length > 0;

const formatDateForDisplay = (date) => (isValidDate(date) ? format(date, "yyyy-MM-dd") : "no_date");

const formatDateTimeForDisplay = (date, time) =>
    `${formatInTimeZone(format(date, "yyyy-MM-dd'T'00:00:00.000'Z'"), "UTC", "LLL dd, y")} ${time}`;

export const DateTimePickerWithRange = forwardRef(
    (
        {
            className,
            setValue,
            nameFrom = "",
            nameTo = "",
            value = null,
            errorFrom = false,
            errorTo = false,
            touchedFrom = false,
            touchedTo = false,
            initialValues = null,
            isTitle = false,
            handleUpdateDate,
            onChange,
            noInitialDate = false,
            idBase = "datetime_picker_with_range",
            setDateRange = null,
            disabled = undefined,
        },
        ref,
    ) => {
        const { t, i18n } = useTranslation();

        const [date, setDate] = useState(() => {
            if (noInitialDate) {
                return { from: undefined, to: undefined };
            }
            return { from: new Date(), to: addDays(new Date(), DEFAULT_DAYS_AHEAD) };
        });

        const [timeFrom, setTimeFrom] = useState(DEFAULT_TIME_FROM);
        const [timeTo, setTimeTo] = useState(DEFAULT_TIME_TO);
        const [isInitialized, setIsInitialized] = useState(false);

        const currentLocale = useMemo(() => LOCALE_MAP[i18n.language] || es, [i18n.language]);

        const formatDateTime = useCallback((from, to, timeFromStr, timeToStr) => {
            const [hoursFrom, minutesFrom] = timeFromStr.split(":").map(Number);
            const [hoursTo, minutesTo] = timeToStr.split(":").map(Number);

            const fromDate = set(from, {
                hours: hoursFrom,
                minutes: minutesFrom,
                seconds: 0,
                milliseconds: 0,
            });

            const baseToDate = to || from;
            const toDate = set(baseToDate, {
                hours: hoursTo,
                minutes: minutesTo,
                seconds: 59,
                milliseconds: 999,
            });

            return `${fromDate.toISOString()}, ${toDate.toISOString()}`;
        }, []);

        const handleNewDate = useCallback(
            (newValue) => {
                handleUpdateDate?.();

                if (!newValue) {
                    setDate({ from: undefined, to: undefined });
                    setValue?.(nameFrom, "");
                    setValue?.(nameTo, "");
                    onChange?.("");
                    return;
                }

                const { from, to } = newValue;

                const [hoursFrom, minutesFrom] = timeFrom.split(":").map(Number);
                const [hoursTo, minutesTo] = timeTo.split(":").map(Number);

                const valueFrom =
                    from instanceof Date
                        ? set(from, { hours: hoursFrom, minutes: minutesFrom, seconds: 0, milliseconds: 0 })
                        : from
                          ? new Date(from)
                          : "";
                const valueTo =
                    to instanceof Date
                        ? set(to, { hours: hoursTo, minutes: minutesTo, seconds: 59, milliseconds: 999 })
                        : to
                          ? new Date(to)
                          : "";

                setValue?.(nameFrom, valueFrom);
                setValue?.(nameTo, valueTo);
                setDate(newValue);

                if (onChange && from) {
                    const dateRangeString = formatDateTime(from, to || from, timeFrom, timeTo);
                    onChange(dateRangeString);
                }
            },
            [nameFrom, nameTo, setValue, onChange, handleUpdateDate, formatDateTime, timeFrom, timeTo],
        );

        const handleTimeChange = useCallback(
            (type, newTime) => {
                if (type === "from") {
                    setTimeFrom(newTime);
                } else {
                    setTimeTo(newTime);
                }

                const newDateFrom = date?.from
                    ? set(date.from, {
                          hours: parseInt(newTime.split(":")[0]),
                          minutes: parseInt(newTime.split(":")[1]),
                          seconds: 0,
                          milliseconds: 0,
                      })
                    : null;

                const newDateTo = date?.to
                    ? set(date.to, {
                          hours: parseInt(newTime.split(":")[0]),
                          minutes: parseInt(newTime.split(":")[1]),
                          seconds: type === "to" ? 59 : 0,
                          milliseconds: type === "to" ? 999 : 0,
                      })
                    : null;

                if (type === "from" && newDateFrom) {
                    setValue?.(nameFrom, newDateFrom);
                    setDateRange?.((prev) => ({ ...prev, from: newDateFrom }));
                } else if (type === "to" && newDateTo) {
                    setValue?.(nameTo, newDateTo);
                    setDateRange?.((prev) => ({ ...prev, to: newDateTo }));
                }

                if (onChange && date?.from) {
                    const dateRangeString = formatDateTime(
                        date.from,
                        date.to || date.from,
                        type === "from" ? newTime : timeFrom,
                        type === "to" ? newTime : timeTo,
                    );
                    onChange(dateRangeString);
                }
            },
            [onChange, date, formatDateTime, timeFrom, timeTo, nameFrom, nameTo, setValue, setDateRange],
        );

        useEffect(() => {
            if (!noInitialDate && !value && !initialValues) {
                const defaultFrom = new Date();
                const defaultTo = addDays(new Date(), DEFAULT_DAYS_AHEAD);
                setValue?.(nameFrom, defaultFrom);
                setValue?.(nameTo, defaultTo);
            }
        }, [noInitialDate, value, initialValues, setValue, nameFrom, nameTo]);

        useEffect(() => {
            if (initialValues && !isInitialized) {
                const hasFrom = hasValue(initialValues[0]);
                const hasTo = hasValue(initialValues[1]);

                if (hasFrom || hasTo) {
                    const fromDate = hasFrom ? new Date(initialValues[0]) : undefined;
                    const toDate = hasTo ? new Date(initialValues[1]) : undefined;

                    setDate({ from: fromDate, to: toDate });

                    if (fromDate) {
                        setTimeFrom(format(fromDate, "HH:mm"));
                    }
                    if (toDate) {
                        setTimeTo(format(toDate, "HH:mm"));
                    }

                    setIsInitialized(true);
                }
            }
        }, [initialValues, isInitialized]);

        useEffect(() => {
            if (value) {
                const [from, to] = value.split(", ");
                const fromDate = new Date(from);
                const toDate = new Date(to);

                setDate({ from: fromDate, to: toDate });
                setTimeFrom(format(fromDate, "HH:mm"));
                setTimeTo(format(toDate, "HH:mm"));
            } else {
                setDate({ from: undefined, to: undefined });
                setTimeFrom(DEFAULT_TIME_FROM);
                setTimeTo(DEFAULT_TIME_TO);
            }
        }, [value]);

        const hasError = (errorFrom || errorTo) && (touchedFrom || touchedTo);
        const displayText = useMemo(() => {
            if (!date?.from) {
                return t("app.forms.selectDate");
            }

            if (date.to) {
                return (
                    <>
                        {formatDateTimeForDisplay(date.from, timeFrom)} - {formatDateTimeForDisplay(date.to, timeTo)}
                    </>
                );
            }

            return formatDateTimeForDisplay(date.from, timeFrom);
        }, [date, timeFrom, timeTo, t]);

        const buttonId = `btn_datetime_picker_with_range_${formatDateForDisplay(date?.from)}_${formatDateForDisplay(date?.to)}`;
        const spanId = `datetimepicker_span_${formatDateForDisplay(date?.from)}_${formatDateForDisplay(date?.to)}`;

        return (
            <div className={cn("grid gap-2", className)} id={`${idBase}_container`} data-testid={`${idBase}_container`}>
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
                <Popover>
                    <PopoverTrigger asChild>
                        <Button
                            variant="outline"
                            className={cn(
                                "w-full justify-start text-left font-normal",
                                !date?.from && "text-muted-foreground",
                            )}
                            data-testid={buttonId}
                            id={buttonId}
                        >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {date?.from ? (
                                displayText
                            ) : (
                                <span id={spanId} data-testid={spanId}>
                                    {t("app.forms.selectDate")}
                                </span>
                            )}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent
                        className="w-auto p-0"
                        align="start"
                        id={`${idBase}_popover_content`}
                        data-testid={`${idBase}_popover_content`}
                    >
                        <div className="p-3">
                            <Calendar
                                initialFocus
                                mode="range"
                                defaultMonth={date?.from}
                                selected={date}
                                onSelect={handleNewDate}
                                numberOfMonths={2}
                                locale={currentLocale}
                                ref={ref}
                                id={`${idBase}_calendar`}
                                data-testid={`${idBase}_calendar`}
                                disabled={disabled}
                            />
                            <div className="border-t pt-3 mt-3">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-2">
                                        <Label className="text-xs flex items-center gap-1">
                                            <Clock className="h-3 w-3" />
                                            {t("app.forms.timeFrom") || "Hora desde"}
                                        </Label>
                                        <Input
                                            type="time"
                                            value={timeFrom}
                                            onChange={(e) => handleTimeChange("from", e.target.value)}
                                            className="h-8"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs flex items-center gap-1">
                                            <Clock className="h-3 w-3" />
                                            {t("app.forms.timeTo") || "Hora hasta"}
                                        </Label>
                                        <Input
                                            type="time"
                                            value={timeTo}
                                            onChange={(e) => handleTimeChange("to", e.target.value)}
                                            className="h-8"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </PopoverContent>
                </Popover>
            </div>
        );
    },
);

DateTimePickerWithRange.propTypes = {
    setValue: PropTypes.func,
    nameFrom: PropTypes.string,
    nameTo: PropTypes.string,
    value: PropTypes.string,
    errorFrom: PropTypes.oneOfType([PropTypes.bool, PropTypes.string]),
    errorTo: PropTypes.oneOfType([PropTypes.bool, PropTypes.string]),
    touchedFrom: PropTypes.bool,
    touchedTo: PropTypes.bool,
    initialValues: PropTypes.array,
    isTitle: PropTypes.bool,
    handleUpdateDate: PropTypes.func,
    onChange: PropTypes.func,
    className: PropTypes.string,
    noInitialDate: PropTypes.bool,
    idBase: PropTypes.string,
};

DateTimePickerWithRange.displayName = "DateTimePickerWithRange";
