import { useDispatch } from "react-redux";
import useGeneralDelete from "../../../hooks/useGeneralDelete";
import { URL_AND_KEYS } from "../../../utils/urlAndKeys";
import {
    setIdSelectedAndDisableEdit,
    setIdSelectedAndEnableEdit,
    setOpenModal,
} from "../../../redux/state/modalBehavior";

const useUserListActions = () => {
    const dispatch = useDispatch();
    const { mutate: deleteAction } = useGeneralDelete({
        keyQuery: URL_AND_KEYS.userLists.key,
    });

    return {
        handleDeleteUserLists: (id) => {
            deleteAction({ id, url: URL_AND_KEYS.userLists.url });
        },
        handleUpdateUserLists: (id) => {
            dispatch(setIdSelectedAndEnableEdit(id));
            dispatch(setOpenModal(true));
        },
        handleSeeUserLists: (id) => {
            dispatch(setIdSelectedAndDisableEdit(id));
            dispatch(setOpenModal(true));
        },
    };
};

export default useUserListActions;
