import { DashboardSectionCard } from "@/components/core/Cards/DashboardSectionCard";
import { GeneralLoader, InputForm as Input, KField } from "@/components/ui-shared";
import useRoleFormData from "./hooks/useRoleFormData";
import { joiFormikAdapter } from "@/utils/main";
import { RoleSchemaForm } from "@/schemas/RoleSchema";
import { Form, Formik } from "formik";
import FormCard from "@/components/core/Cards/FormCard";
import { useTranslation } from "react-i18next";
import { SwitchStateAdmin } from "@/components/core/switchState/SwitchStateAdmin";
import SectionForm from "@/components/core/Cards/section-form";
import { RoleFormCardModulesTab } from "./components/RoleFormCardModulesTab";
import useRoleFormHandler from "./hooks/useRoleFormHandler";
import RoleFormTabSearch from "./components/RoleFormTabSearch";

const RoleForm = () => {
    const { t } = useTranslation();
    const { formData, isEditMode, isLoading } = useRoleFormData();
    const { handleRole, isPending } = useRoleFormHandler();

    return (
        <DashboardSectionCard title="app.title.roles">
            {isLoading ? (
                <GeneralLoader />
            ) : (
                <Formik
                    enableReinitialize={true}
                    initialValues={formData}
                    validationSchema={joiFormikAdapter(RoleSchemaForm)}
                    onSubmit={(values, { setErrors, setStatus }) => handleRole(values, setErrors, setStatus)}
                >
                    {({ errors, status, setStatus, isSubmitting }) => {
                        if (Object.entries(errors).length === 0 && status !== undefined) {
                            setStatus(undefined);
                        }
                        return (
                            <Form className="flex w-full justify-center" autoComplete="off">
                                <FormCard
                                    isId={isEditMode}
                                    isSending={isPending || isSubmitting}
                                    title={t("app.title.roles")}
                                    status={status}
                                >
                                    <div className="flex flex-col col-span-5 gap-8">
                                        <SectionForm
                                            title={t("rol.form.general")}
                                            id="role_title"
                                            dataTestId="role_title"
                                        >
                                            <RoleFormCardModulesTab
                                                title={t("rol.form.roleDetails")}
                                                description={t("rol.form.subtitleRoleDetails")}
                                            >
                                                <KField>
                                                    <Input
                                                        type="text"
                                                        name="descripcion"
                                                        label={t("rol.form.description")}
                                                        placeholder={t("rol.placeholder.description")}
                                                        className="flex flex-col items-start justify-start text-start w-full"
                                                        data-testid="role_input_description"
                                                    />
                                                </KField>

                                                <KField>
                                                    <SwitchStateAdmin name="status" />
                                                </KField>
                                            </RoleFormCardModulesTab>
                                        </SectionForm>
                                        <SectionForm
                                            title={t("rol.form.permissions")}
                                            subTitle={t("rol.form.subtitlePermissions")}
                                            className="min-h-[35rem]"
                                            id="role_permissions"
                                            dataTestId="role_permissions"
                                        >
                                            <RoleFormTabSearch />
                                        </SectionForm>
                                    </div>
                                </FormCard>
                            </Form>
                        );
                    }}
                </Formik>
            )}
        </DashboardSectionCard>
    );
};

export default RoleForm;
