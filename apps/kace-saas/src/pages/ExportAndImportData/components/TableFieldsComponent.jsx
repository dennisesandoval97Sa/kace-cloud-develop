import {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@kace/ui-shared";
import PropTypes from "prop-types";
import useExportData from "../hooks/useExportData";
import { VALIDATE_REQUIRED_FIELDS } from "../data/Constants";
import { useTranslation } from "react-i18next";
import { formatTestId } from "@/utils/src/helpers"

export const TableFieldsComponent = ({ moduleSelected }) => {
    const { currentHeaders } = useExportData({
        module: moduleSelected,
        isImport: true,
    });
    const { t } = useTranslation();
    const handleColumnsExamples = (item) => {
        const { type, nameColumn } = item;
        const statusFields = ["status", "is_active"];
        if (type === "String") {
            if (nameColumn.includes("grupos")) {
                return "1,2,3 (Separar por comas)";
            }
            return "Abcdefgh";
        }
        if (type === "Number") {
            if (statusFields.includes(nameColumn)) {
                return "1-activo, 2-inactivo";
            }
            return 1234;
        }
        if (type === "Date" || type === "date") {
            return "2025-03-03T14:30:00Z";
        }
        if (type === "Object") {
            if (nameColumn === "codigos_externos") {
                return "1,2,3 (Separar por comas)";
            }
        }
        if (type === "Boolean") {
            return "true o false";
        }
        return null;
    };
    const handleTypeDate = (type) => {
        if (type === "Date" || type === "date") {
            return "Fecha";
        }
        if (type === "Number") {
            return "Número";
        }
        if (type === "String") {
            return "Texto";
        }
        if (type === "Object") {
            return "Objeto";
        }
        if (type === "Boolean") {
            return "Booleano";
        }
    };

    const getValidationTestId = (prefix, item, moduleSelected) => {
        const status = VALIDATE_REQUIRED_FIELDS[moduleSelected].includes(item.nameColumn)
            ? "required"
            : "optional"
        return formatTestId(prefix, `${item.value}_validation_${status}`)
    }

    return (
        <Table>
            <TableCaption id="table_fields" data-testid="table_fields">
                {t("importExport.form.listModuleColumns")}</TableCaption>
            <TableHeader>
                <TableRow id="table_row_headers" data-testid="table_row_headers">
                    <TableHead className="w-[100px]" id="table_fields_header_name" data-testid="table_fields_header_name" >{t("app.forms.name")}</TableHead>
                    <TableHead id="table_fields_header_column_name" data-testid="table_fields_header_column_name">{t("importExport.form.columnName")}</TableHead>
                    <TableHead id="table_fields_header_type" data-testid="table_fields_header_type">{t("importExport.form.type")}</TableHead>
                    <TableHead id="table_fields_header_example" data-testid="table_fields_header_example">{t("importExport.form.example")}</TableHead>
                    <TableHead className="text-right" id="table_fields_header_validation" data-testid="table_fields_header_validation">{t("importExport.form.validation")}</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {moduleSelected && currentHeaders.map((item) => (
                    < TableRow key={item.value} id={`table_fields_row_${item.value}`} data-testid={`table_fields_row_${item.value}`}>
                        <TableCell className="font-medium" id={formatTestId("table_fields_cell_label", `${item.label}`)} data-testid={formatTestId("table_fields_cell_label", `${item.label}`)}>
                            {item.label}
                        </TableCell>
                        <TableCell id={formatTestId("table_fields_cell", `${item.value}_column_${item.nameColumn}`)} data-testid={`table_fields_cell_column_${item.value}`}>{item.nameColumn}</TableCell>
                        <TableCell id={formatTestId("table_fields_cell", `${item.value}_type_${item.type}`)} data-testid={formatTestId("table_fields_cell", `${item.value}_type_${item.type}`)}>{handleTypeDate(item.type)}</TableCell>
                        <TableCell id={formatTestId("table_fields_cell", `${item.value}_example_${handleColumnsExamples(item)}`)} data-testid={formatTestId("table_fields_cell", `${item.value}_example_${handleColumnsExamples(item)}`)}>{handleColumnsExamples(item)}</TableCell>
                        <TableCell className="text-right" id={getValidationTestId("table_fields_cell", item, moduleSelected)}
                            data-testid={getValidationTestId("table_fields_cell", item, moduleSelected)}>
                            <span
                                className="rounded-full px-2 py-1 "
                                style={{
                                    backgroundColor: VALIDATE_REQUIRED_FIELDS[
                                        moduleSelected
                                    ].includes(item.nameColumn)
                                        ? "#E76E5080"
                                        : "#2A9D9080",
                                    color: VALIDATE_REQUIRED_FIELDS[
                                        moduleSelected
                                    ].includes(item.nameColumn)
                                        ? "#E76E50"
                                        : "#2A9D90",
                                }}
                            >
                                {VALIDATE_REQUIRED_FIELDS[
                                    moduleSelected
                                ].includes(item.nameColumn)
                                    ? "Requerido"
                                    : "Opcional"}
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
