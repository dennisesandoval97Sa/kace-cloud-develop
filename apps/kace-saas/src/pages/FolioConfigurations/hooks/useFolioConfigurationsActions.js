import usePermissionsUser from "@/hooks/usePermissionsUser";
import { useNavigate } from "react-router-dom";
import useGeneralDelete from "../../../hooks/useGeneralDelete";
import { URL_AND_KEYS } from "../../../utils/urlAndKeys";

const useFolioConfigurationsActions = () => {
    const navigate = useNavigate();
    const { mutate: deleteConfiguration } = useGeneralDelete({
        keyQuery: URL_AND_KEYS.folioConfigurations.key,
    });

    const { arrayAction, canBeCreate } = usePermissionsUser({
        moduleId: "folio-configurations",
        actions: [
            {
                name: "FolioConfigurationsDelete",
                label: "Eliminar",
                handler: (id) => deleteConfiguration({ id, url: URL_AND_KEYS.folioConfigurations.url }),
            },
            {
                name: "FolioConfigurationsRead",
                label: "Ver",
                handler: (id) => navigate(`/folio-configurations/update/${id}?action=see`),
            },
            {
                name: "FolioConfigurationsUpdate",
                label: "Editar",
                handler: (id) => navigate(`/folio-configurations/update/${id}`),
            },
        ],
        nameCreate: "FolioConfigurationsCreate",
    });

    return { arrayAction, canBeCreate };
};

export default useFolioConfigurationsActions;
