import { URL_AND_KEYS } from "../../../utils/urlAndKeys";
import { useDispatch } from "react-redux";
import useGeneralDelete from "../../../hooks/useGeneralDelete";
import { setIdSelectedAndDisableEdit, setIdSelectedAndEnableEdit, setOpenModal } from "../../../redux/state/modalBehavior";

const useActionUpdateModelActions = () => {
    const dispatch = useDispatch();
    const { mutate: deleteAction } = useGeneralDelete({
        keyQuery: URL_AND_KEYS.actionModelUpdate.key,
    });
    return {
        handleDeleteActionUpdateModel: (id) => {
            deleteAction({ id, url: URL_AND_KEYS.actionModelUpdate.url });
        },
        handleUpdateActionUpdateModel: (id) => {
            dispatch(setIdSelectedAndEnableEdit(id));
            dispatch(setOpenModal(true));
        },
        handleSeeActionUpdateModel: (id) => {
            dispatch(setIdSelectedAndDisableEdit(id));
            dispatch(setOpenModal(true));
        },
    };
};

export default useActionUpdateModelActions;
