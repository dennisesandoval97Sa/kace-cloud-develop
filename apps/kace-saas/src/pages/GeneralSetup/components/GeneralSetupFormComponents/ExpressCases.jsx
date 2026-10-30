import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CardModulesTab } from "@/pages/GeneralSetup/components/GeneralSetupFormComponents/CardModulesTab";
import { useTranslation } from "react-i18next";
import CreateModalButton from "@kace_v2/shared/ui/molecules/CreateModalButton";
import DataTable from "@kace_v2/shared/ui/organisms/DataTable";
import { Form, Formik, useFormikContext } from "formik";
import InputField from "@kace_v2/shared/ui/molecules/InputField";
import SelectField from "@kace_v2/shared/ui/molecules/SelectField";
import useOneScriptOptions from "@kace_v2/features/boards/hooks/useOneScriptOptions.hook";
import Button from "@kace_v2/shared/ui/atoms/Button";
import { EXPRESS_CASES } from "@/pages/GeneralSetup/data/constants";
import { upsertOptionRow } from "@kace_v2/features/boards/utils/upsertOptionRow.util";
import { v4 as uuidv4 } from "uuid";

const ExpressCases = () => {
    const { t } = useTranslation();
    const { values, setFieldValue: handlerSubmit } = useFormikContext();

    const [open, setOpen] = useState(false);
    const [rows, setRows] = useState([]);
    const [initialValues, setInitialValues] = useState(EXPRESS_CASES.INITIAL_VALUES);

    const oneScriptEnsureIds = useMemo(
        () => (rows || []).map((row) => row?.one_script_form_id).filter(Boolean),
        [rows],
    );
    const {
        data: oneScriptOptions,
        isLoading: isLoadingOneScriptOptions,
        onSearch: onSearchOneScript,
        fetchNextPage: fetchNextPageOneScript,
        hasNextPage: hasNextPageOneScript,
        isFetchingNextPage: isFetchingNextPageOneScript,
    } = useOneScriptOptions(oneScriptEnsureIds);

    const processRows = useCallback(() => {
        if (!rows || !rows.length) return [];

        return rows.map((row) => ({
            ...row,
            one_script_form_id: oneScriptOptions
                ? (oneScriptOptions.find((el) => el.value === row?.one_script_form_id)?.label ?? "")
                : "",
        }));
    }, [oneScriptOptions, rows]);

    useEffect(() => {
        if (values?.express_cases && Array.isArray(values?.express_cases)) {
            setRows(values.express_cases);
        }
    }, [values?.express_cases]);

    return (
        <CardModulesTab
            title={t("generalSetup.form.title.expressCases")}
            description={t("generalSetup.form.title.subtitleExpressCases")}
            id="tab_agent_card_modules"
            data-testid="tab_agent_card_modules"
        >
            <div className="flex flex-col gap-2 border rounded-lg p-2">
                <div className="flex justify-end">
                    <CreateModalButton
                        title={t("generalSetup.form.title.expressCases")}
                        description={t("generalSetup.form.title.subtitleExpressCases")}
                        open={open}
                        onOpenChange={setOpen}
                    >
                        <Formik
                            initialValues={initialValues}
                            onSubmit={(values) => {
                                const updatedRows = upsertOptionRow(
                                    rows,
                                    values,
                                    (item, next) => item.id === next.id,
                                    uuidv4,
                                );

                                handlerSubmit("express_cases", updatedRows);
                                setRows(updatedRows);
                                setOpen(false);
                                setInitialValues(EXPRESS_CASES.INITIAL_VALUES);
                            }}
                        >
                            {({ values, errors, setFieldValue }) => {
                                return (
                                    <Form autoComplete="off" className="flex flex-col gap-4">
                                        <InputField
                                            label={t("generalSetup.form.labels.label")}
                                            name="label"
                                            defaultValue={values.label}
                                            onChange={(e) => {
                                                setFieldValue("label", e.target.value);
                                            }}
                                            placeholder={t("generalSetup.form.labels.label")}
                                            error={errors?.label ?? ""}
                                        />
                                        <SelectField
                                            label={t("generalSetup.form.labels.one_script_form")}
                                            placeholder={t("actions.placeholder.options")}
                                            options={oneScriptOptions}
                                            value={values?.one_script_form_id || ""}
                                            error={errors.one_script_form_id}
                                            onValueChange={(value) => setFieldValue("one_script_form_id", value)}
                                            isLoading={isLoadingOneScriptOptions}
                                            onSearch={onSearchOneScript}
                                            fetchNextPage={fetchNextPageOneScript}
                                            hasNextPage={hasNextPageOneScript}
                                            isFetchingNextPage={isFetchingNextPageOneScript}
                                        />
                                        <div className="flex items-center justify-center">
                                            <Button
                                                size="sm"
                                                type="submit"
                                                className="w-52"
                                                disabled={Object.entries(errors).length > 0}
                                            >
                                                {t("app.forms.add")}
                                            </Button>
                                        </div>
                                    </Form>
                                );
                            }}
                        </Formik>
                    </CreateModalButton>
                </div>
                <div className="overflow-auto max-h-96">
                    <DataTable
                        columns={[
                            { key: "actions", header: "", width: "10%" },
                            { key: "label", header: t("generalSetup.form.labels.label"), width: "" },
                            {
                                key: "one_script_form_id",
                                header: t("generalSetup.form.labels.one_script_form"),
                                width: "",
                            },
                            { key: "draggable", header: "", width: "10%" },
                        ]}
                        rows={processRows()}
                        actions={[
                            {
                                label: t("app.forms.edit"),
                                fn: ({ row }) => {
                                    const currentRow = rows.find((el) => el.id === row.id);
                                    const currentRowCopy = JSON.parse(JSON.stringify(currentRow));

                                    const expression = currentRow.expression ?? "";
                                    const [related_entity] = expression.split(".");
                                    setInitialValues({ ...currentRowCopy, related_entity });
                                    setOpen(true);
                                },
                            },
                            {
                                label: t("app.forms.delete"),
                                className: "text-redCustom",
                                fn: ({ row }) => {
                                    const rowId = row.id;
                                    if (rows.length > 1) {
                                        let isFound = false;
                                        rows.forEach((item) => {
                                            if (isFound) {
                                                item.position--;
                                            } else {
                                                isFound = item.id === rowId;
                                            }
                                        });
                                    }
                                    const updatedRows = rows.filter((el) => el.id !== rowId);
                                    setRows(updatedRows);
                                    handlerSubmit("express_cases", updatedRows);
                                },
                            },
                        ]}
                    />
                </div>
            </div>
        </CardModulesTab>
    );
};

export default ExpressCases;
