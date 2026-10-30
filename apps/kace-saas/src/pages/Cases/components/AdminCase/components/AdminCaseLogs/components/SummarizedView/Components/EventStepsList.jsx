import PropTypes from "prop-types";
import { useState } from "react";
import EventStepsListItem from "./EventStepsListItem";
import EventDetailsModal from "../../EventDetailsModal";

const EventStepsList = ({ steps }) => {
    const [selectedMetadata, setSelectedMetadata] = useState(null);

    const handleViewMetadata = (metadata) => {
        setSelectedMetadata(metadata);
    };

    const handleCloseModal = () => {
        setSelectedMetadata(null);
    };

    return (
        <>
            <div className="text-sm bg-gray-100 odd:bg-gray-50 my-2 p-2 rounded-md">
                {steps.map((step, index) => (
                    <EventStepsListItem
                        key={index}
                        step={step}
                        onViewMetadata={handleViewMetadata}
                    />
                ))}
            </div>
            <EventDetailsModal
                isOpen={!!selectedMetadata}
                onClose={handleCloseModal}
                eventData={{ body: selectedMetadata }}
            />
        </>
    );
};

EventStepsList.propTypes = {
    steps: PropTypes.array.isRequired,
};

export default EventStepsList;
