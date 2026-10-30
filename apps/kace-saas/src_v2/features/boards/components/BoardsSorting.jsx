import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { BOARDS_SORTING } from "@kace_v2/features/boards/constants/boards.constants";
import useSchemaFields from "@kace/hooks/useSchemaFields";
import BoardsTableSection from "@kace_v2/features/boards/components/BoardsTableSection";
import { Form, Formik } from "formik";
import { joiFormikAdapter } from "@kace/utils";
import { validateBoardsSorting } from "@kace_v2/features/boards/schemas/boards.schema";
import SelectField from "@kace_v2/shared/ui/molecules/SelectField";
import Button from "@kace_v2/shared/ui/atoms/Button";
import { collectJoinData } from "@kace_v2/features/boards/utils/relations.util";
import { removeIds } from "@kace_v2/features/boards/utils/boardIdHelper.util";
import { v4 as uuidv4 } from "uuid";
import { fetchSchemaRules } from "@kace_v2/shared/services/schemas.services";
import { generateAuxSelectOptions } from "@/utils/generateAuxSelectOptions";
import { processAuxiliaryOptions, normalizeAuxiliaryField } from "@kace_v2/features/boards/utils/auxiliaryOptions.util";

const processRows = (rows = [], relationsOptions = [], t) => {
    return rows.map((row) => {
        const relationOption = relationsOptions.find((rel) => rel.value === row.entity || rel.alias === row.entity);
        const entityLabel = relationOption?.label || row.entity || "";

        const fieldLabel = row.field || "";

        const directionLabel =
            row.direction === "asc"
                ? t("boards.form.sorting.direction.asc")
                : row.direction === "desc"
                  ? t("boards.form.sorting.direction.desc")
                  : row.direction || "";

        return {
            ...row,
            entity: entityLabel,
            field: fieldLabel,
            direction: directionLabel,
        };
    });
};

const BoardsSorting = ({
    initialData = [],
    primaryEntity = "",
    currentRelatedEntities = [],
    clearRows = false,
    onSubmit = () => {},
}) => {
    const { t } = useTranslation();
    const { getSchemaField } = useSchemaFields();
    const [initialValues, setInitialValues] = useState(BOARDS_SORTING.INITIAL_VALUES);
    const [open, setOpen] = useState(false);
    const [rows, setRows] = useState([]);
    const [fieldOptions, setFieldOptions] = useState([]);
    const [loadingFieldOptions, setLoadingFieldOptions] = useState(false);

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
        const itemsWithId = (initialData ?? []).map((item) => ({
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
            return;
        }

        if (!initialValues.entity) {
            setFieldOptions([]);
            return;
        }

        const loadFieldOptionsForEdit = async () => {
            const relationOption = relationsOptions.find(
                (rel) => rel.value === initialValues.entity || rel.alias === initialValues.entity,
            );
            const actualRelatedEntity = relationOption?.related_entity || initialValues.entity;

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
                    }
                } catch (error) {
                    setFieldOptions([]);
                } finally {
                    setLoadingFieldOptions(false);
                }
                return;
            }

            const schemaField = getSchemaField(actualRelatedEntity);
            const options = schemaField.map((field) => ({
                label: field.column_name,
                value: field.column_name,
            }));
            setFieldOptions(options);
        };

        loadFieldOptionsForEdit();
    }, [open, initialValues.entity, initialValues.id, initialValues.field, getSchemaField, relationsOptions]);

    const sortingOptions = useMemo(
        () => [
            { label: t("boards.form.sorting.direction.asc"), value: "asc" },
            { label: t("boards.form.sorting.direction.desc"), value: "desc" },
        ],
        [t],
    );

    return (
        <BoardsTableSection
            title={t("boards.form.sorting.title")}
            description={t("boards.form.sorting.description")}
            columns={[
                { key: "actions", header: "", width: "10%" },
                { key: "entity", header: t("boards.form.sorting.tableHeaders.entity"), width: "25%" },
                { key: "field", header: t("boards.form.sorting.tableHeaders.field"), width: "35%" },
                { key: "direction", header: t("boards.form.sorting.tableHeaders.direction"), width: "30%" },
            ]}
            rows={processRows(rows, relationsOptions, t)}
            actions={[
                {
                    label: t("boards.form.sorting.actions.edit"),
                    fn: ({ row }) => {
                        const currentRow = rows.find((el) => el.id === row.id);
                        if (!currentRow) return;
                        const currentRowCopy = structuredClone(currentRow);
                        let entity = "";

                        if (currentRow.entity) {
                            const relationOption = relationsOptions.find(
                                (rel) => rel.alias === currentRow.entity || rel.value === currentRow.entity,
                            );
                            entity = relationOption?.value || currentRow.entity || primaryEntity;
                        } else {
                            const fieldParts = currentRowCopy.field?.split(".") || [];
                            if (fieldParts.length > 1) {
                                const entityFromField = fieldParts[0];
                                const relationOption = relationsOptions.find(
                                    (rel) => rel.alias === entityFromField || rel.value === entityFromField,
                                );
                                entity = relationOption?.value || entityFromField || primaryEntity;
                            } else {
                                entity = primaryEntity;
                            }
                        }

                        const relationOptionForNormalization = relationsOptions.find(
                            (rel) => rel.value === entity || rel.alias === entity,
                        );
                        const actualRelatedEntityForNormalization =
                            relationOptionForNormalization?.related_entity || entity;

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

                        setInitialValues({
                            ...currentRowCopy,
                            entity: relationOptionForNormalization?.value || entity,
                            field: currentRowCopy.field,
                            direction: currentRowCopy.direction,
                        });
                        setOpen(true);
                    },
                },
                {
                    label: t("boards.form.sorting.actions.delete"),
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
                    setInitialValues(BOARDS_SORTING.INITIAL_VALUES);
                }
                setOpen(value);
            }}
            disabled={!primaryEntity}
        >
            <Formik
                initialValues={initialValues}
                validationSchema={joiFormikAdapter(validateBoardsSorting)}
                onSubmit={(values) => {
                    const updatedRows = [...rows];

                    const relationOption = relationsOptions.find((rel) => rel.value === values.entity);
                    const entity = relationOption?.alias || values.entity;

                    const updatedData = {
                        entity,
                        field: values.field,
                        direction: values.direction,
                    };

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
                    setInitialValues(BOARDS_SORTING.INITIAL_VALUES);
                }}
            >
                {({ setFieldValue, values, errors }) => (
                    <Form autoComplete="off" className="flex flex-col gap-4">
                        <SelectField
                            label={t("boards.form.sorting.labels.entity")}
                            name="entity"
                            value={values.entity}
                            placeholder={t("boards.form.placeholders.select")}
                            error={errors?.entity ?? ""}
                            options={relationsOptions}
                            onValueChange={async (selectedValue) => {
                                setFieldValue("entity", selectedValue);
                                setFieldValue("field", "");

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
                                        const processedOptions = processAuxiliaryOptions(options, actualRelatedEntity);
                                        setFieldOptions(processedOptions);
                                        return;
                                    } catch (error) {
                                        setFieldOptions([]);
                                    } finally {
                                        setLoadingFieldOptions(false);
                                    }
                                }

                                const schemaField = getSchemaField(actualRelatedEntity);
                                setFieldOptions(
                                    schemaField.map((field) => ({
                                        label: field.column_name,
                                        value: field.column_name,
                                    })),
                                );
                            }}
                        />

                        {values.entity && fieldOptions.length > 0 && (
                            <SelectField
                                label={t("boards.form.sorting.labels.field")}
                                name="field"
                                value={values.field}
                                placeholder={t("boards.form.placeholders.select")}
                                error={errors?.field ?? ""}
                                options={fieldOptions}
                                onValueChange={(value) => {
                                    setFieldValue("field", value);
                                }}
                                isLoading={loadingFieldOptions}
                            />
                        )}

                        <SelectField
                            label={t("boards.form.sorting.labels.direction")}
                            name="direction"
                            value={values.direction}
                            placeholder={t("boards.form.placeholders.select")}
                            error={errors?.direction ?? ""}
                            options={sortingOptions}
                            onValueChange={(value) => {
                                setFieldValue("direction", value);
                            }}
                        />

                        <div className="flex items-center justify-center">
                            <Button size="sm" type="submit" className="w-52">
                                {t("button.add")}
                            </Button>
                        </div>
                    </Form>
                )}
            </Formik>
        </BoardsTableSection>
    );
};

BoardsSorting.propTypes = {
    initialData: PropTypes.array,
    primaryEntity: PropTypes.string,
    currentRelatedEntities: PropTypes.array,
    clearRows: PropTypes.bool,
    onSubmit: PropTypes.func,
};

export default BoardsSorting;
