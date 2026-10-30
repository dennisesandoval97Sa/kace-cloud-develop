import { ToggleGroup, ToggleGroupItem } from "@kace/ui-shared";
import PropTypes from "prop-types";
import { useEffect } from "react";
import { formatTestId } from "@/utils/src/helpers"

export const TogglesSelectColumnsComponent = ({
    currentHeaders = [],
    setColumnsSelected,
    columnsSelected,
    moduleObject,
}) => {
    useEffect(() => {
        const defaultSelected = currentHeaders
            .map((item) => item.value);
        setColumnsSelected(defaultSelected);
    }, [currentHeaders]);
    const color = `${moduleObject.color}/50`;
    const colorText = `${moduleObject.textColor}`;
    return (
        <ToggleGroup
            type="multiple"
            className="flex flex-wrap gap-2"
            value={columnsSelected}
            onValueChange={(value) => setColumnsSelected(value)}
            id="toggle_multiple_select_columns"
            data-testid="toggle_multiple_select_columns"

        >
            {currentHeaders.map((item) => (
                <ToggleGroupItem
                    value={item.value}
                    key={item.value}
                    className={`data-[state=on]:${color} data-[state=on]:${colorText} flex gap-2 hover:bg-grayCustom border border-input min-w-32`}
                    data-testid={formatTestId("toggle_select_item", `${item.value}`)}
                    id={formatTestId("toggle_select_item", `${item.value}`)}
                >
                    {item.label}
                </ToggleGroupItem>
            ))}
        </ToggleGroup>
    );
};

TogglesSelectColumnsComponent.propTypes = {
    currentHeaders: PropTypes.array,
    setColumnsSelected: PropTypes.func,
    columnsSelected: PropTypes.array,
    moduleObject: PropTypes.object,
};
