import PropTypes from "prop-types";
import { es } from "date-fns/locale";
import { useTranslation } from "react-i18next";
import { DatePickerWithRange, DateTimePickerWithRange, InputForm } from "@/components/ui-shared";
import SelectList from "@/components/ui-shared/src/components/select-list";
import { SelectByListLevels } from "@/components/ui-shared/src/components/SelectByListLevels";
import { ComboBoxForValue } from "@/components/ui-shared/src/components/comboBoxForValue/ComboBoxForValue";
import { SelectColors } from "@/components/ui-shared/src/components/SelectColors";
import { SelectIcons } from "@/components/ui-shared/src/components/SelectIcons";
import { isBooleanSchemaType, SPECIAL_FIELDS } from "@/services/createSchemaFilter";
import { memo } from "react";
import DataTableFilterInputBaseLayout from "./DataTableFilterInputBaseLayout";
import FilterGroupsMultiselect from "@/pages/User/components/FilterGroupsMultiselect";
import FilterRolesMultiselect from "@/pages/User/components/FilterRolesMultiselect";
import FilterClassificationSelect from "@/pages/Classifications/components/FilterClassificationSelect";
import FilterUsersMultiselect from "./filters/FilterUsersMultiselect";

const STATUS_ALL = "all";
const STATUS_ACTIVE = "active";
const STATUS_INACTIVE = "inactive";

const numberSwitchStateToDisplayValue = (filterValue, fallbackOperator) => {
    const v = filterValue?.value;
    const op = filterValue?.operator ?? fallbackOperator ?? "eq";
    if (v === "" || v === null || v === undefined) return "";
    const n = Number(v);
    if (Number.isNaN(n)) return "";
    if (op === "neq" && n === 1) return 0;
    if (op === "eq" && n === 1) return 1;
    if (op === "eq" && n === 0) return 0;
    return "";
};

const DataTableFilterInputs = ({
    type = "",
    label = "",
    name = "",
    options = [],
    value = null,
    filterData = {},
    handle = () => {},
    fieldType = "",
    schemaColumnType = "",
    maxLevel,
}) => {
    const { t } = useTranslation();

    const handleChange = (newValue, label) => {
        let value;
        let field = filterData.field;
        let operator = filterData.operator;

        if (type === SPECIAL_FIELDS.classification_levels) {
            const segments = String(newValue ?? "").split("/");
            const newField = segments[0];
            const tablePrefix = filterData.field?.includes(".") ? `${filterData.field.split(".")[0]}.` : "";
            field = newField.includes(".") ? newField : `${tablePrefix}${newField}`;
            const rawVal = segments.slice(1).join("/");
            value = rawVal === "null" || rawVal === "undefined" ? "" : rawVal;
        } else if (type === SPECIAL_FIELDS.number) {
            value = newValue === "" ? "" : Number(newValue);
        } else if (type === SPECIAL_FIELDS.switch_state) {
            if (newValue === STATUS_ALL) {
                value = "";
                operator = filterData.operator || "eq";
            } else if (isBooleanSchemaType(fieldType, schemaColumnType)) {
                operator = filterData.operator === "neq" ? "eq" : filterData.operator || "eq";
                value = newValue === STATUS_ACTIVE ? "true" : "false";
            } else {
                value = 1;
                operator = newValue === STATUS_ACTIVE ? "eq" : "neq";
            }
        } else {
            value = newValue;
        }

        const filter = {
            ...filterData,
            field,
            value,
            operator,
            ...(label !== undefined && { label }),
        };

        handle(name, filter);
    };

    let content = null;

    switch (type) {
        case SPECIAL_FIELDS.date:
            content = (
                <DatePickerWithRange value={value?.value ?? ""} onChange={handleChange} locale={es} noInitialDate />
            );
            break;
        case SPECIAL_FIELDS.datetime:
            content = (
                <DateTimePickerWithRange value={value?.value ?? ""} onChange={handleChange} locale={es} noInitialDate />
            );
            break;
        case SPECIAL_FIELDS.list:
            content = (
                <SelectList
                    key={String(value?.value ?? "")}
                    value={value?.value ?? ""}
                    label={label}
                    options={options}
                    onChange={handleChange}
                />
            );
            break;
        case SPECIAL_FIELDS.classification_levels:
            content = (
                <SelectByListLevels
                    value={value?.field ? `${value.field}/${value.value ?? ""}` : ""}
                    onChange={handleChange}
                    {...(maxLevel !== undefined && { maxLevel })}
                />
            );
            break;
        case SPECIAL_FIELDS.search_users:
            content = <ComboBoxForValue className="col-span-3" value={value?.value ?? ""} onChange={handleChange} />;
            break;
        case SPECIAL_FIELDS.select_colors:
            content = <SelectColors className="col-span-4" value={value?.value ?? ""} onChange={handleChange} />;
            break;
        case SPECIAL_FIELDS.select_icons:
            content = <SelectIcons className="col-span-4" value={value?.value ?? ""} onChange={handleChange} />;
            break;
        case SPECIAL_FIELDS.switch_state: {
            const statusOptions = [
                { value: STATUS_ALL, name: t("app.forms.all") },
                { value: STATUS_ACTIVE, name: t("app.forms.active") },
                { value: STATUS_INACTIVE, name: t("app.forms.inactive") },
            ];
            let selectedStatus = STATUS_ALL;
            if (isBooleanSchemaType(fieldType, schemaColumnType)) {
                const normalizedValue = String(value?.value).toLowerCase();
                if (["true", "1", "t"].includes(normalizedValue)) selectedStatus = STATUS_ACTIVE;
                else if (["false", "0", "f"].includes(normalizedValue)) selectedStatus = STATUS_INACTIVE;
            } else {
                const displayValue = numberSwitchStateToDisplayValue(value, filterData.operator);
                if (displayValue === 1) selectedStatus = STATUS_ACTIVE;
                else if (displayValue === 0) selectedStatus = STATUS_INACTIVE;
            }
            content = (
                <SelectList
                    key={selectedStatus}
                    value={selectedStatus}
                    options={statusOptions}
                    onChange={(newValue) =>
                        handleChange(newValue, statusOptions.find((option) => option.value === newValue)?.name)
                    }
                />
            );
            break;
        }

        case SPECIAL_FIELDS.multiselect_roles:
            content = (
                <FilterRolesMultiselect
                    value={value?.value ?? ""}
                    onChange={(newValue, label) => handleChange(newValue, label)}
                />
            );
            break;

        case SPECIAL_FIELDS.multiselect_groups:
            content = (
                <FilterGroupsMultiselect
                    value={value?.value ?? ""}
                    onChange={(newValue, label) => handleChange(newValue, label)}
                />
            );
            break;

        case SPECIAL_FIELDS.multiselect_users:
            content = (
                <FilterUsersMultiselect
                    value={value?.value ?? ""}
                    onChange={(newValue, label) => handleChange(newValue, label)}
                />
            );
            break;

        case SPECIAL_FIELDS.select_classification:
            content = (
                <FilterClassificationSelect
                    value={value?.value ?? ""}
                    onChange={(newValue, label) => handleChange(newValue, label)}
                />
            );
            break;

        default:
            content = (
                <InputForm
                    type={type}
                    name={name}
                    value={value?.value ?? ""}
                    className="flex flex-col gap-0"
                    onChange={(e) => handleChange(e.target.value)}
                />
            );
            break;
    }

    return <DataTableFilterInputBaseLayout label={label}>{content}</DataTableFilterInputBaseLayout>;
};

DataTableFilterInputs.propTypes = {
    type: PropTypes.string,
    label: PropTypes.string,
    name: PropTypes.string,
    options: PropTypes.array,
    value: PropTypes.any,
    filterData: PropTypes.shape({
        field: PropTypes.string.isRequired,
        operator: PropTypes.string.isRequired,
        type: PropTypes.string.isRequired,
        value: PropTypes.string,
    }),
    handle: PropTypes.func,
    fieldType: PropTypes.string,
    schemaColumnType: PropTypes.string,
    maxLevel: PropTypes.number,
};

export default memo(DataTableFilterInputs);
