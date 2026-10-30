import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { sendInformation } from "../services/generic-send-information";
import { useDispatch } from "react-redux";
import { setOpenModal } from "../redux/state/modalBehavior";
import { getTranslatedError } from "@/utils/getTranslatedError";

const isFirstListQuery = (queryKey) => queryKey.length === 1 || queryKey[1] === 0 || Array.isArray(queryKey[1]);

const updateCachedLists = ({ queryClient, queries, item, matchingIds, insertIfMissing = false }) => {
    queries.forEach(([queryKey]) => {
        queryClient.setQueryData(queryKey, (old) => {
            if (!Array.isArray(old?.data)) return old;

            const index = old.data.findIndex((cachedItem) => matchingIds.includes(cachedItem.id));
            if (index !== -1) {
                const updatedData = [...old.data];
                updatedData[index] = item;
                return {
                    ...old,
                    data: updatedData,
                };
            }

            if (insertIfMissing && isFirstListQuery(queryKey)) {
                return {
                    ...old,
                    data: [item, ...old.data],
                };
            }

            return old;
        });
    });
};

const useGeneralMutation = ({
    setOpen,
    keyQuery = "",
    openModal = false,
    path = null,
    invalidateQueries = true,
    additionalQueryKeys = [],
    onSuccessToast = true,
    onErrorToast = true,
    optimisticListUpdate = true,
}) => {
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { t } = useTranslation();
    const invalidatePrimaryQuery = () => {
        if (!invalidateQueries) return;

        queryClient.invalidateQueries({ queryKey: [keyQuery], exact: false });
    };
    const invalidateAdditionalQueries = () => {
        if (!invalidateQueries) return;

        additionalQueryKeys.forEach((queryKey) => {
            queryClient.invalidateQueries({ queryKey, exact: false });
        });
    };
    const handleValidateTypeError = (error, setFormikErrors, setFormikStatus) => {
        const value = error?.response?.data?.errors;
        if (value?.duplicateFields) {
            const errorFields = Object.values(value.duplicateFields).reduce((acc, { field, value }) => {
                acc[field] = `Duplicate value: ${value}`;
                return acc;
            }, {});
            setFormikErrors(errorFields);
            return;
        }
        setFormikErrors({
            name: "",
        });
        setFormikStatus(error?.response?.data?.errors);
    };
    const { mutateAsync, isPending, isSuccess, isError } = useMutation({
        mutationFn: sendInformation,
        onMutate: async (variables) => {
            await queryClient.cancelQueries({ queryKey: [keyQuery] });
            const newData = { ...variables.dataPost, id: !variables.id ? variables.dataPost.id : variables.id };
            const previousQueries = queryClient.getQueriesData({ queryKey: [keyQuery] });
            if (!optimisticListUpdate || variables?.options?.serverGeneratedId || !newData.id) {
                return { previousQueries };
            }
            updateCachedLists({
                queryClient,
                queries: previousQueries,
                item: newData,
                matchingIds: [variables.id, newData.id].filter(Boolean),
                insertIfMissing: !variables.id,
            });
            return { previousQueries };
        },
        onError: (error, variables, context) => {
            const apiErrors = error?.response?.data?.errors;

            context?.previousQueries?.forEach(([queryKey, data]) => {
                queryClient.setQueryData(queryKey, data);
            });

            const statesUniquenessError =
                variables?.handleStatesError &&
                Array.isArray(apiErrors) &&
                apiErrors.some(
                    (e) => typeof e.message === "string" && e.message.toLowerCase().includes("already exist"),
                );

            if (statesUniquenessError && variables.setFormikStatus) {
                variables.setFormikStatus(t("app.alerts.duplicatedState"));
                toast.error(t("app.alerts.duplicatedState"));
                return;
            }

            if (variables.setFormikErrors && variables.setFormikStatus) {
                const { setFormikErrors, setFormikStatus } = variables;

                if (error?.response?.data) {
                    handleValidateTypeError(error, setFormikErrors, setFormikStatus);
                }
            }

            if (onErrorToast) {
                toast.error(getTranslatedError(error, t));
            }
        },

        onSuccess: (response, variables) => {
            const responseId = response?.data?.data?.id ?? response?.data?.id;
            if (optimisticListUpdate && responseId && variables?.options?.serverGeneratedId) {
                const responseData = {
                    ...variables.dataPost,
                    ...(response?.data?.data ?? {}),
                    id: responseId,
                };
                const optimisticId = variables?.dataPost?.id ?? variables?.id;
                updateCachedLists({
                    queryClient,
                    queries: queryClient.getQueriesData({ queryKey: [keyQuery] }),
                    item: responseData,
                    matchingIds: [responseId, optimisticId].filter(Boolean),
                    insertIfMissing: true,
                });
            }
            invalidatePrimaryQuery();
            invalidateAdditionalQueries();
            onSuccessToast && toast.success(t("genericTexts.EverythingOk"));
            openModal && dispatch(setOpenModal(false));
            setOpen && setOpen(false);
            path && navigate(path, { replace: true });
        },
        onSettled: () => {
            invalidatePrimaryQuery();
        },
    });

    const mutate = async (...args) => {
        const promise = mutateAsync(...args);
        return promise;
    };

    return { mutate, mutateAsync, isPending, isSuccess, queryClient, isError };
};

export default useGeneralMutation;
