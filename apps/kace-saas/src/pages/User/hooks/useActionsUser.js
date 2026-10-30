import { useNavigate } from "react-router-dom";
import useGeneralDelete from "../../../hooks/useGeneralDelete";
import { URL_AND_KEYS } from "../../../utils/urlAndKeys";

const useActionsUser = () => {
    const navigate = useNavigate();
    const { mutate: deleteAction } = useGeneralDelete({
        keyQuery: URL_AND_KEYS.users.key,
    });

    return {
        handleUpdateUser: (id) => {
            navigate(`/user/update/${id}`);
        },
        handleDeleteUser: (id) => {
            deleteAction({ id, url: URL_AND_KEYS.users.url });
        },
        handleSeeUser: (id) => {
            navigate(`/user/update/${id}?action=see`);
        },
    };
};

export default useActionsUser;
