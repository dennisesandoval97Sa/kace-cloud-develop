import useProcessAndGroupEvents from "../hooks/useProcessEventData";
import EventGroup from "./EventGroup";
import { useTranslation } from "react-i18next";
import PropTypes from "prop-types";
import { useRef, useCallback } from "react";

/**
 * Custom hook para encapsular la lógica del scroll infinito con IntersectionObserver
 */
const useInfiniteScroll = (isFetching, hasMore, onLoadMore) => {
    const observer = useRef();

    return useCallback(
        (node) => {
            if (isFetching) return;
            if (observer.current) observer.current.disconnect();

            observer.current = new IntersectionObserver((entries) => {
                if (entries[0].isIntersecting && hasMore) {
                    onLoadMore();
                }
            });

            if (node) observer.current.observe(node);
        },
        [isFetching, hasMore, onLoadMore],
    );
};

/**
 * Componente visual para separar los eventos por fecha
 */
const DateSeparator = ({ dateString }) => {
    const formattedDate = new Date(dateString).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
    });

    return (
        <div className="relative">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center">
                <span className="bg-white px-2 text-sm text-gray-500">{formattedDate}</span>
            </div>
        </div>
    );
};

DateSeparator.propTypes = {
    dateString: PropTypes.string.isRequired,
};

/**
 * Componente principal que renderiza el diario de actividad
 */
const ActivityJournal = ({ events, showCaseBadge, caseLabelById, mainCaseId, onLoadMore, hasMore, isFetching }) => {
    const { t } = useTranslation();
    const groupedEvents = useProcessAndGroupEvents(events);
    const lastElementRef = useInfiniteScroll(isFetching, hasMore, onLoadMore);

    if (!groupedEvents?.length) {
        return <h1 className="m-4">{t("event_logs.noEvents")}</h1>;
    }

    return (
        <div className="p-2 sm:p-6">
            <div className="space-y-4">
                {groupedEvents.map(([date, groups]) => (
                    <div key={date}>
                        <DateSeparator dateString={groups[0].occurred_at} />
                        <div className="mt-2 space-y-2">
                            {groups.map((group) => (
                                <EventGroup
                                    key={group.id}
                                    group={group}
                                    showCaseBadge={showCaseBadge}
                                    caseLabelById={caseLabelById}
                                    mainCaseId={mainCaseId}
                                />
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {hasMore && (
                <div ref={lastElementRef} className="mt-4 py-4 text-center text-sm text-gray-500">
                    {isFetching ? t("event_logs.loading") : ""}
                </div>
            )}
        </div>
    );
};

ActivityJournal.propTypes = {
    events: PropTypes.array.isRequired,
    showCaseBadge: PropTypes.bool,
    caseLabelById: PropTypes.object,
    mainCaseId: PropTypes.string,
    onLoadMore: PropTypes.func.isRequired,
    hasMore: PropTypes.bool.isRequired,
    isFetching: PropTypes.bool.isRequired,
};

ActivityJournal.defaultProps = {
    showCaseBadge: false,
    caseLabelById: {},
    mainCaseId: undefined,
};

export default ActivityJournal;
