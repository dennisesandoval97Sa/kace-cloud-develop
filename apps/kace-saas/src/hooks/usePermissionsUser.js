import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import useUserInformation from "./useUserInformation";

/*
 * Orden canonico del menu de acciones. Cada entrada lleva la clave de traduccion y el
 * literal en español porque las pantallas conviven: unas pasan `label: t("app.forms.edit")`
 * y otras `label: "Editar"` a pelo. Reconocer solo una de las dos formas descoloca a la otra
 * en cuanto se cambia de idioma.
 */
const ACTION_ORDER = [
    ["app.forms.see", "Ver"],
    ["app.forms.edit", "Editar"],
    ["app.forms.download", "Descargar"],
    ["app.forms.delete", "Eliminar"],
];

const usePermissionsUser = ({ moduleId, actions, nameCreate }) => {
    const { permissionsAdmin } = useUserInformation();
    const { t, i18n } = useTranslation();

    const { arrayAction, canBeCreate } = useMemo(() => {
        let nextCanBeCreate = false;
        const arrayData = (permissionsAdmin ?? []).filter((perm) => perm.module_id === moduleId);

        const nextArrayAction = arrayData.flatMap((perm) => {
            const matchingActions = actions.filter(
                (action) => (action.permissionName ?? action.name) === perm.name && perm.granted,
            );
            const actionCreate = nameCreate === perm.name && perm.granted;
            if (actionCreate) {
                nextCanBeCreate = true;
            }
            if (matchingActions.length > 0) {
                return matchingActions.map((action) => ({
                    name: action.label,
                    permissionName: action.permissionName ?? action.name,
                    code: action.permissionName ?? action.name,
                    action:
                        action.label === "Ver caso"
                            ? (id, reference, row) => action.handler(id, reference, row)
                            : action.handler,
                    customizable: action.customizable ?? false,
                    ...(action.show !== undefined && { show: action.show }),
                }));
            }

            return [];
        });
        /*
         * Las acciones que no estan en el orden canonico van al final, no al principio:
         * `indexOf` devolveria -1 y las colaria por delante de Ver/Editar.
         */
        const rank = (name) => {
            const index = ACTION_ORDER.findIndex(([key, label]) => name === t(key) || name === label);
            return index === -1 ? ACTION_ORDER.length : index;
        };
        nextArrayAction.sort((a, b) => rank(a.name) - rank(b.name));

        return {
            arrayAction: nextArrayAction,
            canBeCreate: nextCanBeCreate,
        };
        // i18n.language entra en las deps porque `rank` compara contra etiquetas traducidas.
    }, [permissionsAdmin, moduleId, actions, nameCreate, t, i18n.language]);

    return {
        arrayAction,
        canBeCreate,
    };
};

export default usePermissionsUser;
