import PropTypes from "prop-types";
import { useMemo } from "react";
import MultiSelect from "@/componentsV2/core/MultiSelect";
import { useGroupsUser } from "@/pages/User/hooks/useGroupsUser";

const FilterGroupsMultiselect = ({ value = "", onChange }) => {
    const selectedIds = useMemo(() => (value ? value.split(",").filter(Boolean) : []), [value]);

    const { groupsOptions, isLoadingGroups, fetchNextGroups, isFetchingNextPageGroups, onSearchGroups } =
        useGroupsUser();

    const selectedData = groupsOptions.filter((o) => selectedIds.includes(o.id));

    const handleSelectOption = (itemId) => {
        const next = selectedIds.includes(itemId)
            ? selectedIds.filter((id) => id !== itemId)
            : [...selectedIds, itemId];
        const label = groupsOptions
            .filter((o) => next.includes(o.id))
            .map((o) => o.label)
            .join(", ");
        onChange(next.join(","), label);
    };

    const handleSelectAll = () => {
        const label = groupsOptions.map((o) => o.label).join(", ");
        onChange(groupsOptions.map((o) => o.id).join(","), label);
    };

    const handleDeselectAll = () => onChange("", "");

    return (
        <MultiSelect
            options={groupsOptions}
            selectedData={selectedData}
            isLoading={isLoadingGroups}
            isFetchingNextPage={isFetchingNextPageGroups}
            onSelectOption={handleSelectOption}
            onSelectedAll={handleSelectAll}
            showDeselectAll
            onDeselectAll={handleDeselectAll}
            fetchNextPage={fetchNextGroups}
            onInputChange={onSearchGroups}
        />
    );
};

FilterGroupsMultiselect.propTypes = {
    value: PropTypes.string,
    onChange: PropTypes.func.isRequired,
};

export default FilterGroupsMultiselect;
