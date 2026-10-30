import { useState } from "react";
import PropTypes from "prop-types";
import InteractionsWorkspaceTabs from "./components/InteractionsWorkspaceTabs";
import InteractionsDataTable from "./components/InteractionsDataTable";

export const InteractionsHandler = ({ actions = [] }) => {
    const [selectedWorkspace, setSelectedWorkspace] = useState(null);

    return (
        <div className="flex w-full flex-col gap-4">
            <InteractionsWorkspaceTabs selectedWorkspace={selectedWorkspace} onSelectWorkspace={setSelectedWorkspace} />
            <InteractionsDataTable actions={actions} selectedWorkspace={selectedWorkspace} />
        </div>
    );
};

InteractionsHandler.propTypes = {
    actions: PropTypes.array,
};

export default InteractionsHandler;
