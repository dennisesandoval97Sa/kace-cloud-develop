import React from "react";
import PropTypes from "prop-types";
import SelectField from "@kace_v2/shared/ui/molecules/SelectField";
import useSchemasOptions from "@kace_v2/shared/hooks/useSchemasOptions.hook";

const SchemaSelectField = ({ className, value, error, pageSize, onChange = () => {} }) => {
    const initialSchema = value ? [value] : [];
    const { schemas, schemasOptions, setSchemas, onSearch, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
        useSchemasOptions(initialSchema, pageSize);

    const selectedValue = schemas[0];

    return (
        <SelectField
            label="Esquema"
            placeholder="Seleccionar esquema..."
            options={schemasOptions}
            isLoading={isLoading}
            fetchNextPage={fetchNextPage}
            hasNextPage={hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            loadingMessage="Buscando..."
            onSearch={onSearch}
            value={selectedValue ?? undefined}
            onValueChange={(newValue) => {
                setSchemas(newValue ? [newValue] : []);
                onChange(newValue);
            }}
            error={error}
            className={className}
        />
    );
};

SchemaSelectField.propTypes = {
    className: PropTypes.string,
    value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    error: PropTypes.string,
    pageSize: PropTypes.number,
    onChange: PropTypes.func,
};

export default SchemaSelectField;
