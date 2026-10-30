import { forwardRef, useEffect, useState } from "react";
import { Label } from "./ui/label.jsx";
import { Switch } from "./ui/switch.jsx";
import { formatTestId } from "@/utils/src/helpers.js";

export const SwitchState = forwardRef(({ value = "", onChange }, ref) => {
    const isSwitchActive = (v) =>
        v === 1 || v === true || v === "true" || v === "1" || (typeof v === "string" && v.toLowerCase() === "t");

    const [checked, setChecked] = useState(isSwitchActive(value));

    const handleChange = (event) => {
        const newValue = event ? 1 : 0;
        onChange(newValue);
    };

    const isActive = isSwitchActive(value);
    const switchState = isActive ? "Activo" : "Inactivo";

    useEffect(() => {
        setChecked(isSwitchActive(value));
    }, [value]);

    return (
        <div className="flex items-center gap-2 border-input border p-2 rounded-md justify-between">
            <div className="flex flex-col gap-2">
                <Label>{value === "" ? "Activo/Inactivo" : switchState}</Label>
            </div>
            <Switch
                checked={checked}
                onCheckedChange={handleChange}
                ref={ref}
                id={formatTestId("switch_state", `${switchState}`)}
                data-testid={formatTestId("switch_state", `${switchState}`)}
            />
        </div>
    );
});
