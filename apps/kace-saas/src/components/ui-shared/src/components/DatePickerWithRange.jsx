import { addDays, format } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { Calendar as CalendarIcon } from "lucide-react";
import { es, enUS } from "date-fns/locale";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import { Calendar } from "./ui/calendar";
import { Label } from "./ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { useEffect, useRef, useState, forwardRef } from "react";
import { useTranslation } from "react-i18next";
import PropTypes from "prop-types";

const parseCalendarDate = (value) => {
    const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return new Date(value);

    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
};

export const DatePickerWithRange = forwardRef(
    (
        {
            className,
            setValue,
            nameFrom = "",
            nameTo = "",
            value,
            errorFrom = false,
            errorTo = false,
            touchedFrom = false,
            touchedTo = false,
            initialValues = null,
            isTitle = false,
            handleUpdateDate,
            onChange,
            noInitialDate = false,
            idBase = "date_picker_with_range",
            disabled,
        },
        ref,
    ) => {
        const { t, i18n } = useTranslation();

        const [date, setDate] = useState(() => {
            if (noInitialDate) {
                return { from: undefined, to: undefined };
            }

            const defaultDate = { from: new Date(), to: addDays(new Date(), 5) };
            return defaultDate;
        });

        const localeMap = {
            es,
            en: enUS,
        };

        const currentLocale = localeMap[i18n.language] || es;

        const initializedRangeKeyRef = useRef(null);

        const handleFormatDate = (from, to) => {
            const formattedFrom = format(from, "yyyy-MM-dd'T'00:00:00.000'Z'");
            const formattedTo = to
                ? format(to, "yyyy-MM-dd'T'23:59:59.999'Z'")
                : format(from, "yyyy-MM-dd'T'23:59:59.999'Z'");

            return `${formattedFrom}, ${formattedTo}`;
        };

        const handleNewDate = (newValue) => {
            handleUpdateDate?.();
            if (!newValue) {
                setDate({ from: undefined, to: undefined });

                setValue?.(nameFrom, "");
                setValue?.(nameTo, "");

                onChange?.("");
                return;
            }

            const from = newValue.from;
            const to = newValue.to;

            const valueFrom = from instanceof Date ? from : from ? new Date(from) : "";
            const valueTo = to instanceof Date ? to : to ? new Date(to) : "";

            setValue?.(nameFrom, valueFrom);
            setValue?.(nameTo, valueTo);
            setDate(newValue);

            if (onChange) {
                const dateRangeString = handleFormatDate(from, to);
                onChange(dateRangeString);
            }
        };

        useEffect(() => {
            if (!noInitialDate && !value && !initialValues) {
                const defaultFrom = new Date();
                const defaultTo = addDays(new Date(), 5);

                setValue?.(nameFrom, defaultFrom);
                setValue?.(nameTo, defaultTo);
            }
        }, [noInitialDate, value, initialValues, setValue, nameFrom, nameTo]);

        useEffect(() => {
            if (!initialValues) {
                initializedRangeKeyRef.current = null;
                return;
            }

            const hasFrom =
                initialValues[0] !== undefined && initialValues[0] !== null && String(initialValues[0]).length > 0;
            const hasTo =
                initialValues[1] !== undefined && initialValues[1] !== null && String(initialValues[1]).length > 0;

            if (!hasFrom && !hasTo) {
                initializedRangeKeyRef.current = null;
                return;
            }

            const rangeKey = initialValues
                .map((initialValue) => {
                    if (initialValue instanceof Date && !Number.isNaN(initialValue.getTime())) {
                        return initialValue.getTime();
                    }

                    return String(initialValue ?? "");
                })
                .join("|");

            if (initializedRangeKeyRef.current !== rangeKey) {
                setDate({
                    from: hasFrom ? new Date(initialValues[0]) : undefined,
                    to: hasTo ? new Date(initialValues[1]) : undefined,
                });
                initializedRangeKeyRef.current = rangeKey;
            }
        }, [initialValues]);

        useEffect(() => {
            if (value === undefined || value === null) {
                if (!initialValues) {
                    setDate({ from: undefined, to: undefined });
                }
                return;
            }

            if (value) {
                const [from, to] = value.split(", ");

                setDate({
                    from: parseCalendarDate(from),
                    to: parseCalendarDate(to),
                });
            } else {
                setDate({ from: undefined, to: undefined });
            }
        }, [value, initialValues]);

        const safeFormat = (date) => (date instanceof Date && !isNaN(date) ? format(date, "yyyy-MM-dd") : "no_date");

        return (
            <div className={cn("grid gap-2", className)} id={`${idBase}_container`} data-testid={`${idBase}_container`}>
                {isTitle && (
                    <div
                        className={`flex justify-between text-sm font-semibold ${(errorFrom || errorTo) && (touchedFrom || touchedTo) && "text-redCustom"}`}
                    >
                        <Label className="text-sm" id={`${idBase}_label`} data-testid={`${idBase}_label`}>
                            {t("app.forms.dateRange")}
                        </Label>
                        {(errorFrom || errorTo) && (touchedFrom || touchedTo) && (
                            <span id={`${idBase}_error`} data-testid={`${idBase}_error`}>
                                {t("app.forms.required")}
                            </span>
                        )}
                    </div>
                )}
                <Popover>
                    <PopoverTrigger asChild>
                        <Button
                            variant={"outline"}
                            className={cn(
                                "w-full justify-start text-left font-normal",
                                !date?.from && "text-muted-foreground",
                            )}
                            data-testid={`btn_date_picker_with_range_${safeFormat(date?.from)}_${safeFormat(date?.to)}`}
                            id={`btn_date_picker_with_range_${safeFormat(date?.from)}_${safeFormat(date?.to)}`}
                        >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {date?.from ? (
                                date.to ? (
                                    <>
                                        {formatInTimeZone(
                                            format(date.from, "yyyy-MM-dd'T'00:00:00.000'Z'"),
                                            "UTC",
                                            "LLL dd, y",
                                        )}{" "}
                                        -{" "}
                                        {formatInTimeZone(
                                            format(date.to, "yyyy-MM-dd'T'00:00:00.000'Z'"),
                                            "UTC",
                                            "LLL dd, y",
                                        )}
                                    </>
                                ) : (
                                    formatInTimeZone(
                                        format(date.from, "yyyy-MM-dd'T'00:00:00.000'Z'"),
                                        "UTC",
                                        "LLL dd, y",
                                    )
                                )
                            ) : (
                                <span
                                    id={`datepicker_span_${safeFormat(date?.from)}_${safeFormat(date?.to)}`}
                                    data-testid={`datepicker_span_${safeFormat(date?.from)}_${safeFormat(date?.to)}`}
                                >
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
                    </PopoverContent>
                </Popover>
            </div>
        );
    },
);

DatePickerWithRange.propTypes = {
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
    disabled: PropTypes.oneOfType([
        PropTypes.bool,
        PropTypes.func,
        PropTypes.arrayOf(PropTypes.instanceOf(Date)),
        PropTypes.object,
    ]),
};

DatePickerWithRange.displayName = "DatePickerWithRange";
