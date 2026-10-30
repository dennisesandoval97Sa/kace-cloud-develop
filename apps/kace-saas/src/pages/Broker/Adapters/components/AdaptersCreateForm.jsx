import { Formik, Form } from "formik";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { joiFormikAdapter } from "@kace/utils";
import { formatTestId } from "@/utils/src/helpers";
import {
    KField,
    InputFormModal as Input,
    FormikStatusMessages,
} from "@kace/ui-shared";
import { BrokerAdapterCreateSchema } from "@/schemas/BrokerAdapterSchema";
import FormCard from "@/components/core/Cards/FormCard";
import InputCard from "@/components/core/Cards/InputCard";
import SectionForm from "@/components/core/Cards/section-form";
import { INITIAL_FORM } from "../data/constants";

const PASSWORD_PLACEHOLDER = "placeholderpassword";

const AdaptersCreateForm = ({ dataHandler, data = {}, isSending = false }) => {
    const { t } = useTranslation();

    const normalizeAdapter = (a) => {
        if (!a) return {};
        const keys = ["id", "name", "host", "port", "queue", "exchange", "vhost", "username"];
        const normalized = keys.reduce((acc, key) => {
            const raw = a[key];
            const value = raw && typeof raw === "object" && "value" in raw ? raw.value : raw;
            acc[key] = value ?? "";
            return acc;
        }, {});
        if (a.password) {
            normalized.password = PASSWORD_PLACEHOLDER;
        }
        return normalized;
    };

    const getInitial = () => {
        if (data && Object.keys(data).length !== 0) return { ...INITIAL_FORM, ...normalizeAdapter(data) };
        return { ...INITIAL_FORM };
    };

    const [formData, setFormData] = useState(getInitial);

    useEffect(() => {
        if (data && Object.entries(data).length !== 0) {
            setFormData((state) => ({ ...state, ...normalizeAdapter(data) }));
        }
    }, [data]);

    return (
        <Formik
            enableReinitialize={true}
            initialValues={formData}
            validationSchema={joiFormikAdapter(BrokerAdapterCreateSchema)}
            onSubmit={async (values, { setErrors, setStatus }) => {
                const submitValues = { ...values };
                if (!submitValues.password || submitValues.password.trim() === "" || submitValues.password === PASSWORD_PLACEHOLDER) {
                    delete submitValues.password;
                }
                await dataHandler(submitValues, setErrors, setStatus);
            }}
        >
            {({ status }) => {
                return (
                <Form className="flex w-full justify-center" autoComplete="off">
                    <FormCard isId={!!data?.id} title={t("broker.adapters.title")} isSending={isSending}>
                        <div className="flex flex-col col-span-3 gap-8">
                            <FormikStatusMessages formikStatus={status} />
                            <SectionForm title={t("broker.adapters.basicInformation")} id="adapter_basic_info" dataTestId="adapter_basic_info">
                                <InputCard>
                                    <KField>
                                        <Input
                                            name="name"
                                            label={t("broker.adapters.placeholder.name")}
                                            placeholder={t("broker.adapters.placeholder.name")}
                                            id="name"
                                            data-testid={formatTestId("adapter_form", "name")}
                                        />
                                    </KField>
                                </InputCard>
                            </SectionForm>

                            <SectionForm title={t("broker.adapters.connectionDetails")} id="adapter_connection" dataTestId="adapter_connection">
                                <InputCard>
                                    <KField>
                                        <Input
                                            name="host"
                                            label={t("broker.adapters.placeholder.host")}
                                            placeholder={t("broker.adapters.placeholder.host")}
                                            id="host"
                                            data-testid={formatTestId("adapter_form", "host")}
                                        />
                                    </KField>
                                </InputCard>

                                <InputCard>
                                    <KField>
                                        <Input
                                            name="port"
                                            type="number"
                                            label={t("broker.adapters.placeholder.port")}
                                            placeholder={t("broker.adapters.placeholder.port")}
                                            id="port"
                                            data-testid={formatTestId("adapter_form", "port")}
                                        />
                                    </KField>
                                </InputCard>

                                <InputCard>
                                    <KField>
                                        <Input
                                            name="queue"
                                            label={t("broker.adapters.placeholder.queue")}
                                            placeholder={t("broker.adapters.placeholder.queue")}
                                            id="queue"
                                            data-testid={formatTestId("adapter_form", "queue")}
                                        />
                                    </KField>
                                </InputCard>

                                <InputCard>
                                    <KField>
                                        <Input
                                            name="exchange"
                                            label={t("broker.adapters.placeholder.exchange")}
                                            placeholder={t("broker.adapters.placeholder.exchange")}
                                            id="exchange"
                                            data-testid={formatTestId("adapter_form", "exchange")}
                                        />
                                    </KField>
                                </InputCard>

                                <InputCard>
                                    <KField>
                                        <Input
                                            name="vhost"
                                            label={t("broker.adapters.placeholder.vhost")}
                                            placeholder={t("broker.adapters.placeholder.vhost")}
                                            id="vhost"
                                            data-testid={formatTestId("adapter_form", "vhost")}
                                        />
                                    </KField>
                                </InputCard>
                            </SectionForm>
                        </div>

                        <div className="flex flex-col gap-8 col-start-4 col-span-2">
                            <SectionForm title={t("broker.adapters.credentials")} id="adapter_credentials" dataTestId="adapter_credentials">
                                <InputCard>
                                    <KField>
                                        <Input
                                            name="username"
                                            label={t("broker.adapters.placeholder.username")}
                                            placeholder={t("broker.adapters.placeholder.username")}
                                            id="username"
                                            data-testid={formatTestId("adapter_form", "username")}
                                        />
                                    </KField>
                                </InputCard>
                                <InputCard>
                                    <KField>
                                        <Input
                                            name="password"
                                            type="password"
                                            label={t("broker.adapters.placeholder.password")}
                                            placeholder={t("broker.adapters.placeholder.password")}
                                            id="password"
                                            data-testid={formatTestId("adapter_form", "password")}
                                        />
                                    </KField>
                                </InputCard>
                            </SectionForm>
                        </div>
                    </FormCard>
                </Form>
            );}}
        </Formik>
    );
};

export default AdaptersCreateForm;
