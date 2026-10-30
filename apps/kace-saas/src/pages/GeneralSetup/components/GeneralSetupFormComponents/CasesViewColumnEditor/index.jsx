import { useState, useMemo, useCallback } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { PlusIcon } from "lucide-react";
import BoardsTableSection from "@kace_v2/features/boards/components/BoardsTableSection";
import Button from "@kace_v2/shared/ui/atoms/Button";
import ColumnConfigModal from "./components/ColumnConfigModal";
import { normalizeVisibleColumns } from "@/pages/Cases/components/CaseDataTable/utils/processCasesData";
import {
    getExpandableClassificationColumn,
    getClassificationColumn,
} from "@/pages/Cases/components/CaseDataTable/utils/classificationLevels.util";
import { getStatusColumn } from "@/pages/Cases/components/CaseDataTable/utils/caseStateStatus.util";

const CELL_TYPE_LABELS = {
    default: "generalSetup.casesColumnEditor.cellTypes.default",
    clasificacion: "generalSetup.casesColumnEditor.cellTypes.clasificacion",
    estado: "generalSetup.casesColumnEditor.cellTypes.estado",
};

const CELL_TYPE_FALLBACKS = {
    default: "Por defecto",
    clasificacion: "Clasificación",
    estado: "Estado",
};

export default function CasesViewColumnEditor({ viewName, schemaFields, value = [], onChange }) {
    const { t } = useTranslation();

    const [modalOpen, setModalOpen] = useState(false);
    const [editingIndex, setEditingIndex] = useState(null);

    const initialValues = editingIndex !== null ? value[editingIndex] : null;

    const existingColumnNames = value
        .map((col) => col.column_name)
        .filter((name) => editingIndex === null || name !== value[editingIndex]?.column_name);

    const expandableClassificationColumn = useMemo(() => getExpandableClassificationColumn(value), [value]);
    const statusColumn = useMemo(() => getStatusColumn(value), [value]);
    const classificationColumn = useMemo(() => getClassificationColumn(value), [value]);

    const getCellTypeLabel = useCallback(
        (cellType) => {
            const key = CELL_TYPE_LABELS[cellType] || CELL_TYPE_LABELS.default;
            const fallback = CELL_TYPE_FALLBACKS[cellType] || CELL_TYPE_FALLBACKS.default;
            return t(key, fallback);
        },
        [t],
    );

    const tableRows = useMemo(
        () =>
            value.map((col) => ({
                id: col.column_name,
                field: col.column_name,
                header_label: col.header_label,
                cell_type: getCellTypeLabel(col.cell_type),
                _source: col,
            })),
        [value, getCellTypeLabel],
    );

    const handleOpenAdd = () => {
        setEditingIndex(null);
        setModalOpen(true);
    };

    const handleOpenEdit = (index) => {
        setEditingIndex(index);
        setModalOpen(true);
    };

    const handleClose = () => {
        setModalOpen(false);
        setEditingIndex(null);
    };

    const handleSave = (saved) => {
        const savedArray = Array.isArray(saved) ? saved : [saved];

        let next;

        if (!Array.isArray(saved) && editingIndex !== null) {
            next = value.map((col, i) => (i === editingIndex ? saved : col));
        } else {
            const existingMap = new Map(value.map((col) => [col.column_name, col]));
            savedArray.forEach((col) => {
                existingMap.set(col.column_name, col);
            });
            next = Array.from(existingMap.values());
        }

        onChange(normalizeVisibleColumns(next));
        handleClose();
    };

    const handleOrderChange = useCallback(
        (reorderedRows) => {
            onChange(reorderedRows.map((row) => row._source));
        },
        [onChange],
    );

    const tableActions = useMemo(
        () => [
            {
                label: t("generalSetup.casesColumnEditor.editAction", "Editar"),
                fn: ({ index }) => handleOpenEdit(index),
            },
            {
                label: t("generalSetup.casesColumnEditor.deleteAction", "Eliminar"),
                className: "text-redCustom",
                fn: ({ row }) => onChange(value.filter((col) => col.column_name !== row.id)),
            },
        ],
        [t, value, onChange],
    );

    const tableColumns = useMemo(
        () => [
            { key: "actions", header: "", width: "10%" },
            { key: "field", header: t("generalSetup.casesColumnEditor.fieldColumn", "Campo") },
            { key: "header_label", header: t("generalSetup.casesColumnEditor.headerColumn", "Cabecera") },
            { key: "cell_type", header: t("generalSetup.casesColumnEditor.typeColumn", "Tipo") },
            { key: "draggable", header: "", width: "10%" },
        ],
        [t],
    );

    return (
        <div className="flex w-full min-w-0 flex-col gap-2">
            <BoardsTableSection
                sectionClassName="w-full"
                columns={tableColumns}
                rows={tableRows}
                actions={tableActions}
                onOrderChange={handleOrderChange}
                customHeader
            >
                <div className="flex gap-2">
                    <Button size="default" type="button" onClick={handleOpenAdd}>
                        <PlusIcon />
                        {t("generalSetup.casesColumnEditor.addColumn", "Agregar columna")}
                    </Button>
                </div>
            </BoardsTableSection>

            <ColumnConfigModal
                isOpen={modalOpen}
                onClose={handleClose}
                onSave={handleSave}
                initialValues={initialValues}
                schemaFields={schemaFields}
                viewName={viewName}
                existingColumnNames={existingColumnNames}
                expandableClassificationColumn={expandableClassificationColumn}
                statusColumn={statusColumn}
                classificationColumn={classificationColumn}
            />
        </div>
    );
}

CasesViewColumnEditor.propTypes = {
    viewName: PropTypes.string,
    schemaFields: PropTypes.object,
    value: PropTypes.arrayOf(
        PropTypes.shape({
            column_name: PropTypes.string.isRequired,
            header_label: PropTypes.string.isRequired,
            cell_type: PropTypes.string.isRequired,
            separator: PropTypes.string,
            expand_levels: PropTypes.bool,
        }),
    ),
    onChange: PropTypes.func.isRequired,
};
