import React from "react";
import PropTypes from "prop-types";
import MultiSelectField from "@kace_v2/shared/ui/molecules/MultiSelectField";

/**
 * Composicion generica sobre MultiSelectField para selectores que se apoyan en un
 * hook de opciones con paginacion (useUsersOptions, useGroupsOptions, ...).
 * `optionsHook` debe devolver { values, options, setValues, onSearch, fetchNextPage,
 * hasNextPage, isFetchingNextPage } dado (initialValues, pageSize).
 */
const MultiSelectPicker = ({
    label,
    placeholder,
    emptyMessage,
    loadingMessage,
    searchErrorMessage,
    optionsHook,
    initialValues,
    className,
    error,
    pageSize,
    handlerChange = () => {},
}) => {
    const { values, options, setValues, onSearch, fetchNextPage, hasNextPage, isFetchingNextPage } = optionsHook(
        initialValues,
        pageSize,
    );

    return (
        <MultiSelectField
            label={label}
            placeholder={placeholder}
            emptyMessage={emptyMessage}
            loadingMessage={loadingMessage}
            searchErrorMessage={searchErrorMessage}
            defaultOptions={options}
            selectedValues={values}
            onChange={(selected) => {
                setValues(selected);
                handlerChange(selected);
            }}
            onSearch={onSearch}
            fetchNextPage={fetchNextPage}
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            error={error}
            className={className}
        />
    );
};

MultiSelectPicker.propTypes = {
    label: PropTypes.string.isRequired,
    placeholder: PropTypes.string,
    emptyMessage: PropTypes.string,
    loadingMessage: PropTypes.string,
    searchErrorMessage: PropTypes.string,
    optionsHook: PropTypes.func.isRequired,
    initialValues: PropTypes.arrayOf(PropTypes.string),
    className: PropTypes.string,
    error: PropTypes.string,
    pageSize: PropTypes.number,
    handlerChange: PropTypes.func,
};

export default MultiSelectPicker;
