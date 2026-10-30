import {
    Button,
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
    Popover,
    PopoverContent,
    PopoverTrigger,
    GeneralLoader
} from "@kace/ui-shared"
import { cn } from "../../../components/ui-shared/src/lib/utils"
import { Check, ChevronsUpDown } from "lucide-react"
import PropTypes from "prop-types"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

const MassiveExecutionCasesSelect = ({
    placeholder = "Search ...",
    data = [],
    className = "",
    classNamePopover = "",
    handle = () => { },
    dataTestId = "combo-box",
    loading = false,
    defaultValue = ""
}) => {
    const { t } = useTranslation()
    const [open, setOpen] = useState(false)
    const [value, setValue] = useState(defaultValue)
    const [idValue, setIdValue] = useState("")
    useEffect(() => {
        setValue("")
        if (defaultValue) {
            setValue(defaultValue)
        }
    }, [data])

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                aria-expanded={open}
                                className={cn("justify-between", className)}
                                data-testid={`btn_massive_select_${dataTestId}`}
                                id={`btn_massive_select_${dataTestId}`}
                            >
                                <span className="w-28 truncate">
                                    {value ? data.find((item) => item.value === value)?.label : `${placeholder}`}
                                </span>
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>{value}</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
            <PopoverContent className={cn("max-w-[600px] p-0", classNamePopover)}>
                <Command data-testid={dataTestId} id={dataTestId}>
                    <CommandInput placeholder={placeholder} />
                    <CommandList>
                        {loading ? (
                            <div className="flex justify-center items-center p-4 h-36 w-full">
                                <GeneralLoader />
                            </div>
                        ) : (
                            <>
                                <CommandEmpty>{t("massiveExecution.form.labels.noAvailableData")}</CommandEmpty>
                                <CommandGroup>
                                    {data.map((item, index) => (
                                        <CommandItem
                                            key={index}
                                            value={item.value}
                                            onSelect={(currentValue) => {
                                                setValue(currentValue === value ? "" : currentValue)
                                                setIdValue(currentValue === value ? "" : item.id)
                                                handle(item.id)
                                                setOpen(false)
                                            }}
                                        >
                                            <Check
                                                id={`massive_select_check_${dataTestId}`}
                                                data-testid={`massive_select_check_${dataTestId}`}
                                                size={16}
                                                className={cn(
                                                    "mr-2 h-4 w-4",
                                                    idValue === item.id ? "opacity-100" : "opacity-0"
                                                )}
                                            />
                                            {item.label}
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </>
                        )}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}

MassiveExecutionCasesSelect.propTypes = {
    placeholder: PropTypes.string,
    data: PropTypes.array,
    className: PropTypes.string,
    classNamePopover: PropTypes.string,
    handle: PropTypes.func,
    dataTestId: PropTypes.string,
    loading: PropTypes.bool,
    defaultValue: PropTypes.string
}

export default MassiveExecutionCasesSelect
