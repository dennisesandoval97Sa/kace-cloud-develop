import InputCard from "../../../components/core/Cards/InputCard";
import { SCHEDULES_SERVICE, GENERAL_SETUP_SERVICE } from "../../../utils/URL";
import SectionForm from "../../../components/core/Cards/section-form";
import { SelectorAdmin } from "../../../components/core/selector-admin";
import { PropTypes } from "prop-types";
import { Form, Formik } from "formik";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { joiFormikAdapter } from "@kace/utils";
import { GroupSchemaForm } from "../../../schemas/GroupSchema";
import FormCard from "../../../components/core/Cards/FormCard";
import { InputForm as Input, KField, SelectByProvider } from "@kace/ui-shared";
import { ONESCRIPT_KONECTA_CLOUD, ROLES_SERVICE } from "../../../utils/URL";
import { initialValues } from "../data";
import { SwitchStateAdmin } from "../../../components/core/switchState/SwitchStateAdmin";
import { useTranslation } from "react-i18next";
import { SelectByUrl } from "../../../components/core/SelectByUrl/SelectByUrl";
import { MultiSelectUsers } from "../../../components/core/multiselector/MultiSelectUsers";
import { InputIps } from "./InputIps";
import { ListIps } from "./ListIps";
import { FormOneScript } from "@/components/core/FormOneScript/FormOneScript";
import useOneScript from "@kace_v2/shared/hooks/useOneScript";
import useConfigAgentData from "../../../hooks/useConfigAgentData";
import { mapRelatedUsersToListValues } from "../utils/mapRelatedUsersToListValues";
import { postGroupUsersToOneScript } from "../../../utils/postGroupUsersToOneScript";

const GroupForm = ({ dataHandler, relatedUsers = {}, data = {}, isSending = false, dataUsers }) => {
    const { t } = useTranslation();
    const [formValues, setFormValues] = useState(data);
    const [externalCodes, setExternalCodes] = useState(null);
    const [allowedIps, setAllowedIps] = useState([]);
    const [oneScriptData, setOneScriptData] = useState({});
    const [listValues, setListValues] = useState([]);
    const { groupsConfig } = useConfigAgentData();
    const hasOneScriptGroups = Boolean(groupsConfig?.oneScript_groups?.trim());
    const { oneScriptRef, oneScriptURL } = useOneScript(groupsConfig?.oneScript_groups, {
        edit_group_id: data?.id || "",
    });

    const sendOneScriptData = useRef(true);
    const formikRef = useRef(null);

    const handleGroupUsersSelectionChange = useCallback(
        (users) => {
            if (!hasOneScriptGroups) return;
            const contentWindow = oneScriptRef.current?.contentWindow;
            postGroupUsersToOneScript(contentWindow, users, ONESCRIPT_KONECTA_CLOUD);
        },
        [hasOneScriptGroups, oneScriptRef],
    );

    useEffect(() => {
        if (Object.entries(data).length !== 0) {
            if (sendOneScriptData.current && data.data) {
                setTimeout(() => {
                    oneScriptRef.current.contentWindow.postMessage(
                        {
                            type: "kaceData",
                            payload: data.data,
                        },
                        ONESCRIPT_KONECTA_CLOUD,
                    );
                }, 5000);
                sendOneScriptData.current = false;
            }
            Object.entries(data).forEach(([key, value]) => {
                setFormValues((state) => ({
                    ...state,
                    [key]: value || initialValues[key] || "",
                }));
            });

            setExternalCodes(data?.codigos_externos || {});
        }
    }, [data]);

    useEffect(() => {
        // Always sync from latest memberships (including []) so restored groups
        // without relations do not keep stale selected users in the multiselect.
        if (!Object.prototype.hasOwnProperty.call(relatedUsers, "users")) {
            return;
        }
        setListValues(mapRelatedUsersToListValues(relatedUsers.users));
    }, [relatedUsers]);

    const handleOptions = (options) => {
        if (Array.isArray(options)) {
            const newOptions = options[0].value.map((item) => ({
                value: item.id,
                label: item.description,
            }));
            return newOptions;
        }
    };

    useEffect(() => {
        const handleMessage = (event) => {
            if (event.origin !== ONESCRIPT_KONECTA_CLOUD) return;
            const { type, payload } = event.data;

            if (type === "groupFormData" && payload) {
                setOneScriptData(payload);
            }

            if (type === "ONECSCRIPT_UPDATE_GROUP") {
                formikRef.current?.submitForm();
            }
        };

        window.addEventListener("message", handleMessage);
        return () => window.removeEventListener("message", handleMessage);
    }, []);

    return (
        <Formik
            innerRef={formikRef}
            enableReinitialize={true}
            initialValues={formValues}
            validationSchema={joiFormikAdapter(GroupSchemaForm)}
            onSubmit={(values) => {
                const newArray = listValues.map((item) => item.id);
                values.codigos_externos = externalCodes;
                values.ips_allowed = {
                    items: allowedIps,
                };
                values.data = oneScriptData;
                dataHandler(values, newArray);
            }}
        >
            {({ values, errors, touched, setFieldValue }) => {
                return (
                    <Form className="flex w-full justify-center" autoComplete="off">
                        <FormCard isId={data?.id} title={t("app.title.group")} isSending={isSending}>
                            <div className="flex flex-col col-span-3 gap-8">
                                <SectionForm
                                    title={t("group.form.information")}
                                    id="group_form_information"
                                    dataTestId="group_form_information"
                                >
                                    <InputCard>
                                        <KField>
                                            <Input
                                                id="nombre"
                                                name="nombre"
                                                label={t("group.form.name")}
                                                type="text"
                                                placeholder={t("group.placeholder.name")}
                                                className="flex flex-col items-start justify-start text-start"
                                            />
                                        </KField>
                                    </InputCard>
                                    <InputCard>
                                        <KField>
                                            <Input
                                                id="descripcion"
                                                name="descripcion"
                                                label={t("group.form.description")}
                                                type="text"
                                                placeholder={t("group.placeholder.description")}
                                                className="flex flex-col items-start justify-start text-start"
                                            />
                                        </KField>
                                    </InputCard>
                                    <InputCard>
                                        <KField>
                                            <Input
                                                id="codigo_externo"
                                                name="codigo_externo"
                                                label={t("group.form.externalCode")}
                                                type="text"
                                                className="flex flex-col items-start justify-start text-start"
                                            />
                                        </KField>
                                    </InputCard>
                                </SectionForm>
                                <SectionForm
                                    title={t("group.form.users")}
                                    id="group_form_users"
                                    dataTestId="group_form_users"
                                >
                                    <MultiSelectUsers
                                        listValues={listValues}
                                        setListValues={setListValues}
                                        values={dataUsers?.users ?? []}
                                        enableSearch={true}
                                        onUserSelectionChange={handleGroupUsersSelectionChange}
                                    />
                                </SectionForm>
                                <SectionForm title={t("users.form.status")}>
                                    <InputCard>
                                        <KField>
                                            <SwitchStateAdmin name="status" />
                                        </KField>
                                    </InputCard>
                                </SectionForm>
                            </div>
                            <div className="flex flex-col gap-8 col-start-4 col-span-2">
                                <SectionForm
                                    title={t("group.form.schedules")}
                                    id="group_form_schedules"
                                    dataTestId="group_form_schedules"
                                >
                                    <InputCard>
                                        <SelectByProvider
                                            name="horario_id"
                                            url={`${SCHEDULES_SERVICE}`}
                                            valueFrom="id"
                                            labelFrom="description"
                                            staleTime={0}
                                            initialValue={{
                                                id: data.horario_id,
                                                description: data.horario_description,
                                            }}
                                            placeholder={t("app.forms.options")}
                                        />
                                    </InputCard>
                                </SectionForm>
                                <SectionForm
                                    title="Configuraciones globales"
                                    id="group_form_general_config"
                                    dataTestId="group_form_general_config"
                                >
                                    <InputCard>
                                        <SelectByUrl
                                            name="configuration_id"
                                            url={`${GENERAL_SETUP_SERVICE}`}
                                            keyQuery="globalConfigurations"
                                            value={values.configuration_id}
                                            setFieldValue={setFieldValue}
                                            typeForm={handleOptions}
                                            error={errors.configuration_id}
                                            touched={touched.configuration_id}
                                        />
                                    </InputCard>
                                </SectionForm>

                                <SectionForm
                                    title={t("group.form.externalCodes")}
                                    id="group_form_externalCodes"
                                    dataTestId="group_form_externalCodes"
                                >
                                    <SelectorAdmin values={externalCodes} setValues={setExternalCodes} />
                                </SectionForm>
                                <SectionForm
                                    title={t("users.form.allowedIps")}
                                    id="user_form_allowed_ips"
                                    dataTestId="user_form_allowed_ips"
                                >
                                    <InputIps allowedIps={allowedIps} setAllowedIps={setAllowedIps} />
                                    <ListIps allowedIps={allowedIps} setAllowedIps={setAllowedIps} />
                                </SectionForm>
                            </div>
                            {hasOneScriptGroups && (
                                <div className="col-span-5 w-full mb-8">
                                    <SectionForm>
                                        <div className="relative h-[600px] max-h-[80vh] w-full overflow-hidden">
                                            <FormOneScript formRef={oneScriptRef} url={oneScriptURL} />
                                        </div>
                                    </SectionForm>
                                </div>
                            )}
                        </FormCard>
                    </Form>
                );
            }}
        </Formik>
    );
};
GroupForm.propTypes = {
    dataHandler: PropTypes.func.isRequired,
    relatedUsers: PropTypes.object,
    data: PropTypes.object,
    isSending: PropTypes.bool,
    dataUsers: PropTypes.object,
};
export default GroupForm;
