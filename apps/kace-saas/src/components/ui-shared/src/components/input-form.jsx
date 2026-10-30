import { PropTypes } from "prop-types";
import { Input as InputCustom } from "./ui/input";
import { Label } from "@kace/ui-shared";
import { cn } from "../lib/utils";
import { forwardRef } from "react";
import { useTranslation } from "react-i18next";
import { formatTestId } from "@/utils/src/helpers";

export const InputForm = forwardRef(
    (
        { label = "", field = {}, meta = {}, className = "", touchedValue = false, classNameInput = "", ...props },
        ref,
    ) => {
        const id = props.id ? props.id : props.name;
        const { t } = useTranslation();
        /*
         * touchedValue forces the error to show even when Formik has not marked the field
         * as touched (e.g. a cross-field rule on a field the user never focused, once submitted)
         */
        const showError = (meta.touched || touchedValue) && meta.error;
        return (
            <div className={cn("grid grid-cols-4 items-center gap-2", className)}>
                <div className="flex w-full justify-between items-center">
                    <Label
                        htmlFor={id}
                        className={`flex justify-end ${showError && "text-redCustom font-semibold"}`}
                        data-testid={formatTestId("input_form_label", `${label}`)}
                        id={formatTestId("input_form_label", `${label}`)}
                    >
                        {t(label)}
                    </Label>
                    {showError && <Label className="text-right text-redCustom font-semibold">{meta.error}</Label>}
                </div>
                <InputCustom
                    id={id}
                    {...field}
                    {...props}
                    className={cn(`col-span-3 ${showError && "placeholder:text-redCustom"}`, classNameInput)}
                    autoComplete="off"
                    ref={ref}
                    data-testid={formatTestId("input_form_custom", `${label}`)}
                />
            </div>
        );
    },
);
InputForm.propTypes = {
    name: PropTypes.string.isRequired,
    type: PropTypes.string,
    id: PropTypes.string,
    label: PropTypes.string,
    placeholder: PropTypes.string,
    className: PropTypes.string,
    field: PropTypes.object,
    meta: PropTypes.object,
    touchedValue: PropTypes.bool,
    classNameInput: PropTypes.string,
};
