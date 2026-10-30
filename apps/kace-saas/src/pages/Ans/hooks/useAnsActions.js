import useGeneralDelete from "../../../hooks/useGeneralDelete";
import { URL_AND_KEYS } from "../../../utils/urlAndKeys";
import { useDispatch } from "react-redux";
import {
    setIdSelectedAndDisableEdit,
    setIdSelectedAndEnableEdit,
    setOpenModal,
} from "../../../redux/state/modalBehavior";

const useAnsActions = () => {
    const dispatch = useDispatch();
    const { mutate: deleteAction } = useGeneralDelete({
        keyQuery: URL_AND_KEYS.ans.key,
    });

    return {
        handleDeleteAns: (id) => {
            deleteAction({ id, url: URL_AND_KEYS.ans.url });
        },
        handleUpdateAns: (id) => {
            dispatch(setIdSelectedAndEnableEdit(id));
            dispatch(setOpenModal(true));
        },
        handleSeeAns: (id) => {
            dispatch(setIdSelectedAndDisableEdit(id));
            dispatch(setOpenModal(true));
        },
    };
};

export default useAnsActions;
