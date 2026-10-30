import PropTypes from "prop-types";
import InputCard from "@/components/core/Cards/InputCard";
import { Button, KField, SelectForm } from "@/components/ui-shared";
import { RECIPIENTS_OPTIONS } from "../data/constants";
import { useFormikContext } from "formik";
import { useCallback, useMemo } from "react";
import { PlusIcon } from "lucide-react";
import useAuxiliariesOptions from "@/hooks/useAuxiliariesOptions";
import { formatTestId } from "@/utils/src/helpers";

const isEmailField = (node) => node?.type === "string" && node?.email;

const TemplateRecipientInput = ({ name, targetName, label = "" }) => {
    const { values, setFieldValue } = useFormikContext();
    const { auxiliariesRules } = useAuxiliariesOptions(true, isEmailField);

    const auxEmailOptions = useMemo(() => {
        return (auxiliariesRules ?? []).flatMap(r => r.options ?? []);
    }, [auxiliariesRules]);

    const recipientOptions = useMemo(() => {
        const base = RECIPIENTS_OPTIONS?.[0]?.data ?? [];
        return [{ data: [...base, ...auxEmailOptions] }];
    }, [auxEmailOptions]);

    const handleChangeValue = useCallback(
        (setFieldValue, nameButton, nameField, campo, value) => {
            value = value ? `${value}{{${campo}}},` : `{{${campo}}},`;
            setFieldValue(nameField, value);
            setFieldValue(nameButton, "");
        },
        [setFieldValue],
    );

    return (
        <InputCard className="flex flex-row items-center gap-2">
            <KField>
                <SelectForm
                    name={name}
                    label={label}
                    optionsLabels={recipientOptions}
                    className="items-start justify-start text-start gap-0"
                    onChange={(event) => setFieldValue(name, event.target.value)}
                    id={formatTestId("select_recipients_form", `${name}`)}
                    data-testid={formatTestId("select_recipients_form", `${name}`)}
                />
            </KField>
            <div className="flex flex-col items-start justify-start text-start">
                <Button
                    type="button"
                    size="icon"
                    title="new"
                    variant="outline"
                    className="flex flex-col gap-4"
                    onClick={() => handleChangeValue(setFieldValue, name, targetName, values[name], values[targetName])}
                    id={formatTestId("btn_add_recipients", `${name}`)}
                    data-testid={formatTestId("btn_add_recipients", `${name}`)}
                >
                    <PlusIcon className="w-3 h-3" />
                </Button>
            </div>
        </InputCard>
    );
};

TemplateRecipientInput.propTypes = {
    name: PropTypes.string.isRequired,
    targetName: PropTypes.string.isRequired,
    label: PropTypes.string,
};

export default TemplateRecipientInput;
