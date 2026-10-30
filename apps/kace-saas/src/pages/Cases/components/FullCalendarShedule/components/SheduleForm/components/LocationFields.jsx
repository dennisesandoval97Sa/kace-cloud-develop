import PropTypes from "prop-types"
import { useTranslation } from "react-i18next"
import {
    KField,
    InputForm as Input,
    SelectForm as Select
} from "@kace/ui-shared"
import InputCard from "../../../../../../../components/core/Cards/InputCard"

export const LocationFields = ({ values }) => {
    const { t } = useTranslation()

    const options = [
        {
            value: "Agenda documentos",
            label: "Agenda documentos"
        }
    ]

    return (
        <>
            <InputCard className="py-2 grid grid-cols-2 gap-2" aria-label="Date and agenda type section">
                <KField>
                    <Input
                        type="text"
                        disabled={true}
                        name="fecha_anterior"
                        label={t("diary.form.labels.fecha_anterior")}
                        placeholder={t("diary.form.labels.fecha_anterior")}
                        className="flex flex-col items-start justify-start text-start"
                        aria-label="Previous date"
                        value={values.fecha_anterior}
                        id={`loc_${values.fecha_anterior}_previousdate`}
                        data-testid={`loc_${values.fecha_anterior}_previousdate`}
                    />
                </KField>
                <KField>
                    <Select
                        options={options}
                        name="tipo_agenda"
                        label={t("diary.form.labels.tipo_agenda")}
                        className="flex flex-col items-start justify-start text-start"
                        aria-label="Select agenda type"
                        value={values.tipo_agenda}
                        id={`loc_${values.tipo_agenda}_agenda`}
                        data-testid={`loc_${values.tipo_agenda}_agenda`}
                    />
                </KField>
            </InputCard>
            <InputCard className="py-2 grid grid-cols-2 gap-2" aria-label="Address details section">
                <KField>
                    <Input
                        type="text"
                        name="departamento"
                        readOnly
                        label={t("diary.form.labels.departamento")}
                        placeholder={t("diary.form.labels.departamento")}
                        className="flex flex-col items-start justify-start text-start"
                        aria-label="Department"
                        value={values.departamento}
                        id={`loc_${values.departamento}_department`}
                        data-testid={`loc_${values.departamento}_department`}
                    />
                </KField>
                <KField>
                    <Input
                        type="text"
                        name="ciudad"
                        readOnly
                        label={t("diary.form.labels.ciudad")}
                        placeholder={t("diary.form.labels.ciudad")}
                        className="flex flex-col items-start justify-start text-start"
                        aria-label="City"
                        value={values.ciudad}
                        id={`loc_${values.ciudad}_city`}
                        data-testid={`loc_${values.ciudad}_city`}
                    />
                </KField>
                <KField>
                    <Input
                        type="text"
                        name="barrio"
                        label={t("diary.form.labels.barrio")}
                        placeholder={t("diary.form.labels.barrio")}
                        className="flex flex-col items-start justify-start text-start"
                        value={values.barrio}
                        id={`loc_${values.barrio}_neighborhood`}
                        data-testid={`loc_${values.barrio}_neighborhood`}
                    />
                </KField>
                <KField>
                    <Input
                        type="text"
                        name="direccion"
                        label={t("diary.form.labels.direccion")}
                        placeholder={t("diary.form.labels.direccion")}
                        className="flex flex-col items-start justify-start text-start"
                        aria-label="Street address"
                        value={values.direccion}
                        id={`loc_${values.direccion}_street`}
                        data-testid={`loc_${values.direccion}_street`}
                    />
                </KField>
                <KField>
                    <Input
                        type="text"
                        name="punto_referencia"
                        label={t("diary.form.labels.punto_referencia")}
                        placeholder={t("diary.form.labels.punto_referencia")}
                        className="flex flex-col items-start justify-start text-start"
                        aria-label="Reference point"
                        value={values.punto_referencia}
                        id={`loc_${values.punto_referencia}_referencepoint`}
                        data-testid={`loc_${values.punto_referencia}_referencepoint`}
                    />
                </KField>
            </InputCard>
        </>
    )
}

LocationFields.propTypes = {
    values: PropTypes.object
}
