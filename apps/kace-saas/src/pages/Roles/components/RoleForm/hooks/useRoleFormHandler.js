import { useCallback, useRef } from "react";
import useGeneralMutation from "@/hooks/useGeneralMutation";
import { genericHandleSendInformation } from "@/services/genericHandleSendInformation";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";
import { validatePesmisions } from "../utils/processRoleData";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

const useRoleFormHandler = () => {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const isSubmittingRef = useRef(false);

    const { mutateAsync, isPending } = useGeneralMutation({
        keyQuery: URL_AND_KEYS.roles.key,
        path: null,
        additionalQueryKeys: [["userInformation"], ["userRoles"]],
    });

    const handleRole = useCallback(
        async (values, setFormikErrors, setFormikStatus) => {
            if (isSubmittingRef.current || isPending) return;
            isSubmittingRef.current = true;

            try {
                const somePermissionGranted = validatePesmisions(values.permisos);
                if (!somePermissionGranted) {
                    setFormikStatus(t("app.forms.permissionRequired"));
                    setFormikErrors(t("app.forms.permissionRequired"));
                    return;
                }

                const data = genericHandleSendInformation({
                    values,
                    urlService: URL_AND_KEYS.roles.url,
                    setFormikErrors,
                    setFormikStatus,
                    pending: isPending,
                });

                await mutateAsync(data);

                const currentUserRoleId = queryClient.getQueryData(["userInformation"])?.user?.rol_id;
                if (values?.id && currentUserRoleId === values.id && values.permisos) {
                    queryClient.setQueryData(["userInformation"], (old) => {
                        if (!old) return old;
                        return {
                            ...old,
                            permisions: {
                                ...old.permisions,
                                ...values.permisos,
                            },
                        };
                    });
                }

                navigate(URL_AND_KEYS.roles.url, { replace: true });

                await queryClient.refetchQueries({ queryKey: ["userInformation"] });
            } catch {
                // NO-SONAR: Los errores de validación de API son gestionados por useGeneralMutation
            } finally {
                isSubmittingRef.current = false;
            }
        },
        [isPending, mutateAsync, queryClient, navigate, t],
    );

    return {
        isPending,
        handleRole,
    };
};

export default useRoleFormHandler;
