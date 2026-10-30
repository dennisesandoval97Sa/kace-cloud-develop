import { DashboardSectionCard } from "@/components/core/Cards/DashboardSectionCard";
import ChannelHubHandler from "./ChannelHubHandler";

const ChannelHub = () => {
    return (
        <DashboardSectionCard title="channelHub.title">
            <ChannelHubHandler />
        </DashboardSectionCard>
    );
};

export default ChannelHub;
