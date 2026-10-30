import PropTypes from 'prop-types';
import { useEffect, useState } from 'react';
import { useFormikContext } from 'formik';
import LiteralsSelect from "./components/LiteralsSelect";
import LiteralsFieldSelect from "./components/LiteralsFieldSelect";
import AuxSelect from "./components/AuxSelect";
import AuxFieldSelect from "./components/AuxFieldSelect";
import EntitiesSelect from "./components/EntitiesSelect";
import RestFlowSelect from "./components/RestFlowSelect";

const SourcesTab = ({ field, fieldIndex }) => {
    const { values, setFieldValue } = useFormikContext();
    const BASE_URL = import.meta.env.VITE_DEV_BASE_API_URL || '';
    const [selectedAuxId, setSelectedAuxId] = useState(null);
    const [selectedAuxSchemaId, setSelectedAuxSchemaId] = useState(null);
    const [selectedAuxField, setSelectedAuxField] = useState(null);

    useEffect(() => {
        const sources = values.fields?.[fieldIndex]?.sources ?? {};
        const auxUrl = sources.auxiliaries_source || '';
        if (auxUrl) {
            const m = String(auxUrl).match(/\/auxiliaries\/(.*?)\/list(?:\?field=(.*))?/);
            if (m) {
                setSelectedAuxId(m[1]);
                if (m[2]) setSelectedAuxField(m[2]);
            }
        }
    }, [values.fields, fieldIndex]);

    useEffect(() => {
        if (selectedAuxId) {
            const sep = BASE_URL.endsWith('/') ? '' : '/';
            const qs = selectedAuxField ? `?field=${selectedAuxField}` : '';
            setFieldValue(`${field}.sources.auxiliaries_source`, `${BASE_URL}${sep}auxiliaries/${selectedAuxId}/list${qs}`);
        } else {
            setFieldValue(`${field}.sources.auxiliaries_source`, "");
        }
    }, [selectedAuxId, selectedAuxField, BASE_URL, field, setFieldValue]);

    return (
        <div className="flex flex-col w-full gap-2">
            <div className="grid grid-cols-2 gap-4">
                <LiteralsSelect field={field} fieldIndex={fieldIndex} />
                <LiteralsFieldSelect field={field} fieldIndex={fieldIndex} />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <AuxSelect
                    field={field}
                    fieldIndex={fieldIndex}
                    selectedAuxId={selectedAuxId}
                    onSelectAux={(id, schemaId) => {
                        setSelectedAuxId(id);
                        setSelectedAuxSchemaId(schemaId || null);
                    }}
                />
                <AuxFieldSelect
                    field={field}
                    fieldIndex={fieldIndex}
                    selectedAuxId={selectedAuxId}
                    selectedAuxSchemaId={selectedAuxSchemaId}
                    selectedAuxField={selectedAuxField}
                    onChangeAuxField={(fieldName) => setSelectedAuxField(fieldName)}
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <EntitiesSelect field={field} fieldIndex={fieldIndex} />
                <RestFlowSelect field={field} fieldIndex={fieldIndex} />
            </div>
        </div>
    );
};

SourcesTab.propTypes = {
    field: PropTypes.string.isRequired,
    fieldIndex: PropTypes.number.isRequired,
};

export default SourcesTab;
