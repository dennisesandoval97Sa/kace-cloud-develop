import PropTypes from "prop-types";

const CellColor = ({ row, accessorKey }) => {
    const color = row.original[accessorKey] || "#000";

    return <div className="h-6 w-6 rounded-full" style={{ backgroundColor: color }} />;
};

CellColor.propTypes = {
    row: PropTypes.object.isRequired,
    accessorKey: PropTypes.string.isRequired,
};

export default CellColor;
