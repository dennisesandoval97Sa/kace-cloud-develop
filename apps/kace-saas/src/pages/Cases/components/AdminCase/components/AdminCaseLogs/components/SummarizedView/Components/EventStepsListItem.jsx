import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import EventListItem from "./EventListItem";

const isMetadataStep = (step) => {
    const stepType = step.step_type?.toLowerCase();
    const type = step.type?.toLowerCase();
    const isConsumption = stepType === "consumption" || type === "consumption";
    const isMapProperty = !!step.metadata?.map_property;
    return (isConsumption || isMapProperty) && !!step.metadata;
};

const EventStepsListItem = ({ step, onViewMetadata }) => {
    const { t } = useTranslation();

    const stepResult = step.error
        ? t("event_logs.actionFailure")
        : t("event_logs.actionSuccess");

    const hasMetadata = isMetadataStep(step);

    const handleViewDetails = () => {
        if (onViewMetadata && step.metadata) {
            onViewMetadata(step.metadata);
        }
    };

    return (
        <div className="flex flex-col">
            <div className="flex items-center">
                <div className={`rounded-full w-2 h-2 border mr-2 bg-${step.error ? "red" : "green"}-600`} />
                <div className="flex-1">
                    <div className="grid grid-cols-2 border-gray-200 border-b last:border-b-0 items-center">
                        <EventListItem
                            name={t("event_logs.restflowName")}
                            value={step.description}
                        />
                        <EventListItem
                            name={t("event_logs.result")}
                            value={stepResult}
                        />
                        <div className="flex gap-1 text-sm text-gray-700">
                            <b>{t("event_logs.step_type")}: </b>
                            <span>{t(`event_logs.${step.step_type}`)}</span>
                            {hasMetadata && (
                                <>
                                    <span>-</span>
                                    <button
                                        className="text-blue-600 hover:text-blue-800 hover:underline"
                                        onClick={handleViewDetails}
                                        type="button"
                                    >
                                        {t("event_logs.viewDetails")}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

EventStepsListItem.propTypes = {
    step: PropTypes.object.isRequired,
    onViewMetadata: PropTypes.func.isRequired,
};

export default EventStepsListItem;
