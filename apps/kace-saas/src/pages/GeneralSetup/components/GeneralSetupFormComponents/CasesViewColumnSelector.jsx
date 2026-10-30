import { useMemo } from "react";
import PropTypes from "prop-types";
import MultiSelect from "@/componentsV2/core/MultiSelect";
import { useTranslation } from "react-i18next";

const SYSTEM_FIELDS = ["deleted_at", "deleted_by", "id", "responsable_id", "cliente_id"];

const CasesViewColumnSelector = ({ viewName, schemaFields, value = [], onChange }) => {
    const { t } = useTranslation();

    const options = useMemo(() => {
        if (!viewName || !schemaFields?.[viewName]) return [];
        return schemaFields[viewName]
            .filter((col) => !SYSTEM_FIELDS.includes(col.column_name))
            .map((col) => ({
                id: col.column_name,
                value: col.column_name,
                label: col.column_name,
            }));
    }, [viewName, schemaFields]);

    const selectedData = useMemo(() => options.filter((opt) => value.includes(opt.id)), [options, value]);

    if (!viewName) return null;

    const handleSelectOption = (columnId) => {
        const isSelected = value.includes(columnId);
        onChange(isSelected ? value.filter((c) => c !== columnId) : [...value, columnId]);
    };

    const handleSelectAll = () => {
        onChange(options.map((opt) => opt.id));
    };

    const handleDeselectAll = () => onChange([]);

    return (
        <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">{t("generalSetup.form.labels.visible_columns")}</label>
            <MultiSelect
                selectedData={selectedData}
                options={options}
                onSelectOption={handleSelectOption}
                onSelectedAll={handleSelectAll}
                showDeselectAll
                onDeselectAll={handleDeselectAll}
                dataTestid="admin_visible_columns"
            />
        </div>
    );
};

CasesViewColumnSelector.propTypes = {
    viewName: PropTypes.string,
    schemaFields: PropTypes.object,
    value: PropTypes.arrayOf(PropTypes.string),
    onChange: PropTypes.func.isRequired,
};

export default CasesViewColumnSelector;
