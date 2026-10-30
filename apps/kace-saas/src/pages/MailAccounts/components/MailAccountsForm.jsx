import { PropTypes } from "prop-types";
import { Formik, Form } from "formik";
import { useEffect, useState } from "react";
import { MAIL_ACCOUNT_TYPE_SERVICE } from "@kace/utils";
import FormCard from "../../../components/core/Cards/FormCard";
import InputCard from "../../../components/core/Cards/InputCard";
import SectionForm from "../../../components/core/Cards/section-form";
import { InputForm as Input, KField, SelectForm as Select } from "@kace/ui-shared";
import { useTranslation } from "react-i18next";
import { SelectorAdmin } from "../../../components/core/selector-admin";
import { SwitchStateAdmin } from "../../../components/core/switchState/SwitchStateAdmin";
import { MailAccountsForms } from "../../../schemas/MailAccountSchema";
import { joiFormikAdapter } from "../../../utils/main";
import { SelectByUrl } from "../../../components/core/SelectByUrl/SelectByUrl";

const MailAccountsForm = ({ dataHandler, data = {}, isSending = false }) => {
    const { t } = useTranslation();
    const [mailAccountsData, setMailAccountsData] = useState(data);
    const [folders, setFolders] = useState([]);
    const [vaultData, setVaultData] = useState({});
    const handlerOptionsTypes = (data) => {
        if (Array.isArray(data)) {
            const items = data.map((item) => {
                if (item instanceof Object) {
                    const label = `${item.key}`;
                    return {
                        value: item.value,
                        label: t(label),
                    };
                }
                if (typeof item === "string") {
                    return { label: item, value: item };
                }
            });
            return items;
        }
    };
    useEffect(() => {
        if (Object.entries(data).length !== 0) {
            if (data?.start_syncing_from) {
                const date = new Date(data?.start_syncing_from);
                data.start_syncing_from = date.toISOString().split("T")[0];
            }
            if (data?.last_synchronization) {
                const date = new Date(data?.last_synchronization);
                data.last_synchronization = date.toISOString().split("T")[0];
            }
            Object.entries(data).forEach(([key, value]) => {
                setMailAccountsData((state) => ({
                    ...state,
                    [key]: key === "is_active" && value === "" ? "false" : (value ?? ""),
                }));
            });
            setFolders(data?.folders || []);
            setVaultData(data?.vault_data || {});
        }
    }, [data]);

    return (
        <Formik
            enableReinitialize={true}
            initialValues={mailAccountsData}
            validationSchema={joiFormikAdapter(MailAccountsForms)}
            onSubmit={(values) => {
                values.folders = folders;
                values.vault_data = vaultData;
                if (values.type === "smtp") {
                    delete values.client_id;
                    delete values.client_secret;
                    delete values.tenant_id;
                    delete values.code;
                    delete values.refresh_token;
                    delete values.mails_download_limit;
                    delete values.login_endpoint;
                    delete values.graph_scope;
                    delete values.access_token;
                    delete values.email_account;
                } else {
                    delete values.host;
                    delete values.port;
                    delete values.protocol;
                    delete values.username;
                    delete values.password;
                }
                dataHandler(values);
            }}
        >
            {({ setFieldValue, values, errors, touched }) => {
                return (
                    <Form className="flex w-full justify-center" autoComplete="off">
                        <FormCard isId={data?.id} isSending={isSending} title={t("app.title.mailAccounts")}>
                            <div className="flex flex-col col-span-3 gap-8">
                                <SectionForm
                                    title={t("mailAccounts.title.informacion_principal")}
                                    id="mail_accounts_form_main_information"
                                    dataTestId="mail_accounts_form_main_information"
                                >
                                    <InputCard>
                                        <KField>
                                            <Input
                                                type="text"
                                                name="description"
                                                label={t("mailAccounts.form.description")}
                                                placeholder={t("mailAccounts.form.description")}
                                                className="flex flex-col items-start justify-start text-start"
                                            />
                                        </KField>
                                    </InputCard>
                                    <InputCard>
                                        <SelectByUrl
                                            name="type"
                                            url={MAIL_ACCOUNT_TYPE_SERVICE}
                                            value={values.type}
                                            keyQuery="typesMailAccountsRequest"
                                            setFieldValue={setFieldValue}
                                            itemLabel="name"
                                            label={t("mailAccounts.form.type")}
                                            error={errors.type}
                                            touched={touched.type}
                                            method="get"
                                            typeForm={handlerOptionsTypes}
                                        />
                                    </InputCard>
                                </SectionForm>
                                <SectionForm
                                    title={t("mailAccounts.title.informacion_cuenta")}
                                    id="mail_accounts_form_account_info"
                                    dataTestId="mail_accounts_form_account_info"
                                >
                                    {values.type === "smtp" ? (
                                        <>
                                            <InputCard>
                                                <KField>
                                                    <Input
                                                        type="text"
                                                        name="host"
                                                        label={t("mailAccounts.form.host")}
                                                        placeholder={t("mailAccounts.form.host")}
                                                        className="flex flex-col items-start justify-start text-start"
                                                    />
                                                </KField>
                                            </InputCard>
                                            <InputCard>
                                                <KField>
                                                    <Input
                                                        type="number"
                                                        name="port"
                                                        label={t("mailAccounts.form.port")}
                                                        placeholder={t("mailAccounts.form.port")}
                                                        className="flex flex-col items-start justify-start text-start"
                                                    />
                                                </KField>
                                            </InputCard>
                                            <InputCard>
                                                <KField>
                                                    <Select
                                                        name="protocol"
                                                        label={t("mailAccounts.form.protocol")}
                                                        className="flex flex-col items-start justify-start text-start"
                                                        options={[
                                                            {
                                                                value: "smtp",
                                                                label: "Smtp",
                                                            },
                                                        ]}
                                                    />
                                                </KField>
                                            </InputCard>
                                            <InputCard>
                                                <KField>
                                                    <Select
                                                        name="encryption"
                                                        label={t("mailAccounts.form.encryption")}
                                                        className="flex flex-col items-start justify-start text-start"
                                                        options={[
                                                            {
                                                                value: "tls",
                                                                label: "TLS",
                                                            },
                                                        ]}
                                                        data-testid="mail_encryption_select"
                                                    />
                                                </KField>
                                            </InputCard>
                                        </>
                                    ) : (
                                        <>
                                            {(values.type === "ms_graph_application" ||
                                                values.type === "ms_graph_user") && (
                                                <InputCard>
                                                    <KField>
                                                        <Input
                                                            type="text"
                                                            name="tenant_id"
                                                            label={t("mailAccounts.form.tenant_id")}
                                                            placeholder={t("mailAccounts.form.tenant_id")}
                                                            className="flex flex-col items-start justify-start text-start"
                                                        />
                                                    </KField>
                                                </InputCard>
                                            )}
                                            <InputCard>
                                                <KField>
                                                    <Input
                                                        type="text"
                                                        name="client_id"
                                                        label={t("mailAccounts.form.client_id")}
                                                        placeholder={t("mailAccounts.form.client_id")}
                                                        className="flex flex-col items-start justify-start text-start"
                                                    />
                                                </KField>
                                            </InputCard>
                                            <InputCard>
                                                <KField>
                                                    <Input
                                                        type="text"
                                                        name="client_secret"
                                                        label={t("mailAccounts.form.client_secret")}
                                                        placeholder={t("mailAccounts.form.client_secret")}
                                                        className="flex flex-col items-start justify-start text-start"
                                                    />
                                                </KField>
                                            </InputCard>
                                            <InputCard>
                                                <KField>
                                                    <Input
                                                        type="text"
                                                        name="code"
                                                        label={t("mailAccounts.form.code")}
                                                        placeholder={t("mailAccounts.form.code")}
                                                        className="flex flex-col items-start justify-start text-start"
                                                    />
                                                </KField>
                                            </InputCard>
                                            <InputCard>
                                                <KField>
                                                    <Input
                                                        type="text"
                                                        name="refresh_token"
                                                        label={t("mailAccounts.form.refresh_token")}
                                                        placeholder={t("mailAccounts.form.refresh_token")}
                                                        className="flex flex-col items-start justify-start text-start"
                                                    />
                                                </KField>
                                            </InputCard>
                                            <InputCard>
                                                <KField>
                                                    <Input
                                                        type="number"
                                                        name="mails_download_limit"
                                                        label={t("mailAccounts.form.mails_download_limit")}
                                                        placeholder={t("mailAccounts.form.mails_download_limit")}
                                                        className="flex flex-col items-start justify-start text-start"
                                                    />
                                                </KField>
                                            </InputCard>
                                            <InputCard>
                                                <KField>
                                                    <Input
                                                        type="text"
                                                        name="login_endpoint"
                                                        label={t("mailAccounts.form.login_endpoint")}
                                                        placeholder={t("mailAccounts.form.login_endpoint")}
                                                        className="flex flex-col items-start justify-start text-start"
                                                    />
                                                </KField>
                                            </InputCard>
                                            <InputCard>
                                                <KField>
                                                    <Input
                                                        type="text"
                                                        name="graph_scope"
                                                        label={t("mailAccounts.form.scope")}
                                                        placeholder={t("mailAccounts.form.scope")}
                                                        className="flex flex-col items-start justify-start text-start"
                                                    />
                                                </KField>
                                            </InputCard>
                                            <InputCard>
                                                <KField>
                                                    <Input
                                                        type="text"
                                                        name="access_token"
                                                        label={t("mailAccounts.form.access_token")}
                                                        placeholder={t("mailAccounts.form.access_token")}
                                                        className="flex flex-col items-start justify-start text-start"
                                                    />
                                                </KField>
                                            </InputCard>
                                            <InputCard>
                                                <KField>
                                                    <Input
                                                        type="text"
                                                        name="email_account"
                                                        label={t("mailAccounts.form.email_account")}
                                                        placeholder={t("mailAccounts.form.email_account")}
                                                        className="flex flex-col items-start justify-start text-start"
                                                    />
                                                </KField>
                                            </InputCard>
                                        </>
                                    )}
                                </SectionForm>
                                {values.type === "smtp" && (
                                    <SectionForm
                                        title={t("mailAccounts.title.credenciales")}
                                        id="mail_account_credentials"
                                        dataTestId="mail_account_credentials"
                                    >
                                        <InputCard>
                                            <KField>
                                                <Input
                                                    type="text"
                                                    name="username"
                                                    label={t("mailAccounts.form.username")}
                                                    placeholder={t("mailAccounts.form.username")}
                                                    className="flex flex-col items-start justify-start text-start"
                                                />
                                            </KField>
                                        </InputCard>
                                        <InputCard>
                                            <KField>
                                                <Input
                                                    type="text"
                                                    name="password"
                                                    label={t("mailAccounts.form.password")}
                                                    placeholder={t("mailAccounts.form.passwordPlaceholder")}
                                                    className="flex flex-col items-start justify-start text-start"
                                                />
                                            </KField>
                                        </InputCard>
                                    </SectionForm>
                                )}
                            </div>
                            <div className="flex flex-col gap-8 col-start-4 col-span-3">
                                <SectionForm
                                    title={t("mailAccounts.title.remitente")}
                                    id="mail_account_sender"
                                    dataTestId="mail_account_sender"
                                >
                                    <InputCard>
                                        <KField>
                                            <Input
                                                type="email"
                                                name="from_address"
                                                label={t("mailAccounts.form.from_address")}
                                                placeholder={t("mailAccounts.form.from_address")}
                                                className="flex flex-col items-start justify-start text-start"
                                            />
                                        </KField>
                                    </InputCard>
                                    <InputCard>
                                        <KField>
                                            <Input
                                                type="text"
                                                name="from_name"
                                                label={t("mailAccounts.form.from_name")}
                                                placeholder={t("mailAccounts.form.from_name")}
                                                className="flex flex-col items-start justify-start text-start"
                                            />
                                        </KField>
                                    </InputCard>
                                </SectionForm>
                                <SectionForm
                                    title={t("mailAccounts.title.sincronizacion")}
                                    id="mail_account_synchronization"
                                    dataTestId="mail_account_synchronization"
                                >
                                    <InputCard>
                                        <KField>
                                            <Input
                                                type="date"
                                                name="start_syncing_from"
                                                label={t("mailAccounts.form.start_syncing_from")}
                                                placeholder={t("mailAccounts.form.start_syncing_from")}
                                                className="flex flex-col items-start justify-start text-start"
                                            />
                                        </KField>
                                    </InputCard>
                                    <InputCard>
                                        <KField>
                                            <Input
                                                type="date"
                                                name="last_synchronization"
                                                label={t("mailAccounts.form.last_synchronization")}
                                                placeholder={t("mailAccounts.form.last_synchronization")}
                                                className="flex flex-col items-start justify-start text-start"
                                            />
                                        </KField>
                                    </InputCard>
                                </SectionForm>
                                <SectionForm
                                    title={t("mailAccounts.title.carpetas")}
                                    id="mail_account_field"
                                    dataTestId="mail_account_field"
                                >
                                    <SelectorAdmin values={folders} setValues={setFolders} />
                                </SectionForm>
                                {data.id && (
                                    <SectionForm title="" id="mail_account_switch" dataTestId="mail_account_switch">
                                        <InputCard>
                                            <KField>
                                                <SwitchStateAdmin name="is_active" tipo="boolean" />
                                            </KField>
                                        </InputCard>
                                    </SectionForm>
                                )}
                            </div>
                        </FormCard>
                    </Form>
                );
            }}
        </Formik>
    );
};

MailAccountsForm.propTypes = {
    dataHandler: PropTypes.func.isRequired,
    data: PropTypes.object,
    isSending: PropTypes.bool,
};
export default MailAccountsForm;
