import { InputForm as Input, KField } from "@kace/ui-shared"
import { useTranslation } from "react-i18next"

export const InputsClientsContainer = () => {
    const { t } = useTranslation()

    return (
        <div className="px-2 grid md:grid-cols-2 grid-cols-1 gap-2">
            <div className="flex flex-col gap-2">
                <KField>
                    <Input
                        id="tipo_documento"
                        name="tipo_documento"
                        label={t("generalSetup.form.labels.tipo_documento")}
                        type="text"
                        placeholder="nombre"
                        className="flex flex-col items-start justify-start text-start"
                    />
                </KField>
                <KField>
                    <Input
                        id="documento"
                        name="documento"
                        label={t("generalSetup.form.labels.documento")}
                        type="text"
                        placeholder="nombre"
                        className="flex flex-col items-start justify-start text-start"
                    />
                </KField>
                <KField>
                    <Input
                        id="nombres"
                        name="nombres"
                        label={t("generalSetup.form.labels.nombres")}
                        type="text"
                        placeholder="nombre"
                        className="flex flex-col items-start justify-start text-start"
                    />
                </KField>
                <KField>
                    <Input
                        id="apellido1"
                        name="apellido1"
                        label={t("generalSetup.form.labels.apellido1")}
                        type="text"
                        placeholder="nombre"
                        className="flex flex-col items-start justify-start text-start"
                    />
                </KField>
                <KField>
                    <Input
                        id="apellido2"
                        name="apellido2"
                        label={t("generalSetup.form.labels.apellido2")}
                        type="text"
                        placeholder="nombre"
                        className="flex flex-col items-start justify-start text-start"
                    />
                </KField>
                <KField>
                    <Input
                        id="nombre_empresa"
                        name="nombre_empresa"
                        label={t("generalSetup.form.labels.nombre_empresa")}
                        type="text"
                        placeholder="nombre"
                        className="flex flex-col items-start justify-start text-start"
                    />
                </KField>
                <KField>
                    <Input
                        id="sexo"
                        name="sexo"
                        label={t("generalSetup.form.labels.sexo")}
                        type="text"
                        placeholder="nombre"
                        className="flex flex-col items-start justify-start text-start"
                    />
                </KField>
                <KField>
                    <Input
                        id="estado_civil"
                        name="estado_civil"
                        label={t("generalSetup.form.labels.estado_civil")}
                        type="text"
                        placeholder="nombre"
                        className="flex flex-col items-start justify-start text-start"
                    />
                </KField>
                <KField>
                    <Input
                        id="habeas_data"
                        name="habeas_data"
                        label={t("generalSetup.form.labels.habeas_data")}
                        type="text"
                        placeholder="nombre"
                        className="flex flex-col items-start justify-start text-start"
                    />
                </KField>
            </div>
            <div className="flex flex-col gap-2">
                <KField>
                    <Input
                        id="fecha_nacimiento"
                        name="fecha_nacimiento"
                        label={t("generalSetup.form.labels.fecha_nacimiento")}
                        type="text"
                        placeholder="nombre"
                        className="flex flex-col items-start justify-start text-start"
                    />
                </KField>
                <KField>
                    <Input
                        id="email"
                        name="email"
                        label={t("generalSetup.form.labels.email")}
                        type="text"
                        placeholder="nombre"
                        className="flex flex-col items-start justify-start text-start"
                    />
                </KField>
                <KField>
                    <Input
                        id="email_alterno"
                        name="email_alterno"
                        label={t("generalSetup.form.labels.email_alterno")}
                        type="text"
                        placeholder="nombre"
                        className="flex flex-col items-start justify-start text-start"
                    />
                </KField>
                <KField>
                    <Input
                        id="telefono"
                        name="telefono"
                        label={t("generalSetup.form.labels.telefono")}
                        type="text"
                        placeholder="nombre"
                        className="flex flex-col items-start justify-start text-start"
                    />
                </KField>
                <KField>
                    <Input
                        id="telefono_alterno"
                        name="telefono_alterno"
                        label={t("generalSetup.form.labels.telefono_alterno")}
                        type="text"
                        placeholder="nombre"
                        className="flex flex-col items-start justify-start text-start"
                    />
                </KField>
                <KField>
                    <Input
                        id="campos_extra1"
                        name="campos_extra1"
                        label={t("generalSetup.form.labels.campos_extra1")}
                        type="text"
                        placeholder="nombre"
                        className="flex flex-col items-start justify-start text-start"
                    />
                </KField>
                <KField>
                    <Input
                        id="campos_extra2"
                        name="campos_extra2"
                        label={t("generalSetup.form.labels.campos_extra2")}
                        type="text"
                        placeholder="nombre"
                        className="flex flex-col items-start justify-start text-start"
                    />
                </KField>
                <KField>
                    <Input
                        id="campos_extra3"
                        name="campos_extra3"
                        label={t("generalSetup.form.labels.campos_extra3")}
                        type="text"
                        placeholder="nombre"
                        className="flex flex-col items-start justify-start text-start"
                    />
                </KField>
                <KField>
                    <Input
                        id="reference"
                        name="reference"
                        label={t("generalSetup.form.labels.reference")}
                        type="text"
                        placeholder="Numero de caso"
                        className="flex flex-col items-start justify-start text-start"
                    />
                </KField>
            </div>
        </div>
    )
}
