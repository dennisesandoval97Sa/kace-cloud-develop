import PropTypes from "prop-types"
import { ICONS_SELECT } from "@/components/ui-shared/src/icons"

const CellIcon = ({ row, accessorKey }) => {
    const iconName = row.original[accessorKey]
    const iconData = ICONS_SELECT.find((icon) => icon.name === iconName)

    if (!iconData || !iconData.component) {
        return <p>{iconName}</p>
    }

    const IconComponent = iconData.component
    return <IconComponent className="h-6 w-6" />
}

CellIcon.propTypes = {
    row: PropTypes.object.isRequired,
    accessorKey: PropTypes.string.isRequired
}

export default CellIcon
