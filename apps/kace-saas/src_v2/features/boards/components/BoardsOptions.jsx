import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import Button from "@kace_v2/shared/ui/atoms/Button";
import { BOARDS_OPTIONS } from "@kace_v2/features/boards/constants/boards.constants";
import BoardsTableSection from "@kace_v2/features/boards/components/BoardsTableSection";
import { Form, Formik } from "formik";
import { joiFormikAdapter } from "@kace/utils";
import { validateBoardsOptions } from "@kace_v2/features/boards/schemas/boards.schema";
import { v4 as uuidv4 } from "uuid";
import SelectField from "@kace_v2/shared/ui/molecules/SelectField";
import InputField from "@kace_v2/shared/ui/molecules/InputField";
import SwitchField from "@kace_v2/shared/ui/molecules/SwitchField";
import { optionsTypeOptions } from "@kace_v2/features/boards/utils/optionsTypeOptions.util";
import useBoardsOptions from "@kace_v2/features/boards/hooks/useBoardsOptions.hook";
import {
    bindBoardOptionSelector,
    boardOptionSelectorByType,
} from "@kace_v2/features/boards/utils/bindBoardOptionSelector.util";
import { parseOptionsRows } from "@kace_v2/features/boards/utils/parseRows.util";
import { isSameBoardOptionRow, upsertOptionRow } from "@kace_v2/features/boards/utils/upsertOptionRow.util";

const ACTION_ALLOWED_ENTITIES = ["usuarios", "grupos", "cases"];

const BoardsOptions = ({ initialData = {}, primaryEntity = "", onSubmit = () => {} }) => {
    const [initialValues, setInitialValues] = useState(BOARDS_OPTIONS.INITIAL_VALUES);
    const [open, setOpen] = useState(false);
    const [rows, setRows] = useState([]);
    const { options, selectors } = useBoardsOptions(rows);
    const availableTypeOptions = optionsTypeOptions().filter(
        ({ value }) => value !== BOARDS_OPTIONS.TYPES.ACTION || ACTION_ALLOWED_ENTITIES.includes(primaryEntity),
    );

    useEffect(() => {
        const source = Array.isArray(initialData) ? initialData : [];
        setRows(source.map((row) => ({ ...row, id: row.id || uuidv4() })));
    }, [initialData]);

    return (
        <BoardsTableSection
            title="Opciones"
            description="Configura las opciones disponibles para tu tablero"
            columns={[
                { key: "actions", header: "", width: "10%" },
                { key: "ref_id", header: "Lista de opciones del menu" },
                { key: "label", header: "Etiqueta" },
                { key: "requires_confirmation", header: "Requiere Confirmacion" },
                { key: "draggable", header: "", width: "10%" },
            ]}
            rows={parseOptionsRows(rows, options)}
            actions={[
                {
                    label: "Editar",
                    fn: ({ row }) => {
                        const currentRow = rows.find((el) => el.id === row.id);
                        if (!currentRow) return;
                        const currentRowCopy = JSON.parse(JSON.stringify(currentRow));
                        setInitialValues({ ...currentRowCopy });
                        setOpen(true);
                    },
                },
                {
                    label: "Eliminar",
                    className: "text-redCustom",
                    fn: ({ row }) => {
                        const updatedRow = rows.filter((el) => el.id !== row.id);
                        setRows(updatedRow);
                        onSubmit(updatedRow);
                    },
                },
            ]}
            open={open}
            onOpenChange={(value) => {
                if (!value) {
                    setInitialValues(BOARDS_OPTIONS.INITIAL_VALUES);
                }
                setOpen(value);
            }}
            onOrderChange={(new_order = []) => {
                const updatedRows = [];
                new_order.forEach((item) => {
                    const current_row = rows.find((el) => el.id === item.id);
                    updatedRows.push(current_row);
                });
                onSubmit(updatedRows);
                setRows(updatedRows);
            }}
            className="sm:max-w-2xl"
        >
            <Formik
                key={initialValues.id || "new"}
                initialValues={initialValues}
                enableReinitialize
                validationSchema={joiFormikAdapter(validateBoardsOptions)}
                onSubmit={(values) => {
                    delete values.related_entity;
                    const updatedRows = upsertOptionRow(rows, values, isSameBoardOptionRow, uuidv4);

                    onSubmit(updatedRows);
                    setRows(updatedRows);
                    setOpen(false);
                    setInitialValues(BOARDS_OPTIONS.INITIAL_VALUES);
                }}
            >
                {({ setFieldValue, values, errors }) => {
                    return (
                        <Form autoComplete="off" className="flex flex-col gap-4">
                            <SelectField
                                label="Tipo"
                                name="type"
                                value={values.type}
                                placeholder="Seleccione..."
                                error={errors?.type ?? ""}
                                options={availableTypeOptions}
                                onValueChange={(type) => {
                                    setFieldValue("type", type);
                                    setFieldValue("ref_id", "");
                                }}
                            />

                            {values.type && (
                                <SelectField
                                    key={values.type}
                                    label={values.type.charAt(0).toUpperCase() + values.type.slice(1).toLowerCase()}
                                    name="ref_id"
                                    value={values.ref_id}
                                    placeholder="Seleccione..."
                                    error={errors?.ref_id ?? ""}
                                    {...bindBoardOptionSelector(boardOptionSelectorByType(selectors, values.type))}
                                    onValueChange={(value) => {
                                        setFieldValue("ref_id", value);
                                    }}
                                />
                            )}

                            <InputField
                                label="Etiqueta"
                                name="label"
                                defaultValue={values.label}
                                onChange={(e) => {
                                    setFieldValue("label", e.target.value);
                                }}
                                placeholder="etiqueta"
                                error={errors?.label ?? ""}
                            />

                            <SwitchField
                                label="Requiere Confirmacion"
                                name="requires_confirmation"
                                defaultChecked={values.requires_confirmation}
                                onCheckedChange={(value) => {
                                    setFieldValue("requires_confirmation", value);
                                }}
                                error={errors?.requires_confirmation ?? ""}
                            />

                            <div className="flex items-center justify-center">
                                <Button
                                    size="sm"
                                    type="submit"
                                    className="w-52"
                                    disabled={Object.entries(errors).length > 0}
                                >
                                    Agregar
                                </Button>
                            </div>
                        </Form>
                    );
                }}
            </Formik>
        </BoardsTableSection>
    );
};

BoardsOptions.propTypes = {
    initialData: PropTypes.array,
    primaryEntity: PropTypes.string,
    onSubmit: PropTypes.func,
};

export default BoardsOptions;
