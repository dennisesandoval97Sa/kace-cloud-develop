import React, { useCallback, useEffect, useState } from "react";
import PropTypes from "prop-types";
import CreateModalButton from "@kace_v2/shared/ui/molecules/CreateModalButton";
import { BOARDS_COLUMNS, concatSeparatorOptions } from "@kace_v2/features/boards/constants/boards.constants";
import { Form, Formik } from "formik";
import { joiFormikAdapter } from "@kace/utils";
import { validateBoardsColumns } from "@kace_v2/features/boards/schemas/boards.schema";
import SelectField from "@kace_v2/shared/ui/molecules/SelectField";
import { SQL } from "@kace_v2/shared/constants/sql.constants";
import { fetchSchemaRules } from "@kace_v2/shared/services/schemas.services";
import { generateAuxSelectOptions } from "@/utils/generateAuxSelectOptions";
import useSchemaFields from "@kace/hooks/useSchemaFields";
import { processAuxiliaryOptions, normalizeAuxiliaryField } from "@kace_v2/features/boards/utils/auxiliaryOptions.util";
import InputField from "@kace_v2/shared/ui/molecules/InputField";
import SwitchField from "@kace_v2/shared/ui/molecules/SwitchField";
import CheckboxField from "@kace_v2/shared/ui/molecules/CheckboxField";
import { getFormatOptions } from "@kace_v2/shared/utils/get-format-options.util";
import Button from "@kace_v2/shared/ui/atoms/Button";
import DateTimePickerSingle from "@kace_v2/shared/ui/molecules/DateTimePickerSingle";
import FieldWrapper from "@kace_v2/shared/ui/molecules/FieldWrapper";
import {
    aggregateFunctionsTypeOptions,
    comparisonFunctionsTypeOptions,
    functionTypeOptions,
} from "@kace_v2/features/boards/utils/functionsTypeOptions.util";
import {
    extractBaseExpression,
    filterFieldsByFunction,
    isComparisonFunction,
    isAggregateFunction,
    isDateType,
} from "@kace_v2/features/boards/utils/boardFunctionsHelper.util";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ENTITY_STATE, FIELD_COLOR, FIELD_STATE } from "@kace_v2/shared/utils/board-colum-rules";
import {
    inferIsStatusColumn,
    isStatusOrIsActiveFieldPath,
} from "@kace_v2/features/boards/utils/boardStatusColumn.util";

const formatColor = {
    alias: FIELD_COLOR,
    data_type: "STRING",
    entity: ENTITY_STATE,
    field: FIELD_COLOR,
    format: null,
    function: null,
    function_type: null,
    group_by: false,
    is_filterable: false,
    position: "",
};

const BoardsColumnModalForm = ({
    defaultValues,
    relationsOptions = [],
    disabled = false,
    open = false,
    setOpen = () => {},
    onSubmit = () => {},
    onClose = () => {},
}) => {
    const { getSchemaField, getFieldData } = useSchemaFields();
    const { t } = useTranslation();
    const [initialValues, setInitialValues] = useState(defaultValues || BOARDS_COLUMNS.INITIAL_VALUES);
    const [fieldOptions, setFieldOptions] = useState([]);
    const [allFieldOptions, setAllFieldOptions] = useState([]);
    const [comparisonFieldOptions, setComparisonFieldOptions] = useState([]);
    const [isLoadingComparisonFields, setIsLoadingComparisonFields] = useState(false);

    const loadFieldOptions = useCallback(
        async (related_entity, functionValue = "") => {
            if (related_entity.includes("aux_")) {
                const auxiliary = await fetchSchemaRules(related_entity);

                const options = generateAuxSelectOptions(auxiliary, () => {}, related_entity);
                const processedOptions = processAuxiliaryOptions(options, related_entity);

                const schemaFields = getSchemaField(related_entity) || [];
                const allowedSystemFields = ["created_at", "updated_at"];

                const systemFields = schemaFields
                    .filter((field) => allowedSystemFields.includes(field.column_name))
                    .map((field) => ({
                        label: field.column_name,
                        value: field.column_name,
                        data_type: field.data_type,
                    }));

                const mergedOptions = [
                    ...processedOptions,
                    ...systemFields.filter((sys) => !processedOptions.some((opt) => opt.value === sys.value)),
                ];

                setAllFieldOptions(mergedOptions);

                const filtered = filterFieldsByFunction(mergedOptions, functionValue);
                setFieldOptions(filtered);

                return;
            }
            const schemaField = getSchemaField(related_entity);
            const options = schemaField.map((field) => ({
                label: field.column_name,
                value: field.column_name,
                data_type: field.data_type,
            }));
            setAllFieldOptions(options);
            const filtered = filterFieldsByFunction(options, functionValue);
            setFieldOptions(filtered);
        },
        [getSchemaField],
    );

    const loadComparisonFieldOptions = useCallback(
        async (comparison_entity) => {
            if (!comparison_entity) {
                setComparisonFieldOptions([]);
                setIsLoadingComparisonFields(false);
                return;
            }

            setIsLoadingComparisonFields(true);
            setComparisonFieldOptions([]);

            try {
                if (comparison_entity.includes("aux_")) {
                    const auxiliary = await fetchSchemaRules(comparison_entity);
                    const options = generateAuxSelectOptions(auxiliary, () => {}, comparison_entity);
                    const processedOptions = processAuxiliaryOptions(options, comparison_entity);
                    const filtered = processedOptions.filter((option) => {
                        const dataType = option.data_type;
                        return dataType?.toUpperCase() === "DATE";
                    });
                    setComparisonFieldOptions(filtered);
                } else {
                    const schemaField = getSchemaField(comparison_entity);
                    const options = schemaField
                        .filter((field) => field.data_type?.toUpperCase() === "DATE")
                        .map((field) => ({
                            label: field.column_name,
                            value: field.column_name,
                            data_type: field.data_type,
                        }));
                    setComparisonFieldOptions(options);
                }
            } finally {
                setIsLoadingComparisonFields(false);
            }
        },
        [getSchemaField],
    );

    useEffect(() => {
        if (!open) {
            return;
        }

        if (!defaultValues) {
            setInitialValues(BOARDS_COLUMNS.INITIAL_VALUES);
            setAllFieldOptions([]);
            setFieldOptions([]);
            setComparisonFieldOptions([]);
            setIsLoadingComparisonFields(false);
            return;
        }

        const values = { ...defaultValues };
        values.is_status_column = inferIsStatusColumn(values);

        if (values.function === "null" || values.function === null || values.function === undefined) {
            values.function = "";
        }
        if (values.function_type === "null" || values.function_type === null || values.function_type === undefined) {
            values.function_type = "";
        }

        if (values.format === null || values.format === undefined) {
            values.format = "";
        } else {
            values.format = String(values.format);
        }

        if (values.function && !values.function_type) {
            if (isComparisonFunction(values.function)) {
                values.function_type = SQL.FUNCTION_TYPES.COMPARISON;
            } else if (isAggregateFunction(values.function)) {
                values.function_type = SQL.FUNCTION_TYPES.AGGREGATE;
            } else if (values.function === SQL.CONCAT_FUNCTIONS.CONCAT) {
                values.function_type = SQL.FUNCTION_TYPES.CONCAT;
            }
        }

        if (values.function_type === SQL.FUNCTION_TYPES.CONCAT) {
            values.concat_sources = values.concat_sources ?? [];
            values.separator = values.separator ?? " ";
        }

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

            if (values.comparison_type === SQL.COMPARISON_TYPES.FIELD && values.comparison_entity) {
                const comparisonRelationOption = relationsOptions.find(
                    (rel) => rel.value === values.comparison_entity || rel.alias === values.comparison_entity,
                );
                const actualComparisonEntity = comparisonRelationOption?.related_entity || values.comparison_entity;
                loadComparisonFieldOptions(actualComparisonEntity);
            }
        } else {
            setInitialValues(values);
        }
    }, [
        open,
        defaultValues?.id,
        defaultValues?.field,
        defaultValues?.function,
        defaultValues?.related_entity,
        loadFieldOptions,
        loadComparisonFieldOptions,
    ]);

    return (
        <CreateModalButton
            title={t("boards.form.columns.title")}
            description={t("boards.form.columns.description")}
            label={t("boards.form.columns.label")}
            className="sm:max-w-2xl"
            open={open}
            onOpenChange={(value) => {
                if (!value) {
                    setInitialValues(BOARDS_COLUMNS.INITIAL_VALUES);
                    setAllFieldOptions([]);
                    setFieldOptions([]);
                    setComparisonFieldOptions([]);
                    setIsLoadingComparisonFields(false);
                    onClose();
                }
                setOpen(value);
            }}
            disabled={disabled}
        >
            <Formik
                initialValues={initialValues}
                validationSchema={joiFormikAdapter(validateBoardsColumns)}
                onSubmit={(values) => {
                    if (values.function_type === SQL.FUNCTION_TYPES.CONCAT) {
                        const concatRelationOption = relationsOptions.find(
                            (rel) => rel.value === values.related_entity || rel.alias === values.related_entity,
                        );
                        const concatEntity = concatRelationOption?.alias || values.related_entity;
                        onSubmit([
                            {
                                ...(values.id != null && values.id !== "" ? { id: values.id } : {}),
                                alias: values.alias,
                                entity: concatEntity,
                                field: "",
                                function: SQL.CONCAT_FUNCTIONS.CONCAT,
                                function_type: SQL.FUNCTION_TYPES.CONCAT,
                                concat_sources: values.concat_sources ?? [],
                                separator: values.separator ?? " ",
                                data_type: "STRING",
                                is_filterable: values.is_filterable || false,
                                visible: values.visible !== false,
                                group_by: false,
                                position: values.position ?? "",
                            },
                        ]);
                        return;
                    }

                    const { related_entity, ...rest } = values;
                    const relationOption = relationsOptions.find(
                        (rel) => rel.value === values.related_entity || rel.alias === values.related_entity,
                    );
                    const entity = relationOption?.alias || related_entity;
                    const rowId = values.id;

                    const toNullIfEmpty = (v) =>
                        v === "" || v == null || String(v).toLowerCase() === "null" ? null : String(v).toLowerCase();
                    const transformedValues = {
                        ...rest,
                        ...(rowId != null && rowId !== "" ? { id: rowId } : {}),
                        entity,
                        function: toNullIfEmpty(values.function),
                        function_type: toNullIfEmpty(values.function_type),
                        format:
                            values.format === "" || values.format === null || values.format === undefined
                                ? null
                                : values.format,
                        is_filterable:
                            values.function === SQL.COMPARISON_FUNCTIONS.DATE_DIFFERENCE
                                ? false
                                : values.is_filterable || false,
                        is_status_column: isStatusOrIsActiveFieldPath(values.field) && Boolean(values.is_status_column),
                    };

                    if (isComparisonFunction(values.function)) {
                        const comparisonType = values.comparison_type
                            ? String(values.comparison_type).toLowerCase()
                            : null;
                        transformedValues.comparison_type = comparisonType;

                        if (comparisonType === SQL.COMPARISON_TYPES.NOW) {
                            transformedValues.comparison_value = SQL.COMPARISON_TYPES.NOW.toUpperCase();
                            delete transformedValues.comparison_entity;
                            delete transformedValues.comparison_field;
                        } else if (comparisonType === SQL.COMPARISON_TYPES.VALUE) {
                            transformedValues.comparison_value = values.comparison_value || null;
                            delete transformedValues.comparison_entity;
                            delete transformedValues.comparison_field;
                        } else if (comparisonType === SQL.COMPARISON_TYPES.FIELD) {
                            transformedValues.comparison_entity = values.comparison_entity || null;
                            transformedValues.comparison_field = values.comparison_field || null;
                            delete transformedValues.comparison_value;
                        }
                    } else {
                        delete transformedValues.comparison_type;
                        delete transformedValues.comparison_value;
                        delete transformedValues.comparison_entity;
                        delete transformedValues.comparison_field;
                    }
                    const isTransitionEstado =
                        transformedValues.entity === ENTITY_STATE && transformedValues.field === FIELD_STATE;
                    let columnsToSubmit = [transformedValues];

                    if (isTransitionEstado) {
                        const colorColumn = formatColor;

                        columnsToSubmit.push(colorColumn);
                    }
                    onSubmit(columnsToSubmit);
                }}
                enableReinitialize={true}
            >
                {({ setFieldValue, setValues, values, errors }) => {
                    return (
                        <Form autoComplete="off" className="flex flex-col gap-4">
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
                                    setFieldValue("function_type", "");
                                    setFieldValue("function", "");
                                    setFieldValue("comparison_type", "");
                                    setFieldValue("comparison_value", "");
                                    setFieldValue("comparison_entity", "");
                                    setFieldValue("comparison_field", "");
                                    setFieldValue("concat_sources", []);
                                    setFieldValue("is_status_column", false);
                                    setComparisonFieldOptions([]);
                                    const relationOption = relationsOptions.find((rel) => rel.value === selectedValue);
                                    const actualRelatedEntity = relationOption?.related_entity || selectedValue;
                                    await loadFieldOptions(actualRelatedEntity, "");
                                }}
                            />

                            {values.related_entity &&
                                fieldOptions?.length > 0 &&
                                values.function_type !== SQL.FUNCTION_TYPES.CONCAT && (
                                    <SelectField
                                        label={t("boards.form.labels.column")}
                                        name="field"
                                        value={extractBaseExpression(values.field) || undefined}
                                        placeholder={t("boards.form.placeholders.select")}
                                        error={errors?.field ?? ""}
                                        options={fieldOptions}
                                        onValueChange={(value) => {
                                            const fieldData = getFieldData(value);
                                            const auxDataType = fieldOptions.find((item) => item.value === value);
                                            const dataType =
                                                auxDataType?.data_type?.toUpperCase() ||
                                                fieldData?.data_type?.toUpperCase();

                                            setFieldValue("field", value);
                                            setFieldValue("data_type", dataType || "");
                                            setFieldValue(
                                                "is_status_column",
                                                inferIsStatusColumn({
                                                    ...values,
                                                    field: value,
                                                    is_status_column: undefined,
                                                }),
                                            );

                                            if (isComparisonFunction(values.function)) {
                                                setFieldValue("comparison_type", "");
                                                setFieldValue("comparison_value", "");
                                                setFieldValue("comparison_entity", "");
                                                setFieldValue("comparison_field", "");
                                                setComparisonFieldOptions([]);
                                            }
                                        }}
                                    />
                                )}

                            {values.related_entity && (
                                <>
                                    <SelectField
                                        label={t("boards.form.labels.functionType")}
                                        name="function_type"
                                        value={values.function_type || "__none__"}
                                        placeholder={t("boards.form.placeholders.selectFunctionType")}
                                        error={errors?.function_type ?? ""}
                                        options={[
                                            { label: t("boards.form.labels.none"), value: "__none__" },
                                            ...functionTypeOptions(t),
                                        ]}
                                        onValueChange={async (functionTypeValue) => {
                                            const actualType =
                                                functionTypeValue === "__none__" ? "" : functionTypeValue;
                                            setFieldValue("function_type", actualType);
                                            setFieldValue("function", "");
                                            setFieldValue("comparison_type", "");
                                            setFieldValue("comparison_value", "");
                                            setFieldValue("comparison_entity", "");
                                            setFieldValue("comparison_field", "");
                                            setFieldValue("concat_sources", []);
                                            setComparisonFieldOptions([]);
                                            setFieldValue("group_by", false);
                                            if (actualType === SQL.FUNCTION_TYPES.CONCAT) {
                                                setFieldValue("function", SQL.CONCAT_FUNCTIONS.CONCAT);
                                                setFieldValue("data_type", "STRING");
                                                setFieldValue("field", "");
                                            }
                                        }}
                                    />

                                    {values.function_type === SQL.FUNCTION_TYPES.CONCAT && (
                                        <>
                                            <div className="flex flex-col gap-2">
                                                <div className="flex items-center justify-between">
                                                    <label className="text-sm font-medium leading-none">
                                                        {t("boards.form.labels.concatSources")}
                                                        <span className="text-red-500 ml-1">*</span>
                                                    </label>
                                                    {errors?.concat_sources &&
                                                        typeof errors.concat_sources === "string" && (
                                                            <span className="text-xs text-red-500">
                                                                {errors.concat_sources}
                                                            </span>
                                                        )}
                                                </div>
                                                {(values.concat_sources ?? []).map((source, index) => {
                                                    const resolvedAlias =
                                                        relationsOptions.find(
                                                            (r) =>
                                                                r.value === values.related_entity ||
                                                                r.alias === values.related_entity,
                                                        )?.alias || values.related_entity;
                                                    return (
                                                        <div
                                                            key={`${source.entity}-${source.field}-${index}`}
                                                            className="flex items-center gap-2"
                                                        >
                                                            <div className="flex-1">
                                                                <SelectField
                                                                    label=""
                                                                    name={`concat_sources_${index}`}
                                                                    value={source.field || ""}
                                                                    placeholder={t("boards.form.placeholders.select")}
                                                                    options={fieldOptions}
                                                                    error=""
                                                                    onValueChange={(value) => {
                                                                        const newSources = [
                                                                            ...(values.concat_sources ?? []),
                                                                        ];
                                                                        newSources[index] = {
                                                                            entity: resolvedAlias,
                                                                            field: value,
                                                                        };
                                                                        setFieldValue("concat_sources", newSources);
                                                                    }}
                                                                />
                                                            </div>
                                                            <button
                                                                type="button"
                                                                className="text-red-500 hover:text-red-700 text-lg px-2 pb-1"
                                                                onClick={() => {
                                                                    const newSources = (
                                                                        values.concat_sources ?? []
                                                                    ).filter((_, i) => i !== index);
                                                                    setFieldValue("concat_sources", newSources);
                                                                }}
                                                            >
                                                                ×
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="w-fit"
                                                    onClick={() => {
                                                        const resolvedAlias =
                                                            relationsOptions.find(
                                                                (r) =>
                                                                    r.value === values.related_entity ||
                                                                    r.alias === values.related_entity,
                                                            )?.alias || values.related_entity;
                                                        setFieldValue("concat_sources", [
                                                            ...(values.concat_sources ?? []),
                                                            { entity: resolvedAlias, field: "" },
                                                        ]);
                                                    }}
                                                >
                                                    + {t("boards.form.labels.addColumn")}
                                                </Button>
                                            </div>
                                            <SelectField
                                                label={t("boards.form.labels.separator")}
                                                name="separator"
                                                value={values.separator ?? " "}
                                                placeholder={t("boards.form.placeholders.select")}
                                                options={concatSeparatorOptions(t)}
                                                error={errors?.separator ?? ""}
                                                onValueChange={(value) => setFieldValue("separator", value)}
                                            />
                                        </>
                                    )}

                                    {values.function_type && values.function_type !== SQL.FUNCTION_TYPES.CONCAT && (
                                        <SelectField
                                            label={t("boards.form.labels.function")}
                                            name="function"
                                            value={values.function || "__none__"}
                                            placeholder={t("boards.form.placeholders.selectFunction")}
                                            error={errors?.function ?? ""}
                                            options={[
                                                { label: t("boards.form.labels.none"), value: "__none__" },
                                                ...(values.function_type === SQL.FUNCTION_TYPES.AGGREGATE
                                                    ? aggregateFunctionsTypeOptions()
                                                    : comparisonFunctionsTypeOptions(t)),
                                            ]}
                                            onValueChange={async (functionValue) => {
                                                const actualValue = functionValue === "__none__" ? "" : functionValue;
                                                const previousFunction = values.function || "";
                                                const isFirstTimeSelectingFunction = !previousFunction && actualValue;
                                                const isComparison = isComparisonFunction(actualValue);
                                                const isAggregate = isAggregateFunction(actualValue);

                                                if (isComparison && values.field) {
                                                    const currentField = extractBaseExpression(values.field);
                                                    let fieldOption = fieldOptions.find(
                                                        (opt) => opt.value === currentField,
                                                    );
                                                    if (!fieldOption) {
                                                        fieldOption = allFieldOptions.find(
                                                            (opt) => opt.value === currentField,
                                                        );
                                                    }
                                                    const fieldData = getFieldData(currentField);
                                                    const fieldDataType =
                                                        fieldOption?.data_type || fieldData?.data_type;

                                                    if (!isDateType(fieldDataType)) {
                                                        toast.warning(t("boards.errors.dateFieldRequired"), {
                                                            duration: 4000,
                                                        });
                                                        setFieldValue("field", "");
                                                        setFieldValue("data_type", "");
                                                    }
                                                }

                                                setFieldValue("function", actualValue);

                                                if (isAggregate || !actualValue) {
                                                    setFieldValue("comparison_type", "");
                                                    setFieldValue("comparison_value", "");
                                                    setFieldValue("comparison_entity", "");
                                                    setFieldValue("comparison_field", "");
                                                    setComparisonFieldOptions([]);
                                                    if (isFirstTimeSelectingFunction) {
                                                        setFieldValue("group_by", true);
                                                    }
                                                }

                                                if (isComparison) {
                                                    setFieldValue("group_by", false);
                                                    setFieldValue("format", null);
                                                    if (actualValue === SQL.COMPARISON_FUNCTIONS.DATE_DIFFERENCE) {
                                                        setFieldValue("is_filterable", false);
                                                    }
                                                    if (!values.comparison_type) {
                                                        setFieldValue("comparison_value", "");
                                                        setFieldValue("comparison_entity", "");
                                                        setFieldValue("comparison_field", "");
                                                        setComparisonFieldOptions([]);
                                                    }
                                                }

                                                if (values.related_entity) {
                                                    const relationOption = relationsOptions.find(
                                                        (rel) =>
                                                            rel.value === values.related_entity ||
                                                            rel.alias === values.related_entity,
                                                    );
                                                    const actualRelatedEntity =
                                                        relationOption?.related_entity || values.related_entity;
                                                    await loadFieldOptions(actualRelatedEntity, actualValue);
                                                } else {
                                                    const filtered = filterFieldsByFunction(
                                                        allFieldOptions,
                                                        actualValue,
                                                    );
                                                    setFieldOptions(filtered);
                                                }
                                            }}
                                        />
                                    )}
                                </>
                            )}

                            {isComparisonFunction(values.function) && values.field && (
                                <>
                                    <SelectField
                                        label={t("boards.form.labels.comparisonType")}
                                        name="comparison_type"
                                        value={values.comparison_type || ""}
                                        placeholder={t("boards.form.placeholders.selectComparisonType")}
                                        error={errors?.comparison_type ?? ""}
                                        options={[
                                            {
                                                label: t("boards.form.comparisonTypes.now"),
                                                value: SQL.COMPARISON_TYPES.NOW,
                                            },
                                            {
                                                label: t("boards.form.comparisonTypes.value"),
                                                value: SQL.COMPARISON_TYPES.VALUE,
                                            },
                                            {
                                                label: t("boards.form.comparisonTypes.field"),
                                                value: SQL.COMPARISON_TYPES.FIELD,
                                            },
                                        ]}
                                        onValueChange={async (comparisonType) => {
                                            const nextValue =
                                                comparisonType === SQL.COMPARISON_TYPES.NOW
                                                    ? SQL.COMPARISON_TYPES.NOW.toUpperCase()
                                                    : "";
                                            setValues(
                                                {
                                                    ...values,
                                                    comparison_type: comparisonType,
                                                    comparison_value: nextValue,
                                                    comparison_entity: "",
                                                    comparison_field: "",
                                                },
                                                true,
                                            );
                                            if (comparisonType === SQL.COMPARISON_TYPES.FIELD) {
                                                setComparisonFieldOptions([]);
                                                setIsLoadingComparisonFields(false);
                                            }
                                        }}
                                    />

                                    {values.comparison_type === SQL.COMPARISON_TYPES.NOW && (
                                        <InputField
                                            label={t("boards.form.labels.comparisonValue")}
                                            name="comparison_value"
                                            value={SQL.COMPARISON_TYPES.NOW.toUpperCase()}
                                            disabled
                                            error={errors?.comparison_value ?? ""}
                                        />
                                    )}

                                    {values.comparison_type === SQL.COMPARISON_TYPES.VALUE && (
                                        <FieldWrapper
                                            label={t("boards.form.labels.comparisonValue")}
                                            error={errors?.comparison_value ?? ""}
                                        >
                                            <DateTimePickerSingle
                                                value={values.comparison_value || null}
                                                onChange={(value) => {
                                                    setFieldValue("comparison_value", value);
                                                }}
                                                placeholder={t("boards.form.placeholders.enterComparisonValue")}
                                                error={errors?.comparison_value}
                                                touched={!!errors?.comparison_value}
                                                noInitialDate
                                            />
                                        </FieldWrapper>
                                    )}

                                    {values.comparison_type === SQL.COMPARISON_TYPES.FIELD && (
                                        <>
                                            <SelectField
                                                label={t("boards.form.labels.comparisonEntity")}
                                                name="comparison_entity"
                                                value={values.comparison_entity || ""}
                                                placeholder={t("boards.form.placeholders.selectComparisonEntity")}
                                                error={errors?.comparison_entity ?? ""}
                                                options={relationsOptions}
                                                onValueChange={async (selectedValue) => {
                                                    setFieldValue("comparison_entity", selectedValue);
                                                    setFieldValue("comparison_field", "");
                                                    const relationOption = relationsOptions.find(
                                                        (rel) => rel.value === selectedValue,
                                                    );
                                                    const actualRelatedEntity =
                                                        relationOption?.related_entity || selectedValue;
                                                    await loadComparisonFieldOptions(actualRelatedEntity);
                                                }}
                                            />

                                            <SelectField
                                                label={t("boards.form.labels.comparisonField")}
                                                name="comparison_field"
                                                value={values.comparison_field || ""}
                                                placeholder={
                                                    isLoadingComparisonFields
                                                        ? t("boards.form.placeholders.loading")
                                                        : t("boards.form.placeholders.selectComparisonField")
                                                }
                                                error={errors?.comparison_field ?? ""}
                                                options={comparisonFieldOptions}
                                                isLoading={isLoadingComparisonFields}
                                                disabled={
                                                    !values.comparison_entity ||
                                                    isLoadingComparisonFields ||
                                                    comparisonFieldOptions.length === 0
                                                }
                                                onValueChange={(value) => {
                                                    setFieldValue("comparison_field", value);
                                                }}
                                            />
                                        </>
                                    )}
                                </>
                            )}

                            <InputField
                                label="Alias"
                                name="alias"
                                defaultValue={values.alias}
                                onChange={(e) => {
                                    setFieldValue("alias", e.target.value);
                                }}
                                placeholder="alias"
                                error={errors?.alias ?? ""}
                            />

                            <SwitchField
                                label={t("boards.form.labels.isFilterable")}
                                name="is_filterable"
                                checked={values.is_filterable}
                                disabled={values.function === SQL.COMPARISON_FUNCTIONS.DATE_DIFFERENCE}
                                onCheckedChange={(value) => {
                                    setFieldValue("is_filterable", value);
                                }}
                                error={errors?.is_filterable ?? ""}
                            />

                            <SwitchField
                                label={t("boards.form.labels.isAns", { defaultValue: "Es ANS" })}
                                name="is_ans"
                                checked={Boolean(values.is_ans)}
                                onCheckedChange={(value) => {
                                    setFieldValue("is_ans", value);
                                }}
                                error={errors?.is_ans ?? ""}
                            />

                            {isStatusOrIsActiveFieldPath(values.field) && (
                                <SwitchField
                                    label={t("boards.form.labels.isStatusColumn", {
                                        defaultValue: "Es columna de estado",
                                    })}
                                    name="is_status_column"
                                    checked={Boolean(values.is_status_column)}
                                    onCheckedChange={(value) => {
                                        setFieldValue("is_status_column", value);
                                    }}
                                    error={errors?.is_status_column ?? ""}
                                />
                            )}

                            <SwitchField
                                label={t("boards.form.labels.visible")}
                                name="visible"
                                checked={values.visible !== false}
                                onCheckedChange={(value) => {
                                    setFieldValue("visible", value);
                                }}
                                error={errors?.visible ?? ""}
                            />

                            {!isComparisonFunction(values.function) && (
                                <CheckboxField
                                    label={t("boards.form.labels.groupBy")}
                                    name="group_by"
                                    checked={values.function ? true : values.group_by}
                                    disabled={!!values.function}
                                    onCheckedChange={(value) => {
                                        if (!values.function) {
                                            setFieldValue("group_by", value);
                                        }
                                    }}
                                    error={errors?.group_by ?? ""}
                                />
                            )}

                            {(values.field || values.function_type === SQL.FUNCTION_TYPES.CONCAT) && (
                                <InputField
                                    label={t("boards.form.labels.dataType")}
                                    name="data_type"
                                    value={
                                        values.function_type === SQL.FUNCTION_TYPES.CONCAT ? "STRING" : values.data_type
                                    }
                                    disabled
                                />
                            )}

                            {values.data_type &&
                                getFormatOptions(values.data_type).length > 0 &&
                                !isComparisonFunction(values.function) && (
                                    <SelectField
                                        label={t("boards.form.labels.format")}
                                        name="format"
                                        value={values.format || ""}
                                        placeholder={t("boards.form.placeholders.select")}
                                        error={errors?.format ?? ""}
                                        options={getFormatOptions(values.data_type)}
                                        onValueChange={(value) => {
                                            setFieldValue(
                                                "format",
                                                value === "" || value === null || value === undefined ? null : value,
                                            );
                                        }}
                                    />
                                )}

                            <div className="flex items-center justify-center">
                                <Button
                                    size="sm"
                                    type="submit"
                                    className="w-52"
                                    disabled={Object.entries(errors).length > 0}
                                >
                                    {defaultValues?.id ? t("button.save") : t("button.add")}
                                </Button>
                            </div>
                        </Form>
                    );
                }}
            </Formik>
        </CreateModalButton>
    );
};

BoardsColumnModalForm.propTypes = {
    defaultValues: PropTypes.object,
    relationsOptions: PropTypes.array,
    disabled: PropTypes.bool,
    open: PropTypes.bool,
    setOpen: PropTypes.func,
    onSubmit: PropTypes.func,
    onClose: PropTypes.func,
};

export default BoardsColumnModalForm;
