import React, { useMemo } from "react";
import PropTypes from "prop-types";
import { SmilePlus } from "lucide-react";
import Button from "@kace_v2/shared/ui/atoms/Button";
import { cn } from "@kace_v2/shared/utils/cn.util";
import Popover from "@kace_v2/shared/ui/molecules/Popover";
import { ICONS_SELECT } from "@kace_v2/shared/constants/iconsSelect.constants";
import Label from "@kace_v2/shared/ui/atoms/Label";
import { formatTestId } from "@kace_v2/shared/utils/format-test-id.util";

const SelectIconField = ({
    className,
    label,
    error,
    iconList = ICONS_SELECT,
    selectedIconName,
    onSelect = () => {},
}) => {
    const selectedIcon = useMemo(() => {
        if (!selectedIconName) return <SmilePlus />;
        const icon = ICONS_SELECT.find((icon) => icon.name === selectedIconName);
        return <icon.component />;
    }, [selectedIconName]);
    return (
        <div
            className={cn("flex items-center gap-2 border-input border p-4 rounded-md justify-between", {
                "border-red-500": error,
            })}
        >
            <div className="flex flex-col w-full justify-between items-start gap-2">
                <Label
                    className={cn("flex justify-end font-semibold", { "text-red-500 font-semibold": error })}
                    data-testid={formatTestId("input-field", label)}
                >
                    {label}
                </Label>
                {error && (
                    <Label
                        className="text-right text-red-500 font-semibold"
                        data-testid={formatTestId("input-field-error", label)}
                    >
                        {error}
                    </Label>
                )}
            </div>
            <Popover
                className={cn("w-[380px] h-72 flex flex-wrap gap-2 overflow-auto", className)}
                trigger={
                    <Button size="icon" type="button">
                        {selectedIcon}
                    </Button>
                }
            >
                {iconList.map((icon) => (
                    <Button
                        key={icon.name}
                        type="button"
                        size="icon"
                        variant="outline"
                        className={cn("", { "border-black": selectedIconName === icon.name })}
                        onClick={() => onSelect(icon.name)}
                    >
                        <icon.component width={24} height={24} />
                    </Button>
                ))}
            </Popover>
        </div>
    );
};

SelectIconField.propTypes = {
    className: PropTypes.string,
    label: PropTypes.string,
    error: PropTypes.string,
    iconList: PropTypes.array,
    selectedIconName: PropTypes.string,
    onSelect: PropTypes.func,
    children: PropTypes.node,
};

export default SelectIconField;
