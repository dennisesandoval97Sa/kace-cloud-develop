import { useDispatch } from "react-redux"
import useGeneralDelete from "../../../hooks/useGeneralDelete"
import { URL_AND_KEYS } from "../../../utils/urlAndKeys"
import {
    setIdSelectedAndDisableEdit,
    setIdSelectedAndEnableEdit,
    setOpenModal
} from "../../../redux/state/modalBehavior"

const useGroupListActions = () => {
    const dispatch = useDispatch()
    const { mutate: deleteAction } = useGeneralDelete({
        keyQuery: URL_AND_KEYS.groupLists.key
    })

    return {
        handleDeleteGroupList: (id) => {
            deleteAction({ id, url: URL_AND_KEYS.groupLists.url })
        },
        handleUpdateGroupList: (id) => {
            dispatch(setIdSelectedAndEnableEdit(id))
            dispatch(setOpenModal(true))
        },
        handleSeeGroupList: (id) => {
            dispatch(setIdSelectedAndDisableEdit(id))
            dispatch(setOpenModal(true))
        }
    }
}

export default useGroupListActions
