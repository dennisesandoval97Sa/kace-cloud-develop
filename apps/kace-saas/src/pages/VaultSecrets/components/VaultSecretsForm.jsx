import { PropTypes } from "prop-types";
import { Formik } from "formik";
import { useEffect, useState } from "react";
import { InputFormModal as Input, KField, FormikStatusMessages } from "@kace/ui-shared";
import { joiFormikAdapter } from "@kace/utils";
import { SecretsVaultCreateSchemaForm } from "../../../schemas/SecretsVaultSchema";
import InputCard from "../../../components/core/Cards/InputCard";
import ModalForm from "../../../components/core/ModalForm/modal-form";
import { initialValues } from "../helpers";
import { VAULT_SECRETS_SERVICE } from "../../../utils/URL";
import { useTranslation } from "react-i18next";
import { genericHandleSendInformation } from "../../../services/genericHandleSendInformation";
import useGeneralMutation from "../../../hooks/useGeneralMutation";
import { URL_AND_KEYS } from "../../../utils/urlAndKeys";
import { useSelector } from "react-redux";
import useGenericViewQuery from "../../../hooks/useGenericViewQuery";

const VaultSecretsForm = () => {
    const { t } = useTranslation();
    const [formData, setFormData] = useState(initialValues);
    const openModal = useSelector((state) => state.modalBehavior.open);
    const idSelected = useSelector((state) => state.modalBehavior.idSelected);

    const { data, isLoading } = useGenericViewQuery({
        url: `${URL_AND_KEYS.vaultSecret.url}/${idSelected}`,
        keyQuery: URL_AND_KEYS.vaultSecret.key,
        searchById: [idSelected],
        staleTime: 0,
        gcTime: 0,
        enabled: !!idSelected,
    });

    const { mutate, isPending } = useGeneralMutation({
        keyQuery: URL_AND_KEYS.vaultSecret.key,
        openModal: true,
        optimisticListUpdate: false,
    });

    const handleVaultSecrets = async (values, setFormikErrors, setFormikStatus) => {
        const fields = [];
        if (values.secreto === "***") {
            fields.push("secreto");
        }
        const data = genericHandleSendInformation({
            values,
            urlService: VAULT_SECRETS_SERVICE,
            setFormikErrors,
            setFormikStatus,
            pending: isPending,
            fields,
        });
        mutate(data);
    };

    useEffect(() => {
        if (data) {
            if (Object.entries(data).length !== 0) {
                Object.entries(data).forEach(([key, value]) => {
                    setFormData((state) => ({
                        ...state,
                        [key]: value || "",
                    }));
                });
            }
        }
    }, [data, openModal]);

    useEffect(() => {
        !openModal && setFormData(initialValues);
    }, [openModal]);

    return (
        <Formik
            enableReinitialize
            initialValues={formData}
            validationSchema={joiFormikAdapter(SecretsVaultCreateSchemaForm)}
            onSubmit={async (values, { setErrors, setStatus }) => {
                handleVaultSecrets(values, setErrors, setStatus);
            }}
        >
            {({ setFieldValue, errors, resetForm, setStatus, status }) => {
                if (Object.entries(errors).length === 0 && status !== undefined) {
                    setStatus(undefined);
                }
                return (
                    <ModalForm
                        open={openModal}
                        isLoading={isLoading}
                        title={t("app.title.vaultSecret")}
                        subtitle={t("app.forms.subtitle")}
                        resetForm={resetForm}
                        pending={isPending}
                        hasEntity={idSelected}
                    >
                        <div className="grid gap-4 py-4">
                            <InputCard>
                                <KField>
                                    <Input
                                        type="text"
                                        name="descripcion"
                                        label={t("secretsVaults.form.description")}
                                        placeholder={t("secretsVaults.placeholder.description")}
                                    />
                                </KField>
                            </InputCard>
                            <InputCard>
                                <KField>
                                    <Input
                                        type="text"
                                        name="referencia"
                                        label={t("secretsVaults.form.reference")}
                                        placeholder={t("secretsVaults.placeholder.reference")}
                                        onChange={(e) => setFieldValue("referencia", e.target.value.toUpperCase())}
                                    />
                                </KField>
                            </InputCard>
                            <InputCard>
                                <KField>
                                    <Input
                                        type="password"
                                        name="secreto"
                                        label={t("secretsVaults.form.secret")}
                                        placeholder={t("secretsVaults.placeholder.secret")}
                                    />
                                </KField>
                            </InputCard>
                            <FormikStatusMessages formikStatus={status} />
                        </div>
                    </ModalForm>
                );
            }}
        </Formik>
    );
};
VaultSecretsForm.propTypes = {
    idSelected: PropTypes.string,
    open: PropTypes.bool,
    setOpen: PropTypes.func,
    setIdSelected: PropTypes.func,
};
export default VaultSecretsForm;
