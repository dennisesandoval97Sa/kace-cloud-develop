import { DashboardSectionCard } from "@/components/core/Cards/DashboardSectionCard";
import { Button } from "@/components/ui-shared";
import { exportSchema } from "@/schemas/ExportSchema";
import { sendInformation } from "@/services/generic-send-information";
import { findPublicErrorCode, PUBLIC_ERROR_CODES } from "@kace/error-codes";
import { EXPORTS_SERVICE } from "@/utils/URL";
import { joiFormikAdapter } from "@kace/utils";
import { Form, Formik } from "formik";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AuxDefinitionDynamicFilters } from "./components/AuxDefinitionDynamicFilters";
import { FiltersByModuleComponent } from "./components/FiltersByModuleComponent";
import { SelectTypeData } from "./components/SelectTypeData";
import { INITIAL_VALUES_PER_MODULE, MODULES } from "./data/Constants";
import useExportData from "./hooks/useExportData";

export const ExportAuxiliaries = () => {
    const [moduleSelected, setModuleSelected] = useState(null);
    const [moduleValidation, setModuleValidation] = useState(null);
    const [formData, setFormData] = useState({});
    const [loading, setLoading] = useState(false);
    const { t } = useTranslation();
    const [formKey, setFormKey] = useState(0);
    const [selectKey, setSelectKey] = useState(0);

    // Flags de tipo de módulo
    const isAuxDefinition = Boolean(
        moduleSelected && (typeof moduleSelected === "number" || !isNaN(moduleSelected) || !MODULES[moduleSelected]),
    );

    // Hook para obtener headers y tableName (solo aux-definitions obtiene tableName)
    const { currentHeaders, tableName } = useExportData({ module: moduleSelected });

    const handleSendRequest = (values = {}) => {
        if (!moduleSelected) return;
        setLoading(true);

        let dataPost;

        if (!isAuxDefinition) {
            /*
             * Nueva estructura para "filter by module"
             * Si cualquiera de los inputs está en blanco => filter = []
             */
            const entries = Object.entries(values).filter(([key]) => key !== "id");
            const isBlank = (v) => {
                if (v === undefined || v === null) return true;
                if (typeof v === "string" && v.trim() === "") return true;
                return false;
            };
            const anyBlank = entries.some(([_, v]) => isBlank(v));

            const deletedAtFilter = { field: "deleted_at", operator: "null", value: "null", type: "AND" };

            const filter =
                !anyBlank && entries.length
                    ? [
                          ...entries.map(([key, v]) => ({
                              field: "data",
                              operator: "jsonContains",
                              value: JSON.stringify({ [key]: v }),
                              type: "AND",
                          })),
                          deletedAtFilter,
                      ]
                    : [deletedAtFilter];

            dataPost = {
                tableName: moduleSelected,
                criteria: { filter },
                headers: ["id", "data"],
            };
        } else {
            // Lógica existente para aux definitions (se mantiene igual)
            const filterSaveData = Object.fromEntries(
                Object.entries(values).filter(([_, value]) => value !== null && value !== ""),
            );

            const filterCriteria = Object.entries(filterSaveData)
                .flatMap(([key, value]) => {
                    if (key === "id") return [];

                    const header = currentHeaders.find((h) => h.nameColumn === key || h.value === key);

                    const typeNorm = (header?.type || "string").toLowerCase();

                    if (typeNorm === "boolean") {
                        const truthyValues = header?.schemaConfig?.truthyValues;
                        const falsyValues = header?.schemaConfig?.falsyValues;

                        const defaultTruthy = [true];
                        const defaultFalsy = [false];

                        const normalizeInputBoolean = (val) => {
                            if (val === true || val === "true" || val === 1 || val === "1") return true;
                            if (val === false || val === "false" || val === 0 || val === "0") return false;
                            return null;
                        };

                        const normalizedValue = normalizeInputBoolean(value);

                        if (normalizedValue === null) return [];

                        const safeTruthy =
                            Array.isArray(truthyValues) && truthyValues.length ? truthyValues : defaultTruthy;

                        const safeFalsy = Array.isArray(falsyValues) && falsyValues.length ? falsyValues : defaultFalsy;

                        const rawValues = normalizedValue ? safeTruthy : safeFalsy;

                        const valuesToUse = rawValues.map(normalizeInputBoolean).filter((v) => v !== null);

                        const finalValues = valuesToUse.length
                            ? valuesToUse
                            : normalizedValue
                              ? defaultTruthy
                              : defaultFalsy;

                        const uniqueValues = [...new Set(finalValues)];
                        if (uniqueValues.includes(true) && uniqueValues.includes(false)) {
                            return [];
                        }

                        if (uniqueValues.length === 1) {
                            return [
                                {
                                    field: "data",
                                    operator: "jsonContains",
                                    value: JSON.stringify({ [key]: uniqueValues[0] }),
                                    type: "AND",
                                },
                            ];
                        }

                        return uniqueValues.map((val) => ({
                            field: "data",
                            operator: "jsonContains",
                            value: JSON.stringify({ [key]: val }),
                            type: "OR",
                        }));
                    }

                    if (["number", "integer", "float", "decimal"].includes(typeNorm)) {
                        if (isNaN(Number(value))) return [];
                        value = Number(value);
                    }

                    if (["date", "datetime"].includes(typeNorm)) {
                        if (typeof value !== "string" || !value.includes(",")) return [];

                        return [
                            {
                                field: `${tableName}.${key}`,
                                operator: "between",
                                value,
                                type: "AND",
                            },
                        ];
                    }

                    if (["array", "object", "json"].includes(typeNorm)) {
                        try {
                            const parsed = JSON.parse(value);
                            value = typeof parsed === "object" ? JSON.stringify(parsed) : value;
                        } catch (_) {
                            // Errors are intentionally not logged or thrown to prevent flow interruption
                            return null;
                        }
                    }

                    return [
                        {
                            field: "data",
                            operator: "jsonContains",
                            value: JSON.stringify({ [key]: value }),
                            type: "AND",
                        },
                    ];
                })
                .filter(Boolean);

            dataPost = {
                tableName: tableName || moduleSelected,
                criteria: {
                    filter: [...filterCriteria, { field: "deleted_at", operator: "null", value: "null", type: "AND" }],
                },
                headers: ["id", "data"],
            };
        }

        toast.promise(
            sendInformation({
                url: EXPORTS_SERVICE,
                dataPost,
            })
                .then((response) => {
                    if (response.data.data.downloadUrl) {
                        window.open(response.data.data.downloadUrl, "_blank", "noopener,noreferrer");
                    }
                    setModuleSelected(null);
                    setSelectKey((k) => k + 1);
                    setFormKey((k) => k + 1);
                    return response;
                })
                .catch((err) => {
                    const publicErrorCode = findPublicErrorCode(
                        err?.response?.data?.data?.code,
                        err?.response?.data?.code,
                    );
                    const msg = err?.response?.data?.errors?.[0]?.message || "";
                    if (
                        publicErrorCode === PUBLIC_ERROR_CODES.AUX_EXPORT_NO_RECORDS ||
                        msg.includes("No se encontraron registros")
                    ) {
                        throw new Error(t("importExport.form.noRecords"));
                    }
                    throw new Error(t("importExport.form.error"));
                })
                .finally(() => {
                    setLoading(false);
                }),
            {
                loading: t("importExport.form.loading"),
                success: t("importExport.form.success"),
                position: "top-center",
                duration: 5000,
                className: "bg-blue-400",
                error: (e) => e.message,
            },
        );
    };

    useEffect(() => {
        if (moduleSelected) {
            setFormKey((k) => k + 1);
            if (!isAuxDefinition) {
                const initialValuesPerModule = INITIAL_VALUES_PER_MODULE[moduleSelected];
                setFormData(initialValuesPerModule);
                setModuleValidation(exportSchema[moduleSelected]);
            } else {
                setFormData({});
                setModuleValidation(null);
            }
        }
    }, [moduleSelected, isAuxDefinition]);

    return (
        <DashboardSectionCard title={t("importExport.form.exportAuxTitle")}>
            <article className="flex justify-center">
                <div className="flex flex-col gap-8 p-4 w-full 2xl:w-4/5 h-full bg-background shadow-md rounded-md">
                    <SelectTypeData key={selectKey} setModuleSelected={setModuleSelected} />
                    <Formik
                        key={formKey}
                        enableReinitialize={true}
                        initialValues={formData}
                        validationSchema={moduleValidation ? joiFormikAdapter(moduleValidation) : undefined}
                        onSubmit={(values) => {
                            handleSendRequest(values);
                        }}
                    >
                        {({ setFieldValue, values }) => {
                            const headersForFilters = isAuxDefinition
                                ? currentHeaders.filter((h) => h.value !== "id")
                                : [];
                            return (
                                <Form
                                    className="w-full flex flex-col gap-8 justify-center items-center"
                                    autoComplete="off"
                                >
                                    {isAuxDefinition ? (
                                        <AuxDefinitionDynamicFilters
                                            headers={headersForFilters}
                                            setFieldValue={setFieldValue}
                                            values={values}
                                        />
                                    ) : (
                                        <FiltersByModuleComponent
                                            module={moduleSelected}
                                            setFieldValue={setFieldValue}
                                            values={values}
                                        />
                                    )}
                                    <Button
                                        type="submit"
                                        disabled={loading || !moduleSelected || (isAuxDefinition && !tableName)}
                                        id="btn_export_data"
                                        data-testid="btn_export_data"
                                    >
                                        {t("importExport.form.button")}
                                    </Button>
                                </Form>
                            );
                        }}
                    </Formik>
                </div>
            </article>
        </DashboardSectionCard>
    );
};
