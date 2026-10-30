import { Input, Label, Popover, PopoverContent, PopoverTrigger, Button } from "@kace/ui-shared";
import { useEffect, useState } from "react";
import { PropTypes } from "prop-types";
import { useField } from "formik";
import LabelInput from "../ModalForm/label-input";
import { COLORS } from "@kace/utils";
import { Palette } from "lucide-react";
import { cn } from "../../ui-shared";

export const SelectColor = ({ title, colors = COLORS, className = "", ...props }) => {
    const [field, meta, helpers] = useField(props);
    const [selectedColor, setSelectedColor] = useState("#2A9D90");
    const [isOpen, setIsOpen] = useState(false);

    const handleColorSelect = (color) => {
        helpers.setValue(color);
        setSelectedColor(color);
        setIsOpen(false);
    };

    useEffect(() => {
        if (field.value) {
            setSelectedColor(field.value);
        }
    }, [field.value]);

    return (
        <div className="w-full">
            <div className={cn("grid grid-cols-4 gap-4 items-center", className)}>
                <div className="flex justify-between items-center w-full">
                    <LabelInput id="color" label={title} meta={meta} data-testid={`select_color_${title}`} />
                    {meta.touched && meta.error && <Label className="text-redCustom font-semibold">{meta.error}</Label>}
                </div>
                <div className="col-span-3 flex gap-2 items-center w-full relative">
                    <Input
                        type="text"
                        id={`input_select_color_${field.name}`}
                        name="color"
                        value={field.value}
                        onChange={(e) => setSelectedColor(e.target.value)}
                        placeholder="Select a color"
                        disabled
                        data-testid={`input_select_color_${field.name}`}
                        className="disabled:text-black disabled:opacity-100 disabled:cursor-not-allowed font-semibold placeholder:text-black"
                        style={{ backgroundColor: selectedColor }}
                        {...field}
                        {...props}
                    />
                    <Popover open={isOpen} onOpenChange={setIsOpen}>
                        <PopoverTrigger asChild>
                            <Button
                                size="icon"
                                aria-label="Select color"
                                type="button"
                                className="absolute top-0 right-0 w-full bg-transparent justify-end p-2 hover:bg-transparent text-black"
                                data-testid={`btn_select_color_${field.value}`}
                                id={`btn_select_color_${field.value}`}
                                variant="secondary"
                            >
                                <Palette id="icon_palet_select_color" data-testid="icon_palet_select_color" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[228px]">
                            <div
                                className="flex flex-wrap"
                                data-testid={`pallette_colors_${field.name}`}
                                id={`pallette_colors_${field.name}`}
                            >
                                {colors.map((color, index) => (
                                    <button
                                        key={index}
                                        type="button"
                                        className={`w-10 h-10 m-1 cursor-pointer border-2 ${selectedColor === color
                                            ? "border-black"
                                            : "border-transparent"
                                            }`}
                                        style={{ backgroundColor: color }}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            handleColorSelect(color);
                                        }}
                                        aria-label={`Select color ${color}`}
                                        data-testid={`btn_select_content_color_${color}`}
                                        id={`btn_select_content_color_${color}`}
                                        tabIndex={0}
                                    />
                                ))}
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>
            </div>
        </div>
    );
};

SelectColor.propTypes = {
    title: PropTypes.string,
    colors: PropTypes.array,
    className: PropTypes.string,
};
