import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useFormikContext } from "formik";
import PropTypes from "prop-types";
import MultiSelect from "@/componentsV2/core/MultiSelect";
import useGenericSearchQuery from "@/hooks/useGenericSearchQuery";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";

const AuxSelect = ({ field, fieldIndex, selectedAuxId: propSelectedAuxId, onSelectAux, variant = "default" }) => {
    const { t } = useTranslation();
    const { values } = useFormikContext();

    const { data: auxData, isFetching: isFetchingAux } = useGenericSearchQuery({
        url: `${URL_AND_KEYS.auxDefinitions.url}/search`,
        keyQuery: URL_AND_KEYS.auxDefinitions.key,
    });

    const [selectedAuxId, setSelectedAuxId] = useState(propSelectedAuxId ?? null);

    useEffect(() => {
        const sources = values.fields?.[fieldIndex]?.sources ?? {};
        const aux = sources.auxiliaries_source || sources.aux;
        if (aux) {
            const m = String(aux).match(/\/auxiliaries\/(.*?)\/list(?:\?field=(.*))?/);
            if (m) setSelectedAuxId(m[1]);
            else setSelectedAuxId(aux);
        }
    }, [values.fields, fieldIndex]);

    useEffect(() => {
        if (onSelectAux) {
            onSelectAux(selectedAuxId, auxData?.data?.find((item) => item.id === selectedAuxId)?.schema_id ?? null);
        }
    }, [selectedAuxId, auxData?.data, onSelectAux]);

    const selectedAux = useMemo(() => {
        return auxData?.data?.find((item) => item.id === selectedAuxId || item.url === selectedAuxId);
    }, [auxData?.data, selectedAuxId]);

    return (
        <div className="flex flex-col justify-stretch">
            <h1>{t("auxSchema.form.auxiliary", "Aux")}</h1>
            <MultiSelect
                type="button"
                single={true}
                placeholder={selectedAux?.name ?? t("auxSchema.form.auxiliary")}
                selectedData={selectedAux ? [{ ...selectedAux, label: selectedAux.name, value: selectedAux.id }] : []}
                options={auxData?.data?.map((item) => ({ ...item, label: item.name, value: item.id })) ?? []}
                isLoading={isFetchingAux}
                onSelectOption={(data) => {
                    const id = data?.id ?? data;
                    setSelectedAuxId(id);
                    const schemaId = data?.schema_id ?? data?.schemaId ?? null;
                    if (onSelectAux) onSelectAux(id, schemaId);
                }}
                variant={variant}
            />
        </div>
    );
};

AuxSelect.propTypes = {
    field: PropTypes.string.isRequired,
    fieldIndex: PropTypes.number.isRequired,
    selectedAuxId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    onSelectAux: PropTypes.func,
    variant: PropTypes.string,
};

export default AuxSelect;
