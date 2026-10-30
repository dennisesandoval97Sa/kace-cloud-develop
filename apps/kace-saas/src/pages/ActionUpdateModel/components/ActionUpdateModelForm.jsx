import { Formik } from "formik";
import { useEffect, useState } from "react";
import { joiFormikAdapter } from "@kace/utils";
import InputCard from "../../../components/core/Cards/InputCard";
import { KField, InputFormModal as Input, Label } from "@kace/ui-shared";
import { SelectByUrl } from "../../../components/core/SelectByUrl/SelectByUrl";
import ModalForm from "../../../components/core/ModalForm/modal-form";
import { ACTION_UPDATE_MODEL } from "../../../utils/URL";
import { INITIAL_VALUES_UPDATE_MODE } from "../data/constants";
import { ActionUpdateModelSchemaForm } from "../../../schemas/ActionUpdateModelSchema";
import useGeneralMutation from "../../../hooks/useGeneralMutation";
import { genericHandleSendInformation } from "../../../services/genericHandleSendInformation";
import { useTranslation } from "react-i18next";
import useGenericViewQuery from "../../../hooks/useGenericViewQuery";
import { URL_AND_KEYS } from "../../../utils/urlAndKeys";
import { useSelector } from "react-redux";
import { ModelFieldSelector } from "./ModelFieldSelector";

export const ActionUpdateModelForm = () => {
    const { t } = useTranslation();
    const [formValues, setFormValues] = useState(INITIAL_VALUES_UPDATE_MODE);
    const openModal = useSelector((state) => state.modalBehavior.open);
    const idSelected = useSelector((state) => state.modalBehavior.idSelected);
    const { mutate, isPending } = useGeneralMutation({
        keyQuery: URL_AND_KEYS.actionModelUpdate.key,
        openModal: true,
    });

    const { data, isLoading } = useGenericViewQuery({
        url: `${URL_AND_KEYS.actionModelUpdate.url}/${idSelected}`,
        keyQuery: URL_AND_KEYS.actionModelUpdate.key,
        searchById: [idSelected],
        staleTime: 0,
        gcTime: 0,
        enabled: !!idSelected,
    });

    const handleSendInformation = async (values, setFormikErrors, setFormikStatus) => {
        delete values.aggregate_aux;
        delete values.field_aux;

        if (values.type === "formula" && values.formula !== "modelo_a_modelo") delete values.value;
        const data = genericHandleSendInformation({
            values,
            urlService: URL_AND_KEYS.actionModelUpdate.url,
            setFormikErrors,
            setFormikStatus,
            pending: isPending,
        });

        mutate(data);
    };

    const handlerOptionsTypesByUrl = (data) => {
        if (Array.isArray(data)) {
            const items = data.map((item) => {
                if (item instanceof Object) {
                    return {
                        value: item.value || item.column_name,
                        label: item.key || item.column_name,
                    };
                }
                if (typeof item === "string") {
                    return { label: item, value: item };
                }
                return null;
            });
            return items;
        }
    };

    useEffect(() => {
        if (data && openModal) {
            if (Object.entries(data).length !== 0) {
                Object.entries(data).forEach(([key, value]) => {
                    setFormValues((updateModel) => ({
                        ...updateModel,
                        [key]: value || "",
                    }));
                });
            }
        }
    }, [data, openModal]);

    useEffect(() => {
        !openModal && setFormValues(INITIAL_VALUES_UPDATE_MODE);
    }, [openModal]);

    return (
        <Formik
            enableReinitialize={true}
            initialValues={formValues}
            validationSchema={joiFormikAdapter(ActionUpdateModelSchemaForm)}
            onSubmit={(values, { setErrors, setStatus }) => {
                handleSendInformation(values, setErrors, setStatus);
            }}
        >
            {({ values, errors, touched, resetForm, setFieldValue }) => {
                // NO-SONAR: se requiere utilizar el hook con la funcion setFieldValue de Formik
                useEffect(() => {
                    if (values.type === "formula" && values.formula === "modelo_a_modelo") {
                        if (values.aggregate_aux && values.field_aux) {
                            setFieldValue("value", `${values.aggregate_aux}.${values.field_aux}`);
                        } else {
                            setFieldValue("value", "");
                        }
                    }
                }, [values.aggregate_aux, values.field_aux, values.type, values.formula, setFieldValue]);

                return (
                    <>
                        <ModalForm
                            open={openModal}
                            loading={isLoading}
                            title={t("app.title.updateModel")}
                            subtitle={t("app.forms.subtitle")}
                            resetForm={resetForm}
                            pending={isPending}
                            hasEntity={values.id}
                        >
                            <InputCard>
                                <KField>
                                    <Input
                                        id="description"
                                        name="description"
                                        label={t("gridMain.columns.description")}
                                        type="text"
                                        placeholder={t("gridMain.columns.description")}
                                    />
                                </KField>
                            </InputCard>

                            <ModelFieldSelector
                                values={values}
                                errors={errors}
                                touched={touched}
                                setFieldValue={setFieldValue}
                                aggregateKey="aggregate"
                                fieldKey="field"
                            />

                            <div className="grid grid-cols-4 gap-4 items-center">
                                <Label className={`${errors.type && touched.type && "text-redCustom"} text-right`}>
                                    {t("mailAccounts.form.type")}
                                </Label>
                                <InputCard className="col-start-2 col-end-5">
                                    <SelectByUrl
                                        name="type"
                                        url={`${ACTION_UPDATE_MODEL}/types`}
                                        value={values.type}
                                        keyQuery="typeUpdateModelRequest"
                                        setFieldValue={setFieldValue}
                                        error={errors.custom_form_id}
                                        touched={touched.custom_form_id}
                                        method="get"
                                        typeForm={handlerOptionsTypesByUrl}
                                        onValueChange={(value) => {
                                            setFieldValue("formula", "");
                                            setFieldValue("value", "");
                                            setFieldValue("type", value);
                                        }}
                                        isTranslated
                                    />
                                </InputCard>
                            </div>

                            {values.type === "formula" && (
                                <div className="grid grid-cols-4 gap-4 items-center">
                                    <Label
                                        className={`${errors.formula && touched.formula && "text-redCustom"} text-right`}
                                    >
                                        {t("gridMain.columns.Formula")}
                                    </Label>
                                    <InputCard className="col-start-2 col-end-5">
                                        <SelectByUrl
                                            name="formula"
                                            url={`${ACTION_UPDATE_MODEL}/formulas`}
                                            value={values.formula}
                                            keyQuery="formulaUpdateModelRequest"
                                            setFieldValue={setFieldValue}
                                            error={errors.custom_form_id}
                                            touched={touched.custom_form_id}
                                            method="get"
                                            typeForm={handlerOptionsTypesByUrl}
                                            onValueChange={(value) => {
                                                setFieldValue("value", "");
                                                setFieldValue("formula", value);
                                            }}
                                            isTranslated
                                        />
                                    </InputCard>
                                </div>
                            )}

                            {values.formula === "modelo_a_modelo" && (
                                <ModelFieldSelector
                                    values={values}
                                    errors={errors}
                                    touched={touched}
                                    setFieldValue={setFieldValue}
                                    aggregateKey="aggregate_aux"
                                    fieldKey="field_aux"
                                />
                            )}
                            {values.type !== "formula" && (
                                <InputCard>
                                    <KField>
                                        <Input
                                            id="value"
                                            name="value"
                                            label={t("gridMain.columns.Value")}
                                            type="text"
                                            placeholder={t("gridMain.columns.Value")}
                                        />
                                    </KField>
                                </InputCard>
                            )}
                        </ModalForm>
                    </>
                );
            }}
        </Formik>
    );
};
