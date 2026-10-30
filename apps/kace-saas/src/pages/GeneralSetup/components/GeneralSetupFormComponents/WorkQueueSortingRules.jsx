import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import CreateModalButton from "@kace_v2/shared/ui/molecules/CreateModalButton";
import DataTable from "@kace_v2/shared/ui/organisms/DataTable";
import { Form, Formik, useFormikContext } from "formik";
import SelectField from "@kace_v2/shared/ui/molecules/SelectField";
import Button from "@kace_v2/shared/ui/atoms/Button";
import { v4 as uuidv4 } from "uuid";

const INITIAL_VALUES = { assign_strategy: "", cast_type: "", order_type: "" };

const ORDER_TYPES = {
    asc: "ASC",
    desc: "DESC",
    asc_nulls_first: "ASC NULLS FIRST",
    desc_nulls_last: "DESC NULLS LAST",
};

const normalizeRuleRow = (row) => ({
    id: row?.id,
    assign_strategy: row?.assign_strategy || "",
    cast_type: row?.cast_type || "",
    order_type: ORDER_TYPES[row?.order_type] ?? row?.order_type ?? "",
});

const validateRule = (formValues, t) => {
    const errors = {};
    const requiredMessage = t("validations.required", "Required");
    if (!formValues.assign_strategy) errors.assign_strategy = requiredMessage;
    if (!formValues.cast_type) errors.cast_type = requiredMessage;
    if (!formValues.order_type) errors.order_type = requiredMessage;
    return errors;
};

const useOptions = (t, caseFieldOptions) =>
    useMemo(
        () => ({
            assignStrategy: [
                { value: "case_ans", label: t("generalSetup.form.labels.caseAns") },
                { value: "state_ans", label: t("generalSetup.form.labels.stateAns") },
                { value: "created_at", label: t("generalSetup.form.labels.caseCreatedAt") },
                ...caseFieldOptions.map(({ value, label }) => ({
                    value: `aux_cases.${value}`,
                    label,
                })),
            ],
            castType: [
                { value: "int", label: t("generalSetup.form.labels.int") },
                { value: "date", label: t("generalSetup.form.labels.date") },
                { value: "epoch", label: t("generalSetup.form.labels.epoch") },
                { value: "other", label: t("generalSetup.form.labels.other") },
            ],
            orderType: [
                { value: "ASC", label: t("generalSetup.form.labels.ascending") },
                { value: "DESC", label: t("generalSetup.form.labels.descending") },
                { value: "ASC NULLS FIRST", label: t("generalSetup.form.labels.ascNullsFirst") },
                { value: "DESC NULLS LAST", label: t("generalSetup.form.labels.descNullsLast") },
            ],
        }),
        [t, caseFieldOptions],
    );

const useModalForm = () => {
    const [open, setOpen] = useState(false);
    const [initialValues, setInitialValues] = useState(INITIAL_VALUES);

    const openEdit = (row) => {
        setInitialValues(row);
        setOpen(true);
    };

    const closeModal = () => {
        setInitialValues(INITIAL_VALUES);
        setOpen(false);
    };

    return { open, setOpen, initialValues, openEdit, closeModal };
};

const SortingRuleForm = ({ options }) => {
    const { t } = useTranslation();
    const { values, errors, setFieldValue } = useFormikContext();

    const fields = [
        {
            name: "assign_strategy",
            label: t("generalSetup.form.labels.fieldForCaseSorting"),
            options: options.assignStrategy,
        },
        {
            name: "cast_type",
            label: t("generalSetup.form.labels.valueType"),
            options: options.castType,
        },
        {
            name: "order_type",
            label: t("generalSetup.form.labels.orderType"),
            options: options.orderType,
        },
    ];

    return (
        <Form autoComplete="off" className="flex flex-col gap-4">
            {fields.map(({ name, label, options: fieldOptions }) => (
                <SelectField
                    key={name}
                    label={label}
                    placeholder={label}
                    options={fieldOptions}
                    value={values[name] || ""}
                    error={errors[name]}
                    onValueChange={(value) => setFieldValue(name, value)}
                />
            ))}
            <div className="flex items-center justify-center pt-4">
                <Button
                    size="sm"
                    type="submit"
                    className="w-52"
                    disabled={!values.assign_strategy || !values.cast_type || !values.order_type}
                >
                    {t("button.save")}
                </Button>
            </div>
        </Form>
    );
};

const WorkQueueSortingRules = ({ caseFieldOptions = [] }) => {
    const { t } = useTranslation();
    const { values, setFieldValue: setParentField } = useFormikContext();
    const rows = Array.isArray(values?.work_queue_sorting_rules) ? values.work_queue_sorting_rules : [];

    const options = useOptions(t, caseFieldOptions);
    const { open, setOpen, initialValues, openEdit, closeModal } = useModalForm();

    const labelOf = (opts, value) => opts.find((option) => option.value === value)?.label ?? value;

    const processedRows = useMemo(
        () =>
            rows.map((row) => ({
                ...row,
                assign_strategy_label: labelOf(options.assignStrategy, row.assign_strategy),
                cast_type_label: labelOf(options.castType, row.cast_type),
                order_type_label: labelOf(options.orderType, row.order_type),
            })),
        [rows, options],
    );

    const handleSubmit = (formValues) => {
        const updatedRows = [...rows];
        const index = updatedRows.findIndex((row) => row.id === formValues.id);
        const normalizedRow = normalizeRuleRow(formValues);

        if (index !== -1) {
            normalizedRow.id = updatedRows[index].id;
            updatedRows[index] = normalizedRow;
        } else {
            normalizedRow.id = uuidv4();
            updatedRows.push(normalizedRow);
        }

        setParentField("work_queue_sorting_rules", updatedRows);
        closeModal();
    };

    const actions = [
        {
            label: t("button.edit"),
            fn: ({ row }) => {
                const currentRow = rows.find((current) => current.id === row.id);
                if (currentRow) openEdit(currentRow);
            },
        },
        {
            label: t("button.delete"),
            className: "text-redCustom",
            fn: ({ row }) =>
                setParentField(
                    "work_queue_sorting_rules",
                    rows.filter((current) => current.id !== row.id),
                ),
        },
    ];

    return (
        <div className="flex flex-col gap-4 mt-4 w-full">
            <h3 className="font-semibold">{t("generalSetup.form.labels.workQueueSortingRules")}</h3>
            <div className="flex flex-col gap-2 border rounded-lg p-2 w-full">
                <div className="flex justify-end">
                    <CreateModalButton
                        title={t("generalSetup.form.labels.workQueueSortingRules")}
                        description={t("generalSetup.form.labels.addSortingRule")}
                        open={open}
                        onOpenChange={setOpen}
                    >
                        <Formik
                            initialValues={initialValues}
                            enableReinitialize
                            validate={(formValues) => validateRule(formValues, t)}
                            onSubmit={handleSubmit}
                        >
                            <SortingRuleForm options={options} />
                        </Formik>
                    </CreateModalButton>
                </div>
                <div className="overflow-auto max-h-96">
                    <DataTable
                        columns={[
                            { key: "actions", header: "", width: "10%" },
                            {
                                key: "assign_strategy_label",
                                header: t("generalSetup.form.labels.fieldForCaseSorting"),
                                width: "",
                            },
                            { key: "cast_type_label", header: t("generalSetup.form.labels.valueType"), width: "" },
                            { key: "order_type_label", header: t("generalSetup.form.labels.orderType"), width: "" },
                            { key: "draggable", header: "", width: "10%" },
                        ]}
                        rows={processedRows}
                        actions={actions}
                        onOrderChange={(newRows) => {
                            const normalizedRows = newRows.map(normalizeRuleRow);
                            setParentField("work_queue_sorting_rules", normalizedRows);
                        }}
                    />
                </div>
            </div>
        </div>
    );
};

export default WorkQueueSortingRules;
