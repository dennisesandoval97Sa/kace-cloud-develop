import React, { useCallback, useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import BoardsTableSection from "@kace_v2/features/boards/components/BoardsTableSection";
import { parseColumnRows } from "@kace_v2/features/boards/utils/parseRows.util";
import BoardsColumnModalForm from "@kace_v2/features/boards/components/BoardsColumnModalForm";
import { v4 as uuidv4 } from "uuid";
import { removeIds } from "@kace_v2/features/boards/utils/boardIdHelper.util";
import { collectJoinData } from "@kace_v2/features/boards/utils/relations.util";
import { ENTITY_STATE, FIELD_COLOR, FIELD_STATE } from "@kace_v2/shared/utils/board-colum-rules";

const BoardsParameters = ({
    initialData = [],
    primaryEntity,
    currentRelatedEntities = [],
    clearRows = false,
    onSubmit = () => {},
}) => {
    const [defaultValues, setDefaultValues] = useState(null);
    const [openColumns, setOpenColumns] = useState(false);
    const [rows, setRows] = useState([]);

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

    const handlerSubmit = useCallback(
        (values) => {
            const updatedRows = [...rows];

            const valuesArray = Array.isArray(values) ? values : [values];

            valuesArray.forEach((value) => {
                const { related_entity, ...rest } = value;

                let index = -1;
                if (rest.id != null && rest.id !== "") {
                    index = updatedRows.findIndex((item) => item.id === rest.id);
                }
                if (index === -1) {
                    index = updatedRows.findIndex(
                        (item) => item.alias === rest.alias && item.field === rest.field && item.entity === rest.entity,
                    );
                }

                if (index !== -1) {
                    rest.id = updatedRows[index].id;
                    rest.position = updatedRows[index].position || updatedRows.length + 1;
                    updatedRows[index] = rest;
                } else {
                    rest.id = uuidv4();
                    rest.position = updatedRows.length + 1;
                    updatedRows.push(rest);
                }
            });

            const columnsWithoutId = removeIds(updatedRows);

            onSubmit(columnsWithoutId);
            setRows(updatedRows);
            setOpenColumns(false);
            setDefaultValues(null);
        },
        [rows, onSubmit],
    );

    useEffect(() => {
        const columnsWithId = (initialData ?? []).map((column) => ({
            ...column,
            id: column.id || uuidv4(),
        }));
        setRows(columnsWithId);
    }, [initialData]);

    useEffect(() => {
        if (clearRows) {
            setRows([]);
            onSubmit([]);
        }
    }, [clearRows]); // todo: omitiendo onSubmit, evaluar habilitacion

    return (
        <BoardsTableSection
            columns={[
                { key: "actions", header: "", width: "10%" },
                { key: "type", header: "Tipo" },
                { key: "field", header: "Campo" },
                { key: "alias", header: "Alias" },
                { key: "is_filterable", header: "Filtrable" },
                { key: "is_status_column", header: "Estado" },
                { key: "visible", header: "Visible" },
                { key: "data_type", header: "Tipo de dato" },
                { key: "format", header: "Formato" },
                { key: "function", header: "Función" },
                { key: "group_by", header: "Group By" },
                { key: "draggable", header: "", width: "10%" },
            ]}
            rows={parseColumnRows(rows)}
            actions={[
                {
                    label: "Editar",
                    fn: ({ row }) => {
                        const currentRow = rows.find((el) => el.id === row.id);
                        if (!currentRow) return;
                        const currentRowCopy = structuredClone(currentRow);

                        let related_entity = "";
                        const fieldValue = currentRow.field ?? "";
                        const functionMatch = String(fieldValue).match(/^(count|sum|avg|max|min)\((.+)\)$/);

                        if (functionMatch) {
                            related_entity = functionMatch[2];
                        } else if (currentRow.entity) {
                            const relationOption = relationsOptions.find((rel) => rel.alias === currentRow.entity);
                            related_entity = relationOption?.value || currentRow.entity || primaryEntity;
                        } else {
                            related_entity = primaryEntity;
                        }

                        setDefaultValues({ ...currentRowCopy, related_entity });
                        setOpenColumns(true);
                    },
                },
                {
                    label: "Eliminar",
                    className: "text-redCustom",
                    disabled: ({ row }) => {
                        const currentRow = rows.find((el) => el.id === row.id);
                        if (!currentRow) return true;

                        const isColor = currentRow.field === FIELD_COLOR && currentRow.entity === ENTITY_STATE;

                        const hasEstado = rows.some((col) => col.field === FIELD_STATE && col.entity === ENTITY_STATE);

                        return isColor && hasEstado;
                    },
                    fn: ({ row }) => {
                        const currentRow = rows.find((el) => el.id === row.id);
                        if (!currentRow) return;

                        const isEstado = currentRow.field === FIELD_STATE && currentRow.entity === ENTITY_STATE;

                        let updatedRow = rows.filter((el) => el.id !== currentRow.id);

                        if (isEstado) {
                            updatedRow = updatedRow.filter(
                                (col) => !(col.field === FIELD_COLOR && col.entity === ENTITY_STATE),
                            );
                        }

                        const columnsWithoutId = removeIds(updatedRow);
                        setRows(updatedRow);
                        onSubmit(columnsWithoutId);
                    },
                },
            ]}
            onOrderChange={(new_order = []) => {
                const updatedRows = [];
                new_order.forEach((item, index) => {
                    const current_row = rows.find((el) => el.id === item.id);
                    if (current_row) {
                        current_row.position = index + 1;
                        updatedRows.push(current_row);
                    }
                });
                const columnsWithoutId = removeIds(updatedRows);
                onSubmit(columnsWithoutId);
                setRows(updatedRows);
            }}
            customHeader
        >
            <div className="flex gap-2">
                <BoardsColumnModalForm
                    defaultValues={defaultValues}
                    relationsOptions={relationsOptions}
                    disabled={!primaryEntity}
                    open={openColumns}
                    setOpen={setOpenColumns}
                    onSubmit={handlerSubmit}
                    onClose={() => setDefaultValues(null)}
                />
            </div>
        </BoardsTableSection>
    );
};

BoardsParameters.propTypes = {
    initialData: PropTypes.array,
    primaryEntity: PropTypes.string,
    currentRelatedEntities: PropTypes.array,
    clearRows: PropTypes.bool,
    onSubmit: PropTypes.func,
};

export default BoardsParameters;
