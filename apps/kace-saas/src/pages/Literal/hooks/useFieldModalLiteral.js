import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { sendInformation } from "../../../services/generic-send-information";
import { LITERALS_SERVICE } from "../../../utils/URL";
import { formatDataBeforePost, handleLiteralMutationError } from "../helpers";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { URL_AND_KEYS } from "../../../utils/urlAndKeys";
import useGenericSearchQuery from "../../../hooks/useGenericSearchQuery";
import { apiService } from "../../../utils/main";

async function deleteInformationFieldModel(data) {
    const response = await apiService.get(data.url);
    if (response.status !== 200 && response.status !== 201) {
        throw new Error(response.data.message);
    }
    return response;
}

const useFieldModalLiteral = ({ id, load = false, setOpenModal } = {}) => {
    const queryClient = useQueryClient();
    const [fieldsData, setFieldsData] = useState([]);
    const { t } = useTranslation();
    const { data, isLoading: isLoadingFieldsData } = useGenericSearchQuery({
        url: `${URL_AND_KEYS.literals.url}/search`,
        keyQuery: URL_AND_KEYS.literals.keyId,
        filter: [
            {
                field: "tipo_literal",
                operator: "eq",
                value: id,
                type: "AND",
            },
            {
                field: "is_active",
                operator: "eq",
                value: "1",
                type: "AND",
            },
        ],
        pagination: { limit: 0, offset: 0 },
        enabled: !!id && load,
        select: (data) => data.data,
    });

    const { mutate: mutateNewOption, isPending: isLoadingNewOption } = useMutation({
        mutationFn: sendInformation,
        onError: (err) => handleLiteralMutationError(err, t),
        onSuccess: (_id, context) => {
            queryClient.invalidateQueries({
                predicate: (query) => {
                    const [key, filters] = query.queryKey;
                    if (key !== URL_AND_KEYS.literals.keyId) return false;
                    return Array.isArray(filters) && filters.some((filter) => filter.value === context.parentId);
                },
            });

            toast.success(t("app.alerts.fieldCreate"));
            setOpenModal && setOpenModal(false);
        },
    });

    const { mutate: mutateUpdate, isPending: isUpdating } = useMutation({
        mutationFn: sendInformation,
        onError: (err) => handleLiteralMutationError(err, t),
        onSuccess: (_id, context) => {
            queryClient.invalidateQueries({
                predicate: (query) => {
                    const [key, filters] = query.queryKey;
                    if (key !== URL_AND_KEYS.literals.keyId) return false;
                    return Array.isArray(filters) && filters.some((filter) => filter.value === context.parentId);
                },
            });

            toast.success(t("app.alerts.fieldEdit"));
            setOpenModal && setOpenModal(false);
        },
    });

    const { mutate: mutateDelete, isPending: isDeleting } = useMutation({
        mutationFn: deleteInformationFieldModel,
        onError: () => {
            toast.error(t("app.alerts.dontAction"));
        },
        onSuccess: (_id, context) => {
            queryClient.invalidateQueries({
                predicate: (query) => {
                    const [key, filters] = query.queryKey;
                    if (key !== URL_AND_KEYS.literals.keyId) return false;
                    return (
                        Array.isArray(filters) && filters.some((filter) => filter.value === context.field.tipo_literal)
                    );
                },
            });

            toast.success(t("app.alerts.fieldDelete"));
            setOpenModal && setOpenModal(false);
        },
    });

    const handleSendFieldInformation = (values, parentId) => {
        if (isLoadingNewOption || isUpdating) return;
        const { id } = values;
        if (id) delete values.tipo_literal;
        delete values.value;
        const url = id ? `${LITERALS_SERVICE}/${id}` : `${LITERALS_SERVICE}`;
        const dataPost = formatDataBeforePost(values, id);
        dataPost.tipo_literal = parentId;
        const data = {
            id,
            url,
            dataPost,
            parentId,
        };
        id ? mutateUpdate(data) : mutateNewOption(data);
    };

    const handleDeleteField = (field) => {
        if (isDeleting) return;
        mutateDelete({ url: `${LITERALS_SERVICE}/${field.id}/delete`, field });
    };

    useEffect(() => {
        if (data) {
            const dataFormat = data.map((item) => {
                return {
                    ...item,
                    nombre: item.nombre.includes("/") ? item.nombre.split("/")[1] : item.nombre,
                    value: item.id,
                };
            });
            setFieldsData(dataFormat);
        }
    }, [data]);

    return {
        fieldsData,
        setFieldsData,
        handleSendFieldInformation,
        isLoadingFieldsData,
        handleDeleteField,
        loadingData: isLoadingFieldsData || isLoadingNewOption || isUpdating || isDeleting,
    };
};

export default useFieldModalLiteral;
