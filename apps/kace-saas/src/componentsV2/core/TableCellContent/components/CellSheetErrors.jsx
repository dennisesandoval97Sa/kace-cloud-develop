import PropTypes from "prop-types";
import { SheetErrors } from "@/pages/ExportAndImportData/components/SheetErrors";
import { EmptyTableCell } from "../utils/emptyTableCell";

const hasErrors = (errorsDetails) => {
    if (!errorsDetails) return false;
    const { generalErrors = [], insertErrors = [] } = errorsDetails;
    return generalErrors.filter(Boolean).length > 0 || insertErrors.length > 0;
};

const CellSheetErrors = ({ row }) => {
    const errorsDetails = row.original.error_details;

    if (!hasErrors(errorsDetails)) {
        return <EmptyTableCell />;
    }

    return <SheetErrors errorsDetails={errorsDetails} file={row.original.file_path} />;
};

CellSheetErrors.propTypes = {
    row: PropTypes.object.isRequired,
};

export default CellSheetErrors;
