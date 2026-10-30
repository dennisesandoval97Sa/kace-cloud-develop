import { FormikStatusMessages, InputFormModal as Input, KField } from "@kace/ui-shared";
import { joiFormikAdapter } from "@kace/utils";
import { Formik } from "formik";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { toast } from "sonner";
import InputCard from "../../../components/core/Cards/InputCard";
import ModalForm from "../../../components/core/ModalForm/modal-form";
import { MultiSelectGroups } from "../../../components/core/multiselector/MultiSelectGroups";
import useGeneralMutation from "../../../hooks/useGeneralMutation";
import useGenericViewQuery from "../../../hooks/useGenericViewQuery";
import { GroupListSchemaForm } from "../../../schemas/GroupListSchema";
import { genericHandleSendInformation } from "../../../services/genericHandleSendInformation";
import { URL_AND_KEYS } from "../../../utils/urlAndKeys";
import { INITIAL_GROUP_LIST_VALUES } from "../data/constants";

export const GroupListForm = () => {
    const [formData, setFormData] = useState(INITIAL_GROUP_LIST_VALUES);
    const [groups, setGroups] = useState([]);
    const { t } = useTranslation();
    const openModal = useSelector((state) => state.modalBehavior.open);
    const idSelected = useSelector((state) => state.modalBehavior.idSelected);

    const { mutate, isPending } = useGeneralMutation({
        keyQuery: URL_AND_KEYS.groupLists.key,
        openModal: true,
    });
    const { data, isLoading } = useGenericViewQuery({
        url: `${URL_AND_KEYS.groupLists.url}/${idSelected}`,
        keyQuery: URL_AND_KEYS.groupLists.key,
        searchById: [idSelected],
        staleTime: 0,
        gcTime: 0,
        enabled: !!idSelected,
    });

    const handleGroupList = async (values, setFormikErrors, setFormikStatus) => {
        const data = genericHandleSendInformation({
            values,
            urlService: URL_AND_KEYS.groupLists.url,
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
                if (data.lista_grupos !== null) {
                    setGroups(data.lista_grupos);
                }
            }
        }
    }, [data, openModal]);

    useEffect(() => {
        setGroups([]);
        !openModal && setFormData(INITIAL_GROUP_LIST_VALUES);
    }, [openModal]);

    return (
        <Formik
            enableReinitialize={true}
            initialValues={formData}
            validationSchema={joiFormikAdapter(GroupListSchemaForm)}
            onSubmit={(values) => {
                if (groups.length === 0) {
                    toast.warning(t("app.alerts.selectGroup"));
                    return;
                }
                handleGroupList({ ...values, lista_grupos: groups.map(({ id, label }) => ({ id, label })) });
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
                        title={t("app.title.groupList")}
                        subtitle="groupList.form.subTitle"
                        resetForm={() => {
                            resetForm({
                                values: {
                                    ...INITIAL_GROUP_LIST_VALUES,
                                    ...(formData.id ? { id: formData.id } : {}),
                                },
                            });
                            setGroups([]);
                        }}
                        pending={isPending}
                        hasEntity={idSelected}
                    >
                        <div className="grid gap-4 py-4">
                            <InputCard>
                                <KField>
                                    <Input
                                        type="text"
                                        name="descripcion"
                                        label={`${t("groupList.form.description")} *`}
                                        placeholder={t("groupList.form.description")}
                                    />
                                </KField>
                            </InputCard>
                            <MultiSelectGroups
                                listValues={groups}
                                setListValues={setGroups}
                                values={formData.lista_grupos}
                            />

                            <FormikStatusMessages formikStatus={status} />
                        </div>
                    </ModalForm>
                );
            }}
        </Formik>
    );
};
