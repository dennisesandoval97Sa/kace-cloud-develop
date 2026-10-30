import { useCallback } from "react";
import { useTranslation } from "react-i18next";

const REPORT_COLUMN_TRANSLATION_KEYS = {
    name: "reports.table.name",
    created_at: "reports.table.generationDate",
    status: "reports.table.status",
    initial_date: "reports.table.initialDate",
    end_date: "reports.table.endDate",
};

/**
 * Hook que procesa el esquema de columnas para reportes
 * Agrega columnas virtuales para initial_date y end_date que no existen en la BD
 * pero se generan en processData desde el campo period
 */
const useProcessReportsSchema = () => {
    const { t } = useTranslation();

    const processReportsSchema = useCallback(
        (rawSchema) => {
            if (!rawSchema?.length) return [];

            /*
             * Filtrar las columnas que queremos del esquema real de la BD
             */
            const realColumns = ["name", "created_at", "status"];
            const filteredSchema = rawSchema.filter((col) => realColumns.includes(col.column_name));

            /*
             * Agregar columnas virtuales para las fechas del período
             * Estas no existen en la BD pero se generan en processData
             */
            const virtualColumns = [
                {
                    column_name: "initial_date",
                    data_type: "date",
                    label: "initial_date",
                    is_nullable: "YES",
                },
                {
                    column_name: "end_date",
                    data_type: "date",
                    label: "end_date",
                    is_nullable: "YES",
                },
            ];

            const result = [...filteredSchema, ...virtualColumns];

            return result.map((column) => {
                const translationKey = REPORT_COLUMN_TRANSLATION_KEYS[column.column_name];
                if (!translationKey) return column;

                return {
                    ...column,
                    header_label: t(translationKey),
                };
            });
        },
        [t],
    );

    const processReportsFilterSchema = useCallback(
        (filterSchema) =>
            filterSchema.map((column) => {
                const translationKey = REPORT_COLUMN_TRANSLATION_KEYS[column.column_name];
                if (!translationKey) return column;

                return {
                    ...column,
                    header: t(translationKey),
                };
            }),
        [t],
    );

    return { processReportsSchema, processReportsFilterSchema };
};

export default useProcessReportsSchema;
