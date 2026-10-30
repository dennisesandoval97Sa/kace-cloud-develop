import CellActions from "../components/CellActions";
import CellClassification from "../components/CellClassification";
import CellDefault from "../components/CellDefault";
import CellDate from "../components/CellDate";
import CellColor from "../components/CellColor";
import CellDescription from "../components/CellDescription";
import CellGroups from "../components/CellGroups";
import CellIcon from "../components/CellIcon";
import CellLevels from "../components/CellLevels";
import CellLink from "../components/CellLink";
import CellSheetErrors from "../components/CellSheetErrors";
import CellStatus from "../components/CellStatus";

export const CELL_COMPONENT_MAP = {
    actions: CellActions,
    clasificacion: CellClassification,
    default: CellDefault,
    date: CellDate,
    color: CellColor,
    descripcion: CellDescription,
    estado: CellStatus,
    groups: CellGroups,
    icon_class: CellIcon,
    nivel1: CellLevels,
    error_details: CellSheetErrors,
    status: CellStatus,
    is_active: CellStatus,
    can_start_sub_cases_flow: CellStatus,
    element: CellLink,
};
