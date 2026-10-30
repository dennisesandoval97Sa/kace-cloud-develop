import { useState } from "react";
import UserAvatar from "./UserAvatar";
import { Settings } from "lucide-react";
import EventDetail from "./EventDetail";
import { Button } from "@/components/ui-shared";
import { useTranslation } from "react-i18next";
import EventCaseProperty from "./EventCaseProperty";
import { eventTypeDetails } from "../constants";
import EventListItem from "./EventListItem";
import EventStepsList from "./EventStepsList";
import PropTypes from "prop-types";

export const MAX_RENDER_DEPTH = 15;

const EventGroup = ({ group, showCaseBadge, caseLabelById, mainCaseId }) => {
    const { t, i18n } = useTranslation();
    const [isExpanded, setIsExpanded] = useState(false);
    const firstEvent = group?.events?.[0];
    if (!firstEvent) {
        return null;
    }

    const userName = group?.initiator?.name || "";
    const time = new Date(group.occurred_at).toLocaleTimeString(navigator?.language, {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        fractionalSecondDigits: 3,
    });
    const date = new Intl.DateTimeFormat(i18n.resolvedLanguage, {
        year: "numeric",
        month: "short",
        day: "numeric",
    }).format(new Date(group.occurred_at));

    const toggleDetails = () => {
        setIsExpanded((prev) => !prev);
    };

    const isSystem = userName === "System" || !userName?.trim()?.length;
    const details = eventTypeDetails[firstEvent.event_name] ?? eventTypeDetails.default;
    const Icon = details?.icon;
    const caseLabel = caseLabelById[firstEvent.case_id] || firstEvent.case_id;
    const isMainCaseBadge = firstEvent.case_id === mainCaseId;

    return (
        <div className="flex space-x-2 border-b pb-2 border-gray-200">
            <div className="flex-1">
                <div className="flex items-center">
                    {Icon ? <Icon className={`${details.color} flex-shrink-0`} size={20} /> : <div className="w-6" />}
                    <span className="font-semibold mx-2 flex-1">
                        {(eventTypeDetails[group.events[0].event_name] ?? eventTypeDetails.default).text(
                            group.events[0],
                        )}
                    </span>
                    {showCaseBadge && caseLabel && (
                        <span
                            className={`mr-2 rounded-full px-2 py-0.5 text-xs font-medium ${
                                isMainCaseBadge ? "bg-purple-300 text-purple-800" : "bg-blue-100 text-blue-700"
                            }`}
                        >
                            {caseLabel}
                        </span>
                    )}
                    <UserAvatar isSystem={isSystem} />
                    <p className="text-gray-800 flex-1 ml-1">{isSystem ? "System" : userName}</p>
                    <div className="flex flex-col items-center shrink-0 whitespace-nowrap">
                        <p className="text-sm text-gray-500">{date}</p>
                        <p className="text-sm text-gray-500">{time}</p>
                    </div>
                </div>
                {group.summary && (
                    <div className="mt-1">
                        {(group.event_name === "case.updated" || group.event_name === "aux-cases.updated") && (
                            <>
                                <div className="flex">
                                    <Button variant="link" size="xs" onClick={toggleDetails}>
                                        {t(`event_logs.${isExpanded ? "hide" : "view"}Details`)}
                                    </Button>
                                </div>
                                {isExpanded && (
                                    <div className="mt-2 pl-4 border-l-2 border-gray-200 space-y-1">
                                        <ul className="list-none">
                                            {group.data
                                                ?.filter((prop) => prop.newValue !== prop.previousValue)
                                                .map((prop, propIndex) => (
                                                    <EventCaseProperty
                                                        key={propIndex}
                                                        prop={prop}
                                                        propIndex={propIndex}
                                                    />
                                                ))}
                                        </ul>
                                    </div>
                                )}
                            </>
                        )}
                        {(group.event_name === "case.created" || group.event_name === "aux-cases.created") && (
                            <>
                                <div className="flex">
                                    <Button variant="link" size="xs" onClick={toggleDetails}>
                                        {t(`event_logs.${isExpanded ? "hide" : "view"}Details`)}
                                    </Button>
                                </div>
                                {isExpanded && (
                                    <div className="mt-2 pl-4 border-l-2 border-gray-200 space-y-1">
                                        <ul className="list-none">
                                            {group.data
                                                ?.filter(
                                                    (prop) =>
                                                        prop.newValue !== prop.previousValue &&
                                                        prop.newValue !== undefined,
                                                )
                                                .map((prop, propIndex) => (
                                                    <EventCaseProperty
                                                        key={propIndex}
                                                        prop={prop}
                                                        propIndex={propIndex}
                                                    />
                                                ))}
                                        </ul>
                                    </div>
                                )}
                            </>
                        )}
                        {group.event_name === "ws-rest-flows.executed" && (
                            <>
                                <div className="flex">
                                    <div className="flex flex-1 items-center space-x-2">
                                        <Settings className="text-gray-500" size={16} />
                                        <div>
                                            <div className="grid grid-cols-2 gap-1 text-sm">
                                                <EventListItem
                                                    name={t("event_logs.actionTrigger")}
                                                    value={t(
                                                        `event_logs.${group?.events?.[0]?.body?.trigger}`,
                                                        group?.events?.[0]?.body?.trigger,
                                                    )}
                                                />
                                                <EventListItem
                                                    name={t("event_logs.result")}
                                                    value={
                                                        group?.events?.[0]?.body?.execution_status === "success"
                                                            ? t("event_logs.actionSuccess")
                                                            : t("event_logs.actionFailure")
                                                    }
                                                />
                                                <EventListItem
                                                    name={t("event_logs.restflowName")}
                                                    value={
                                                        group?.events?.[0]?.body?.flow?.description ??
                                                        t("event_logs.stateUnknown")
                                                    }
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <Button variant="link" size="xs" onClick={toggleDetails}>
                                        {t(`event_logs.${isExpanded ? "hide" : "view"}Details`)}
                                    </Button>
                                </div>
                                {isExpanded && (
                                    <div className="mt-2 pl-4 border-l-2 border-gray-200 space-y-1">
                                        <div className="grid grid-cols-2">
                                            <EventListItem
                                                name={t("event_logs.endpoints")}
                                                value={
                                                    group?.events?.[0]?.body?.execution_summary?.endpoint_steps ?? "-"
                                                }
                                            />
                                            <EventListItem
                                                name={t("event_logs.functions")}
                                                value={
                                                    group?.events?.[0]?.body?.execution_summary?.function_steps ?? "-"
                                                }
                                            />
                                            <EventListItem
                                                name={t("event_logs.totalSteps")}
                                                value={group?.events?.[0]?.body?.total_steps ?? "-"}
                                            />
                                            <EventListItem
                                                name={t("event_logs.successfulSteps")}
                                                value={
                                                    group?.events?.[0]?.body?.execution_summary?.successful_steps ?? "-"
                                                }
                                            />
                                        </div>
                                        {group?.events?.[0]?.body?.steps_executed && (
                                            <>
                                                <hr />
                                                <b className="text-sm">{t("event_logs.executedSteps")}:</b>
                                                <EventStepsList
                                                    steps={group?.events?.[0]?.body?.steps_executed ?? "-"}
                                                />
                                            </>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                {group?.events[0]?.fields?.length && (
                    <div className="border-l-2 border-gray-200">
                        <EventDetail event={group.events[0]} />
                    </div>
                )}
            </div>
        </div>
    );
};

EventGroup.propTypes = {
    group: PropTypes.object.isRequired,
    showCaseBadge: PropTypes.bool,
    caseLabelById: PropTypes.object,
    mainCaseId: PropTypes.string,
};

EventGroup.defaultProps = {
    showCaseBadge: false,
    caseLabelById: {},
    mainCaseId: undefined,
};

export default EventGroup;
