import CardsContainer from "./cards-container"
import ChartsContainer from "./charts-container"
import useDashboardHook from "./hooks/useDashboardHook"
import { TablesContainer } from "./SectionTables/TablesContainer"
import CardsContainerSkeleton from "./skeleton/cards-container-skeleton"
import ChartsContainerSkeleton from "./skeleton/charts-container-skeleton"

export const DashboardHandler = () => {
    const { casesStates, allStates, loadingAllStates, loadingTotalCases } =
        useDashboardHook()
    if (loadingTotalCases || loadingAllStates) {
        return (
            <div className="flex flex-col w-full gap-8">
                <CardsContainerSkeleton />
                <ChartsContainerSkeleton />
            </div>
        )
    }

    return (
        <div className="flex flex-grow flex-col gap-8">
            <CardsContainer casesStates={casesStates} />
            <ChartsContainer informationStates={allStates} />
            <TablesContainer />
        </div>
    )
}
