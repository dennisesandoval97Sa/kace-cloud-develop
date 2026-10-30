import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import BoardsTableSection from "@kace_v2/features/boards/components/BoardsTableSection";
import { Form, Formik } from "formik";
import Button from "@kace_v2/shared/ui/atoms/Button";
import { v4 as uuidv4 } from "uuid";
import { parseRelationRows } from "@kace_v2/features/boards/utils/parseRows.util.jsx";
import BoardsRelationEntity from "@kace_v2/features/boards/components/BoardsRelationEntity";
import { buildRelations, flattenJoinConditions } from "@kace_v2/features/boards/utils/relations.util";
import { removeIds } from "@kace_v2/features/boards/utils/boardIdHelper.util";

const BoardsRelations = ({ initialData = [], primaryEntity, clearRows = false, onSubmit = () => {} }) => {
    const [initialValues, setInitialValues] = useState({});
    const [editingId, setEditingId] = useState(null);

    const [open, setOpen] = useState(false);
    const [rows, setRows] = useState([]);

    useEffect(() => {
        const relationsWithId = (initialData ?? []).map((relation) => ({
            ...relation,
            id: relation.id || uuidv4(),
        }));
        setRows(relationsWithId);
    }, [initialData]);

    useEffect(() => {
        if (clearRows) {
            setRows([]);
            onSubmit([]);
        }
    }, [clearRows]);

    useEffect(() => {
        setInitialValues({});
        setEditingId(null);
        setOpen(false);
    }, [primaryEntity]);

    useEffect(() => {
        if (open && !editingId) {
            setInitialValues({});
        }
    }, [open, editingId]);

    return (
        <BoardsTableSection
            title="Relaciones"
            description="Configura las relaciones para tu tablero"
            columns={[
                { key: "actions", header: "", width: "10%" },
                { key: "related_entity", header: "Relaciones", width: "25%" },
                { key: "join_type", header: "Tipo Union", width: "20%" },
                { key: "on", header: "Condiciones", width: "45%" },
            ]}
            rows={parseRelationRows(rows)}
            actions={[
                {
                    label: "Editar",
                    fn: ({ row }) => {
                        const currentRow = rows.find((el) => el.id === row.id);
                        setInitialValues(flattenJoinConditions(currentRow));
                        setEditingId(currentRow?.id || null);
                        setOpen(true);
                    },
                },
                {
                    label: "Eliminar",
                    className: "text-redCustom",
                    fn: ({ row }) => {
                        const rowId = row.id;
                        const updatedRow = rows.filter((el) => el.id !== rowId);
                        const relationsWithoutId = removeIds(updatedRow);
                        setRows(updatedRow);
                        onSubmit(relationsWithoutId);
                    },
                },
            ]}
            className="sm:max-w-2xl"
            open={open}
            onOpenChange={(isOpen) => {
                setOpen(isOpen);
                if (!isOpen) {
                    setEditingId(null);
                    setInitialValues({});
                }
            }}
            disabled={!primaryEntity || primaryEntity.includes("aux_")}
        >
            <Formik
                key={editingId || "new"}
                initialValues={initialValues}
                enableReinitialize={true}
                onSubmit={(values) => {
                    const updatedData = buildRelations(values);
                    const updatedRows = [...rows];

                    const index = updatedRows.findIndex((item) => item.id === editingId);

                    if (index !== -1) {
                        updatedData.id = updatedRows[index].id;
                        updatedRows[index] = updatedData;
                    } else {
                        updatedData.id = uuidv4();
                        updatedRows.push(updatedData);
                    }

                    onSubmit(removeIds(updatedRows));
                    setRows(updatedRows);
                    setOpen(false);
                    setEditingId(null);
                    setInitialValues({});
                }}
            >
                <Form autoComplete="off" className="flex flex-col gap-4">
                    <BoardsRelationEntity entity={primaryEntity} />
                    <div className="flex items-center justify-center">
                        <Button size="sm" type="submit" className="w-52">
                            Agregar
                        </Button>
                    </div>
                </Form>
            </Formik>
        </BoardsTableSection>
    );
};

BoardsRelations.propTypes = {
    initialData: PropTypes.array,
    primaryEntity: PropTypes.string,
    clearRows: PropTypes.bool,
    onSubmit: PropTypes.func,
};

export default BoardsRelations;
