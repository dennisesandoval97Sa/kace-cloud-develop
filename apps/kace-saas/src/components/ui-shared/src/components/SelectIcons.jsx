import {
    Input,
    Popover,
    PopoverContent,
    PopoverTrigger,
    Button,
    ScrollArea
} from "@kace/ui-shared"
import { forwardRef, useState } from "react"
import { PropTypes } from "prop-types"
import { cn } from "../lib/utils"

import { ICONS_SELECT } from "../icons/IconsSelect"
import { SmilePlus } from "lucide-react"
import { formatTestId } from "@/utils/src/helpers"

export const SelectIcons = forwardRef(({
    title,
    iconList = ICONS_SELECT,
    className = "",
    value,
    onChange,
    ...props
}, ref) => {
    const [selectedIcon, setSelectedIcon] = useState("")
    const [isOpen, setIsOpen] = useState(false)

    const handleIconSelect = (iconName) => {
        onChange(iconName)
        setSelectedIcon(iconName)
        setIsOpen(false)
    }

    const SelectedIconComponent =
        iconList.find((icon) => icon.name === selectedIcon)?.component || null

    return (
        <div>
            <div
                className={cn("grid grid-cols-4 gap-4 items-center", className)}
            >
                <div className="col-span-4 flex gap-2 items-center w-full">
                    <Input
                        type="text"
                        name="icon"
                        value={value}
                        onChange={(e) => setSelectedIcon(e.target.value)}
                        placeholder="Icon"
                        disabled
                        className="bg-white text-black cursor-default"
                        ref={ref}
                        {...props}
                        id={formatTestId("input_select_icon", `${value}`)}
                        data-testid={formatTestId("input_select_icon", `${value}`)}
                    />
                    <Popover open={isOpen} onOpenChange={setIsOpen}>
                        <PopoverTrigger asChild>
                            <Button
                                size="icon"
                                aria-label="Select icon"
                                type="button"
                                className="w-10 h-10 p-2"
                                variant="secondary"
                                id="btn_select_icon"
                                data-testid="btn_select_icon"
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
                                    {iconList.map((icon, index) => (
                                        <button
                                            key={index}
                                            type="button"
                                            onClick={(e) => {
                                                e.preventDefault()
                                                handleIconSelect(icon.name)
                                            }}
                                            aria-label={`Select icon ${icon.name}`}
                                            className={`w-10 h-10 m-1 border-2 flex items-center justify-center cursor-pointer ${selectedIcon === icon.name ? "border-black" : "border-transparent"
                                                }`}
                                            id={formatTestId("btn_select_icon", `${icon.name}`)}
                                            data-testid={formatTestId("btn_select_icon", `${icon.name}`)}
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
        </div>
    )
})

SelectIcons.propTypes = {
    title: PropTypes.string,
    iconList: PropTypes.array,
    className: PropTypes.string
}
