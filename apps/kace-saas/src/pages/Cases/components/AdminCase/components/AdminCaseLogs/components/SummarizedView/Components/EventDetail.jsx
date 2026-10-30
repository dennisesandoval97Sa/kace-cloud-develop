import PropTypes from "prop-types";
import EventListItem from "./EventListItem";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui-shared";

const EventDetail = ({ event }) => {
    return (
        <div className="grid grid-cols-2 xl:grid-cols-3 gap-1 ml-6">
            {event.fields.map((field, index) =>
                field.tooltip ? (
                    <TooltipProvider key={`event-field-${event.id}-${index}`}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div>
                                    <EventListItem name={field.name} value={field.value} truncate />
                                </div>
                            </TooltipTrigger>
                            <TooltipContent
                                data-testid="event-detail-tooltip"
                                className="max-h-64 overflow-y-auto max-w-[min(24rem,calc(100vw-2rem))]"
                            >
                                <p className="break-words whitespace-pre-wrap">{field.value}</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                ) : (
                    <EventListItem key={`event-field-${event.id}-${index}`} name={field.name} value={field.value} />
                ),
            )}
        </div>
    );
};

EventDetail.propTypes = {
    event: PropTypes.object.isRequired,
};

export default EventDetail;
