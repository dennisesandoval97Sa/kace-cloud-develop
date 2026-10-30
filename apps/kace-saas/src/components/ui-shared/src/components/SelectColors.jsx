import {
    Popover,
    PopoverContent,
    PopoverTrigger
} from "./ui/popover"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { forwardRef, useEffect, useState } from "react"
import { PropTypes } from "prop-types"
import { cn } from "../lib/utils"
import { COLORS } from "@kace/utils"
import { Palette } from "lucide-react"


export const SelectColors = forwardRef(
    ({ title, className = "", value, onChange, ...props }, ref) => {
        const [selectedColor, setSelectedColor] = useState("#afafb0")
        const [isOpen, setIsOpen] = useState(false)

        const handleColorSelect = (color) => {
            onChange(color)
            setIsOpen(false)
        }

        useEffect(() => {
            if (value) {
                setSelectedColor(value)
            }
        }, [value])

        return (
            <div>
                <div
                    className={cn(
                        "grid grid-cols-4 gap-4 items-center",
                        className
                    )}
                >
                    <div className="col-span-4 flex gap-2 items-center w-full relative">
                        <Input
                            type="text"
                            id="color"
                            name="color"
                            value={value}
                            onChange={(e) => setSelectedColor(e.target.value)}
                            placeholder="Color"
                            disabled
                            style={{ backgroundColor: selectedColor }}
                            className="disabled:text-black disabled:opacity-100 disabled:cursor-not-allowed font-semibold placeholder:text-black"
                            ref={ref}
                            {...props}
                        />
                        <Popover open={isOpen} onOpenChange={setIsOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                    size="icon"
                                    aria-label="Select color"
                                    type="button"
                                    className="absolute top-0 right-0 w-full bg-transparent justify-end p-2 hover:bg-transparent text-black"
                                    variant="secondary"
                                    data-testid={`btn_open_select_${props.id}`}
                                    id={`btn_open_select_${props.id}`}
                                >
                                    <Palette />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[228px]">
                                <div className="flex flex-wrap">
                                    {COLORS.map((color, index) => (
                                        <button
                                            key={index}
                                            type="button"
                                            className={`w-10 h-10 m-1 cursor-pointer border-2 ${selectedColor === color ? "border-black" : "border-transparent"
                                                }`}
                                            style={{ backgroundColor: color }}
                                            onClick={(e) => {
                                                e.preventDefault()
                                                handleColorSelect(color)
                                            }}
                                            aria-label={`Select color ${color}`}
                                            id={`btn_select_color_${color}`}
                                            data-testid={`btn_select_color_${color}`}
                                            tabIndex={0}
                                        />
                                    ))}
                                </div>
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>
            </div>
        )
    }
)

SelectColors.propTypes = {
    title: PropTypes.string,
    colors: PropTypes.array,
    className: PropTypes.string
}
