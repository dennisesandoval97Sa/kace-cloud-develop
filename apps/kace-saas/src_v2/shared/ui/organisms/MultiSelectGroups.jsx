import React from "react";
import PropTypes from "prop-types";
import MultiSelectPicker from "@kace_v2/shared/ui/organisms/MultiSelectPicker";
import useGroupsOptions from "@kace_v2/shared/hooks/useGroupsOptions.hook";

const useGroupsPickerOptions = (initialValues, pageSize) => {
    const { groups, groupsOptions, setGroups, onSearch, fetchNextPage, hasNextPage, isFetchingNextPage } =
        useGroupsOptions(initialValues, pageSize);

    return {
        values: groups,
        options: groupsOptions,
        setValues: setGroups,
        onSearch,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
    };
};

const MultiSelectGroups = ({
    className,
    label = "Grupos",
    initialGroups,
    error,
    pageSize,
    loadingMessage,
    searchErrorMessage,
    handlerChange = () => {},
}) => (
    <MultiSelectPicker
        label={label}
        placeholder="Seleccionar grupos..."
        emptyMessage="No se encontraron grupos"
        loadingMessage={loadingMessage}
        searchErrorMessage={searchErrorMessage}
        optionsHook={useGroupsPickerOptions}
        initialValues={initialGroups}
        pageSize={pageSize}
        error={error}
        className={className}
        handlerChange={handlerChange}
    />
);

MultiSelectGroups.propTypes = {
    className: PropTypes.string,
    label: PropTypes.string,
    initialGroups: PropTypes.arrayOf(PropTypes.string),
    error: PropTypes.string,
    pageSize: PropTypes.number,
    loadingMessage: PropTypes.string,
    searchErrorMessage: PropTypes.string,
    handlerChange: PropTypes.func,
};

export default MultiSelectGroups;
