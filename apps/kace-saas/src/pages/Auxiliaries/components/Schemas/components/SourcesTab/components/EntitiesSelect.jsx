import { useEffect, useMemo, useState } from "react";
import { useFormikContext } from "formik";
import PropTypes from "prop-types";
import MultiSelect from "@/componentsV2/core/MultiSelect";
import { useTranslation } from "react-i18next";

const ENTITY_IDS = ["classifications", "states"];

const EntitiesSelect = ({ field, fieldIndex }) => {
    const { t } = useTranslation();
    const { values, setFieldValue } = useFormikContext();
    const BASE_URL = import.meta.env.VITE_DEV_BASE_API_URL || "";

    const [selectedEntityId, setSelectedEntityId] = useState(null);

    useEffect(() => {
        const sources = values.fields?.[fieldIndex]?.sources ?? {};
        const ent = sources.entities_source || sources.entityId;
        if (!ent) return;

        const m = String(ent).match(/([^/]+)\/list(?:$|\?)/);
        const candidate = m ? m[1] : String(ent);
        setSelectedEntityId(ENTITY_IDS.find((id) => candidate === id || candidate.endsWith(id)) ?? null);
    }, [values.fields, fieldIndex]);

    useEffect(() => {
        if (selectedEntityId) {
            const sep = BASE_URL.endsWith("/") ? "" : "/";
            setFieldValue(`${field}.sources.entities_source`, `${BASE_URL}${sep}${selectedEntityId}/list`);
        } else {
            setFieldValue(`${field}.sources.entities_source`, "");
        }
    }, [selectedEntityId, BASE_URL, field, setFieldValue]);

    const options = useMemo(
        () =>
            ENTITY_IDS.map((id) => ({
                id,
                value: id,
                label: t(`auxSchema.form.entities.${id}`),
            })),
        [t],
    );

    const selectedEntity = useMemo(() => {
        const option = options.find((item) => item.id === selectedEntityId);
        return option ? [option] : [];
    }, [options, selectedEntityId]);

    return (
        <div className="flex flex-col justify-stretch">
            <h1>{t("auxSchema.form.entity", "Entities")}</h1>
            <MultiSelect
                type="button"
                single={true}
                hiddenSelectedAll={true}
                placeholder={selectedEntity?.[0]?.label ?? t("auxSchema.form.entity")}
                selectedData={selectedEntity}
                options={options}
                onSelectOption={(data) => {
                    const id = data?.id ?? data;
                    setSelectedEntityId(ENTITY_IDS.includes(id) ? id : null);
                }}
            />
        </div>
    );
};

EntitiesSelect.propTypes = {
    field: PropTypes.string.isRequired,
    fieldIndex: PropTypes.number.isRequired,
};

export default EntitiesSelect;
