import useApiMetaData from "@/hooks/useApiMetaData"
import PropTypes from "prop-types"
import { Link } from "react-router-dom"

const CellLink = ({ row }) => {
    const { urlRedirect } = useApiMetaData()
    const { name, schema_id = null, id = null } = row.original
    return (
        <Link
            to={`${urlRedirect}/${schema_id ?? id}`}
            className="text-blue-800 font-semibold underline-offset-4 hover:underline"
        >
            {name}
        </Link>
    )
}

CellLink.propTypes = {
    row: PropTypes.object.isRequired,
    accessorKey: PropTypes.string.isRequired
}

export default CellLink
