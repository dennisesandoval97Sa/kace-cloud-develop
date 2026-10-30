import { formatTestId } from "@/utils/src/helpers";
import { Label, Switch, cn } from "@kace/ui-shared";
import { useField } from "formik";
import { PropTypes } from "prop-types";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

export const SwitchStateAdmin = ({ className, shouldBool = false, onAfterChange, ...props }) => {
    const { t } = useTranslation();
    const [field, meta, helpers] = useField(props);
    const handleChange = () => {
        if (props?.tipo === "boolean" || shouldBool) {
            helpers.setValue(!field.value);
        } else {
            const newValue = field.value === 1 || field.value === true ? 2 : 1;
            helpers.setValue(newValue);
        }
        onAfterChange?.();
    };

    const trueText = useMemo(() => props.trueText ?? t("app.forms.active"), [props.trueText]);
    const falseText = useMemo(() => props.falseText ?? t("app.forms.inactive"), [props.falseText]);

    const switchState = field.value === 1 || field.value === true ? trueText : falseText;

    return (
        <div className={cn("flex items-center gap-2 border-input border p-2 rounded-md justify-between", className)}>
            <div className="flex flex-col gap-2">
                <Label className={`${meta.error !== undefined && "text-redCustom"} font-semibold`}>
                    {props.title ? props.title : t("app.forms.status")}
                </Label>
                <Label
                    className={`text-sm ${field.value === 1 || field.value === true ? "text-greenCustom" : "text-redCustom"}`}
                >
                    {switchState}
                </Label>
            </div>
            <Switch
                checked={field.value === 1 || field.value === true}
                onCheckedChange={handleChange}
                id={formatTestId(`switch_state_adm`, `${props.title || "estado"}_${switchState}`)}
                data-testid={formatTestId(`switch_state_adm`, `${props.title || "estado"}_${switchState}`)}
                disabled={props.disabled}
            />
        </div>
    );
};

SwitchStateAdmin.propTypes = {
    shouldBool: PropTypes.bool,
    className: PropTypes.string,
    title: PropTypes.string,
    tipo: PropTypes.string,
    trueText: PropTypes.string,
    falseText: PropTypes.string,
    onAfterChange: PropTypes.func,
};
