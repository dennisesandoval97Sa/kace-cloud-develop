import { PropTypes } from "prop-types";
import { Formik, Form } from "formik";
import { useEffect, useState } from "react";
import { joiFormikAdapter } from "@kace/utils";
import FormCard from "../../../components/core/Cards/FormCard";
import InputCard from "../../../components/core/Cards/InputCard";
import SectionForm from "../../../components/core/Cards/section-form";
import { CLIENT_SERVICE } from "../../../utils/URL";
import { KField, InputForm as Input, TextAreaForm } from "@kace/ui-shared";
import { ClientNotificationFormSchema } from "../../../schemas/NotificationSchema";
import { SwitchStateAdmin } from "../../../components/core/switchState/SwitchStateAdmin";

import { useTranslation } from "react-i18next";
import { SelectByUrl } from "../../../components/core/SelectByUrl/SelectByUrl";
import { DatePickerWithRangeNotifications } from "../../../components/core/DatePicker/DatePickerWithRangeNotifications";

const NotificationsClientForm = ({ dataHandler, data = {}, isSending = false }) => {
    const { t } = useTranslation();
    const [formData, setFormData] = useState(data);
    useEffect(() => {
        if (Object.entries(data).length !== 0) {
            Object.entries(data).forEach(([key, value]) => {
                setFormData((state) => ({
                    ...state,
                    [key]: value ?? "",
                }));
            });
        }
    }, [data]);
    return (
        <Formik
            enableReinitialize={true}
            initialValues={formData}
            validationSchema={joiFormikAdapter(ClientNotificationFormSchema)}
            onSubmit={async (values, { setErrors, setStatus }) => {
                dataHandler(values, setErrors, setStatus);
            }}
        >
            {({ values, setFieldValue, errors, touched, initialValues }) => {
                return (
                    <Form className="flex w-full justify-center" autoComplete="off">
                        <FormCard isId={data?.id} title={t("app.title.notificationsClient")} isSending={isSending}>
                            <div className="flex flex-col col-span-3 gap-8">
                                <SectionForm title="Información">
                                    <InputCard>
                                        <KField>
                                            <Input
                                                type="text"
                                                name="subject"
                                                label={t("notificationsClient.form.subject")}
                                                placeholder={t("notificationsClient.placeholder.subject")}
                                                className="flex flex-col items-start justify-start text-start"
                                                data-testid="notification_client_subject"
                                            />
                                        </KField>
                                    </InputCard>
                                    <InputCard>
                                        <KField>
                                            <TextAreaForm
                                                id="notification_client_message"
                                                name="message"
                                                label={t("notificationsClient.form.message")}
                                                type="text"
                                                placeholder={t("notificationsClient.placeholder.message")}
                                                textDescription={t("notificationsClient.text.message")}
                                                data-testid="notification_client_message"
                                            />
                                        </KField>
                                    </InputCard>
                                    <InputCard>
                                        <DatePickerWithRangeNotifications
                                            setValue={setFieldValue}
                                            nameFrom="start_date"
                                            nameTo="end_date"
                                            errorFrom={errors.start_date}
                                            errorTo={errors.end_date}
                                            touchedFrom={touched.start_date}
                                            touchedTo={touched.end_date}
                                            isTitle
                                            initialValues={[initialValues.start_date, initialValues.end_date]}
                                        />
                                    </InputCard>
                                </SectionForm>
                            </div>
                            <div className="flex flex-col gap-8 col-start-4 col-span-2">
                                <SectionForm title="Cliente">
                                    <SelectByUrl
                                        name="client_id"
                                        url={`${CLIENT_SERVICE}`}
                                        value={values.client_id}
                                        keyQuery="usersRequest"
                                        setFieldValue={setFieldValue}
                                        itemLabel="nombres"
                                        error={errors.client_id}
                                        touched={touched.client_id}
                                    />
                                </SectionForm>
                                {data.id && (
                                    <SectionForm title="Estado">
                                        <InputCard>
                                            <KField>
                                                <SwitchStateAdmin name="is_active" shouldBool />
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
NotificationsClientForm.propTypes = {
    dataHandler: PropTypes.func.isRequired,
    data: PropTypes.object,
    isSending: PropTypes.bool,
};

export default NotificationsClientForm;
