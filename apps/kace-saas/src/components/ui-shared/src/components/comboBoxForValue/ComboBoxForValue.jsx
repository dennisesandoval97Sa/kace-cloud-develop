import { Check, ChevronsUpDown, FilterX, X } from "lucide-react"

import { cn } from "../../lib/utils"
import { Button } from "../ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover"
import { forwardRef, useEffect, useState } from "react"
import { SearchForField } from "./SearchForField"
import { GeneralLoader } from "../general-loader"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { USER_SERVICE } from "@kace/utils"
import { ScrollArea } from "../ui/scroll-area"
import { TextNotFilters } from "./TextNotFilters"
import { LoaderThreeDots } from "../LoaderThreeDots"
import { genericSearchService } from "../../../../../services/genericSearchService"
import { genericView } from "../../../../../services/genericView"
import { useTranslation } from "react-i18next"

export const ComboBoxForValue = forwardRef(
    ({ className = "", value, onChange }, ref) => {
        const [open, setOpen] = useState(false)
        const [textPageEmpty, setTextPageEmpty] = useState(null)
        const [options, setOptions] = useState([])
        const [userValue, setUserValue] = useState(null)
        const [selectedField, setSelectedField] = useState(null)
        const [filters, setFilters] = useState([])
        const {
            data: dataSearchUser,
            isLoading
        } = useQuery({
            queryKey: ["searchUserToFilter", filters],
            queryFn: async () =>
                genericSearchService(`${USER_SERVICE}/search`, [], {
                    filter: filters,
                    limit: 0,
                    offset: 0
                }),
            staleTime: 1000 * 60 * 60 * 24,
            enabled: filters.length > 0
        })

        const { t } = useTranslation()

        const {
            data: dataSearchUserValue,
            isLoading: isLoadingToUserValue
        } = useQuery({
            queryKey: ["searchUserToUserValue", value],
            queryFn: async () =>
                genericView(`${USER_SERVICE}/${value}`),
            staleTime: 1000 * 60 * 60 * 24,
            enabled: !!value
        })

        const handleSearchUser = () => {
            if (selectedField && userValue) {
                if (selectedField === "nombres") {
                    setFilters(() => [
                        ...["nombres", "apellido1", "apellido2"].map((item) => ({
                            field: item,
                            operator: "ilike",
                            value: userValue,
                            type: "OR"
                        })),
                        {
                            field: "deleted_at",
                            operator: "null",
                            value: "null",
                            type: "AND"
                        }
                    ])
                } else {
                    setFilters(() => [
                        {
                            field: selectedField,
                            operator: "like",
                            value: userValue,
                            type: "AND"
                        }
                    ])
                }
            } else {
                toast.warning("Debe ingresar un valor y un campo a buscar")
            }
        }

        useEffect(() => {
            if (dataSearchUser && selectedField && userValue) {
                const { data } = dataSearchUser
                if (data.length === 0) {
                    setTextPageEmpty("No se encontraron resultados")
                    setOptions([])
                    return
                }
                const listUsers = data.map((user) => {
                    return {
                        value: user.id,
                        label: `${user.nombres} ${user.apellido1} ${user.apellido2 || ""}`
                    }
                })
                onChange("")
                setSelectedField(null)
                setOptions(listUsers)
            }
        }, [dataSearchUser])

        useEffect(() => {
            if (value && !selectedField && !userValue) {
                setUserValue(value)
            }
        }, [value])

        useEffect(() => {
            if (dataSearchUserValue) {
                const listUsers = [{
                    value: dataSearchUserValue.id,
                    label: `${dataSearchUserValue.nombres} ${dataSearchUserValue.apellido1} ${dataSearchUserValue.apellido2 || ""}`
                }]
                onChange(dataSearchUserValue.id)
                setSelectedField(null)
                setOptions(listUsers)
            }
        }, [dataSearchUserValue])

        return (
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        aria-expanded={open}
                        className="w-full justify-between"
                        disabled={isLoading}
                        ref={ref}
                        id={`comboBox_value_${value || "empty"}`}
                        data-testid={`comboBox_value_${value || "empty"}`}
                    >
                        {isLoading || isLoadingToUserValue ? (
                            <LoaderThreeDots />
                        ) : value ? (
                            options.find((user) => user.value === value)?.label
                        ) : (
                            t("generalSetup.form.labels.selectAUser")
                        )}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[280px] p-0" side="top">
                    <div className="flex flex-col gap-2 p-2">
                        <SearchForField
                            setUserValue={setUserValue}
                            setSelectedField={setSelectedField}
                            handleSearchUser={handleSearchUser}
                        />
                        {isLoading
                            ? (
                                <div className="flex justify-center items-center p-4 h-36 w-full">
                                    <GeneralLoader />
                                </div>
                            )
                            : options.length === 0
                                ? (
                                    <div className="p-4">
                                        <p>
                                            {textPageEmpty
                                                ? (
                                                    <div className="flex flex-col gap-2 justify-center items-center">
                                                        <FilterX size={30} />
                                                        <span className="text-sm" id={`combobox_span_${textPageEmpty}`} data-testid={`combobox_span_${textPageEmpty}`}>
                                                            {textPageEmpty}
                                                        </span>
                                                    </div>
                                                )
                                                : (
                                                    <TextNotFilters />
                                                )}
                                        </p>
                                    </div>
                                )
                                : (
                                    <ScrollArea
                                        className={cn(
                                            "w-full rounded-md border p-2",
                                            options.length > 5 ? "h-72" : "h-auto"
                                        )}
                                    >
                                        {options.map((user) => (
                                            <div className="flex justify-between items-center relative" key={user.value}>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        onChange(user.value)
                                                        setOpen(false)
                                                    }}
                                                    className="flex items-center rounded-md cursor-pointer px-2 py-1 w-full"
                                                    aria-label={`Select ${user.label}`}
                                                    id={`comboBox_item_${user.value}`}
                                                    data-testid={`comboBox_item_${user.value}`}
                                                >
                                                    <Check
                                                        className={cn(
                                                            "h-4 w-4",
                                                            value === user.value
                                                                ? "opacity-100"
                                                                : "opacity-0"
                                                        )}
                                                        id={`comboBox_check_${user.value}`}
                                                        data-testid={`comboBox_check_${user.value}`}
                                                    />
                                                    {user.label}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (value === user.value) {
                                                            onChange("")
                                                        }
                                                    }}
                                                    className="cursor-pointer absolute right-1 top-1.5 hover:bg-redCustom rounded-full p-1"
                                                    aria-label="Remove user"
                                                    id={`btn_comboBox_delete_${user.value}`}
                                                    data-testid={`btn_comboBox_delete_${user.value}`}
                                                >
                                                    <X height={18} width={18} id="btn_comboBox" data-testid="btn_comboBox" />
                                                </button>
                                            </div>
                                        ))}
                                    </ScrollArea>
                                )}
                    </div>
                </PopoverContent>
            </Popover>
        )
    }
)
