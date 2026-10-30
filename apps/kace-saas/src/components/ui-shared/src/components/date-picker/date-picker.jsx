import { format } from "date-fns"
import { CalendarIcon } from "../../icons/calendar-icon"
import { enUS, es } from "date-fns/locale"

import { cn } from "../../lib/utils"
import { Button } from "../ui/button"
import { Calendar } from "../ui/calendar"
import { Label } from "../ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover"
import { useTranslation } from "react-i18next"
import { forwardRef, useMemo, useState } from "react"
import PropTypes from "prop-types"
import { X } from "lucide-react"
import { formatTestId } from "@/utils/src/helpers"

export const DatePicker = forwardRef(
    (
        {
            value = "",
            onChange = () => { },
            label = null,
            placeholder = "Elegir fecha",
            error = null,
            errorMessage = "",
            disabled = false,
            isBirthDatePicker = false,
            nowButton = false
        },
        ref
    ) => {
        const { i18n, t } = useTranslation()
        const [langCode] = useState(i18n.language)
        const getLocale = () => {
            switch (langCode) {
                case "es":
                    return es
                case "en":
                default:
                    return enUS
            }
        }

        const birthClassNameProps = useMemo(
            () => ({
                caption_label: "hidden",
                caption_dropdowns: "flex space-x-2",
                caption_dropdown:
                    "border border-input bg-background rounded-md px-2 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            }),
            []
        )

        const defaultProps = useMemo(
            () =>
                isBirthDatePicker
                    ? {
                        captionLayout: "dropdown",
                        fromYear: 1900,
                        toYear: new Date().getFullYear()
                    }
                    : {},
            [isBirthDatePicker]
        )

        const selectedValue = useMemo(() => {
            try {
                if (value === "now") {
                    return t(`app.forms.${value}`, value)
                }
                return format(value, "PPP", { locale: getLocale() }) ?? placeholder
            } catch {
                // NO-SONAR: Se retorna el placeholder si hay un error al formatear la fecha
                return placeholder
            }
        }, [value, placeholder])

        const handleClear = (e) => {
            e.preventDefault()
            onChange("")
        }

        return (
            <div className="flex items-center justify-center gap-2">
                <div className="w-full">
                    <Popover>
                        <div className={cn("flex justify-between mb-2", error && "text-redCustom")}>
                            {label && <Label className={cn(error && "font-semibold")}>{label}</Label>}
                            {error && <Label className={cn(error && "font-semibold")}>{errorMessage}</Label>}
                        </div>
                        <div className="flex flex-row">
                            <PopoverTrigger asChild disabled={disabled}>
                                <Button
                                    variant={"outline"}
                                    className={cn(
                                        "w-full flex justify-start items-center text-left font-normal mb-4",
                                        !value && "text-muted-foreground"
                                    )}
                                    ref={ref}
                                    id="btn_date_picker"
                                    data-testid="btn_date_picker"
                                >
                                    <span className="mr-1">
                                        <CalendarIcon width={18} height={18} />
                                    </span>
                                    <span id={formatTestId("date_picker_select", `${selectedValue}`)} data-testid={formatTestId("date_picker_select", `${selectedValue}`)} >{selectedValue}</span>
                                </Button>
                            </PopoverTrigger>
                            {value && (
                                <Button variant="ghost" size="icon" className="opacity-60 hover:opacity-100" onClick={handleClear} id="btn_date_picker_clear"
                                    data-testid="btn_date_picker_clear">
                                    <X />
                                </Button>
                            )}
                        </div>
                        <PopoverContent className="w-auto p-2 flex flex-col items-center" id="date_picker_popover"
                            data-testid="date_picker_popover">
                            {nowButton && (
                                <Button type="button" size="sm" onClick={() => onChange("now")} id="date_picker_now"
                                    data-testid="date_picker_now">
                                    Now
                                </Button>
                            )}
                            <Calendar
                                id="date_picker_calendar"
                                data-testid="date_picker_calendar"
                                classNames={isBirthDatePicker ? { ...birthClassNameProps } : ""}
                                mode="single"
                                selected={value}
                                onSelect={onChange}
                                initialFocus
                                locale={getLocale()}
                                {...defaultProps}
                            />
                        </PopoverContent>
                    </Popover>
                </div>
            </div>
        )
    }
)

DatePicker.displayName = "DatePicker"

DatePicker.propTypes = {
    value: PropTypes.string,
    onChange: PropTypes.func,
    label: PropTypes.string,
    placeholder: PropTypes.string,
    error: PropTypes.string,
    errorMessage: PropTypes.string,
    disabled: PropTypes.bool,
    isBirthDatePicker: PropTypes.bool,
    nowButton: PropTypes.bool
}
