import { apiService } from "@/utils/main";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

/**
 * Displays a toast asking the user for confirmation.
 * @param {string} message - Translated message to display.
 * @param {string} label - Translated action button label (must be provided already translated by the caller).
 * @param {Function} onConfirmAction - Callback when user clicks the confirmation action button.
 */
const showConfirmationToast = (message, label, onConfirmAction = () => {}) => {
    toast.info(message, {
        duration: 10000,
        closeButton: true,
        position: "top-center",
        action: {
            label,
            onClick: () => {
                onConfirmAction();
                toast.dismiss();
            },
        },
        actionButtonStyle: {
            backgroundColor: "#0873DC",
            borderRadius: "25%",
        },
    });
};

export const useFilterTableHandler = () => {
    const { t } = useTranslation();
    const queryClient = useQueryClient();

    const createNewFilter = useCallback(
        async ({ id, filters, selectedGroup, grupo_activo, account_type }) => {
            const userInfoKey = [URL_AND_KEYS.users.userInformation];
            try {
                const response = await apiService.post(`${URL_AND_KEYS.users.url}/${id}`, {
                    account_type: account_type || 1,
                    grupo_activo: grupo_activo || selectedGroup,
                    filters: {
                        ...filters,
                    },
                });
                if (response.status !== 200) {
                    throw new Error(t("app.alert.failedToSaveFilter"));
                }
                queryClient.setQueryData(userInfoKey, (prev) => {
                    if (!prev) return prev;
                    return {
                        ...prev,
                        user: { ...prev.user, filters },
                    };
                });
                return response;
            } finally {
                queryClient.invalidateQueries({
                    queryKey: userInfoKey,
                });
            }
        },
        [queryClient, t],
    );

    const haveFiltersChanged = useCallback((newFiltersValues, currentFiltersValues) => {
        const cleanedKeys = Object.keys(newFiltersValues);
        const currentKeys = Object.keys(currentFiltersValues);

        if (cleanedKeys.length !== currentKeys.length) return true;

        for (const key of cleanedKeys) {
            const a = newFiltersValues[key];
            const b = currentFiltersValues[key];

            if (!b || JSON.stringify(a) !== JSON.stringify(b)) {
                return true;
            }
        }

        return false;
    }, []);

    const promptConfirmation = useCallback(
        ({ isNew, handler, newFiltersValues, currentFiltersValues }) => {
            if (isNew) {
                showConfirmationToast(t("app.alerts.saveFilter"), t("app.button.yes"), handler);
            } else {
                haveFiltersChanged(newFiltersValues, currentFiltersValues) &&
                    showConfirmationToast(t("app.alerts.unsavedChangesFilter"), t("app.button.yes"), handler);
            }
        },
        [t, haveFiltersChanged],
    );

    return { promptConfirmation, createNewFilter };
};
