import PropTypes from "prop-types";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import InputCard from "@/components/core/Cards/InputCard";
import useSchemaFields from "@/hooks/useSchemaFields";
import { KField, SelectForm } from "@kace/ui-shared";

export const PeriodFieldSelect = ({ reportName }) => {
    const { t } = useTranslation();
    const { getSchemaField } = useSchemaFields();

    const dateFields = useMemo(() => {
        if (!reportName) {
            return [];
        }

        const schemaFields = getSchemaField(reportName);

        if (!schemaFields || schemaFields.length === 0) {
            return [];
        }

        const dateFieldsArray = schemaFields
            .filter((field) => (field.column_name || field.name || "").startsWith("filter_"))
            .map((field) => {
                const columnName = field.column_name || field.name;
                return {
                    value: columnName,
                    label: columnName.replace(/^filter_/, ""),
                };
            })
            .sort((a, b) => a.label.localeCompare(b.label));

        return dateFieldsArray;
    }, [reportName, getSchemaField]);

    return (
        <InputCard>
            <KField>
                <SelectForm
                    id="period.field"
                    name="period.field"
                    label={t("reports.form.columnFilter")}
                    options={dateFields}
                    placeholder={
                        dateFields.length === 0
                            ? t("reports.form.noDateFieldsAvailable")
                            : t("reports.form.dateFieldPlaceholder")
                    }
                    dataTestId="select_period_field"
                    disabled={dateFields.length === 0}
                    required
                />
            </KField>
        </InputCard>
    );
};

PeriodFieldSelect.propTypes = {
    reportName: PropTypes.string.isRequired,
};
