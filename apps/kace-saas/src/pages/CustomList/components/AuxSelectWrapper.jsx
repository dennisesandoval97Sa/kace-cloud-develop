import MultiSelect from "@/componentsV2/core/MultiSelect";
import useGenericSearchQuery from "@/hooks/useGenericSearchQuery";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";
import { PropTypes } from "prop-types";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

/**
 * Wrapper para AuxSelect que permite usarlo fuera del contexto Formik original
 * Reimplementa la lógica del AuxSelect pero con control local
 */
export const AuxSelectWrapper = ({ value, onChange, showLabel = true, error, touched, variant = "outline" }) => {
    const { t } = useTranslation();

    const { data: auxData, isFetching: isFetchingAux } = useGenericSearchQuery({
        url: `${URL_AND_KEYS.auxDefinitions.url}/search`,
        keyQuery: URL_AND_KEYS.auxDefinitions.key,
    });

    const [selectedAuxId, setSelectedAuxId] = useState(value ?? null);

    // Sincronizar con prop value
    useEffect(() => {
        if (value !== undefined) {
            setSelectedAuxId(value);
        }
    }, [value]);

    const selectedAux = useMemo(() => {
        return auxData?.data?.find((item) => item.id === selectedAuxId || item.url === selectedAuxId);
    }, [auxData?.data, selectedAuxId]);

    const handleSelectOption = (data) => {
        const id = data?.id ?? data;
        setSelectedAuxId(id);

        // Encontrar el schema_id del aux-definition seleccionado
        const auxItem = auxData?.data?.find((item) => item.id === id);
        const schemaData = {
            schema_id: auxItem?.schema_id ?? null,
            name: auxItem?.name ?? null,
        };

        // Llamar al onChange con (auxDefinitionId, schemaData)
        if (onChange) {
            onChange(id, schemaData);
        }
    };

    return (
        <div className="flex flex-col w-full">
            {showLabel && <label className="text-sm font-medium mb-2">{t("schemas.form.title.aux", "Aux")}</label>}
            <MultiSelect
                type="button"
                single={true}
                placeholder={selectedAux?.name ?? t("auxSchema.form.auxiliary")}
                selectedData={selectedAux ? [{ ...selectedAux, label: selectedAux.name, value: selectedAux.id }] : []}
                options={auxData?.data?.map((item) => ({ ...item, label: item.name, value: item.id })) ?? []}
                isLoading={isFetchingAux}
                onSelectOption={handleSelectOption}
                variant={variant}
            />
            {error && touched && <span className="text-sm text-red-500 mt-1">{error}</span>}
        </div>
    );
};

AuxSelectWrapper.propTypes = {
    value: PropTypes.string,
    onChange: PropTypes.func.isRequired,
    showLabel: PropTypes.bool,
    error: PropTypes.string,
    touched: PropTypes.bool,
    variant: PropTypes.string,
};
