import { PropTypes } from "prop-types";
import { Formik, Form } from "formik";
import { useEffect, useState } from "react";
import { joiFormikAdapter } from "@kace/utils";
import { UserNotificationCreateSchema } from "../../../schemas/UserNotificationsSchema";
import FormCard from "../../../components/core/Cards/FormCard";
import InputCard from "../../../components/core/Cards/InputCard";
import SectionForm from "../../../components/core/Cards/section-form";
import { KField, InputForm as Input } from "@kace/ui-shared";
import { SwitchStateAdmin } from "../../../components/core/switchState/SwitchStateAdmin";
import { useTranslation } from "react-i18next";
import { DatePickerWithRangeNotifications } from "../../../components/core/DatePicker/DatePickerWithRangeNotifications";
import { SelectSingleSearch } from "../../../components/core/SelectContainer/SelectSingleSearch";

const NotificationsAgentForm = ({ dataHandler, data = {}, isSending = false }) => {
    const [formData, setFormData] = useState(data);
    const { t } = useTranslation();

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
            validationSchema={joiFormikAdapter(UserNotificationCreateSchema)}
            onSubmit={async (values, { setErrors, setStatus }) => {
                dataHandler(values, setErrors, setStatus);
            }}
        >
            {({ errors, touched, values, setFieldValue, initialValues }) => {
                return (
                    <Form className="flex w-full justify-center" autoComplete="off">
                        <FormCard isId={data?.id} title={t("app.title.notificationsAgent")} isSending={isSending}>
                            <div className="flex flex-col col-span-3 gap-8">
                                <SectionForm title="Información">
                                    <InputCard>
                                        <KField>
                                            <Input
                                                type="text"
                                                name="asunto"
                                                label={t("notificationsAgent.form.subject")}
                                                placeholder={t("notificationsAgent.placeholder.subject")}
                                                className="flex flex-col items-start justify-start text-start"
                                            />
                                        </KField>
                                    </InputCard>
                                    <InputCard>
                                        <KField>
                                            <Input
                                                type="text"
                                                name="mensaje"
                                                label={t("notificationsAgent.form.message")}
                                                placeholder={t("notificationsAgent.placeholder.message")}
                                                className="flex flex-col items-start justify-start text-start"
                                            />
                                        </KField>
                                    </InputCard>
                                    <InputCard>
                                        <DatePickerWithRangeNotifications
                                            setValue={setFieldValue}
                                            nameFrom="fecha_inicio"
                                            nameTo="fecha_fin"
                                            errorFrom={errors.fecha_inicio}
                                            errorTo={errors.fecha_fin}
                                            touchedFrom={touched.fecha_inicio}
                                            touchedTo={touched.fecha_fin}
                                            isTitle
                                            initialValues={[initialValues.fecha_inicio, initialValues.fecha_fin]}
                                        />
                                    </InputCard>
                                </SectionForm>
                            </div>
                            <div className="flex flex-col gap-8 col-start-4 col-span-2">
                                <SectionForm title={t("notificationsAgent.form.user")}>
                                    <SelectSingleSearch
                                        name="user_id"
                                        value={values.user_id}
                                        setFieldValue={setFieldValue}
                                        error={errors.user_id}
                                        touched={touched.user_id}
                                    />
                                </SectionForm>
                                {data.id && (
                                    <SectionForm title={t("notificationsAgent.form.status")}>
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
NotificationsAgentForm.propTypes = {
    dataHandler: PropTypes.func.isRequired,
    data: PropTypes.object,
    isSending: PropTypes.bool,
};
export default NotificationsAgentForm;
