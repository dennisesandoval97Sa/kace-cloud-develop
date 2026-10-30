import { FullCalendarShedule } from "../../FullCalendarShedule/FullCalendarShedule";
import useAdminCaseParams from "../hooks/useAdminCaseParams";

const AdminCasesCalendar = () => {
    const { caseId, userId, isAdmin } = useAdminCaseParams();

    return (
        <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col">
            <FullCalendarShedule idCase={caseId} admin={isAdmin} clientId={userId} />
        </div>
    );
};
export default AdminCasesCalendar;
