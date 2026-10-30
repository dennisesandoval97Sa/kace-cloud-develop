import { formatTestId } from "@/utils/src/helpers";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@kace/ui-shared";
import { apiService } from "@kace/utils";
import PropTypes from "prop-types";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { MODULES, VALIDATE_REQUIRED_FIELDS } from "../data/Constants";
import { formatFieldName, handleColumnsExamples, handleTypeDate } from "../data/proccessData";
import useExportData from "../hooks/useExportData";

export const TableFieldsComponent = ({ moduleSelected }) => {
    // Mapa de required por padre: { progreso: true/false }
    const [parentRequiredMap, setParentRequiredMap] = useState({});

    const { currentHeaders } = useExportData({
        module: moduleSelected,
        isImport: true,
    });
    const { t } = useTranslation();

    // Determina si es aux-definition (schema numérico / uuid no presente en MODULES)
    const isAuxDefinition = Boolean(
        moduleSelected && (typeof moduleSelected === "number" || !isNaN(moduleSelected) || !MODULES[moduleSelected]),
    );

    const requiredFields = isAuxDefinition ? [] : VALIDATE_REQUIRED_FIELDS[moduleSelected] || [];

    // Obtiene el schema original para deducir required de cada padre
    useEffect(() => {
        let cancel = false;
        const fetchSchema = async () => {
            if (!isAuxDefinition || !moduleSelected) return;
            try {
                const schemaResponse = await apiService.get(`/schemas/${moduleSelected}/rules`);
                const schemaData = schemaResponse?.data?.data;
                const ds = schemaData?.data_structure || {}; // Primer nivel con padres
                const map = Object.entries(ds).reduce((acc, [key, val]) => {
                    acc[key] = Boolean(val?.required);
                    return acc;
                }, {});
                if (!cancel) setParentRequiredMap(map);
            } catch (_) {
                // Errors are intentionally not logged or thrown to prevent flow interruption
                if (!cancel) setParentRequiredMap({});
            }
        };
        fetchSchema();
        return () => {
            cancel = true;
        };
    }, [isAuxDefinition, moduleSelected]);

    const getValidationTestId = (prefix, item) => {
        const status = item.required || requiredFields.includes(item.nameColumn) ? "required" : "optional";
        return formatTestId(prefix, `${item.value}_validation_${status}`);
    };

    // Construye filas incluyendo padre antes de hijos
    const rows = useMemo(() => {
        if (!moduleSelected) return [];
        if (!isAuxDefinition) return currentHeaders; // legacy igual
        if (!currentHeaders || currentHeaders.length === 0) return [];

        const grouped = currentHeaders.reduce((acc, field) => {
            const [parent] = field.value.split("::");
            if (!acc[parent]) acc[parent] = [];
            acc[parent].push(field);
            return acc;
        }, {});

        const output = [];
        Object.entries(grouped).forEach(([parent, children]) => {
            // Detecta si existen hijos anidados (paths con ::)
            const hasNestedChildren = children.some((c) => c.value.includes("::"));
            const isSingleLeafParent = !hasNestedChildren;

            if (isSingleLeafParent) {
                // Caso: campo simple sin hijos (ej: id) -> no crear fila padre duplicada
                children.forEach((child) => {
                    output.push({
                        ...child,
                        isParent: true, // Para mantener estilo si se desea resaltar
                        required: child.required || parentRequiredMap[parent] || false,
                    });
                });
            } else {
                // Caso: objeto con hijos -> crear fila padre y luego hijos
                output.push({
                    value: parent,
                    label: parent,
                    nameColumn: parent,
                    type: "object",
                    required: parentRequiredMap[parent] || false,
                    isParent: true,
                });
                children.forEach((child) => output.push(child));
            }
        });
        return output;
    }, [moduleSelected, isAuxDefinition, currentHeaders, parentRequiredMap]);

    return (
        <Table>
            <TableCaption id="table_fields" data-testid="table_fields">
                {t("importExport.form.listModuleColumns")}
            </TableCaption>
            <TableHeader>
                <TableRow id="table_row_headers" data-testid="table_row_headers">
                    <TableHead
                        className="w-[100px]"
                        id="table_fields_header_name"
                        data-testid="table_fields_header_name"
                    >
                        {t("app.forms.name")}
                    </TableHead>
                    <TableHead id="table_fields_header_column_name" data-testid="table_fields_header_column_name">
                        {t("importExport.form.columnName")}
                    </TableHead>
                    <TableHead id="table_fields_header_type" data-testid="table_fields_header_type">
                        {t("importExport.form.type")}
                    </TableHead>
                    <TableHead id="table_fields_header_example" data-testid="table_fields_header_example">
                        {t("importExport.form.example")}
                    </TableHead>
                    <TableHead
                        className="text-right"
                        id="table_fields_header_validation"
                        data-testid="table_fields_header_validation"
                    >
                        {t("importExport.form.validation")}
                    </TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {rows.map((item) => (
                    <TableRow
                        key={`${item.isParent ? "parent" : "child"}_${item.value}_${item.nameColumn}`}
                        id={`table_fields_row_${item.value}`}
                        data-testid={`table_fields_row_${item.value}`}
                    >
                        <TableCell
                            className={`font-medium ${item.isParent ? "bg-muted/40" : ""}`}
                            id={formatTestId("table_fields_cell_label", `${item.label}`)}
                            data-testid={formatTestId("table_fields_cell_label", `${item.label}`)}
                        >
                            {formatFieldName(item.label)}
                        </TableCell>
                        <TableCell
                            id={formatTestId("table_fields_cell", `${item.value}_column_${item.nameColumn}`)}
                            data-testid={`table_fields_cell_column_${item.value}`}
                        >
                            {item.nameColumn}
                        </TableCell>
                        <TableCell
                            id={formatTestId("table_fields_cell", `${item.value}_type_${item.type}`)}
                            data-testid={formatTestId("table_fields_cell", `${item.value}_type_${item.type}`)}
                        >
                            {handleTypeDate(item.type, t)}
                        </TableCell>
                        <TableCell
                            id={formatTestId(
                                "table_fields_cell",
                                `${item.value}_example_${handleColumnsExamples(item)}`,
                            )}
                            data-testid={formatTestId(
                                "table_fields_cell",
                                `${item.value}_example_${handleColumnsExamples(item)}`,
                            )}
                        >
                            {handleColumnsExamples(item)}
                        </TableCell>
                        <TableCell
                            className="text-right"
                            id={getValidationTestId("table_fields_cell", item)}
                            data-testid={getValidationTestId("table_fields_cell", item)}
                        >
                            <span
                                className="rounded-full px-2 py-1 "
                                style={{
                                    backgroundColor:
                                        item.required || requiredFields.includes(item.nameColumn)
                                            ? "#E76E5080"
                                            : "#2A9D9080",
                                    color:
                                        item.required || requiredFields.includes(item.nameColumn)
                                            ? "#E76E50"
                                            : "#2A9D90",
                                }}
                            >
                                {item.required || requiredFields.includes(item.nameColumn)
                                    ? t("validations.required")
                                    : t("validations.optional")}
                            </span>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
};

TableFieldsComponent.propTypes = {
    moduleSelected: PropTypes.string,
};
