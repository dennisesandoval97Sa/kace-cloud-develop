import { CommentsForm } from "./components/AdminCaseCommentsForm";
import AdminCaseCommentsHistory from "./components/AdminCaseCommentsHistory";

const AdminCaseComments = () => {
    return (
        <div className="grid h-full min-h-0 min-w-0 w-full flex-1 grid-cols-2 gap-4 max-sm:grid-cols-1">
            <div className="col-span-1 flex min-h-0 min-w-0 flex-col overflow-auto rounded-md bg-background drop-shadow-md">
                <CommentsForm />
            </div>
            <AdminCaseCommentsHistory />
        </div>
    );
};

export default AdminCaseComments;
