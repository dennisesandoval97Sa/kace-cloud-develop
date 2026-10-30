import { PieChartDonut } from "@/components/ui-shared/src/components/charts/pie-chart-donut";
import AllStatesContainer from "./all-states-container";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";

const ChartsContainer = ({ informationStates = [] }) => {
    const { t } = useTranslation();
    const chartConfig = {
        visitors: {
            label: "Visitors",
        },
        ...informationStates.reduce((acc, state) => {
            acc[state.name] = {
                label: state.name,
                color: `hsl(${state.chartColor})`,
            };
            return acc;
        }, {}),
    };
    const chartData = informationStates.map((state) => ({
        label: state.name,
        total: state.total,
        fill: `hsl(${state.chartColor})`,
    }));

    return (
        <div className="flex flex-col gap-8">
            <h2 className="text-2xl font-semibold">{t("dashboard.charts.totalOpenCasesByState")}</h2>
            <div className="grid lg:flex gap-8 ">
                <div className="w-full h-auto">
                    <AllStatesContainer informationStates={informationStates} />
                </div>
                <div className="w-full h-auto">
                    <PieChartDonut
                        chartConfig={chartConfig}
                        chartData={chartData}
                        textFooterOne={t("dashboard.charts.textFooterOne")}
                        title={t("dashboard.charts.statesDistribution")}
                        description={new Date().toISOString().split("T")[0]}
                        textFooterTwo={t("dashboard.charts.textFooterTwo")}
                    />
                </div>
            </div>
        </div>
    );
};

ChartsContainer.propTypes = {
    informationStates: PropTypes.array,
};

export default ChartsContainer;
