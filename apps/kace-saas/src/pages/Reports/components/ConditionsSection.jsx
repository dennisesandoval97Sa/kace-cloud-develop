import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState, useRef } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";

import InputCard from "@/components/core/Cards/InputCard";
import SectionForm from "@/components/core/Cards/section-form";
import useSchemaFields from "@/hooks/useSchemaFields";
import { Button, InputForm as Input, KField, SelectForm } from "@kace/ui-shared";
import MultiSelect from "@/componentsV2/core/MultiSelect";
import { CONDITION_OPTIONS } from "../data/constants";
import { useReportDistinctValuesInfinite } from "../hooks/useReportDistinctValuesInfinite";
import { formatDate } from "@kace_v2/shared/utils/format-date.util.js";

const LIST_OPERATORS = ["in", "notIn"];

const formatLabel = (val) => {
    if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}/.test(val)) {
        const d = new Date(val);
        if (!isNaN(d)) return formatDate(val, "DD/MM/YYYY");
    }
    return String(val);
};

const SEARCH_DEBOUNCE_MS = 400;

const ConditionValueInput = ({ condition, reportName, handleFieldChange }) => {
    const { t } = useTranslation();
    const isListOperator = LIST_OPERATORS.includes(condition.condition);

    const [debouncedFilter, setDebouncedFilter] = useState("");
    const debounceRef = useRef(null);

    const {
        data: infiniteData,
        isLoading,
        isFetchingNextPage,
        fetchNextPage,
    } = useReportDistinctValuesInfinite(
        isListOperator ? reportName : null,
        isListOperator ? condition.field : null,
        debouncedFilter,
    );

    const distinctValues = useMemo(
        () =>
            (infiniteData?.pages ?? [])
                .flatMap((page) => page.data ?? [])
                .map((item) => ({
                    ...item,
                    id: String(item.id),
                    value: String(item.value),
                    label: formatLabel(item.value),
                })),
        [infiniteData],
    );

    const selectedValues = Array.isArray(condition.value) ? condition.value : [];

    const handleSelectOption = (itemId) => {
        const exists = selectedValues.some((i) => i.id === itemId);
        const next = exists
            ? selectedValues.filter((i) => i.id !== itemId)
            : [...selectedValues, distinctValues.find((i) => i.id === itemId)].filter(Boolean);
        handleFieldChange(condition.id, "value", next);
    };

    const handleSelectAll = () => {
        handleFieldChange(condition.id, "value", [...distinctValues]);
    };

    const handleDeselectAll = () => handleFieldChange(condition.id, "value", []);

    if (isListOperator) {
        return (
            <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-700">{t("reports.form.value")}</label>
                <MultiSelect
                    options={distinctValues}
                    selectedData={selectedValues}
                    isLoading={isLoading}
                    isFetchingNextPage={isFetchingNextPage}
                    fetchNextPage={fetchNextPage}
                    onInputChange={(value) => {
                        clearTimeout(debounceRef.current);
                        debounceRef.current = setTimeout(() => setDebouncedFilter(value), SEARCH_DEBOUNCE_MS);
                    }}
                    onSelectOption={handleSelectOption}
                    onSelectedAll={handleSelectAll}
                    showDeselectAll
                    onDeselectAll={handleDeselectAll}
                    dataTestid={`condition_${condition.id}`}
                />
            </div>
        );
    }

    return (
        <Input
            id={`conditions_value_${condition.id}`}
            name={`conditions_value_${condition.id}`}
            label={t("reports.form.value")}
            type="text"
            placeholder={t("reports.form.valuePlaceholder")}
            onChange={(e) => handleFieldChange(condition.id, "value", e.target.value)}
            value={typeof condition.value === "string" ? condition.value : ""}
            className="flex flex-col items-start justify-start text-start"
            data-testid={`input_condition_value_${condition.id}`}
        />
    );
};

export const ConditionsSection = ({ conditions, setFieldValue, reportName }) => {
    const { t } = useTranslation();
    const { getSchemaField } = useSchemaFields();

    const fields = useMemo(() => {
        if (!reportName) {
            return [];
        }

        const schemaFields = getSchemaField(reportName);

        if (!schemaFields || schemaFields.length === 0) {
            return [];
        }

        const transformedFields = schemaFields
            .filter((field) => {
                const fieldName = field.column_name || field.name || "";
                return !fieldName.startsWith("filter_") && !fieldName.startsWith("reporting_");
            })
            .map((field) => ({
                value: field.column_name || field.name,
                label: field.label && field.label !== "undefined" ? field.label : field.column_name,
            }));

        return transformedFields;
    }, [reportName, getSchemaField]);

    const handleAddCondition = () => {
        const newCondition = {
            id: Date.now(),
            field: "",
            condition: "",
            value: "",
        };
        const updatedConditions = [...conditions, newCondition];
        setFieldValue("conditions", updatedConditions);
    };

    const handleRemoveCondition = (id) => {
        const updatedConditions = conditions.filter((condition) => condition.id !== id);
        setFieldValue("conditions", updatedConditions);
    };

    const handleFieldChange = (id, field, value) => {
        const updatedConditions = conditions.map((condition) =>
            condition.id === id ? { ...condition, [field]: value } : condition,
        );
        setFieldValue("conditions", updatedConditions);
    };

    return (
        <div className="flex flex-col col-span-3 gap-8">
            <SectionForm id="reports_form_conditions" dataTestId="reports_form_conditions">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-base font-semibold text-gray-700">{t("reports.form.conditions")}</h3>
                    <Button
                        type="button"
                        onClick={handleAddCondition}
                        className="flex items-center gap-2"
                        variant="outline"
                        size="sm"
                        data-testid="btn_add_condition"
                    >
                        <Plus className="w-4 h-4" />
                        {t("reports.form.addCondition")}
                    </Button>
                </div>

                {conditions.length === 0 && (
                    <InputCard>
                        <div className="flex flex-col items-center justify-center p-8 text-center text-gray-500">
                            <p>{t("reports.form.noConditions")}</p>
                            <p className="text-sm mt-2">{t("reports.form.clickToAdd")}</p>
                        </div>
                    </InputCard>
                )}

                {conditions.map((condition, index) => (
                    <InputCard key={condition.id}>
                        <div className="flex flex-col gap-4 p-4 bg-white rounded-md border border-gray-200">
                            <div className="flex justify-between items-center mb-2">
                                <h4 className="text-sm font-semibold text-gray-600">
                                    {t("reports.form.condition")} #{index + 1}
                                </h4>
                                <Button
                                    type="button"
                                    onClick={() => handleRemoveCondition(condition.id)}
                                    variant="ghost"
                                    size="sm"
                                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                    data-testid={`btn_remove_condition_${condition.id}`}
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <KField>
                                    <SelectForm
                                        id={`conditions.${index}.field`}
                                        name={`conditions.${index}.field`}
                                        label={t("reports.form.selectField")}
                                        options={fields}
                                        placeholder={
                                            fields.length === 0
                                                ? t("reports.form.noFieldsAvailable")
                                                : t("reports.form.fieldPlaceholder")
                                        }
                                        handle={(newField) => {
                                            if (newField === condition.field) return;
                                            const isListOperator = LIST_OPERATORS.includes(condition.condition);
                                            const updatedConditions = conditions.map((c) =>
                                                c.id === condition.id
                                                    ? { ...c, field: newField, value: isListOperator ? [] : "" }
                                                    : c,
                                            );
                                            setFieldValue("conditions", updatedConditions);
                                        }}
                                        dataTestId={`select_condition_field_${condition.id}`}
                                        disabled={fields.length === 0}
                                        required
                                    />
                                </KField>

                                <KField>
                                    <SelectForm
                                        id={`conditions.${index}.condition`}
                                        name={`conditions.${index}.condition`}
                                        label={t("reports.form.condition")}
                                        options={CONDITION_OPTIONS}
                                        placeholder={t("reports.form.conditionPlaceholder")}
                                        handle={(newOperator) => {
                                            if (newOperator === condition.condition) return;
                                            const isListOperator = LIST_OPERATORS.includes(newOperator);
                                            const updatedConditions = conditions.map((c) =>
                                                c.id === condition.id
                                                    ? { ...c, condition: newOperator, value: isListOperator ? [] : "" }
                                                    : c,
                                            );
                                            setFieldValue("conditions", updatedConditions);
                                        }}
                                        dataTestId={`select_condition_operator_${condition.id}`}
                                    />
                                </KField>

                                <KField>
                                    <ConditionValueInput
                                        condition={condition}
                                        reportName={reportName}
                                        handleFieldChange={handleFieldChange}
                                    />
                                </KField>
                            </div>
                        </div>
                    </InputCard>
                ))}
            </SectionForm>
        </div>
    );
};

ConditionValueInput.propTypes = {
    condition: PropTypes.object.isRequired,
    reportName: PropTypes.string,
    handleFieldChange: PropTypes.func.isRequired,
};

ConditionsSection.propTypes = {
    conditions: PropTypes.array.isRequired,
    setFieldValue: PropTypes.func.isRequired,
    reportName: PropTypes.string,
};
