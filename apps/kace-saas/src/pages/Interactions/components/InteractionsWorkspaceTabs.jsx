import { useTranslation } from "react-i18next";
import useGenericSearchQuery from "@/hooks/useGenericSearchQuery";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";
import { Mail, Inbox, Users, FileText, MessageSquare, Briefcase } from "lucide-react";
import { Button } from "@kace/ui-shared";
import PropTypes from "prop-types";
import { createSystemInboxWorkspaceExclusionFilter, excludeSystemInboxWorkspaces } from "@/utils/systemInboxWorkspace";

const getWorkspaceIcon = (tag) => {
    const iconMap = {
        email: Mail,
        inbox: Inbox,
        users: Users,
        documents: FileText,
        messages: MessageSquare,
        work: Briefcase,
    };

    const IconComponent = iconMap[tag?.toLowerCase()] || Inbox;
    return <IconComponent size={16} />;
};

const InteractionsWorkspaceTabs = ({ selectedWorkspace, onSelectWorkspace }) => {
    const { t } = useTranslation();

    const { data: workspaces = [], isLoading } = useGenericSearchQuery({
        url: `${URL_AND_KEYS.workspaces.url}/search`,
        keyQuery: URL_AND_KEYS.workspaces.key,
        select: (data) => excludeSystemInboxWorkspaces(data?.data || []),
        filter: [
            {
                field: "is_active",
                operator: "eq",
                value: "true",
                type: "AND",
            },
            createSystemInboxWorkspaceExclusionFilter(),
        ],
    });

    if (isLoading) {
        return (
            <div className="flex gap-2 overflow-x-auto pb-2">
                <div className="h-12 w-32 bg-gray-200 rounded-lg animate-pulse" />
                <div className="h-12 w-32 bg-gray-200 rounded-lg animate-pulse" />
                <div className="h-12 w-32 bg-gray-200 rounded-lg animate-pulse" />
            </div>
        );
    }

    return (
        <div className="flex gap-2 overflow-x-auto pb-2 border-b">
            <Button
                variant={selectedWorkspace === null ? "default" : "outline"}
                size="default"
                onClick={() => onSelectWorkspace(null)}
                className="gap-2 whitespace-nowrap"
            >
                <Inbox size={16} />
                <span className="font-medium">{t("interactions.title.allWorkspaces")}</span>
            </Button>

            {workspaces.map((workspace) => {
                return (
                    <Button
                        key={workspace.id}
                        variant={selectedWorkspace === workspace.id ? "default" : "outline"}
                        size="default"
                        onClick={() => onSelectWorkspace(workspace.id)}
                        className="gap-2 whitespace-nowrap"
                    >
                        {getWorkspaceIcon(workspace.tag)}
                        <span className="font-medium">{workspace.description}</span>
                    </Button>
                );
            })}
        </div>
    );
};

InteractionsWorkspaceTabs.propTypes = {
    selectedWorkspace: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    onSelectWorkspace: PropTypes.func.isRequired,
};

export default InteractionsWorkspaceTabs;
