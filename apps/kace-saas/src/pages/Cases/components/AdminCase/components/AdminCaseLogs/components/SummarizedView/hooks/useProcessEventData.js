import { t } from "i18next";
import { eventTypeDetails } from "../constants";

const groupEventsByFlowId = (events, parentEvent) => {
    if (!events || events.length === 0) return [];

    return events.filter(
        (event) =>
            event.event_name === "ws-rest-workflow-steps.executed" &&
            event.body?.flow_id === parentEvent.body?.flow?.id,
    );
};

const strategies = {
    "ws-rest-flows.executed": (events, parentEvent) => {
        return [[parentEvent, ...groupEventsByFlowId(events, parentEvent)]];
    },
    default: (_events, currentEvent) => {
        return [[currentEvent]];
    },
};

const useProcessAndGroupEvents = (events) => {
    if (!events || events.length === 0) return [];

    const sortedEvents = [...events].sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at));

    const processedEvents = sortedEvents.reduce((acc, currentEvent) => {
        if (currentEvent.event_name === "ws-rest-workflow-steps.executed") {
            return acc;
        }

        const groupStrategy = strategies[currentEvent.event_name] || strategies["default"];
        const groups = groupStrategy(sortedEvents, currentEvent);

        groups.forEach((group) => {
            const firstEvent = group[0];

            const summary = {
                id: firstEvent.id,
                event_name: firstEvent.event_name,
                responsable: {
                    id: firstEvent.initiated_by_user,
                    name: [
                        firstEvent.body?.responsable?.nombres,
                        firstEvent.body?.responsable?.apellido1,
                        firstEvent.body?.responsable?.apellido2,
                    ]
                        .filter(Boolean)
                        .join(" "),
                },
                initiator: {
                    id: firstEvent.initiated_by_user,
                    name: [
                        firstEvent.body?.initiator?.nombres,
                        firstEvent.body?.initiator?.apellido1,
                        firstEvent.body?.initiator?.apellido2,
                    ]
                        .filter(Boolean)
                        .join(" "),
                },
                occurred_at: firstEvent.occurred_at,
                events: group,
            };

            if (firstEvent.event_name === "ws-rest-flows.executed") {
                summary.summary = {
                    message: t("event_logs.eventName.restflowExecuted", {
                        flow: firstEvent.body?.flow?.description ?? t("event_logs.stateUnknown"),
                    }),
                    steps: group.map((e) => ({
                        step_name: e.body?.restflow_name,
                        result: e.body?.result,
                    })),
                };
            } else if (firstEvent.event_name === "case.updated" || firstEvent.event_name === "aux-cases.updated") {
                summary.summary = {
                    message: t(
                        `event_logs.eventName.${firstEvent.event_name === "case.updated" ? "updated" : "auxUpdated"}`,
                    ),
                };
                summary.data = Object.keys(firstEvent.body)
                    .filter((key) => !["updated_at", "updated_by", "state_change_at", "initiator"].includes(key))
                    .map((prop) => ({
                        name: prop,
                        previousValue: firstEvent.old_data?.[prop],
                        newValue: firstEvent.body?.[prop],
                    }));
            } else if (firstEvent.event_name === "case.created" || firstEvent.event_name === "aux-cases.created") {
                summary.summary = {
                    message: t(
                        `event_logs.eventName.${firstEvent.event_name === "case.created" ? "created" : "auxCreated"}`,
                    ),
                };
                summary.data = Object.keys(firstEvent.body)
                    .filter((key) => !["created_at", "created_by", "state_change_at", "initiator"].includes(key))
                    .map((prop) => ({
                        name: prop,
                        previousValue: firstEvent.old_data?.[prop],
                        newValue: firstEvent.body?.[prop],
                    }));
            }

            const eventFields = eventTypeDetails[firstEvent.event_name]?.fields;
            if (!!eventFields) {
                firstEvent.fields = eventFields(firstEvent);
            }

            acc.push(summary);
        });

        return acc;
    }, []);

    const groupedByDate = processedEvents.reduce((acc, group) => {
        const date = new Date(group.occurred_at).toLocaleDateString("es-CO", {
            year: "numeric",
            month: "long",
            day: "numeric",
        });
        if (!acc[date]) {
            acc[date] = [];
        }
        acc[date].push(group);
        return acc;
    }, {});

    return Object.entries(groupedByDate).sort((a, b) => {
        const dateA = new Date(a[1][0].occurred_at);
        const dateB = new Date(b[1][0].occurred_at);
        return dateB - dateA;
    });
};

export default useProcessAndGroupEvents;
