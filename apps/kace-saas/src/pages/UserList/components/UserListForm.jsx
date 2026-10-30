import { PropTypes } from "prop-types";
import { Formik } from "formik";
import { useCallback, useEffect, useState } from "react";
import { InputFormModal as Input, KField, FormikStatusMessages, SelectByProvider } from "@kace/ui-shared";
import { joiFormikAdapter } from "@kace/utils";
import InputCard from "../../../components/core/Cards/InputCard";
import ModalForm from "../../../components/core/ModalForm/modal-form";
import { INITIAL_VALUES_USER_LIST } from "../helpers";
import { MultiSelectUsers } from "../../../components/core/multiselector/MultiSelectUsers";
import { UserListSchemaForm } from "../../../schemas/UserListSchema";
import { toast } from "sonner";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import useGenericViewQuery from "../../../hooks/useGenericViewQuery";
import { URL_AND_KEYS } from "../../../utils/urlAndKeys";
import useGeneralMutation from "../../../hooks/useGeneralMutation";
import { genericHandleSendInformation } from "../../../services/genericHandleSendInformation";
import { GROUP_SERVICE } from "../../../utils/URL";

const UserListForm = () => {
    const { t } = useTranslation();
    const [formData, setFormData] = useState(INITIAL_VALUES_USER_LIST);
    const [users, setUsers] = useState([]);
    const [usersData, setUsersData] = useState([]);
    const openModal = useSelector((state) => state.modalBehavior.open);
    const idSelected = useSelector((state) => state.modalBehavior.idSelected);

    const { mutate, isPending } = useGeneralMutation({
        keyQuery: URL_AND_KEYS.userLists.key,
        openModal: true,
    });
    const { data, isLoading } = useGenericViewQuery({
        url: `${URL_AND_KEYS.userLists.url}/${idSelected}`,
        keyQuery: URL_AND_KEYS.userLists.key,
        searchById: [idSelected],
        staleTime: 0,
        gcTime: 0,
        enabled: !!idSelected,
    });

    const resetLocalState = useCallback(() => {
        setUsers([]);
        setUsersData([]);
    }, []);

    const handleUserList = async (values, setFormikErrors, setFormikStatus) => {
        const data = genericHandleSendInformation({
            values,
            urlService: URL_AND_KEYS.userLists.url,
            setFormikErrors,
            setFormikStatus,
            pending: isPending,
        });
        mutate(data);
    };

    useEffect(() => {
        if (data && openModal) {
            if (Object.entries(data).length !== 0) {
                Object.entries(data).forEach(([key, value]) => {
                    setFormData((state) => ({
                        ...state,
                        [key]: value || "",
                    }));
                });
                if (data.lista_usuarios !== null) {
                    const ids = data.lista_usuarios.map((item) => ({ id: item.id }));
                    setUsersData(ids);
                } else {
                    setUsersData([]);
                }
            }
        }
    }, [data, openModal]);

    useEffect(() => {
        if (!openModal) {
            setFormData(INITIAL_VALUES_USER_LIST);
            resetLocalState();
        }
    }, [openModal, resetLocalState]);

    // Reset cuando cambia el idSelected
    useEffect(() => {
        if (idSelected) {
            resetLocalState();
        }
    }, [idSelected, resetLocalState]);

    return (
        <Formik
            enableReinitialize={true}
            initialValues={formData}
            validationSchema={joiFormikAdapter(UserListSchemaForm)}
            onSubmit={async (values, { setErrors, setStatus }) => {
                if (users.length === 0) {
                    toast.warning(t("app.alerts.selectUser"));
                    return;
                }
                handleUserList({ ...values, lista_usuarios: users.map(({ id }) => ({ id })) }, setErrors, setStatus);
            }}
        >
            {({ errors, status, setStatus, resetForm }) => {
                if (Object.entries(errors).length === 0 && status !== undefined) {
                    setStatus(undefined);
                }
                return (
                    <ModalForm
                        open={openModal}
                        isLoading={isLoading}
                        title={t("app.title.userList")}
                        subtitle="userList.form.subTitle"
                        resetForm={() => {
                            resetForm({ values: { ...INITIAL_VALUES_USER_LIST, id: formData.id ?? "" } });
                            resetLocalState();
                        }}
                        pending={isPending}
                        hasEntity={idSelected}
                        id="user_list_form_title"
                        data-testid="user_list_form_title"
                    >
                        <div className="grid gap-4 py-4">
                            <InputCard>
                                <KField>
                                    <Input
                                        type="text"
                                        name="descripcion"
                                        label={`${t("userList.form.description")} *`}
                                        placeholder={t("userList.form.description")}
                                    />
                                </KField>
                            </InputCard>

                            <InputCard className="flex items-center gap-4">
                                <h5 className="mt-4">{t("userList.form.associatedGroup")}</h5>
                                <SelectByProvider
                                    name="group_id"
                                    url={`${GROUP_SERVICE}`}
                                    valueFrom="id"
                                    labelFrom="nombre"
                                    staleTime={0}
                                />
                            </InputCard>

                            <MultiSelectUsers
                                listValues={users}
                                setListValues={setUsers}
                                values={usersData}
                                enableSearch
                                groupSelectedFirst={false}
                            />

                            <FormikStatusMessages formikStatus={status} />
                        </div>
                    </ModalForm>
                );
            }}
        </Formik>
    );
};
UserListForm.propTypes = {
    idSelected: PropTypes.string,
    open: PropTypes.bool,
    setOpen: PropTypes.func,
    setIdSelected: PropTypes.func,
};
export default UserListForm;
