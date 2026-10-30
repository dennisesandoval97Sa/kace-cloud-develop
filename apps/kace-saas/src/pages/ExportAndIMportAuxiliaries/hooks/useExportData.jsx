import { apiService } from "@kace/utils";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    COLUMNS_NOT_SHOW_CLASSIFICATIONS,
    COLUMNS_NOT_SHOW_GROUPS,
    COLUMNS_NOT_SHOW_USERS,
    MODULES,
} from "../data/Constants";
import { flattenNestedProperties } from "../data/proccessData";

/**
 * Hook: useExportData
 * Responsabilidades:
 * 1. Detectar si el módulo es una definición auxiliar (schema numérico) o legacy.
 * 2. Obtener nombre de tabla (solo definiciones auxiliares) desde /aux-definitions.
 * 3. Obtener y aplanar estructura del esquema desde /schemas/{schema_id}/rules.
 * 4. Normalizar columnas y aplicar filtros/contexto (legacy vs aux-definition).
 * 5. Reordenar/agregar columna id requerida en modo import.
 */
const useExportData = ({ module, isImport = false }) => {
    // Flags y estado base
    const isAuxDefinition = useMemo(
        () => Boolean(module && (typeof module === "number" || !isNaN(module) || !MODULES[module])),
        [module],
    );

    const [rawSchemaFields, setRawSchemaFields] = useState([]); // Campos crudos (aplanados o lista simple)
    const [tableName, setTableName] = useState(null);

    const moduleObject = useMemo(() => (!isAuxDefinition ? MODULES[module] : null), [isAuxDefinition, module]);

    // Obtiene nombre de tabla solo para definiciones auxiliares
    useEffect(() => {
        const fetchAuxDefinitionTable = async () => {
            if (!isAuxDefinition || !module) {
                setTableName(null);
                return;
            }
            setTableName(null);
            try {
                const response = await apiService.get("/aux-definitions");
                const items = response?.data?.data?.items || [];
                const match = items.find((item) => item.schema_id === module);
                setTableName(match?.tablename || null);
            } catch (_) {
                // Errors are intentionally not logged or thrown to prevent flow interruption
                setTableName(null);
            }
        };
        fetchAuxDefinitionTable();
    }, [module, isAuxDefinition]);

    // Obtiene estructura de esquema y lo aplana (solo definiciones auxiliares)
    useEffect(() => {
        const fetchAuxDefinitionSchema = async () => {
            if (!isAuxDefinition || !module) {
                setRawSchemaFields([]);
                return;
            }
            setRawSchemaFields([]);
            try {
                const schemaResponse = await apiService.get(`/schemas/${module}/rules`);
                const schemaData = schemaResponse.data?.data;

                if (schemaData?.data_structure) {
                    const flattened = flattenNestedProperties(schemaData.data_structure);

                    const enriched = flattened.map((field) => {
                        const originalNode = schemaData.data_structure?.[field.path];

                        return {
                            ...field,
                            truthyValues: originalNode?.truthyValues,
                            falsyValues: originalNode?.falsyValues,
                        };
                    });

                    setRawSchemaFields(enriched);
                } else {
                    setRawSchemaFields([]);
                }
            } catch (_) {
                // Errors are intentionally not logged or thrown to prevent flow interruption
                setRawSchemaFields([]);
            }
        };
        fetchAuxDefinitionSchema();
    }, [module, isAuxDefinition]);

    // Normaliza columnas según tipo de módulo
    const normalizedColumns = useMemo(() => {
        if (!rawSchemaFields || rawSchemaFields.length === 0) return [];

        if (isAuxDefinition) {
            return rawSchemaFields.map((field) => ({
                value: field.path,
                label: field.label || field.path,
                type: field.type || "String",
                nameColumn: field.path,
                required: Boolean(field.required),
                schemaConfig: {
                    truthyValues: field.truthyValues,
                    falsyValues: field.falsyValues,
                    type: field.type,
                },
            }));
        }

        // Legacy: asume rawSchemaFields es lista de strings (se puede adaptar si cambia)
        return rawSchemaFields.map((col) => ({
            value: col,
            label: col,
            type: col.type || "String",
            nameColumn: col,
        }));
    }, [rawSchemaFields, isAuxDefinition]);

    // Aplica filtros específicos para módulos legacy
    const applyLegacyFilters = useCallback(
        (columns) => {
            if (isAuxDefinition || !moduleObject) return columns;
            const { value } = moduleObject;
            let filtered = columns;

            if (value === "usuarios") {
                filtered = columns.filter((c) => !COLUMNS_NOT_SHOW_USERS.includes(c.value));
            } else if (value === "grupos") {
                filtered = columns.filter((c) => !COLUMNS_NOT_SHOW_GROUPS.includes(c.value));
            } else if (value === "clasificaciones") {
                filtered = columns.filter((c) => !COLUMNS_NOT_SHOW_CLASSIFICATIONS.includes(c.value));
            }

            if (value === "usuarios" || value === "clasificaciones") {
                filtered = [
                    ...filtered,
                    {
                        value: "grupos",
                        label: "Grupos",
                        type: "String",
                        nameColumn: "grupos",
                    },
                ];
            }
            return filtered;
        },
        [isAuxDefinition, moduleObject],
    );

    // Garantiza que la columna id esté primero y marcada requerida en modo import
    const ensureIdFirst = useCallback(
        (columns) => {
            if (!isImport) return columns;
            const id = columns.find((c) => c.value === "id");
            const rest = columns.filter((c) => c.value !== "id");
            if (id) return [{ ...id, required: true }, ...rest];
            return [
                {
                    value: "id",
                    label: "ID",
                    type: "String",
                    nameColumn: "id",
                    required: true,
                },
                ...columns,
            ];
        },
        [isImport],
    );

    // Pipeline final de columnas
    const currentHeaders = useMemo(() => {
        if (normalizedColumns.length === 0) return [];
        const withFilters = applyLegacyFilters(normalizedColumns);
        return ensureIdFirst(withFilters);
    }, [normalizedColumns, applyLegacyFilters, ensureIdFirst]);

    return { currentHeaders, tableName };
};

export default useExportData;
