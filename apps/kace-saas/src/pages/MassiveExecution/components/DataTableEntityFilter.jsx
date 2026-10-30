import React, { useMemo } from "react";
import PropTypes from "prop-types";
import { Formik, Form } from "formik";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui-shared";
import DataTableFilterInputs from "@/componentsV2/core/DataTable/components/DataTableFilterInputs";
import useSchemaFields from "@/hooks/useSchemaFields";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";
import { isIdentityFilterField } from "@/utils/identityFilterField";

const toTitleCase = (str) => {
    if (!str) return "";
    return str
        .replace(/_/g, " ")
        .toLowerCase()
        .split(" ")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
};

const getDefaultOperator = (dataType, columnName) => {
    if (isIdentityFilterField(columnName)) return "eq";
    switch (dataType.toLowerCase()) {
        case "number":
        case "integer":
        case "bigint":
        case "numeric":
            return "eq";
        case "date":
        case "timestamp":
            return "between";
        case "boolean":
            return "is";
        default:
            return "ilike";
    }
};

const DataTableEntityFilter = ({
    onApply = () => {},
    onClear = () => {},
    isFetching = false,
    excludeColumns = [],
    fieldPrefix = "",
}) => {
    const { t } = useTranslation();
    const { getSchemaField } = useSchemaFields();

    const schema = useMemo(() => getSchemaField(URL_AND_KEYS.clients.entity), []);

    const filteredSchema = useMemo(() => {
        if (!schema) return [];
        return schema.filter((field) => !excludeColumns.includes(field.column_name));
    }, [schema, excludeColumns]);

    if (!filteredSchema || filteredSchema.length === 0) {
        return <div className="p-4 text-center text-gray-500">{t("dataTable.errors.noSchema")}</div>;
    }

    const initialValues = filteredSchema.reduce((acc, field) => {
        acc[field.column_name] = {
            field: `${fieldPrefix}${field.column_name}`,
            operator: getDefaultOperator(field.data_type, field.column_name),
            type: "AND",
            value: "",
        };
        return acc;
    }, {});

    const handleSubmit = (values) => {
        const activeFilters = Object.entries(values)
            .filter(([, filterObject]) => filterObject.value !== null && filterObject.value !== "")
            .map((filter) => filter[1]);
        onApply(activeFilters);
    };

    const handleClear = (resetForm) => {
        resetForm();
        onClear();
    };

    return (
        <Formik initialValues={initialValues} onSubmit={handleSubmit} enableReinitialize>
            {({ values, setFieldValue, resetForm }) => (
                <Form
                    className="flex flex-wrap items-start gap-4 p-4 border bg-background rounded-md mb-4"
                    autoComplete="off"
                >
                    {filteredSchema.map((field) => {
                        const translatedLabel = t(`fieldsClient.${field.column_name}`, toTitleCase(field.column_name));
                        return (
                            <DataTableFilterInputs
                                key={field.column_name}
                                type={field.data_type.toLowerCase()}
                                label={translatedLabel}
                                name={field.column_name}
                                handle={setFieldValue}
                                value={values[field.column_name]}
                                filterData={values[field.column_name]}
                                options={field.options || []}
                            />
                        );
                    })}
                    <div className="flex self-end gap-2 pt-6">
                        <Button type="submit" disabled={isFetching}>
                            {t("massiveExecution.button.filter")}
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            disabled={isFetching}
                            onClick={() => handleClear(resetForm)}
                        >
                            {t("button.clear")}
                        </Button>
                    </div>
                </Form>
            )}
        </Formik>
    );
};

DataTableEntityFilter.propTypes = {
    onApply: PropTypes.func,
    onClear: PropTypes.func,
    isFetching: PropTypes.bool,
    excludeColumns: PropTypes.arrayOf(PropTypes.string),
    fieldPrefix: PropTypes.string,
};

export default DataTableEntityFilter;
