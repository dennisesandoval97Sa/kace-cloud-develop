import { Button, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@kace/ui-shared";
import { PropTypes } from "prop-types";
import { useTranslation } from "react-i18next";
import { Trash2, ChevronUp, ChevronDown } from "lucide-react";

/**
 * AuxiliariesTable - Displays and manages a table of auxiliary items with reorder capabilities
 *
 * Shows a list of selected auxiliary items with controls to:
 * - Move items up/down to change their order
 * - Delete items from the list
 *
 * Returns null if the list is empty (no table rendered).
 *
 * @component
 * @param {Object} props - Component properties
 * @param {Array<Object>} props.auxiliariesList - Array of auxiliary items to display
 * @param {string} props.auxiliariesList[].id - Unique identifier for the auxiliary
 * @param {string} props.auxiliariesList[].name - Display name of the auxiliary
 * @param {number} props.auxiliariesList[].order - Order number for sorting
 * @param {Function} props.onMoveUp - Callback when moving item up (receives index)
 * @param {Function} props.onMoveDown - Callback when moving item down (receives index)
 * @param {Function} props.onDelete - Callback when deleting item (receives index)
 * @returns {JSX.Element|null} Table with auxiliary items or null if empty
 */
export const AuxiliariesTable = ({ auxiliariesList, onMoveUp, onMoveDown, onDelete }) => {
    const { t } = useTranslation();

    // Don't render anything if list is empty
    if (!auxiliariesList || auxiliariesList.length === 0) {
        return null;
    }

    return (
        <div className="w-full my-4">
            <div className="border rounded-lg overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[50%]">{t("gridMain.columns.Record")}</TableHead>
                            <TableHead className="w-[20%]">{t("gridMain.columns.Order")}</TableHead>
                            <TableHead className="w-[30%] text-center">{t("gridMain.actions.actions")}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {auxiliariesList.map((auxiliary, index) => (
                            <TableRow key={auxiliary.id}>
                                <TableCell className="font-medium">{auxiliary.name}</TableCell>
                                <TableCell>{auxiliary.order}</TableCell>
                                <TableCell>
                                    <div className="flex justify-center gap-2">
                                        {/* Move Up button - disabled for first item */}
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => onMoveUp(index)}
                                            disabled={index === 0}
                                            title={t("gridMain.actions.moveUp")}
                                            className="h-8 w-8 p-0"
                                        >
                                            <ChevronUp className="h-4 w-4" />
                                        </Button>
                                        {/* Move Down button - disabled for last item */}
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => onMoveDown(index)}
                                            disabled={index === auxiliariesList.length - 1}
                                            title={t("gridMain.actions.moveDown")}
                                            className="h-8 w-8 p-0"
                                        >
                                            <ChevronDown className="h-4 w-4" />
                                        </Button>
                                        {/* Delete button */}
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => onDelete(index)}
                                            title={t("gridMain.actions.delete")}
                                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
};

AuxiliariesTable.propTypes = {
    auxiliariesList: PropTypes.arrayOf(
        PropTypes.shape({
            id: PropTypes.string.isRequired,
            name: PropTypes.string.isRequired,
            order: PropTypes.number.isRequired,
        }),
    ).isRequired,
    onMoveUp: PropTypes.func.isRequired,
    onMoveDown: PropTypes.func.isRequired,
    onDelete: PropTypes.func.isRequired,
};
