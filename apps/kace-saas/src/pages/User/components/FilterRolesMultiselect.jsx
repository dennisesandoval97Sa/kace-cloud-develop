import PropTypes from "prop-types";
import { useMemo } from "react";
import MultiSelect from "@/componentsV2/core/MultiSelect";
import { useRolesUser } from "@/pages/User/hooks/useRolesUser";

const FilterRolesMultiselect = ({ value = "", onChange }) => {
    const selectedIds = useMemo(() => (value ? value.split(",").filter(Boolean) : []), [value]);

    const { rolesOptions, isLoadingRoles, fetchNextRoles, isFetchingNextPageRoles, onSearchRoles } = useRolesUser();

    const selectedData = rolesOptions.filter((o) => selectedIds.includes(String(o.id)));

    const handleSelectOption = (itemId) => {
        const id = String(itemId);
        const next = selectedIds.includes(id) ? selectedIds.filter((i) => i !== id) : [...selectedIds, id];
        const label = rolesOptions
            .filter((o) => next.includes(String(o.id)))
            .map((o) => o.label)
            .join(", ");
        onChange(next.join(","), label);
    };

    const handleSelectAll = () => {
        const label = rolesOptions.map((o) => o.label).join(", ");
        onChange(rolesOptions.map((o) => String(o.id)).join(","), label);
    };

    const handleDeselectAll = () => onChange("", "");

    return (
        <MultiSelect
            options={rolesOptions}
            selectedData={selectedData}
            isLoading={isLoadingRoles}
            isFetchingNextPage={isFetchingNextPageRoles}
            onSelectOption={handleSelectOption}
            onSelectedAll={handleSelectAll}
            showDeselectAll
            onDeselectAll={handleDeselectAll}
            fetchNextPage={fetchNextRoles}
            onInputChange={onSearchRoles}
        />
    );
};

FilterRolesMultiselect.propTypes = {
    value: PropTypes.string,
    onChange: PropTypes.func.isRequired,
};

export default FilterRolesMultiselect;
