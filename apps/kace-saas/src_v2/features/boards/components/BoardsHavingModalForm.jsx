import React, { useCallback, useEffect, useState } from "react";
import PropTypes from "prop-types";
import CreateModalButton from "@kace_v2/shared/ui/molecules/CreateModalButton";
import { BOARDS_HAVING } from "@kace_v2/features/boards/constants/boards.constants";
import { Form, Formik } from "formik";
import { joiFormikAdapter } from "@kace/utils";
import { validateBoardsHaving } from "@kace_v2/features/boards/schemas/boards.schema";
import SelectField from "@kace_v2/shared/ui/molecules/SelectField";
import { fetchSchemaRules } from "@kace_v2/shared/services/schemas.services";
import { generateAuxSelectOptions } from "@/utils/generateAuxSelectOptions";
import useSchemaFields from "@kace/hooks/useSchemaFields";
import { processAuxiliaryOptions, normalizeAuxiliaryField } from "@kace_v2/features/boards/utils/auxiliaryOptions.util";
import InputField from "@kace_v2/shared/ui/molecules/InputField";
import Button from "@kace_v2/shared/ui/atoms/Button";
import { functionsTypeOptions } from "@kace_v2/features/boards/utils/functionsTypeOptions.util";
import { operatorOptions } from "@kace_v2/features/boards/utils/operatorOptions.util";
import { filterFieldsByFunction } from "@kace_v2/features/boards/utils/boardFunctionsHelper.util";
import { useTranslation } from "react-i18next";

const BoardsHavingModalForm = ({
    defaultValues,
    relationsOptions = [],
    disabled = false,
    open = false,
    setOpen = () => {},
    onSubmit = () => {},
}) => {
    const { getSchemaField } = useSchemaFields();
    const { t } = useTranslation();
    const [initialValues, setInitialValues] = useState(defaultValues || BOARDS_HAVING.INITIAL_VALUES);
    const [fieldOptions, setFieldOptions] = useState([]);
    const [allFieldOptions, setAllFieldOptions] = useState([]);

    const loadFieldOptions = useCallback(
        async (related_entity, functionValue = "") => {
            if (related_entity.includes("aux_")) {
                const auxiliary = await fetchSchemaRules(related_entity);
                const allOptions = generateAuxSelectOptions(auxiliary, () => {}, related_entity);
                const processedOptions = processAuxiliaryOptions(allOptions, related_entity);
                setAllFieldOptions(processedOptions);
                const filtered = filterFieldsByFunction(processedOptions, functionValue);
                setFieldOptions(filtered);
                return;
            }

            const schemaField = getSchemaField(related_entity);
            const allOptions = schemaField.map((field) => ({
                label: field.column_name,
                value: field.column_name,
                data_type: field.data_type,
            }));
            setAllFieldOptions(allOptions);
            const filtered = filterFieldsByFunction(allOptions, functionValue);
            setFieldOptions(filtered);
        },
        [getSchemaField],
    );

    useEffect(() => {
        const values = defaultValues || BOARDS_HAVING.INITIAL_VALUES;
        if (values.related_entity) {
            const relationOption = relationsOptions.find(
                (rel) => rel.value === values.related_entity || rel.alias === values.related_entity,
            );
            const actualRelatedEntity = relationOption?.related_entity || values.related_entity;
            if (actualRelatedEntity.includes("aux_") && values.field) {
                values.field = normalizeAuxiliaryField(values.field, actualRelatedEntity);
            }
            setInitialValues(values);
            loadFieldOptions(actualRelatedEntity, values.function || "");
        } else {
            setInitialValues(values);
        }
    }, [defaultValues, relationsOptions, loadFieldOptions]);

    return (
        <CreateModalButton
            title={t("boards.form.havings.title")}
            description={t("boards.form.havings.description")}
            label="Having"
            className="sm:max-w-2xl"
            open={open}
            onOpenChange={(value) => {
                if (!value) {
                    setInitialValues(BOARDS_HAVING.INITIAL_VALUES);
                    setAllFieldOptions([]);
                    setFieldOptions([]);
                }
                setOpen(value);
            }}
            disabled={disabled}
        >
            <Formik
                initialValues={initialValues}
                validationSchema={joiFormikAdapter(validateBoardsHaving)}
                onSubmit={onSubmit}
                enableReinitialize={true}
            >
                {({ setFieldValue, values, errors }) => {
                    return (
                        <Form autoComplete="off" className="flex flex-col gap-4">
                            <SelectField
                                label={t("boards.form.labels.function")}
                                name="function"
                                value={values.function}
                                placeholder={t("boards.form.placeholders.select")}
                                error={errors?.function ?? ""}
                                options={functionsTypeOptions()}
                                onValueChange={async (value) => {
                                    setFieldValue("function", value);
                                    if (values.related_entity) {
                                        const relationOption = relationsOptions.find(
                                            (rel) => rel.value === values.related_entity,
                                        );
                                        const actualRelatedEntity =
                                            relationOption?.related_entity || values.related_entity;
                                        await loadFieldOptions(actualRelatedEntity, value);
                                    } else {
                                        const filtered = filterFieldsByFunction(allFieldOptions, value);
                                        setFieldOptions(filtered);
                                    }
                                }}
                            />

                            <SelectField
                                label={t("boards.form.labels.entity")}
                                name="related_entity"
                                value={values.related_entity}
                                placeholder={t("boards.form.placeholders.select")}
                                error={errors?.related_entity ?? ""}
                                options={relationsOptions}
                                onValueChange={async (selectedValue) => {
                                    setFieldValue("related_entity", selectedValue);
                                    setFieldValue("field", "");
                                    const relationOption = relationsOptions.find((rel) => rel.value === selectedValue);
                                    const actualRelatedEntity = relationOption?.related_entity || selectedValue;
                                    await loadFieldOptions(actualRelatedEntity, values.function || "");
                                }}
                            />

                            {values.related_entity && fieldOptions.length > 0 && (
                                <SelectField
                                    label={t("boards.form.labels.column")}
                                    name="field"
                                    value={values.field}
                                    placeholder={t("boards.form.placeholders.select")}
                                    error={errors?.field ?? ""}
                                    options={fieldOptions}
                                    onValueChange={(value) => {
                                        setFieldValue("field", value);
                                    }}
                                />
                            )}

                            <SelectField
                                label={t("boards.form.labels.operator")}
                                name="operator"
                                value={values.operator}
                                placeholder={t("boards.form.placeholders.select")}
                                error={errors?.operator ?? ""}
                                options={operatorOptions()}
                                onValueChange={(value) => {
                                    setFieldValue("operator", value);
                                }}
                            />

                            <InputField
                                label={t("boards.form.labels.value")}
                                name="value"
                                defaultValue={values.value}
                                onChange={(e) => {
                                    setFieldValue("value", e.target.value);
                                }}
                                placeholder={t("boards.form.placeholders.value")}
                                error={errors?.value ?? ""}
                            />

                            <div className="flex items-center justify-center">
                                <Button
                                    size="sm"
                                    type="submit"
                                    className="w-52"
                                    disabled={Object.entries(errors).length > 0}
                                >
                                    {t("button.add")}
                                </Button>
                            </div>
                        </Form>
                    );
                }}
            </Formik>
        </CreateModalButton>
    );
};

BoardsHavingModalForm.propTypes = {
    defaultValues: PropTypes.object,
    relationsOptions: PropTypes.array,
    disabled: PropTypes.bool,
    open: PropTypes.bool,
    setOpen: PropTypes.func,
    onSubmit: PropTypes.func,
};

export default BoardsHavingModalForm;
