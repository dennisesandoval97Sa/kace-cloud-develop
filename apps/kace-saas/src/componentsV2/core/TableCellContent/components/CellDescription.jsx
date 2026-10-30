import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger
} from "@/components/ui-shared"
import PropTypes from "prop-types"

const CellDescription = ({ row }) => {
    const description = row.original.descripcion
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger>
                    <p className="w-48 truncate text-start">{description}</p>
                </TooltipTrigger>
                <TooltipContent>
                    <p className="max-w-80">{description}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}

CellDescription.propTypes = {
    row: PropTypes.object.isRequired,
    accessorKey: PropTypes.string.isRequired
}

export default CellDescription
