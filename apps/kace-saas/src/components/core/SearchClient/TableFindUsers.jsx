import { TableContainerClients } from "@kace/ui-shared"
import PropTypes from "prop-types"

export const TableFindUsers = ({
    data = [],
    setOpenModal,
    isLoading,
    columns = []
}) => {
    return (
        <div className="grid grid-cols-1 max-h-[34rem] overflow-y-auto">
            <TableContainerClients
                data={data}
                setOpenModal={setOpenModal}
                isLoading={isLoading}
                columns={columns}
            />
        </div>
    )
}

TableFindUsers.propTypes = {
    data: PropTypes.array,
    setOpenModal: PropTypes.func,
    isLoading: PropTypes.bool,
    columns: PropTypes.array.isRequired
}
