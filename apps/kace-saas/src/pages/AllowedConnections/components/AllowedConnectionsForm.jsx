import { Formik } from "formik";
import { useEffect, useState } from "react";
import { InputFormModal as Input, KField } from "@kace/ui-shared";
import { joiFormikAdapter } from "@kace/utils";
import { AllowedConnectionForm } from "../../../schemas/AllowedConnectionsSchema";
import InputCard from "../../../components/core/Cards/InputCard";
import ModalForm from "../../../components/core/ModalForm/modal-form";
import { buildAllowedConnectionMutation, initialValues, isHttpsEnabled } from "../helpers";
import { useTranslation } from "react-i18next";
import { SwitchStateAdmin } from "../../../components/core/switchState/SwitchStateAdmin";
import useGeneralMutation from "../../../hooks/useGeneralMutation";
import { useSelector } from "react-redux";
import { URL_AND_KEYS } from "../../../utils/urlAndKeys";
import useGenericViewQuery from "../../../hooks/useGenericViewQuery";

const AllowedConnectionsForm = () => {
    const { t } = useTranslation();
    const openModal = useSelector((state) => state.modalBehavior.open);
    const idSelected = useSelector((state) => state.modalBehavior.idSelected);
    const [formData, setFormData] = useState(initialValues);

    const { data, isLoading } = useGenericViewQuery({
        url: `${URL_AND_KEYS.allowedConnections.url}/${idSelected}`,
        keyQuery: URL_AND_KEYS.allowedConnections.key,
        searchById: [idSelected],
        staleTime: 0,
        gcTime: 0,
        enabled: !!idSelected,
    });

    const { mutate, isPending } = useGeneralMutation({
        keyQuery: URL_AND_KEYS.allowedConnections.key,
        openModal: true,
    });

    const handleConnections = async (values, setFormikErrors, setFormikStatus) => {
        if (!values.has_ssl || values.has_ssl === "") {
            values.has_ssl = false;
        }

        const data = buildAllowedConnectionMutation({
            values,
            urlService: URL_AND_KEYS.allowedConnections.url,
            setFormikErrors,
            setFormikStatus,
            pending: isPending,
        });
        mutate(data);
    };

    useEffect(() => {
        if (data && openModal) {
            if (Object.entries(data).length !== 0) {
                const nextFormData = Object.fromEntries(
                    Object.entries(data).map(([key, value]) => [
                        key,
                        key === "is_active" && value === "" ? "false" : value || "",
                    ]),
                );

                if (!isHttpsEnabled(data.has_ssl)) {
                    nextFormData.certificate = "";
                }

                setFormData((state) => ({ ...state, ...nextFormData }));
            }
        }
    }, [data, openModal]);
    useEffect(() => {
        !openModal && setFormData(initialValues);
    }, [openModal]);

    return (
        <Formik
            enableReinitialize={true}
            initialValues={formData}
            validationSchema={joiFormikAdapter(AllowedConnectionForm)}
            onSubmit={async (values, { setErrors, setStatus }) => {
                handleConnections(values, setErrors, setStatus);
            }}
        >
            {({ resetForm, setFieldTouched, setValues, values }) => {
                const httpsEnabled = isHttpsEnabled(values.has_ssl);

                return (
                    <ModalForm
                        open={openModal}
                        loading={isLoading}
                        title={t("app.title.allowedConnections")}
                        subtitle={t("app.forms.subtitle")}
                        resetForm={resetForm}
                        pending={isPending}
                        isLoading={isLoading}
                        hasEntity={idSelected}
                    >
                        <InputCard>
                            <KField>
                                <Input
                                    type="text"
                                    name="connection"
                                    label={t("allowedConnections.form.conexion")}
                                    placeholder={t("allowedConnections.placeholder.conexion")}
                                />
                            </KField>
                        </InputCard>
                        <InputCard>
                            <KField>
                                <Input
                                    type="text"
                                    name="description"
                                    label={t("allowedConnections.form.description")}
                                    placeholder={t("allowedConnections.placeholder.description")}
                                />
                            </KField>
                        </InputCard>
                        <InputCard>
                            <KField>
                                <Input
                                    type="text"
                                    name="certificate"
                                    label={t("allowedConnections.form.fingerprint")}
                                    placeholder={t("allowedConnections.placeholder.fingerprint")}
                                    disabled={!httpsEnabled}
                                />
                            </KField>
                        </InputCard>
                        <InputCard>
                            <KField>
                                <SwitchStateAdmin
                                    name="has_ssl"
                                    title={t("allowedConnections.form.ssl")}
                                    tipo="boolean"
                                    onAfterChange={() => {
                                        if (httpsEnabled) {
                                            setValues((currentValues) => ({
                                                ...currentValues,
                                                has_ssl: false,
                                                certificate: "",
                                            }));
                                            setFieldTouched("certificate", false, false);
                                        }
                                    }}
                                />
                            </KField>
                        </InputCard>
                        {idSelected && (
                            <InputCard>
                                <KField>
                                    <SwitchStateAdmin name="is_active" tipo="boolean" />
                                </KField>
                            </InputCard>
                        )}
                    </ModalForm>
                );
            }}
        </Formik>
    );
};

export default AllowedConnectionsForm;
