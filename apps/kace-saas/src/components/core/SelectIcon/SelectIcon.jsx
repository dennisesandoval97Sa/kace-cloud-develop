import {
    Input,
    Label,
    Popover,
    PopoverContent,
    PopoverTrigger,
    Button,
    ScrollArea
} from "@kace/ui-shared"
import { useState } from "react"
import { PropTypes } from "prop-types"
import { useField } from "formik"
import LabelInput from "../ModalForm/label-input"
import { SmilePlus } from "lucide-react"

import { cn } from "../../ui-shared/src/lib/utils"
import { ICONS_SELECT } from "../../ui-shared/src/icons"
import { formatTestId } from "@/utils/src/helpers"

export const SelectIcon = ({
    title,
    iconList = ICONS_SELECT,
    className = "",
    ...props
}) => {
    const [field, meta, helpers] = useField(props)
    const [selectedIcon, setSelectedIcon] = useState(field.value)
    const [isOpen, setIsOpen] = useState(false)

    const handleIconSelect = (iconName) => {
        helpers.setValue(iconName)
        setSelectedIcon(iconName)
        setIsOpen(false)
    }

    const SelectedIconComponent =
        iconList.find((icon) => icon.name === selectedIcon)?.component || null

    return (
        < div className="w-full" >
            <div
                className={cn("grid grid-cols-4 gap-4 items-center", className)}
            >
                <div className="flex justify-between items-center w-full">
                    <LabelInput id="icon" label={title} meta={meta} data-testid={`select_icon_${title}`} />
                    {meta.touched && meta.error && (
                        <Label className="text-redCustom font-semibold">
                            {meta.error}
                        </Label>
                    )}
                </div>
                <div className="col-span-3 flex gap-2 items-center w-full relative">
                    <Input
                        type="text"
                        name="icon"
                        value={field.value}
                        onChange={(e) => setSelectedIcon(e.target.value)}
                        placeholder="Select an icon"
                        disabled
                        data-testid={`input_select_icon_${field.name}`}
                        id={`input_select_icon_${field.name}`}
                        className="disabled:text-black disabled:opacity-100 disabled:cursor-not-allowed font-semibold bg-orangeCustom placeholder:text-black"
                        {...field}
                        {...props}
                    />
                    <Popover open={isOpen} onOpenChange={setIsOpen}>
                        <PopoverTrigger asChild>
                            <Button
                                size="icon"
                                aria-label="Select icon"
                                type="button"
                                className="absolute top-0 right-0 w-full bg-transparent justify-end p-2 hover:bg-transparent text-black"
                                variant="secondary"
                                data-testid={formatTestId("btn_select_icon", `${field.value}`)}
                                id={formatTestId("btn_select_icon", `${field.value}`)}
                            >
                                {SelectedIconComponent
                                    ? (
                                        <SelectedIconComponent
                                            width={24}
                                            height={24}
                                        />
                                    )
                                    : (
                                        <SmilePlus />
                                    )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[380px] h-72">
                            <ScrollArea className="w-full h-full">
                                <div className="flex flex-wrap">
                                    {iconList.map((icon) => (
                                        <button
                                            key={icon.name}
                                            type="button"
                                            className={`w-10 h-10 m-1 cursor-pointer border-2 flex items-center justify-center ${selectedIcon === icon.name
                                                ? "border-black"
                                                : "border-transparent"
                                                }`}
                                            onClick={(e) => {
                                                e.preventDefault()
                                                handleIconSelect(icon.name)
                                            }}
                                            aria-label={`Select icon ${icon.name}`}
                                            tabIndex={0}
                                            id={formatTestId("select_icon", `${icon.name}`)}
                                            data-testid={formatTestId("select_icon", `${icon.name}`)}
                                        >
                                            <icon.component width={24} height={24} />
                                        </button>
                                    ))}
                                </div>
                            </ScrollArea>
                        </PopoverContent>
                    </Popover>
                </div>
            </div>
        </div >
    )
}

SelectIcon.propTypes = {
    title: PropTypes.string,
    iconList: PropTypes.array,
    className: PropTypes.string
}
