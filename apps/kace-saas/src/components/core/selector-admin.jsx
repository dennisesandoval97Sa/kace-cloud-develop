import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { Input, Button } from "@kace/ui-shared";
import { PlusIcon } from "lucide-react";
import { CancelIcon } from "../ui-shared/src/icons";
import { cn, Label } from "../ui-shared";
import { useTranslation } from "react-i18next";

export const SelectorAdmin = ({ type = "text", values, setValues, label = null, meta = {}, field = {} }) => {
    const { t } = useTranslation();
    const [data, setData] = useState([]);
    const [newCode, setNewCode] = useState("");
    const specialCode = field?.specialCode || "";
    const hasSpecialCode = Boolean(specialCode) && data.includes(specialCode);

    const removeItem = (index) => {
        const _data = [...data];
        if (typeof values === "object") {
            const element = _data[index];
            delete values[element];
            setValues({ ...values });
        }
        if (Array.isArray(values)) {
            _data.splice(index, 1);
            setValues(_data);
        }
    };
    const handleData = () => {
        if (!newCode || !newCode.trim()) return;
        if (data.includes(newCode)) return;
        if (typeof values === "object" && values[newCode]) return;
        if (Array.isArray(values) && values.includes(newCode)) return;

        const newCodeTrim = newCode.trim();

        if (typeof values === "object") {
            setValues({ ...values, [newCodeTrim]: newCodeTrim });
        }
        if (Array.isArray(values)) {
            setValues([...values, newCodeTrim]);
        }
        setNewCode("");
    };

    const toggleSpecialCode = () => {
        if (!specialCode) return;

        if (hasSpecialCode) {
            const index = data.findIndex((value) => value === specialCode);
            if (index !== -1) removeItem(index);
            return;
        }

        if (typeof values === "object") {
            setValues({ ...(values || {}), [specialCode]: specialCode });
            return;
        }

        if (Array.isArray(values)) {
            setValues([...(values || []), specialCode]);
        }
    };

    useEffect(() => {
        if (values) {
            let _values = [];

            if (typeof values === "object") {
                _values = Object.values(values).map((value) => value);
            }
            if (Array.isArray(values)) {
                _values = values.map((value) => value);
            }
            setData(_values);
        }
    }, [values]);
    return (
        <div className="flex flex-col gap-2">
            {label && (
                <div className="flex w-full justify-between items-center">
                    <Label
                        className={`flex justify-end ${meta.touched && meta.error && "text-redCustom font-semibold"}`}
                    >
                        {t(label)}
                    </Label>
                    {meta.touched && meta.error && (
                        <Label className="text-right text-redCustom font-semibold">{meta.error}</Label>
                    )}
                </div>
            )}
            <div className="flex justify-center gap-2">
                <Input
                    type={type}
                    name="newCode"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                    {...field}
                    className={cn("col-span-3", { "placeholder:text-redCustom": meta.touched && meta.error })}
                    data-testid={`selector_admin_input_${newCode || "empty"}`}
                    id={`selector_admin_input_${newCode || "empty"}`}
                />
                <Button
                    type="button"
                    name="addCode"
                    size="icon"
                    onClick={handleData}
                    data-testid="btn_add_code_selector_admin"
                    id="btn_add_code_selector_admin"
                >
                    <PlusIcon />
                </Button>
            </div>
            {specialCode && (
                <div className="flex flex-col gap-2 p-3 rounded-lg border border-violet-300 bg-violet-50">
                    <Label className="text-sm font-semibold text-violet-900">
                        {field?.specialCodeTitle || specialCode}
                    </Label>
                    <Label className="text-xs text-violet-800">{field?.specialCodeDescription || ""}</Label>
                    <div>
                        <Button
                            type="button"
                            variant={hasSpecialCode ? "outline" : "default"}
                            onClick={toggleSpecialCode}
                            data-testid="selector_admin_toggle_special_code"
                            id="selector_admin_toggle_special_code"
                            className={
                                hasSpecialCode
                                    ? "border-violet-500 text-violet-800 hover:bg-violet-100"
                                    : "bg-violet-600 text-white hover:bg-violet-700"
                            }
                        >
                            {hasSpecialCode
                                ? field?.specialCodeRemoveLabel || t("button.remove")
                                : field?.specialCodeAddLabel || t("button.add")}
                        </Button>
                    </div>
                </div>
            )}
            <div className="flex justify-center flex-wrap gap-2 p-2">
                {data.map((value, index) => (
                    <div
                        className={cn(
                            "border flex justify-between min-w-20 rounded-md px-2 py-1.5",
                            value === specialCode
                                ? "bg-violet-100 border-violet-400 text-violet-900"
                                : "bg-cyan-50 border-cyan-300 text-cyan-900",
                        )}
                        key={`externalCode${index}`}
                        data-testid={`selector_admin_item_${index}`}
                    >
                        <span
                            className="text-center w-full mr-1"
                            id={`selector_admin_item_value_${value}`}
                            data-testid={`selector_admin_item_value_${value}`}
                        >
                            {value === specialCode ? field?.specialCodeDisplayLabel || specialCode : value}
                        </span>
                        <Button
                            type="button"
                            size="icon"
                            className="min-h-6 min-w-6 h-6 w-6 rounded-full"
                            onClick={() => removeItem(index)}
                            variant="outline"
                            data-testid={`btn_selector_admin_remove_${index}`}
                            id={`btn_selector_admin_remove_${index}`}
                        >
                            <CancelIcon width={18} height={18} />
                        </Button>
                    </div>
                ))}
            </div>
        </div>
    );
};

SelectorAdmin.propTypes = {
    name: PropTypes.string,
    type: PropTypes.string,
    values: PropTypes.any,
    setValues: PropTypes.func.isRequired,
    label: PropTypes.string,
    meta: PropTypes.object,
    field: PropTypes.object,
};
