import { CasesManagement } from "./components/CasesManagement/CasesManagement";
import { TabsClientContainer } from "./components/TabsClientContainer/TabsClientContainer";
import { AgentProvider } from "./context/AgentContext";

const AgentContent = () => {
    return (
        <div className="flex flex-col overflow-auto gap-2 h-full">
            <TabsClientContainer />
            <CasesManagement />
        </div>
    );
};

const Agent = () => {
    return (
        <AgentProvider>
            <AgentContent />
        </AgentProvider>
    );
};

export default Agent;
