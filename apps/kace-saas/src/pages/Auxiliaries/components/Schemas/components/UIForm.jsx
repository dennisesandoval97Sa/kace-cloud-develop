import { SwitchStateAdmin } from "@/components/core/switchState/SwitchStateAdmin";
import BootstrapClassesEditor from "./BootstrapClassesEditor";
import InputCard from "@/components/core/Cards/InputCard";
import MultiSelect from "@/componentsV2/core/MultiSelect";
import { InputForm as Input, KField } from "@kace/ui-shared";
import { Field, useFormikContext } from "formik";
import PropTypes from "prop-types";
import { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";

const UIForm = ({ field, index }) => {
    const { t } = useTranslation();
    const { values, setFieldValue } = useFormikContext();
    const fieldType = values?.fields?.[index]?.type;
    const isNumberType = fieldType === "number";

    const markUiModified = useCallback(() => {
        setFieldValue(`${field}.ui.ui_modified`, true);
    }, [field, setFieldValue]);

    useEffect(() => {
        if (!isNumberType && values?.fields?.[index]?.ui?.input_type === "currency") {
            setFieldValue(`${field}.ui.input_type`, "text");
        }
    }, [isNumberType, field, index, setFieldValue, values?.fields?.[index]?.ui?.input_type]);

    return (
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 p-4 items-center">
            <InputCard>
                <Field name={`${field}.ui.label`}>
                    {({ field: labelField }) => (
                        <KField>
                            <Input
                                {...labelField}
                                onChange={(e) => {
                                    labelField.onChange(e);
                                    markUiModified();
                                }}
                                label={t("auxSchema.form.label")}
                                placeholder={t("auxSchema.form.label")}
                                className="flex flex-col items-start justify-start text-start"
                            />
                        </KField>
                    )}
                </Field>
            </InputCard>
            <InputCard>
                <BootstrapClassesEditor
                    control={`${field}.ui.css`}
                    data={values?.fields?.[index]?.ui?.css?.split(" ") ?? []}
                    onUiModified={markUiModified}
                />
            </InputCard>
            {isNumberType ? (
                <InputCard>
                    <MultiSelect
                        name={`${field}.ui.input_type`}
                        label={t("auxSchema.form.options")}
                        hiddenSelectedAll={true}
                        placeholder={
                            values?.fields?.[index]?.ui?.input_type === "currency"
                                ? t("auxSchema.form.currency")
                                : t("auxSchema.form.inputTypeDefaultText")
                        }
                        type="button"
                        single
                        selectedData={
                            values?.fields?.[index]?.ui?.input_type === "currency"
                                ? [
                                      {
                                          id: "currency",
                                          label: t("auxSchema.form.currency"),
                                          value: "currency",
                                      },
                                  ]
                                : []
                        }
                        clearable
                        onClearSelection={() => {
                            setFieldValue(`${field}.ui.input_type`, "text");
                            markUiModified();
                        }}
                        options={[{ id: "currency", label: t("auxSchema.form.currency"), value: "currency" }]}
                        onSelectOption={(selection) => {
                            setFieldValue(`${field}.ui.input_type`, selection === "currency" ? "currency" : "text");
                            markUiModified();
                        }}
                    />
                </InputCard>
            ) : null}
            <InputCard>
                <SwitchStateAdmin
                    name={`${field}.ui.is_visible`}
                    title={t("auxSchema.form.fieldVisible")}
                    tipo="boolean"
                    onAfterChange={markUiModified}
                />
            </InputCard>
            <InputCard>
                <SwitchStateAdmin
                    name={`${field}.ui.read_only`}
                    title={t("auxSchema.form.readOnly")}
                    tipo="boolean"
                    onAfterChange={markUiModified}
                />
            </InputCard>
            <InputCard>
                <SwitchStateAdmin
                    name={`${field}.ui.show_in_grid`}
                    title={t("auxSchema.form.showGrid")}
                    tipo="boolean"
                    onAfterChange={markUiModified}
                />
            </InputCard>
        </div>
    );
};

UIForm.propTypes = {
    field: PropTypes.string.isRequired,
    index: PropTypes.number,
};

export default UIForm;
