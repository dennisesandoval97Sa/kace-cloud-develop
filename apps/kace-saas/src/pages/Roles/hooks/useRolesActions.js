import useGeneralDelete from "../../../hooks/useGeneralDelete";
import { URL_AND_KEYS } from "../../../utils/urlAndKeys";
import { useNavigate } from "react-router-dom";

const useRolesActions = () => {
    const navigate = useNavigate();
    const { mutate: deleteAction } = useGeneralDelete({
        keyQuery: URL_AND_KEYS.roles.key,
    });

    return {
        handleDeleteRoles: (id) => {
            deleteAction({ id, url: URL_AND_KEYS.roles.url });
        },
        handleUpdateRoles: (id) => {
            navigate(`/roles/update/${id}`);
        },
        handleSeeRoles: (id) => {
            navigate(`/roles/update/${id}?action=see`);
        },
    };
};

export default useRolesActions;
