import { useTranslation } from "react-i18next";
import PropTypes from "prop-types";
import { toast } from "sonner";

import { InputForm as Input, KField } from "@kace/ui-shared";
import { useField, useFormikContext } from "formik";

const SchemasPatternFlagsInput = ({ namePrefix }) => {
    const { t } = useTranslation();
    const { setFieldValue } = useFormikContext();
    const [field] = useField(`${namePrefix}.pattern.flags`);

    const handleChange = (e) => {
        const value = e.target.value;
        const previousValue = field.value || "";

        if (value.length > previousValue.length) {
            const newChar = value[value.length - 1];
            if (!/[imsu]/.test(newChar)) {
                const flagName = newChar === "g" ? "g (global)" : newChar === "y" ? "y (sticky)" : `"${newChar}"`;
                toast.warning(
                    t("auxSchema.form.flagsInvalidFlag", { flagName }) ||
                    `Flag ${flagName} is not allowed. Valid flags are: i (case-insensitive), m (multiline), s (dotall), u (unicode).`,
                );
            }
        }

        const filtered = value.split("").filter(char => /[imsu]/.test(char)).join("");
        const uniqueFlags = Array.from(new Set(filtered.split(""))).join("");

        setFieldValue(`${namePrefix}.pattern.flags`, uniqueFlags);
    };

    return (
        <KField>
            <Input
                {...field}
                onChange={handleChange}
                label={t("auxSchema.form.flags")}
                type="text"
                placeholder="e.g., i"
                className="flex flex-col items-start justify-start text-start"
                pattern="^[imsu]*$"
                maxLength={4}
                title={t("auxSchema.form.flagsHelp") || "Valid flags: i (case-insensitive), m (multiline), s (dotall), u (unicode). Flags g (global) and y (sticky) are not allowed in Joi validation."}
            />
        </KField>
    );
};

SchemasPatternFlagsInput.propTypes = {
    namePrefix: PropTypes.string.isRequired,
};

export default SchemasPatternFlagsInput;
