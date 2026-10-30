import { useEffect, useState } from "react";
import { DashboardSectionCard } from "../../components/core/Cards/DashboardSectionCard";
import { SelectTypeData } from "./components/SelectTypeData";
import { FiltersByModuleComponent } from "./components/FiltersByModuleComponent";
import { ColumnsForDataComponent } from "./components/ColumnsForDataComponent";
import { Form, Formik } from "formik";
import { INITIAL_VALUES_PER_MODULE } from "./data/Constants";
import { sendInformation } from "../../services/generic-send-information";
import { toast } from "sonner";
import { Button } from "../../components/ui-shared";
import { EXPORTS_SERVICE } from "../../utils/URL";
import { joiFormikAdapter } from "@kace/utils";
import { exportSchema } from "../../schemas/ExportSchema";
import { useTranslation } from "react-i18next";

export const ExportData = () => {
    const [moduleSelected, setModuleSelected] = useState("usuarios");
    const [moduleValidation, setModuleValidation] = useState(null);
    const [formData, setFormData] = useState({});
    const [columnsSelected, setColumnsSelected] = useState([]);
    const [saveValues, setSaveValues] = useState(null);
    const [loading, setLoading] = useState(false);
    const { t } = useTranslation();
    const [formKey, setFormKey] = useState(0);

    const isColumnDate = (column) => {
        const keyWords = ["fecha", "created_at", "updated_at"];
        return keyWords.some((word) => column.includes(word));
    };

    const resolveStatusOperator = (values) => {
        const statusForm =
            values?.status !== undefined
                ? "status"
                : values?.is_active !== undefined
                    ? "is_active"
                    : null;

        const status = statusForm ? values[statusForm] : null;
        if (status === "" || status === undefined || status === null) return null;
        const operator = status === 2 ? "neq" : status === true || status === 1 ? "eq" : null;
        values[statusForm] = moduleSelected === "clasificaciones" ? true : 1;
        return operator;
    };

    const handleSendRequest = () => {
        setLoading(true);
        const statusOperator = resolveStatusOperator(saveValues);
        const filterSaveData = Object.fromEntries(
            Object.entries(saveValues).filter(([_, value]) => value !== null && value !== ""),
        );
        const filterCriteria = Object.entries(filterSaveData)
            .map(([key, value]) => {
                if (key !== "id") {
                    return {
                        field: key,
                        operator: isColumnDate(key) ? "between" : statusOperator || (typeof key === "string" ? "ilike" : "eq"),
                        value,
                        type: "AND",
                    };
                }
                return null;
            })
            .filter((item) => item !== null);
        const dataPost = {
            tableName: moduleSelected,
            ...(filterCriteria &&
                filterCriteria.length > 0 && {
                criteria: { filter: filterCriteria },
            }),
            headers: Array.from(new Set(["id", ...columnsSelected])),
        };
        toast.promise(
            sendInformation({
                url: EXPORTS_SERVICE,
                dataPost,
            }).then((response) => {
                if (response.data.data.downloadUrl) {
                    window.open(
                        response.data.data.downloadUrl,
                        "_blank",
                        "noopener,noreferrer",
                    );
                }
                return response;
            })
            .catch((err) => {
                const msg = err?.response?.data?.errors?.[0]?.message || "";
                if (msg.includes("No se encontraron registros")) {
                    throw new Error(t("importExport.form.noRecords"));
                }
                throw new Error(t("importExport.form.error"));
            })
            .finally(() => {setLoading(false);
                            setFormKey(k => k + 1)}),
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
            setSaveValues(null);
            const initialValuesPerModule =
                INITIAL_VALUES_PER_MODULE[moduleSelected];
            setFormData(initialValuesPerModule);
            setModuleValidation(exportSchema[moduleSelected]);
        }
    }, [moduleSelected]);
    return (
        <DashboardSectionCard title={t("importExport.form.exportTitle")}>
            <article className="flex justify-center">
                <div className="flex flex-col gap-8 p-4 w-full 2xl:w-4/5 h-full bg-background shadow-md rounded-md">
                    <Formik
                        key={formKey}
                        enableReinitialize={true}
                        initialValues={formData}
                        validationSchema={joiFormikAdapter(moduleValidation)}
                        onSubmit={() => {
                            handleSendRequest();
                        }}
                    >
                        {({ setFieldValue, values }) => {
                            setSaveValues(values);
                            return (
                                <Form
                                    className="w-full flex flex-col gap-8 justify-center items-center"
                                    autoComplete="off"
                                >
                                    <SelectTypeData
                                        setModuleSelected={setModuleSelected}
                                    />
                                    <FiltersByModuleComponent
                                        module={moduleSelected}
                                        setFieldValue={setFieldValue}
                                        values={values}
                                    />
                                    <ColumnsForDataComponent
                                        module={moduleSelected}
                                        setColumnsSelected={setColumnsSelected}
                                        columnsSelected={columnsSelected}
                                    />
                                    <Button
                                        type="submit"
                                        disabled={
                                            loading ||
                                            !moduleSelected ||
                                            !columnsSelected.length
                                        }
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
