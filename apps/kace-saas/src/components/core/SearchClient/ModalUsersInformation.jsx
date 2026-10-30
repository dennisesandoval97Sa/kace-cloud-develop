import PropTypes from "prop-types"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle
} from "@kace/ui-shared"
import { TableFindUsers } from "./TableFindUsers"

export const ModalUsersInformation = ({
    data = [],
    openModal,
    setOpenModal,
    isLoading = false,
    columns = []
}) => {
    return (
        <Dialog
            open={openModal}
            onOpenChange={() => {
                setOpenModal(false)
            }}
            id="modal_users_information"
            data-testid="modal_users_information"
        >
            <DialogContent className="max-w-[85rem] max-h" id="modal_users_information_content" data-testid="modal_users_information_content">
                <DialogHeader id="modal_users_information_header" data-testid="modal_users_information_header">
                    <DialogTitle id="modal_users_information_title" data-testid="modal_users_information_title">Clientes</DialogTitle>
                    <DialogDescription id="modal_users_information_description" data-testid="modal_users_information_description">
                        Seleccione un cliente para ver su información
                    </DialogDescription>
                    <TableFindUsers data={data} setOpenModal={setOpenModal} isLoading={isLoading} columns={columns} id="table_find_users" data-testid="table_find_users" />
                </DialogHeader>
            </DialogContent>
        </Dialog>
    )
}

ModalUsersInformation.propTypes = {
    data: PropTypes.array.isRequired,
    openModal: PropTypes.bool.isRequired,
    setOpenModal: PropTypes.func.isRequired,
    isLoading: PropTypes.bool.isRequired,
    columns: PropTypes.array.isRequired
}
