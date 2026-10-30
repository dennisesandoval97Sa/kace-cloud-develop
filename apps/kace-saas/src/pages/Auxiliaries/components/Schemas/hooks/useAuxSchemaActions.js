import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import usePermissionsUser from "@/hooks/usePermissionsUser";
import useGeneralDelete from "@/hooks/useGeneralDelete";
import { AUX_SCHEMAS_SERVICE } from "@/utils/URL";
import { dataTableConfig } from "../data/constants";
import { ROUTES } from "@/config/routesDictionary";

const useAuxSchemaActions = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { mutate } = useGeneralDelete({
        keyQuery: dataTableConfig.key,
    });

    return usePermissionsUser({
        moduleId: "schemas",
        actions: [
            {
                name: "SchemasDelete",
                label: t("app.forms.delete"),
                handler: (id) => {
                    mutate({ id, url: AUX_SCHEMAS_SERVICE });
                },
            },
            {
                name: "SchemasRead",
                label: t("app.forms.see"),
                handler: (id) => {
                    navigate(`${ROUTES.AUX_SCHEMAS_CREATE.path}/${id}?action=see`);
                },
            },
            {
                name: "SchemasUpdate",
                label: t("app.forms.edit"),
                handler: (id) => {
                    navigate(`/aux/schemas/create/${id}`);
                },
            },
        ],
        nameCreate: "SchemasCreate",
    });
};

export default useAuxSchemaActions;
