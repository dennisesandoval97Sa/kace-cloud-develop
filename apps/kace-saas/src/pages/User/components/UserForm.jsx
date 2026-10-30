import { PropTypes } from "prop-types";
import { Form, Formik } from "formik";
import React, { useEffect, useRef, useState } from "react";
import { joiFormikAdapter } from "@kace/utils";
import FormCard from "../../../components/core/Cards/FormCard";
import InputCard from "../../../components/core/Cards/InputCard";
import { ONESCRIPT_KONECTA_CLOUD } from "../../../utils/URL";
import SectionForm from "../../../components/core/Cards/section-form";
import { SelectorAdmin } from "../../../components/core/selector-admin";
import { SwitchStateAdmin } from "../../../components/core/switchState/SwitchStateAdmin";
import { useTranslation } from "react-i18next";
import { InputIps } from "./InputIps";
import { ListIps } from "./ListIps";
import { FormOneScript } from "@/components/core/FormOneScript/FormOneScript";
import useOneScript from "@kace_v2/shared/hooks/useOneScript";
import useConfigAgentData from "../../../hooks/useConfigAgentData";

import { InputForm as Input, KField, SelectForm as Select, Label } from "@kace/ui-shared";
import { UserFormSchema } from "../../../schemas/UserSchema";
import { MultiSelectGroups } from "../../../components/core/multiselector/MultiSelectGroups";
import useUserInformation from "@/hooks/useUserInformation";
import { useDispatch } from "react-redux";
import { setShowGroupsSelect } from "../../../redux/state/showGroupSelect";
import { useRolesUser } from "../hooks/useRolesUser";
import SelectField from "@kace_v2/shared/ui/molecules/SelectField";
import {
    getSelectedGroupIds,
    resolveActiveGroupForSelectedGroups,
    shouldRequireGroups,
} from "../utils/normalizeUserFormGroups";

const UserForm = ({ dataHandler, data = {}, isSending = false }) => {
    const { t } = useTranslation();
    const [formValues, setFormValues] = useState(data);
    const [externalCodes, setExternalCodes] = useState(null);
    const [listValues, setListValues] = useState([]);
    const [allowedIps, setAllowedIps] = useState([]);
    const [oneScriptData, setOneScriptData] = useState({});
    const typeAcountsOptions = [
        { value: "1", label: "Identity" },
        { value: "2", label: "Servicio" },
    ];
    const { sessionTime } = useConfigAgentData();
    const hasOneScriptUsers = Boolean(sessionTime?.oneScript_users?.trim());
    const { oneScriptRef, oneScriptURL } = useOneScript(sessionTime?.oneScript_users, { edit_user_id: data?.id || "" });

    const sendOneScriptData = useRef(true);

    const { user } = useUserInformation();
    const dispatch = useDispatch();

    const { rolesOptions, isLoadingRoles, fetchNextRoles, hasNextPageRoles, isFetchingNextPageRoles, onSearchRoles } =
        useRolesUser();

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
                const next =
                    key === "account_type"
                        ? value === null || value === undefined || value === ""
                            ? ""
                            : String(value)
                        : value || "";
                setFormValues((state) => ({
                    ...state,
                    [key]: next,
                }));
            });
            setExternalCodes(data?.codigos_externos || {});
            setListValues(data?.groups || []);
            setAllowedIps(data?.ips_allowed?.items || []);
        }
    }, [data]);

    useEffect(() => {
        const handleMessage = (event) => {
            if (event.origin !== ONESCRIPT_KONECTA_CLOUD) return;
            const { type, payload } = event.data;
            if (type === "userFormData" && payload) {
                setOneScriptData(payload);
            }
        };

        window.addEventListener("message", handleMessage);
        return () => window.removeEventListener("message", handleMessage);
    }, []);

    return (
        <Formik
            enableReinitialize={true}
            initialValues={formValues}
            validationSchema={joiFormikAdapter(UserFormSchema)}
            onSubmit={async (values, { setErrors, setStatus, setSubmitting }) => {
                if (!values.id) {
                    values.is_active = 1;
                    if (String(values.account_type) === "1") values.is_active = 2;
                }
                const selectedGroupIds = getSelectedGroupIds(listValues);
                values.codigos_externos = externalCodes;
                if (shouldRequireGroups(values) && selectedGroupIds.length === 0) {
                    setErrors({ groups: "Requerido" });
                    setSubmitting(false);
                    return;
                }

                values.grupo_activo = resolveActiveGroupForSelectedGroups(values.grupo_activo, selectedGroupIds);
                values.ips_allowed = {
                    items: allowedIps,
                };
                values.data = oneScriptData;

                dataHandler(values, setErrors, setStatus, selectedGroupIds);
                if (data.id === user.id && data.rol_id !== values.rol_id) {
                    dispatch(setShowGroupsSelect(true));
                    localStorage.removeItem("userGroupId");
                }
            }}
        >
            {({ values, errors, setStatus, status, touched, isSubmitting, initialValues, setFieldValue }) => {
                if (Object.entries(errors).length === 0 && status !== undefined) {
                    setStatus(undefined);
                }
                return (
                    <Form className="flex w-full justify-center" autoComplete="off">
                        <FormCard isId={data?.id} isSending={isSending} title={t("app.title.user")} status={status}>
                            <div className="flex flex-col col-span-3 gap-8">
                                <SectionForm
                                    title={t("users.form.typeAccount")}
                                    id="user_form_account_type"
                                    dataTestId="user_form_account_type"
                                >
                                    <Select
                                        name="account_type"
                                        label=""
                                        className="flex flex-col items-start justify-start text-start"
                                        options={typeAcountsOptions}
                                    />
                                </SectionForm>
                                <SectionForm title="Información" id="user_form_login" dataTestId="user_form_login">
                                    <InputCard>
                                        <KField>
                                            <Input
                                                id="login"
                                                name="login"
                                                label={t("users.form.login")}
                                                type="text"
                                                placeholder={t("users.placeholder.login")}
                                                className="flex flex-col items-start justify-start text-start"
                                            />
                                        </KField>
                                    </InputCard>
                                    {values.account_type === "2" && values.newUser === 1 && (
                                        <InputCard>
                                            <KField>
                                                <Input
                                                    id="password"
                                                    name="password"
                                                    label={t("users.form.password")}
                                                    type="password"
                                                    placeholder={t("users.placeholder.password")}
                                                    className="flex flex-col items-start justify-start text-start"
                                                />
                                            </KField>
                                        </InputCard>
                                    )}
                                    <InputCard>
                                        <KField>
                                            <Input
                                                id="nombres"
                                                name="nombres"
                                                label={t("users.form.names")}
                                                type="text"
                                                placeholder={t("users.placeholder.names")}
                                                className="flex flex-col items-start justify-start text-start"
                                            />
                                        </KField>
                                    </InputCard>
                                    <InputCard>
                                        <KField>
                                            <Input
                                                id="apellido1"
                                                name="apellido1"
                                                label={t("users.form.firstLastName")}
                                                type="text"
                                                placeholder={t("users.placeholder.firstLastName")}
                                                className="flex flex-col items-start justify-start text-start"
                                            />
                                        </KField>
                                    </InputCard>
                                    <InputCard>
                                        <KField>
                                            <Input
                                                id="apellido2"
                                                name="apellido2"
                                                label={t("users.form.secondLastName")}
                                                type="text"
                                                placeholder={t("users.placeholder.secondLastName")}
                                                className="flex flex-col items-start justify-start text-start"
                                            />
                                        </KField>
                                    </InputCard>
                                    <InputCard>
                                        <KField>
                                            <Input
                                                id="email"
                                                name="email"
                                                label={t("users.form.email")}
                                                type="text"
                                                placeholder={t("users.placeholder.email")}
                                                className="flex flex-col items-start justify-start text-start"
                                            />
                                        </KField>
                                    </InputCard>
                                    <InputCard>
                                        <KField>
                                            <Input
                                                id="telefono"
                                                name="telefono"
                                                label={t("users.form.phone")}
                                                type="text"
                                                placeholder={t("users.placeholder.phone")}
                                                className="flex flex-col items-start justify-start text-start"
                                            />
                                        </KField>
                                    </InputCard>
                                    <InputCard>
                                        <KField>
                                            <Input
                                                id="movil"
                                                name="movil"
                                                label={t("users.form.movil")}
                                                type="text"
                                                placeholder={t("users.placeholder.movil")}
                                                className="flex flex-col items-start justify-start text-start"
                                            />
                                        </KField>
                                    </InputCard>
                                    <InputCard>
                                        <KField>
                                            <Input
                                                id="external_id"
                                                name="external_id"
                                                label={t("users.form.idExterno")}
                                                type="text"
                                                placeholder={t("users.placeholder.idExterno")}
                                                className="flex flex-col items-start justify-start text-start"
                                            />
                                        </KField>
                                    </InputCard>
                                </SectionForm>
                                <div
                                    className={`${listValues.length === 0 && touched.groups && !isSubmitting && "text-redCustom"} text-right`}
                                >
                                    <SectionForm
                                        title={t("users.form.groups")}
                                        id="user_form_groups"
                                        dataTestId="user_form_groups"
                                    >
                                        <InputCard>
                                            <KField>
                                                <MultiSelectGroups
                                                    listValues={listValues}
                                                    setListValues={setListValues}
                                                    values={values.groups}
                                                />
                                            </KField>
                                        </InputCard>
                                        {listValues.length === 0 && touched.groups && !isSubmitting && (
                                            <Label
                                                className="text-redCustom font-semibold"
                                                id="user_form_required"
                                                data-testid="user_form_required"
                                            >
                                                {t("app.forms.required")}
                                            </Label>
                                        )}
                                    </SectionForm>
                                </div>
                            </div>
                            <div className="flex flex-col gap-8 col-start-4 col-span-2">
                                <SectionForm
                                    title={t("users.form.rol")}
                                    id="user_form_rol_id"
                                    dataTestId="user_form_rol_id"
                                >
                                    <InputCard>
                                        <SelectField
                                            label={t("users.form.rol")}
                                            options={rolesOptions}
                                            value={values?.rol_id || ""}
                                            defaultValue={initialValues?.rol_id || ""}
                                            error={errors?.rol_id}
                                            onValueChange={(value) => setFieldValue("rol_id", value)}
                                            isLoading={isLoadingRoles}
                                            fetchNextPage={fetchNextRoles}
                                            hasNextPage={hasNextPageRoles}
                                            isFetchingNextPage={isFetchingNextPageRoles}
                                            onSearch={onSearchRoles}
                                        />
                                    </InputCard>
                                </SectionForm>

                                <SectionForm
                                    title={t("users.form.externalCodes")}
                                    id="user_form_external_codes"
                                    dataTestId="user_form_external_codes"
                                >
                                    <SelectorAdmin
                                        values={externalCodes}
                                        setValues={setExternalCodes}
                                        field={{
                                            specialCode: "DEFAULT_ASSIGNEE",
                                            specialCodeTitle: t("users.form.defaultAssigneeTitle"),
                                            specialCodeDescription: t("users.form.defaultAssigneeDescription"),
                                            specialCodeDisplayLabel: t("users.form.defaultAssigneeDisplayLabel"),
                                            specialCodeAddLabel: t("users.form.defaultAssigneeAdd"),
                                            specialCodeRemoveLabel: t("users.form.defaultAssigneeRemove"),
                                        }}
                                    />
                                </SectionForm>
                                <SectionForm
                                    title={t("users.form.allowedIps")}
                                    id="user_form_allowed_ips"
                                    dataTestId="user_form_allowed_ips"
                                >
                                    <InputIps allowedIps={allowedIps} setAllowedIps={setAllowedIps} />
                                    <ListIps allowedIps={allowedIps} setAllowedIps={setAllowedIps} />
                                </SectionForm>

                                {data.id && (
                                    <SectionForm
                                        title={t("users.form.status")}
                                        id="user_form_status"
                                        dataTestId="user_form_status"
                                    >
                                        <InputCard>
                                            <KField>
                                                <SwitchStateAdmin name="is_active" />
                                            </KField>
                                        </InputCard>
                                    </SectionForm>
                                )}
                            </div>
                            {hasOneScriptUsers && (
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
UserForm.propTypes = {
    dataHandler: PropTypes.func.isRequired,
    relatedUsers: PropTypes.array,
    data: PropTypes.object,
    isSending: PropTypes.bool,
};
export default UserForm;
