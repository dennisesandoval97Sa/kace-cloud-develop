import React from "react";
import PropTypes from "prop-types";
import { cn } from "@kace_v2/shared/utils/cn.util";
import FieldWrapper from "@kace_v2/shared/ui/molecules/FieldWrapper";
import Select from "@kace_v2/shared/ui/molecules/Select";

const SelectField = ({
    className,
    error,
    label,
    position = "popper",
    placeholder,
    options,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    loadingMessage,
    noResultsMessage,
    noSearchResultsMessage,
    onSearch,
    clearable,
    onClear,
    ...props
}) => {
    return (
        <FieldWrapper label={label} error={error}>
            <Select
                className={cn("col-span-3", className, {
                    "border-red-500": error,
                })}
                position={position}
                placeholder={placeholder}
                options={options}
                loadingMessage={loadingMessage}
                noResultsMessage={noResultsMessage}
                noSearchResultsMessage={noSearchResultsMessage}
                clearable={clearable}
                onClear={onClear}
                {...props}
                isLoading={isLoading}
                fetchNextPage={fetchNextPage}
                hasNextPage={hasNextPage}
                isFetchingNextPage={isFetchingNextPage}
                onSearch={onSearch}
                disabled={props.disabled || isLoading}
            />
        </FieldWrapper>
    );
};

SelectField.propTypes = {
    className: PropTypes.string,
    error: PropTypes.string,
    label: PropTypes.string,
    position: PropTypes.oneOf(["item-aligned", "popper"]),
    placeholder: PropTypes.string,
    options: PropTypes.arrayOf(
        PropTypes.shape({
            label: PropTypes.string,
            value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        }),
    ),
    isLoading: PropTypes.bool,
    fetchNextPage: PropTypes.func,
    hasNextPage: PropTypes.bool,
    isFetchingNextPage: PropTypes.bool,
    loadingMessage: PropTypes.string,
    onSearch: PropTypes.func,
    clearable: PropTypes.bool,
    onClear: PropTypes.func,
};

export default SelectField;
