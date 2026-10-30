import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, Portal } from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { toast } from "sonner";
import SelectField from "@kace_v2/shared/ui/molecules/SelectField";
import InputField from "@kace_v2/shared/ui/molecules/InputField";
import SwitchField from "@kace_v2/shared/ui/molecules/SwitchField";
import Button from "@kace_v2/shared/ui/atoms/Button";
import DialogOverlay from "@kace_v2/shared/ui/atoms/DialogOverlay";
import DialogContent from "@kace_v2/shared/ui/atoms/DialogContent";
import DialogClose from "@kace_v2/shared/ui/atoms/DialogClose";
import DialogTitle from "@kace_v2/shared/ui/atoms/DialogTitle";
import DialogDescription from "@kace_v2/shared/ui/atoms/DialogDescription";
import {
    isClassificationCellType,
    isNivelColumn,
    wouldBeExpandableClassificationColumn,
} from "@/pages/Cases/components/CaseDataTable/utils/classificationLevels.util";
import { isStatusCellType } from "@/pages/Cases/components/CaseDataTable/utils/caseStateStatus.util";

const hasValidColumnName = (col) => typeof col?.column_name === "string" && col.column_name.trim() !== "";

export default function ColumnConfigModal({
    isOpen,
    onClose,
    onSave,
    initialValues,
    schemaFields,
    viewName,
    existingColumnNames = [],
    expandableClassificationColumn = null,
    statusColumn = null,
    classificationColumn = null,
}) {
    const { t } = useTranslation();

    const isEditMode = initialValues !== null && initialValues !== undefined;

    const [columnName, setColumnName] = useState(initialValues?.column_name ?? "");
    const [headerLabel, setHeaderLabel] = useState(initialValues?.header_label ?? "");
    const [cellType, setCellType] = useState(initialValues?.cell_type ?? "default");
    const [separator, setSeparator] = useState(initialValues?.separator ?? "");
    const [expandLevels, setExpandLevels] = useState(initialValues?.expand_levels ?? true);

    useEffect(() => {
        setColumnName(initialValues?.column_name ?? "");
        setHeaderLabel(initialValues?.header_label ?? "");
        setCellType(initialValues?.cell_type ?? "default");
        setSeparator(initialValues?.separator ?? "");
        setExpandLevels(initialValues?.expand_levels ?? true);
    }, [initialValues, isOpen]);

    const viewColumns = schemaFields && viewName && schemaFields[viewName] ? schemaFields[viewName] : [];

    const isEditingExpandableColumn =
        isEditMode && expandableClassificationColumn?.column_name === initialValues?.column_name;

    const isEditingStatusColumn = isEditMode && statusColumn?.column_name === initialValues?.column_name;

    const isEditingClassificationColumn = isEditMode && isClassificationCellType(initialValues?.cell_type);

    const availableColumns = viewColumns.filter((col) => {
        if (!hasValidColumnName(col)) {
            return false;
        }
        if (existingColumnNames.includes(col.column_name)) {
            return isEditMode && col.column_name === initialValues.column_name;
        }
        if (expandableClassificationColumn && !isEditingExpandableColumn && isNivelColumn(col.column_name)) {
            return false;
        }
        return true;
    });

    const columnOptions = useMemo(
        () =>
            availableColumns.map((col) => ({
                value: col.column_name,
                label: col.column_name,
            })),
        [availableColumns],
    );

    const cellTypeOptions = useMemo(() => {
        const options = [
            { value: "default", label: t("generalSetup.casesColumnEditor.cellTypes.default", "Por defecto") },
            {
                value: "clasificacion",
                label: t("generalSetup.casesColumnEditor.cellTypes.clasificacion", "Clasificación"),
            },
            { value: "estado", label: t("generalSetup.casesColumnEditor.cellTypes.estado", "Estado") },
        ];

        return options.filter((option) => {
            if (option.value === "estado" && statusColumn && !isEditingStatusColumn) {
                return false;
            }
            if (isClassificationCellType(option.value) && classificationColumn && !isEditingClassificationColumn) {
                return false;
            }
            return true;
        });
    }, [t, statusColumn, isEditingStatusColumn, classificationColumn, isEditingClassificationColumn]);

    const isClassificationLevelField = isClassificationCellType(cellType) && isNivelColumn(columnName);
    const isClassificationSeparatorField = isClassificationCellType(cellType) && !isNivelColumn(columnName);
    const showExpandLevels =
        isClassificationLevelField || (isClassificationSeparatorField && separator.trim().length > 0);

    const findSchemaColumn = (name) => viewColumns.find((c) => c.column_name === name);

    const handleColumnChange = (selected) => {
        setColumnName(selected);
        if (selected) {
            const col = findSchemaColumn(selected);
            setHeaderLabel(col ? col.column_name : selected);
        } else {
            setHeaderLabel("");
        }
    };

    const handleSave = () => {
        const candidateColumn = {
            column_name: columnName,
            cell_type: cellType,
            expand_levels: expandLevels,
            separator: separator.trim() || undefined,
        };

        const isAddingAnotherExpandableClassification =
            expandableClassificationColumn &&
            !isEditingExpandableColumn &&
            wouldBeExpandableClassificationColumn(candidateColumn);

        if (isAddingAnotherExpandableClassification) {
            toast.error(
                t(
                    "generalSetup.casesColumnEditor.expandableColumnAlreadyExists",
                    "Ya tienes una columna con expansión de clasificaciones habilitada. Edítala o desactiva la expansión antes de agregar otra.",
                ),
            );
            return;
        }

        const isAddingAnotherClassificationColumn =
            classificationColumn && !isEditingClassificationColumn && isClassificationCellType(cellType);

        if (isAddingAnotherClassificationColumn) {
            toast.error(
                t(
                    "generalSetup.casesColumnEditor.classificationColumnAlreadyExists",
                    "Ya tienes una columna de tipo clasificación. Edítala o elimínala antes de agregar otra.",
                ),
            );
            return;
        }

        const isAddingAnotherStatusColumn = statusColumn && !isEditingStatusColumn && isStatusCellType(cellType);

        if (isAddingAnotherStatusColumn) {
            toast.error(
                t(
                    "generalSetup.casesColumnEditor.statusColumnAlreadyExists",
                    "Ya tienes una columna de tipo estado. Edítala o elimínala antes de agregar otra.",
                ),
            );
            return;
        }

        const resolvedLabel = headerLabel.trim() || columnName;

        const visibleColumn = {
            column_name: columnName,
            header_label: resolvedLabel,
            cell_type: cellType,
        };

        if (showExpandLevels) {
            visibleColumn.expand_levels = expandLevels;
        }

        if (isClassificationSeparatorField && separator.trim()) {
            visibleColumn.separator = separator.trim();
        }

        onSave(visibleColumn);
    };

    const showSeparator = isClassificationSeparatorField;
    const isSaveDisabled = !columnName;

    const title = isEditMode
        ? t("generalSetup.casesColumnEditor.editTitle", "Editar columna")
        : t("generalSetup.casesColumnEditor.addTitle", "Agregar columna");

    return (
        <Dialog
            open={isOpen}
            onOpenChange={(open) => {
                if (!open) {
                    onClose();
                }
            }}
        >
            <Portal>
                <DialogOverlay />
                <DialogContent className="sm:max-w-2xl max-h-[calc(100vh-12rem)] flex flex-col overflow-hidden">
                    <div className="flex-shrink-0">
                        <DialogClose asChild>
                            <Button
                                size="icon"
                                variant="outline"
                                type="button"
                                aria-label={t("button.close", "Cerrar")}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </DialogClose>
                        <DialogTitle>{title}</DialogTitle>
                        <DialogDescription>
                            {t(
                                "generalSetup.casesColumnEditor.description",
                                "Configura las columnas visibles en la vista de casos",
                            )}
                        </DialogDescription>
                    </div>

                    <div className="flex-1 min-h-0 overflow-y-auto">
                        <div className="flex flex-col gap-4">
                            <SelectField
                                label={t("generalSetup.casesColumnEditor.fieldLabel", "Campo")}
                                name="column_name"
                                value={columnName}
                                placeholder={t(
                                    "generalSetup.casesColumnEditor.selectPlaceholder",
                                    "Selecciona un campo",
                                )}
                                options={columnOptions}
                                onValueChange={handleColumnChange}
                            />

                            <InputField
                                label={t("generalSetup.casesColumnEditor.headerLabel", "Cabecera")}
                                name="header_label"
                                value={headerLabel}
                                onChange={(e) => setHeaderLabel(e.target.value)}
                                placeholder={t("generalSetup.casesColumnEditor.headerLabel", "Cabecera")}
                            />

                            <SelectField
                                label={t("generalSetup.casesColumnEditor.typeLabel", "Tipo")}
                                name="cell_type"
                                value={cellType}
                                placeholder={t(
                                    "generalSetup.casesColumnEditor.selectPlaceholder",
                                    "Selecciona un campo",
                                )}
                                options={cellTypeOptions}
                                onValueChange={setCellType}
                            />

                            {showSeparator && (
                                <div className="flex flex-col gap-1">
                                    <InputField
                                        label={t(
                                            "generalSetup.casesColumnEditor.separatorLabel",
                                            "Separador de niveles en la vista",
                                        )}
                                        name="separator"
                                        aria-describedby="column-separator-help"
                                        value={separator}
                                        onChange={(e) => setSeparator(e.target.value)}
                                        placeholder={t("generalSetup.casesColumnEditor.separatorPlaceholder", "Ej: ->")}
                                    />
                                    <p id="column-separator-help" className="text-xs text-muted-foreground">
                                        {t(
                                            "generalSetup.casesColumnEditor.separatorHelp",
                                            "Caracter que se usa en la vista para separar los niveles de la clasificación (por ejemplo, 'A > B > C' usa ' > ').",
                                        )}
                                    </p>
                                </div>
                            )}

                            {showExpandLevels && (
                                <SwitchField
                                    label={t(
                                        "generalSetup.casesColumnEditor.expandLevels",
                                        "Agrupar y expandir clasificaciones",
                                    )}
                                    name="expand_levels"
                                    checked={expandLevels}
                                    onCheckedChange={setExpandLevels}
                                />
                            )}

                            <div className="flex items-center justify-center">
                                <Button
                                    size="sm"
                                    type="button"
                                    className="w-52"
                                    disabled={isSaveDisabled}
                                    onClick={handleSave}
                                >
                                    {isEditMode ? t("button.save", "Guardar") : t("button.add", "Agregar")}
                                </Button>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Portal>
        </Dialog>
    );
}
