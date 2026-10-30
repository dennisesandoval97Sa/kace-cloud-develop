import React, { useCallback, useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import BoardsTableSection from "@kace_v2/features/boards/components/BoardsTableSection";
import { parseHavingRows } from "@kace_v2/features/boards/utils/parseRows.util";
import BoardsHavingModalForm from "@kace_v2/features/boards/components/BoardsHavingModalForm";
import { v4 as uuidv4 } from "uuid";
import { removeIds } from "@kace_v2/features/boards/utils/boardIdHelper.util";
import { collectJoinData } from "@kace_v2/features/boards/utils/relations.util";

const BoardsHavings = ({ initialData = [], primaryEntity, currentRelatedEntities = [], clearRows = false, onSubmit = () => {} }) => {
    const [defaultValues, setDefaultValues] = useState(null);
    const [openHaving, setOpenHaving] = useState(false);
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
        // using alias as unique key to keep all relations ( incluiding if they have the same related_entity)
        return Array.from(new Map(options.map((item) => [item.alias || item.value, item])).values());
    }, [currentRelatedEntities?.length, primaryEntity]);

    const handlerSubmit = useCallback((values) => {
        const updatedRows = [...rows];
        const { related_entity, ...rest } = values;
        const relationOption = relationsOptions.find((rel) => rel.value === values.related_entity);
        const entity = relationOption?.alias || related_entity;
        const updatedValues = { ...rest, entity };

        const index = rows.findIndex((item) => item.id === values.id);

        if (index !== -1) {
            updatedValues.id = updatedRows[index].id;
            updatedRows[index] = updatedValues;
        } else {
            updatedValues.id = uuidv4();
            updatedRows.push(updatedValues);
        }

        const havingsWithoutId = removeIds(updatedRows);

        onSubmit(havingsWithoutId);
        setRows(updatedRows);
        setOpenHaving(false);
        setDefaultValues(null);
    }, [rows, onSubmit]);

    useEffect(() => {
        const havingsWithId = (initialData ?? []).map((having) => ({
            ...having,
            id: having.id || uuidv4(),
        }));
        setRows(havingsWithId);
    }, [initialData]);

    useEffect(() => {
        if (clearRows) {
            setRows([]);
            onSubmit([]);
        }
    }, [clearRows]); // todo: check onSubmit causing infitite loop

    return (
        <BoardsTableSection
            columns={[
                { key: "actions", header: "", width: "10%" },
                { key: "function", header: "Función" },
                { key: "field", header: "Campo" },
                { key: "operator", header: "Operador" },
                { key: "value", header: "Valor" },
            ]}
            rows={parseHavingRows(rows)}
            actions={[
                {
                    label: "Editar",
                    fn: ({ row }) => {
                        const currentRow = rows.find((el) => el.id === row.id);
                        const currentRowCopy = structuredClone(currentRow);

                        const field = currentRow.field ?? "";
                        const [entityFromField] = field.split(".");
                        const relationOption = relationsOptions.find((rel) => rel.alias === currentRow.entity || rel.alias === entityFromField);
                        const related_entity = relationOption?.value || entityFromField || primaryEntity;
                        setDefaultValues({ ...currentRowCopy, related_entity });
                        setOpenHaving(true);
                    },
                },
                {
                    label: "Eliminar",
                    className: "text-redCustom",
                    fn: ({ row }) => {
                        const rowId = row.id;
                        const updatedRow = rows.filter((el) => el.id !== rowId);
                        const havingsWithoutId = removeIds(updatedRow);
                        setRows(updatedRow);
                        onSubmit(havingsWithoutId);
                    },
                },
            ]}
            customHeader
        >
            <div className="flex gap-2">
                <BoardsHavingModalForm
                    defaultValues={defaultValues}
                    relationsOptions={relationsOptions}
                    disabled={!primaryEntity}
                    open={openHaving}
                    setOpen={setOpenHaving}
                    onSubmit={handlerSubmit}
                />
            </div>
        </BoardsTableSection>
    );
};

BoardsHavings.propTypes = {
    initialData: PropTypes.array,
    primaryEntity: PropTypes.string,
    currentRelatedEntities: PropTypes.array,
    clearRows: PropTypes.bool,
    onSubmit: PropTypes.func,
};

export default BoardsHavings;
