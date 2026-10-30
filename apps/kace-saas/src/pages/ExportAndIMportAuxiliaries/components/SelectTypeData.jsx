import PropTypes from "prop-types";
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import SelectField from "@kace_v2/shared/ui/molecules/SelectField";
import { useAuxDefinitions } from "../hooks/useAuxDefinitions";

export const SelectTypeData = ({ setModuleSelected, isImport = false }) => {
    const { t } = useTranslation();
    const [selectedDefinition, setSelectedDefinition] = useState("");
    const type = isImport ? "import" : "export";
    const schemaIdMap = useRef({});

    const { auxOptions, isLoadingAux, fetchNextAux, hasNextPageAux, isFetchingNextPageAux, onSearchAux } =
        useAuxDefinitions(type);

    auxOptions.forEach(({ value, schema_id }) => {
        if (value && schema_id) schemaIdMap.current[value] = schema_id;
    });

    const handleSearch = useCallback(
        async (query) => {
            const results = await onSearchAux(query);
            const safeResults = Array.isArray(results) ? results : [];
            safeResults.forEach(({ value, schema_id }) => {
                if (value && schema_id) schemaIdMap.current[value] = schema_id;
            });
            return safeResults;
        },
        [onSearchAux],
    );

    const handleChange = (value) => {
        setSelectedDefinition(value);
        const schemaId = schemaIdMap.current[value];
        setModuleSelected(schemaId ?? null);
    };

    return (
        <div className="flex flex-col gap-4 items-center w-full">
            <h2 className="text-lg font-semibold">
                {t(isImport ? "importExport.form.modulesToImport" : "importExport.form.modulesToExport")}
            </h2>

            <div className="w-full max-w-md">
                <SelectField
                    label={t("app.title.auxiliaries")}
                    options={auxOptions}
                    value={selectedDefinition || ""}
                    onValueChange={handleChange}
                    isLoading={isLoadingAux}
                    fetchNextPage={fetchNextAux}
                    hasNextPage={hasNextPageAux}
                    isFetchingNextPage={isFetchingNextPageAux}
                    onSearch={handleSearch}
                    placeholder={t("app.forms.options")}
                />
            </div>
        </div>
    );
};

SelectTypeData.propTypes = {
    setModuleSelected: PropTypes.func.isRequired,
    isImport: PropTypes.bool,
};
