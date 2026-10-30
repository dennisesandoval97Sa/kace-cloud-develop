import { PropTypes } from "prop-types";
import { Formik } from "formik";
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { joiFormikAdapter } from "@kace/utils";
import { AgendaSchemaForm } from "../../../schemas/AgendaSchema";
import { InputFormModal as Input, KField, Label } from "@kace/ui-shared";
import InputCard from "../../../components/core/Cards/InputCard";
import ModalForm from "../../../components/core/ModalForm/modal-form";
import { useAgendaData } from "../hooks/useAgendaData";
import { MultiSelectGroups } from "../../../components/core/multiselector/MultiSelectGroups";
import SectionForm from "../../../components/core/Cards/section-form";
import { SwitchStateAdmin } from "../../../components/core/switchState/SwitchStateAdmin";
import { getInitialValues } from "../data";

const AgendaForm = ({ dataHandler }) => {
    const { t } = useTranslation();
    const { oneScript_calendar: oneScriptID } = useSelector((state) => state.generalSetup.configAgent?.calendar);
    const [initialValues] = useState(getInitialValues(oneScriptID));
    const [formValues, setFormValues] = useState(initialValues);
    const openModal = useSelector((state) => state.modalBehavior.open);
    const idSelected = useSelector((state) => state.modalBehavior.idSelected);

    const {
        data,
        isLoading,
        dataAgendaToGroup,
        setDataAgendaToGroup,
        isAgendaToGroupLoading,
        isGroupsLoading,
        initializeStates,
    } = useAgendaData(idSelected);

    const [groups, setGroups] = useState([]);

    useEffect(() => {
        if (!isLoading && data && !isAgendaToGroupLoading && !isGroupsLoading && dataAgendaToGroup) {
            Object.entries(data).forEach(([key, value]) => {
                setFormValues((state) => ({
                    ...state,
                    [key]:
                        key === "is_for_weekend"
                            ? value === "" || value === false
                                ? false
                                : true
                            : key === "is_active"
                              ? value === "" || value === false
                                  ? false
                                  : true
                              : value || initialValues[key] || "",
                }));
            });
        } else {
            setFormValues(initialValues);
        }
    }, [data, isLoading, isAgendaToGroupLoading, isGroupsLoading, dataAgendaToGroup]);

    useEffect(() => {
        if (dataAgendaToGroup && openModal) {
            setGroups(dataAgendaToGroup);
        }
    }, [dataAgendaToGroup, openModal]);

    useEffect(() => {
        if (!idSelected) {
            initializeStates();
        }
    }, [idSelected]);

    return (
        <Formik
            enableReinitialize={true}
            initialValues={formValues}
            validationSchema={joiFormikAdapter(AgendaSchemaForm)}
            onSubmit={(values, { setFieldError, setSubmitting }) => {
                if (groups.length === 0) {
                    setSubmitting(false);
                    setFieldError("groups", t("app.forms.required"));
                    return;
                }
                values.id = idSelected;
                values.groups = groups.map((item) => item.id);
                const previousDataAgendaToGroup = dataAgendaToGroup;
                dataHandler(values, previousDataAgendaToGroup);
                setDataAgendaToGroup(groups);
            }}
        >
            {({ resetForm, touched, isSubmitting }) => {
                return (
                    <ModalForm
                        open={openModal}
                        isLoading={isLoading}
                        title={t("app.title.agenda")}
                        subtitle={t("app.forms.subtitle")}
                        resetForm={resetForm}
                        hasEntity={idSelected}
                    >
                        <div className="grid gap-4 py-4">
                            <InputCard>
                                <KField>
                                    <Input
                                        id="description"
                                        name="description"
                                        label={t("agenda.form.description")}
                                        type="text"
                                        placeholder={t("agenda.placeholder.description")}
                                    />
                                </KField>
                            </InputCard>
                            <InputCard>
                                <KField>
                                    <Input
                                        id="daily_limit"
                                        name="daily_limit"
                                        label={t("agenda.form.daily_limit")}
                                        placeholder={t("agenda.placeholder.daily_limit")}
                                        type="number"
                                        min="0"
                                    />
                                </KField>
                            </InputCard>
                            <div className="flex flex-row-reverse gap-2">
                                <InputCard className={" w-3/4"}>
                                    <SwitchStateAdmin
                                        name="is_for_weekend"
                                        title={t("agenda.form.is_for_weekend")}
                                        tipo="boolean"
                                    />
                                </InputCard>
                            </div>
                            {idSelected && (
                                <div className="flex flex-row-reverse gap-2">
                                    <InputCard className={" w-3/4"}>
                                        <SwitchStateAdmin name="is_active" tipo="boolean" />
                                    </InputCard>
                                </div>
                            )}
                            <InputCard>
                                <KField>
                                    <Input
                                        id="one_script_id"
                                        name="one_script_id"
                                        type="hidden"
                                        value={initialValues.one_script_id}
                                    />
                                </KField>
                            </InputCard>
                            <div
                                className={`${groups.length == 0 && touched.groups && !isSubmitting && "text-redCustom"} text-right`}
                            >
                                <SectionForm title={t("agenda.form.associateGroup")}>
                                    <InputCard>
                                        <KField>
                                            <MultiSelectGroups
                                                enableInfiniteScroll
                                                listValues={groups}
                                                setListValues={setGroups}
                                                values={dataAgendaToGroup}
                                            />
                                        </KField>
                                    </InputCard>
                                    {groups.length == 0 && touched.groups && !isSubmitting && (
                                        <Label className="text-redCustom font-semibold">
                                            {t("app.forms.required")}
                                        </Label>
                                    )}
                                </SectionForm>
                            </div>
                        </div>
                    </ModalForm>
                );
            }}
        </Formik>
    );
};
AgendaForm.propTypes = {
    dataHandler: PropTypes.func.isRequired,
};
export default AgendaForm;
