import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { BOARDS_INITIAL_FILTER } from "@kace_v2/features/boards/constants/boards.constants";
import useSchemaFields from "@kace/hooks/useSchemaFields";
import BoardsTableSection from "@kace_v2/features/boards/components/BoardsTableSection";
import { Form, Formik } from "formik";
import { joiFormikAdapter } from "@kace/utils";
import { validateBoardsInitialFilter } from "@kace_v2/features/boards/schemas/boards.schema";
import SelectField from "@kace_v2/shared/ui/molecules/SelectField";
import Button from "@kace_v2/shared/ui/atoms/Button";
import InputField from "@kace_v2/shared/ui/molecules/InputField";
import { fetchSchemaRules } from "@kace_v2/shared/services/schemas.services";
import { generateAuxSelectOptions } from "@/utils/generateAuxSelectOptions";
import { operatorOptions } from "@kace_v2/features/boards/utils/operatorOptions.util";
import { v4 as uuidv4 } from "uuid";
import { removeIds } from "@kace_v2/features/boards/utils/boardIdHelper.util";
import { isBoardIdentityFunction } from "@kace_v2/features/boards/utils/boardFunctionsHelper.util";
import { collectJoinData } from "@kace_v2/features/boards/utils/relations.util";
import { processAuxiliaryOptions, normalizeAuxiliaryField } from "@kace_v2/features/boards/utils/auxiliaryOptions.util";

const processRows = (rows = []) =>
    rows.map((row) => ({
        ...row,
        value: row.value.toString(),
    }));

const BoardsInitialFilter = ({
    initialData = {},
    primaryEntity,
    currentRelatedEntities = [],
    clearRows = false,
    onSubmit = () => {},
}) => {
    const { t } = useTranslation();
    const [initialValues, setInitialValues] = useState(BOARDS_INITIAL_FILTER.INITIAL_VALUES);
    const { getSchemaField } = useSchemaFields();

    const [open, setOpen] = useState(false);
    const [rows, setRows] = useState([]);
    const [fieldOptions, setFieldOptions] = useState([]);
    const [valueFieldOptions, setValueFieldOptions] = useState([]);
    const [loadingFieldOptions, setLoadingFieldOptions] = useState(false);
    const [loadingValueFieldOptions, setLoadingValueFieldOptions] = useState(false);
    const [dataType, setDataType] = useState(null);

    const relationsOptions = useMemo(() => {
        if (!currentRelatedEntities?.length && primaryEntity === "") return [];
        const options = [];
        currentRelatedEntities.forEach((entity) => {
            const { related_entity, alias } = collectJoinData(entity);

            related_entity.forEach((entity, index) => {
                options.push({
                    label: alias[index] || entity,
                    value: alias[index] || entity,
                    alias: alias[index],
                    related_entity: entity,
                });
            });
        });
        if (typeof primaryEntity === "string") {
            options.unshift({ label: primaryEntity, value: primaryEntity, alias: primaryEntity });
        }
        return Array.from(new Map(options.map((item) => [item.alias || item.value, item])).values());
    }, [currentRelatedEntities?.length, primaryEntity]);

    useEffect(() => {
        const itemsWithId = (initialData?.items ?? []).map((item) => ({
            ...item,
            id: item.id || uuidv4(),
        }));
        setRows(itemsWithId);
    }, [initialData]);

    useEffect(() => {
        if (clearRows) {
            setRows([]);
            onSubmit([]);
        }
    }, [clearRows]);

    useEffect(() => {
        if (!open) {
            setFieldOptions([]);
            setValueFieldOptions([]);
            setLoadingValueFieldOptions(false);
            setDataType(null);
            return;
        }

        if (!initialValues.related_entity) {
            setFieldOptions([]);
            setValueFieldOptions([]);
            setDataType(null);
            return;
        }

        const loadFieldOptionsForEdit = async () => {
            const relationOption = relationsOptions.find(
                (rel) => rel.value === initialValues.related_entity || rel.alias === initialValues.related_entity,
            );
            const actualRelatedEntity = relationOption?.related_entity || initialValues.related_entity;

            if (actualRelatedEntity.includes("aux_")) {
                try {
                    setLoadingFieldOptions(true);
                    const auxiliary = await fetchSchemaRules(actualRelatedEntity);
                    const options = generateAuxSelectOptions(auxiliary, () => {}, actualRelatedEntity);
                    const processedOptions = processAuxiliaryOptions(options, actualRelatedEntity);
                    setFieldOptions(processedOptions);

                    if (initialValues.field) {
                        const normalizedField = normalizeAuxiliaryField(initialValues.field, actualRelatedEntity);
                        if (normalizedField !== initialValues.field) {
                            setInitialValues((prev) => ({ ...prev, field: normalizedField }));
                        }
                        const selectedField = processedOptions.find((field) => field.value === normalizedField);
                        if (selectedField?.data_type) {
                            setDataType(selectedField.data_type.toUpperCase());
                        }
                    }
                } catch (error) {
                    setFieldOptions([]);
                    setValueFieldOptions([]);
                } finally {
                    setLoadingFieldOptions(false);
                }
            } else {
                const schemaField = getSchemaField(actualRelatedEntity);
                const options = schemaField.map((field) => ({
                    label: field.column_name,
                    value: field.column_name,
                    data_type: field.data_type,
                }));
                setFieldOptions(options);

                if (initialValues.field) {
                    const fieldName = initialValues.field.includes(".")
                        ? initialValues.field.split(".").slice(-1)[0]
                        : initialValues.field;
                    const selectedField = schemaField.find((field) => field.column_name === fieldName);
                    if (selectedField) {
                        setDataType(selectedField.data_type?.toUpperCase() || null);
                    }
                }
            }

            if (initialValues.comparison_type === "FIELD" && initialValues.field_related_entity) {
                const fieldRelationOption = relationsOptions.find(
                    (rel) =>
                        rel.value === initialValues.field_related_entity ||
                        rel.alias === initialValues.field_related_entity,
                );
                const actualFieldRelatedEntity =
                    fieldRelationOption?.related_entity || initialValues.field_related_entity;

                if (actualFieldRelatedEntity.includes("aux_")) {
                    try {
                        setLoadingValueFieldOptions(true);
                        const auxiliary = await fetchSchemaRules(actualFieldRelatedEntity);
                        const options = generateAuxSelectOptions(auxiliary, () => {}, actualFieldRelatedEntity);
                        const processedOptions = processAuxiliaryOptions(options, actualFieldRelatedEntity);
                        setValueFieldOptions(processedOptions);
                    } catch {
                        setValueFieldOptions([]);
                    } finally {
                        setLoadingValueFieldOptions(false);
                    }
                } else {
                    const fieldSchemaField = getSchemaField(actualFieldRelatedEntity);
                    setValueFieldOptions(
                        fieldSchemaField.map((field) => ({
                            label: field.column_name,
                            value: field.column_name,
                        })),
                    );
                }
            }
        };

        loadFieldOptionsForEdit();
    }, [
        open,
        initialValues.related_entity,
        initialValues.id,
        initialValues.field,
        initialValues.comparison_type,
        initialValues.field_related_entity,
        getSchemaField,
    ]);

    return (
        <BoardsTableSection
            title={t("boards.initialFilter.title")}
            description={t("boards.initialFilter.description")}
            columns={[
                { key: "actions", header: "", width: "10%" },
                { key: "field", header: t("boards.initialFilter.columns.field"), width: "30%" },
                { key: "operator", header: t("boards.initialFilter.columns.operator"), width: "15%" },
                { key: "value", header: t("boards.initialFilter.columns.value"), width: "30%" },
                { key: "type", header: t("boards.initialFilter.columns.type"), width: "15%" },
            ]}
            rows={processRows(rows)}
            actions={[
                {
                    label: t("boards.initialFilter.actions.edit"),
                    fn: ({ row }) => {
                        const currentRow = rows.find((el) => el.id === row.id);
                        if (!currentRow) return;
                        const currentRowCopy = structuredClone(currentRow);
                        let related_entity = "";
                        if (currentRow.entity) {
                            const relationOption = relationsOptions.find((rel) => rel.alias === currentRow.entity);
                            related_entity = relationOption?.value || currentRow.entity || primaryEntity;
                        } else {
                            const fieldParts = currentRowCopy.field?.split(".") || [];
                            if (fieldParts.length > 1) {
                                const entityFromField = fieldParts[0];
                                const relationOption = relationsOptions.find(
                                    (rel) => rel.alias === entityFromField || rel.value === entityFromField,
                                );
                                related_entity = relationOption?.value || entityFromField || primaryEntity;
                            } else {
                                related_entity = primaryEntity;
                            }
                        }

                        const relationOptionForNormalization = relationsOptions.find(
                            (rel) => rel.value === related_entity || rel.alias === related_entity,
                        );
                        const actualRelatedEntityForNormalization =
                            relationOptionForNormalization?.related_entity || related_entity;

                        if (currentRowCopy.field?.includes(".")) {
                            if (actualRelatedEntityForNormalization.includes("aux_")) {
                                currentRowCopy.field = normalizeAuxiliaryField(
                                    currentRowCopy.field,
                                    actualRelatedEntityForNormalization,
                                );
                            } else {
                                currentRowCopy.field = currentRowCopy.field.split(".").slice(-1)[0];
                            }
                        } else if (actualRelatedEntityForNormalization.includes("aux_")) {
                            currentRowCopy.field = normalizeAuxiliaryField(
                                currentRowCopy.field,
                                actualRelatedEntityForNormalization,
                            );
                        }
                        let field_value = false;
                        if (typeof currentRowCopy.value === "string" && currentRowCopy.value.includes(".")) {
                            const dotIndex = currentRowCopy.value.indexOf(".");
                            const first = currentRowCopy.value.slice(0, dotIndex);
                            const second = currentRowCopy.value.slice(dotIndex + 1);
                            const matchesRelation = relationsOptions.some(
                                (rel) => rel.value === first || rel.alias === first,
                            );
                            if (matchesRelation) {
                                field_value = [first, second];
                            }
                        }
                        let comparison_type = "VALUE";
                        let field_related_entity = "";
                        let function_type = "";
                        let days = "";

                        if (currentRowCopy.function_type) {
                            comparison_type = "FUNCIONES";
                            function_type = currentRowCopy.function_type;
                            if (isBoardIdentityFunction(currentRowCopy.function_type)) {
                                days = "";
                                currentRowCopy.value = "";
                            } else {
                                days = currentRowCopy.value?.toString() || "";
                                currentRowCopy.value = days;
                            }
                        } else if (Array.isArray(field_value) && field_value.length > 1) {
                            comparison_type = "FIELD";
                            field_related_entity = field_value[0];
                            currentRowCopy.value = field_value[1];
                            // Handle corrupted stored values where entity prefix was saved twice
                            // e.g. "cases.cases.fecha_resolucion" → after split: "cases.fecha_resolucion" → strip → "fecha_resolucion"
                            const entityPrefix = field_related_entity + ".";
                            if (
                                typeof currentRowCopy.value === "string" &&
                                currentRowCopy.value.startsWith(entityPrefix)
                            ) {
                                currentRowCopy.value = currentRowCopy.value.slice(entityPrefix.length);
                            }
                        }

                        setInitialValues({
                            ...currentRowCopy,
                            related_entity,
                            comparison_type,
                            field_related_entity,
                            function_type,
                            days,
                        });
                        setOpen(true);
                    },
                },
                {
                    label: t("boards.initialFilter.actions.delete"),
                    className: "text-redCustom",
                    fn: ({ row }) => {
                        const updatedRow = rows.filter((el) => el.id !== row.id);
                        const rowsWithoutId = removeIds(updatedRow);
                        setRows(updatedRow);
                        onSubmit(rowsWithoutId);
                    },
                },
            ]}
            className="sm:max-w-2xl"
            open={open}
            onOpenChange={(value) => {
                if (!value) {
                    setInitialValues(BOARDS_INITIAL_FILTER.INITIAL_VALUES);
                }
                setOpen(value);
            }}
            disabled={!primaryEntity}
        >
            <Formik
                initialValues={initialValues}
                validationSchema={joiFormikAdapter(validateBoardsInitialFilter)}
                validateOnChange={true}
                validateOnBlur={true}
                onSubmit={(values) => {
                    const updatedRows = [...rows];

                    const relationOption = relationsOptions.find((rel) => rel.value === values.related_entity);
                    const entity = relationOption?.alias || values.related_entity;

                    let resolvedValue;
                    if (values.comparison_type === "FIELD" && values.field_related_entity && values.value) {
                        const actualFieldRelatedEntity = values.field_related_entity;
                        const secondField = values.value;
                        resolvedValue = `${actualFieldRelatedEntity}.${secondField}`;
                    } else if (
                        values.comparison_type === "FUNCIONES" &&
                        isBoardIdentityFunction(values.function_type)
                    ) {
                        resolvedValue = "";
                    } else if (values.comparison_type === "FUNCIONES") {
                        resolvedValue = String(values.value);
                    } else {
                        resolvedValue = values.value;
                    }
                    const updatedData = {
                        entity,
                        field: values.field,
                        operator: values.operator,
                        value: resolvedValue,
                        type: values.type,
                    };

                    if (values.comparison_type === "FUNCIONES") {
                        updatedData.function_type = values.function_type;
                    }

                    const index = rows.findIndex((item) => item.id === values.id);

                    if (index !== -1) {
                        updatedData.id = updatedRows[index].id;
                        updatedRows[index] = updatedData;
                    } else {
                        updatedData.id = uuidv4();
                        updatedRows.push(updatedData);
                    }

                    const rowsWithoutId = removeIds(updatedRows);
                    onSubmit(rowsWithoutId);
                    setRows(updatedRows);
                    setOpen(false);
                    setInitialValues(BOARDS_INITIAL_FILTER.INITIAL_VALUES);
                }}
            >
                {({ setFieldValue, setFieldTouched, validateField, values, errors }) => {
                    const comparisonTypeOptions = [
                        { label: t("boards.initialFilter.comparisonTypes.value"), value: "VALUE" },
                        { label: t("boards.initialFilter.comparisonTypes.field"), value: "FIELD" },
                        ...(values.field
                            ? [{ label: t("boards.initialFilter.comparisonTypes.functions"), value: "FUNCIONES" }]
                            : []),
                    ];

                    return (
                        <Form autoComplete="off" className="flex flex-col gap-4">
                            <SelectField
                                label={t("boards.initialFilter.labels.entity")}
                                name="related_entity"
                                value={values.related_entity}
                                placeholder={t("boards.initialFilter.placeholders.select")}
                                error={errors?.related_entity ?? ""}
                                options={relationsOptions}
                                onValueChange={async (selectedValue) => {
                                    setFieldValue("related_entity", selectedValue);
                                    setFieldValue("field", "");
                                    setDataType(null);
                                    if (values.comparison_type === "FUNCIONES") {
                                        setFieldValue("comparison_type", "");
                                        setFieldValue("function_type", "");
                                        setFieldValue("days", "");
                                        setFieldValue("value", "");
                                    }
                                    if (values.comparison_type === "FIELD") {
                                        setFieldValue("field_related_entity", "");
                                        setFieldValue("value", "");
                                        setValueFieldOptions([]);
                                    }

                                    const relationOption = relationsOptions.find((rel) => rel.value === selectedValue);
                                    const actualRelatedEntity = relationOption?.related_entity || selectedValue;

                                    if (actualRelatedEntity.includes("aux_")) {
                                        try {
                                            setLoadingFieldOptions(true);
                                            const auxiliary = await fetchSchemaRules(actualRelatedEntity);
                                            const options = generateAuxSelectOptions(
                                                auxiliary,
                                                () => {},
                                                actualRelatedEntity,
                                            );
                                            const processedOptions = processAuxiliaryOptions(
                                                options,
                                                actualRelatedEntity,
                                            );
                                            setFieldOptions(processedOptions);
                                            setValueFieldOptions(processedOptions);
                                            return;
                                        } catch (error) {
                                            setFieldOptions([]);
                                            setValueFieldOptions([]);
                                        } finally {
                                            setLoadingFieldOptions(false);
                                        }
                                    }

                                    const schemaField = getSchemaField(actualRelatedEntity);
                                    setFieldOptions(
                                        schemaField.map((field) => ({
                                            label: field.column_name,
                                            value: field.column_name,
                                            data_type: field.data_type,
                                        })),
                                    );
                                }}
                            />

                            {values.related_entity && fieldOptions.length > 0 && (
                                <SelectField
                                    label={t("boards.initialFilter.labels.column")}
                                    name="field"
                                    value={values.field}
                                    placeholder={t("boards.initialFilter.placeholders.select")}
                                    error={errors?.field ?? ""}
                                    options={fieldOptions}
                                    onValueChange={(value) => {
                                        setFieldValue("field", value);
                                        const data_type =
                                            fieldOptions.find((field) => field.value === value)?.data_type || "";
                                        const upperDataType = data_type.toUpperCase();
                                        setDataType(upperDataType);

                                        if (values.comparison_type === "FUNCIONES") {
                                            setFieldValue("function_type", "");
                                            setFieldValue("days", "");
                                            setFieldValue("value", "");
                                        }
                                    }}
                                    isLoading={loadingFieldOptions}
                                />
                            )}

                            <SelectField
                                label={t("boards.initialFilter.labels.operator")}
                                name="operator"
                                value={values.operator}
                                placeholder={t("boards.initialFilter.placeholders.select")}
                                error={errors?.operator ?? ""}
                                options={operatorOptions()}
                                onValueChange={(value) => {
                                    setFieldValue("operator", value);
                                    if (value === "in" || value === "notIn") {
                                        setFieldValue("value", values.value != null ? String(values.value) : "");
                                    }
                                }}
                            />

                            <SelectField
                                label={t("boards.initialFilter.labels.comparisonType")}
                                name="comparison_type"
                                value={values.comparison_type}
                                placeholder={t("boards.initialFilter.placeholders.select")}
                                error={errors?.comparison_type ?? ""}
                                options={comparisonTypeOptions}
                                onValueChange={(value) => {
                                    setFieldValue("comparison_type", value);
                                    if (value !== "FUNCIONES") {
                                        setFieldValue("function_type", "");
                                        setFieldValue("days", "");
                                        setFieldValue("value", "");
                                    }
                                }}
                            />

                            {values.comparison_type === "VALUE" && (
                                <InputField
                                    label={t("boards.initialFilter.labels.value")}
                                    name="value"
                                    defaultValue={values.value}
                                    placeholder={t("boards.initialFilter.placeholders.value")}
                                    error={errors?.value ?? ""}
                                    onChange={(event) => {
                                        const value = event.target.value;
                                        const isInOrNotIn = values.operator === "in" || values.operator === "notIn";
                                        let parseValue = value;
                                        if (!isInOrNotIn) {
                                            switch (dataType) {
                                                case "NUMBER":
                                                    parseValue = Number(value);
                                                    break;
                                                case "BOOLEAN":
                                                    parseValue = Boolean(value);
                                                    break;
                                            }
                                        }
                                        setFieldValue(
                                            "value",
                                            dataType === "NUMBER" && isNaN(parseValue) ? value : parseValue,
                                        );
                                    }}
                                />
                            )}

                            {values.comparison_type === "FIELD" && (
                                <>
                                    <SelectField
                                        label={t("boards.initialFilter.labels.entity")}
                                        name="field_related_entity"
                                        value={values.field_related_entity}
                                        placeholder={t("boards.initialFilter.placeholders.select")}
                                        error={errors?.field_related_entity ?? ""}
                                        options={relationsOptions}
                                        onValueChange={async (selectedValue) => {
                                            setFieldValue("field_related_entity", selectedValue);
                                            setFieldValue("value", "");

                                            const relationOption = relationsOptions.find(
                                                (rel) => rel.value === selectedValue,
                                            );
                                            const actualRelatedEntity = relationOption?.related_entity || selectedValue;

                                            if (actualRelatedEntity.includes("aux_")) {
                                                try {
                                                    setLoadingValueFieldOptions(true);
                                                    const auxiliary = await fetchSchemaRules(actualRelatedEntity);
                                                    const options = generateAuxSelectOptions(
                                                        auxiliary,
                                                        () => {},
                                                        actualRelatedEntity,
                                                    );
                                                    const processedOptions = processAuxiliaryOptions(
                                                        options,
                                                        actualRelatedEntity,
                                                    );
                                                    setValueFieldOptions(processedOptions);
                                                } catch {
                                                    setValueFieldOptions([]);
                                                } finally {
                                                    setLoadingValueFieldOptions(false);
                                                }
                                                return;
                                            }

                                            const schemaField = getSchemaField(actualRelatedEntity);
                                            setValueFieldOptions(
                                                schemaField.map((field) => ({
                                                    label: field.column_name,
                                                    value: field.column_name,
                                                })),
                                            );
                                        }}
                                    />

                                    {values.field_related_entity && (
                                        <SelectField
                                            label={t("boards.initialFilter.labels.column")}
                                            name="value"
                                            value={values.value}
                                            placeholder={t("boards.initialFilter.placeholders.select")}
                                            error={errors?.value ?? ""}
                                            options={valueFieldOptions}
                                            isLoading={loadingValueFieldOptions}
                                            onValueChange={(value) => {
                                                setFieldValue("value", value);
                                            }}
                                        />
                                    )}
                                </>
                            )}

                            {values.comparison_type === "FUNCIONES" && (
                                <>
                                    <SelectField
                                        label={t("boards.initialFilter.labels.function")}
                                        name="function_type"
                                        value={values.function_type}
                                        placeholder={t("boards.initialFilter.placeholders.select")}
                                        error={errors?.function_type ?? ""}
                                        options={(dataType === "DATE"
                                            ? BOARDS_INITIAL_FILTER.FUNCTIONS
                                            : [
                                                  BOARDS_INITIAL_FILTER.LOGGED_IN_USER,
                                                  BOARDS_INITIAL_FILTER.LOGGED_IN_USER_GROUP,
                                                  BOARDS_INITIAL_FILTER.ACTIVE_CLIENT,
                                              ]
                                        ).map((func) => ({
                                            label: t(`boards.initialFilter.functionOptions.${func}`),
                                            value: func,
                                        }))}
                                        onValueChange={(value) => {
                                            setFieldValue("function_type", value);
                                            setFieldTouched("function_type", true, false);
                                            if (isBoardIdentityFunction(value)) {
                                                setFieldValue("days", "");
                                                setFieldValue("value", "");
                                            }
                                            setTimeout(() => validateField("function_type"), 0);
                                        }}
                                        onOpenChange={(open) => {
                                            if (!open) {
                                                setFieldTouched("function_type", true);
                                                setTimeout(() => validateField("function_type"), 0);
                                            }
                                        }}
                                    />
                                    {values.function_type === BOARDS_INITIAL_FILTER.ACTIVE_CLIENT && (
                                        <p className="text-sm text-muted-foreground">
                                            {t("boards.initialFilter.notes.active_client")}
                                        </p>
                                    )}
                                    {values.function_type && !isBoardIdentityFunction(values.function_type) && (
                                        <InputField
                                            label={t("boards.initialFilter.labels.days")}
                                            name="days"
                                            type="text"
                                            value={values.days || ""}
                                            placeholder={t("boards.initialFilter.placeholders.enterDays")}
                                            error={errors?.days ?? ""}
                                            onChange={(event) => {
                                                const value = event.target.value;
                                                setFieldValue("days", value);
                                                setFieldValue("value", value);
                                                setFieldTouched("days", true, false);
                                            }}
                                            onBlur={() => {
                                                setFieldTouched("days", true);
                                                validateField("days");
                                            }}
                                        />
                                    )}
                                </>
                            )}

                            <SelectField
                                label={t("boards.initialFilter.labels.type")}
                                name="type"
                                value={values.type}
                                placeholder={t("boards.initialFilter.placeholders.select")}
                                error={errors?.type ?? ""}
                                options={[
                                    { label: "AND", value: "and" },
                                    { label: "OR", value: "or" },
                                ]}
                                onValueChange={(value) => {
                                    setFieldValue("type", value);
                                }}
                            />

                            <div className="flex items-center justify-center">
                                <Button size="sm" type="submit" className="w-52">
                                    {t("boards.initialFilter.button.add")}
                                </Button>
                            </div>
                        </Form>
                    );
                }}
            </Formik>
        </BoardsTableSection>
    );
};

BoardsInitialFilter.propTypes = {
    initialData: PropTypes.object,
    primaryEntity: PropTypes.string,
    currentRelatedEntities: PropTypes.array,
    clearRows: PropTypes.bool,
    onSubmit: PropTypes.func,
};

export default BoardsInitialFilter;
