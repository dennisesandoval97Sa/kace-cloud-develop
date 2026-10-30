import { useField } from "formik";
import { PropTypes } from "prop-types";
import { useTranslation } from "react-i18next";
import { Input, Label } from "@kace/ui-shared";
import { formatTestId } from "@/utils/src/helpers";
import { charLimitKey, isMaxBelowMin } from "@kace/core/src/global-config/domain/settings/clientFieldCharLimits.js";
import {
    blockNumericSignAndDecimalKeys,
    blockNumericSignAndDecimalPaste,
    getGeneralSetupErrorLabel,
} from "../../helpers";

// Input does not forward `name` to the DOM, so the handlers are bound to the field name
const CharLimitInput = ({ field, placeholder, ariaLabel, errorId }) => (
    <Input
        id={field.name}
        name={field.name}
        value={field.value ?? ""}
        onChange={field.onChange(field.name)}
        onBlur={field.onBlur(field.name)}
        type="number"
        min={0}
        onKeyDown={blockNumericSignAndDecimalKeys}
        onPaste={blockNumericSignAndDecimalPaste}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-invalid={Boolean(errorId)}
        aria-describedby={errorId}
        className={`w-24 ${errorId ? "border-redCustom" : ""}`}
    />
);

CharLimitInput.propTypes = {
    field: PropTypes.object.isRequired,
    placeholder: PropTypes.string,
    ariaLabel: PropTypes.string,
    errorId: PropTypes.string,
};

export const ClientFieldCharLimits = ({ label }) => {
    const { t } = useTranslation();
    const minKey = charLimitKey(label, "min");
    const maxKey = charLimitKey(label, "max");
    const [minField, minMeta] = useField(minKey);
    const [maxField, maxMeta] = useField(maxKey);

    const minError = minMeta.touched ? minMeta.error : undefined;
    // Editing only the min can break the max/min rule, but not the max's own checks
    const showMaxError = maxMeta.touched || (minMeta.touched && isMaxBelowMin(minField.value, maxField.value));
    const maxError = showMaxError ? maxMeta.error : undefined;
    const errorMessage = [minError, maxError].filter(Boolean).join(". ");
    const errorId = formatTestId("tab_agent_field_min_max_error", label);

    return (
        <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
                <Label
                    className="text-start w-full"
                    id={formatTestId("tab_agent_field_min_max", label)}
                    data-testid={formatTestId("tab_agent_field_min_max", label)}
                >
                    {t(`generalSetup.form.labels.${label}`)}
                </Label>
                <div className="flex items-center justify-center gap-1">
                    <CharLimitInput
                        field={minField}
                        placeholder={t("generalSetup.form.labels.min")}
                        ariaLabel={getGeneralSetupErrorLabel(minKey, t)}
                        errorId={minError ? errorId : undefined}
                    />
                    <CharLimitInput
                        field={maxField}
                        placeholder={t("generalSetup.form.labels.max")}
                        ariaLabel={getGeneralSetupErrorLabel(maxKey, t)}
                        errorId={maxError ? errorId : undefined}
                    />
                </div>
            </div>
            {errorMessage && (
                <Label className="text-right text-redCustom font-semibold" id={errorId} data-testid={errorId}>
                    {errorMessage}
                </Label>
            )}
        </div>
    );
};

ClientFieldCharLimits.propTypes = {
    label: PropTypes.string.isRequired,
};
