import PropTypes from "prop-types";
import { useCallback, useMemo, useRef } from "react";
import MultiSelect from "@/componentsV2/core/MultiSelect";
import { useUsersFilterOptions } from "./useUsersFilterOptions";

const FilterUsersMultiselect = ({ value = "", onChange }) => {
    const selectedIds = useMemo(() => (value ? value.split(",").filter(Boolean) : []), [value]);

    const { usersOptions, isLoadingUsers, fetchNextUsers, hasNextPageUsers, isFetchingNextPageUsers, onSearchUsers } =
        useUsersFilterOptions();

    const knownLabels = useRef(new Map());
    usersOptions.forEach((option) => knownLabels.current.set(option.id, option.label));

    const selectedData = useMemo(
        () =>
            selectedIds
                .map((id) => {
                    const live = usersOptions.find((option) => String(option.id) === String(id));
                    if (live) return live;
                    const label = knownLabels.current.get(id);
                    return label ? { id, label, value: id } : null;
                })
                .filter(Boolean),
        [selectedIds, usersOptions],
    );

    const labelFor = useCallback(
        (ids) =>
            ids
                .map((id) => knownLabels.current.get(id))
                .filter(Boolean)
                .join(", "),
        [],
    );

    const handleSelectOption = useCallback(
        (itemId) => {
            const next = selectedIds.includes(itemId)
                ? selectedIds.filter((id) => id !== itemId)
                : [...selectedIds, itemId];
            onChange(next.join(","), labelFor(next));
        },
        [labelFor, onChange, selectedIds],
    );

    const handleSelectAll = useCallback(() => {
        if (usersOptions.length === 0) return;

        const selectedSet = new Set(selectedIds.map(String));
        const visibleIds = usersOptions.map((option) => option.id);
        const allVisibleSelected = visibleIds.every((id) => selectedSet.has(String(id)));

        if (allVisibleSelected && !hasNextPageUsers) {
            const visibleSet = new Set(visibleIds.map(String));
            const remaining = selectedIds.filter((id) => !visibleSet.has(String(id)));
            onChange(remaining.join(","), labelFor(remaining));
            return;
        }

        const merged = [...selectedIds];
        visibleIds.forEach((id) => {
            if (!selectedSet.has(String(id))) merged.push(id);
        });
        onChange(merged.join(","), labelFor(merged));
    }, [hasNextPageUsers, labelFor, onChange, selectedIds, usersOptions]);

    const handleDeselectAll = useCallback(() => onChange("", ""), [onChange]);

    return (
        <MultiSelect
            options={usersOptions}
            selectedData={selectedData}
            isLoading={isLoadingUsers}
            isFetchingNextPage={isFetchingNextPageUsers}
            onSelectOption={handleSelectOption}
            onSelectedAll={handleSelectAll}
            showDeselectAll
            onDeselectAll={handleDeselectAll}
            fetchNextPage={fetchNextUsers}
            onInputChange={onSearchUsers}
        />
    );
};

FilterUsersMultiselect.propTypes = {
    value: PropTypes.string,
    onChange: PropTypes.func.isRequired,
};

export default FilterUsersMultiselect;
