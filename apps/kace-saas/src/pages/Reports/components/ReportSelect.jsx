import PropTypes from "prop-types";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import InputCard from "@/components/core/Cards/InputCard";
import useSchemaFields from "@/hooks/useSchemaFields";
import { KField } from "@kace/ui-shared";
import SelectField from "@kace_v2/shared/ui/molecules/SelectField";
import { Button } from "@/components/ui-shared";

export const ReportSelect = ({
    onReportChange,
    setFieldValue,
    values,
    initialValues,
    errors,
    setDateRange,
    resetForm,
}) => {
    const { t } = useTranslation();

    // Obtener todos los schema fields
    const { processSchemaFields } = useSchemaFields();
    const [allSchemas, setAllSchemas] = useState(null);

    // Cargar todos los schemas al montar el componente
    useEffect(() => {
        const loadSchemas = async () => {
            const result = await processSchemaFields();
            if (result?.data) {
                setAllSchemas(result.data);
            }
        };
        loadSchemas();
    }, [processSchemaFields]);

    // Filtrar y crear opciones de reportes dinámicamente desde las keys que contienen "reports"
    const reportOptions = useMemo(() => {
        if (!allSchemas) return [];

        const filteredReports = Object.keys(allSchemas)
            .filter((key) => key.toLowerCase().includes("reports"))
            .map((key) => ({
                value: key,
                label: key
                    .split("_")
                    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(" "),
            }))
            .sort((a, b) => a.label.localeCompare(b.label));

        return filteredReports;
    }, [allSchemas]);

    const handleClearReport = () => {
        resetForm();
        setDateRange({
            from: "",
            to: "",
        });
    };

    return (
        <InputCard>
            <KField>
                <div className="flex items-end gap-2">
                    <div className="flex-1">
                        <SelectField
                            label={t("reports.form.selectReport")}
                            options={reportOptions}
                            defaultValue={initialValues?.report || ""}
                            value={values?.report ?? ""}
                            error={errors?.report}
                            onValueChange={(value) => setFieldValue("report", value)}
                            placeholder={
                                reportOptions.length === 0
                                    ? t("reports.form.loadingReports")
                                    : t("reports.form.reportPlaceholder")
                            }
                            dataTestId="reports_form_select_report"
                            disabled={reportOptions.length === 0}
                        />
                    </div>
                    {values?.report && (
                        <Button type="button" variant="outline" onClick={handleClearReport}>
                            {t("app.forms.clearAll")}
                        </Button>
                    )}
                </div>
            </KField>
        </InputCard>
    );
};

ReportSelect.propTypes = {
    onReportChange: PropTypes.func,
};
