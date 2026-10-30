import React from "react";
import PropTypes from "prop-types";
import InputField from "@kace_v2/shared/ui/molecules/InputField";
import SwitchField from "@kace_v2/shared/ui/molecules/SwitchField";
import { DatePickerWithRange } from "@kace/ui-shared";
import { es } from "date-fns/locale";
import FieldWrapper from "@kace_v2/shared/ui/molecules/FieldWrapper";
import Switch from "@kace_v2/shared/ui/atoms/Switch";
import { cn } from "@kace_v2/shared/utils/cn.util";
import { unifiedStatusBadgeInlineStyle } from "@kace_v2/features/boards/utils/boardStatusColumn.util";

/*
 * El formulario guarda el filtro ya construido por filterBuilder, no el texto
 * que escribio el usuario. Para poder repintar el input hay que sacar el valor
 * crudo de vuelta: `displayValue` cuando existe (campos aux_, donde `value` es
 * el JSON del jsonContains) y `value.value` en el resto.
 */
const extractRawValue = (value) => {
    if (value === null || value === undefined) return value;
    if (typeof value !== "object") return value;
    if (value.displayValue !== undefined) return value.displayValue;
    return value.value;
};

const DynamicInput = ({ type, value, label, onChange, booleanActiveLabel, booleanInactiveLabel }) => {
    const rawValue = extractRawValue(value);

    switch (type) {
        case "number":
            return (
                <InputField
                    label={label}
                    type="number"
                    value={rawValue ?? ""}
                    /*
                     * Un campo vacio es "sin filtro", no "cero": con el input ya
                     * controlado, `Number("")` devolvia 0 y lo repintaba, dejando
                     * el filtro numerico imposible de quitar desde el modal.
                     * sanitizeFilterFormValues descarta luego el "" .
                     */
                    onChange={(e) => {
                        const raw = e.target.value;
                        onChange(raw === "" ? "" : Number(raw));
                    }}
                    placeholder="Escribe un número..."
                />
            );

        case "boolean": {
            let checked = false;
            let isUnset = true;
            if (value !== null && value !== undefined && typeof value === "object" && "value" in value) {
                isUnset = false;
                checked = Boolean(value.value);
            } else if (typeof value === "boolean") {
                isUnset = false;
                checked = value;
            }
            const hasStatusLabels =
                typeof booleanActiveLabel === "string" &&
                booleanActiveLabel.length > 0 &&
                typeof booleanInactiveLabel === "string" &&
                booleanInactiveLabel.length > 0;
            if (hasStatusLabels) {
                return (
                    <div className={cn("flex w-full items-center gap-3 rounded-md border border-input p-4")}>
                        <span className="min-w-0 flex-1 font-semibold text-foreground">{label}</span>
                        <div className="flex shrink-0 items-center gap-2">
                            {!isUnset ? (
                                <span style={unifiedStatusBadgeInlineStyle(checked)}>
                                    {checked ? booleanActiveLabel : booleanInactiveLabel}
                                </span>
                            ) : null}
                            <Switch className="shrink-0" checked={checked} onCheckedChange={(v) => onChange(v)} />
                        </div>
                    </div>
                );
            }
            return <SwitchField label={label} checked={checked} onCheckedChange={(v) => onChange(v)} />;
        }

        case "date":
            return (
                <FieldWrapper label={label}>
                    <DatePickerWithRange
                        label={label}
                        value={typeof rawValue === "string" && rawValue ? rawValue : null}
                        onChange={onChange}
                        locale={es}
                        noInitialDate
                        className="w-full"
                    />
                </FieldWrapper>
            );

        case "object":
            return (
                <textarea
                    value={JSON.stringify(rawValue || {}, null, 2)}
                    onChange={(e) => {
                        try {
                            const parsed = JSON.parse(e.target.value);
                            onChange(parsed);
                        } catch {
                            onChange(e.target.value); // texto temporal si no es JSON válido
                        }
                    }}
                    placeholder="Introduce un objeto JSON..."
                    rows={5}
                    style={{ width: "100%" }}
                />
            );

        default:
            return (
                <InputField
                    label={label}
                    type="text"
                    value={rawValue ?? ""}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder="Escribe un texto..."
                />
            );
    }
};

DynamicInput.propTypes = {
    type: PropTypes.oneOf(["string", "number", "boolean", "date", "object"]),
    value: PropTypes.any,
    label: PropTypes.string,
    onChange: PropTypes.func,
    booleanActiveLabel: PropTypes.string,
    booleanInactiveLabel: PropTypes.string,
};

export default DynamicInput;
