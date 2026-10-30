import { CaseStatusCounter } from "@/components/ui-shared";
import { PropTypes } from "prop-types";
import { useTranslation } from "react-i18next";
import { useDispatch } from "react-redux";
import useUserInformation from "../../../hooks/useUserInformation";
import { setFilterCases } from "../../../redux/state/filterCases";

const getFilterByState = (state) => {
    const filtersByStates = {
        toOvercome: [
            {
                column: "ans_posicion",
                value: "2",
                type: "AND",
                operator: "eq",
            },
            {
                column: "fecha_resolucion",
                value: "null",
                type: "AND",
                operator: "null",
            },
        ],
        defeated: [
            {
                column: "ans_posicion",
                value: "3",
                type: "AND",
                operator: "eq",
            },
            {
                column: "fecha_resolucion",
                value: "null",
                type: "AND",
                operator: "null",
            },
        ],
        pending: [
            {
                column: "ans_posicion",
                value: "1",
                type: "AND",
                operator: "eq",
            },
            {
                column: "fecha_resolucion",
                value: "null",
                type: "AND",
                operator: "null",
            },
        ],
    };
    return filtersByStates[state];
};

const ansStates = [
    {
        key: "pending",
        idSuffix: "pending",
        color: "#2BA17A",
        label: "text.pending",
    },
    {
        key: "toOvercome",
        idSuffix: "to_overcome",
        color: "#E8C468",
        label: "text.toOvercome",
    },
    {
        key: "defeated",
        idSuffix: "defeated",
        color: "#E76E50",
        label: "text.defeated",
    },
];

export const AnsUser = ({ contadores = {} }) => {
    const dispatch = useDispatch();
    const { t } = useTranslation();
    const { user } = useUserInformation();
    const handleCaseFilter = (state) => {
        const defaultFilters = [
            {
                column: "responsable_id",
                value: user.id,
                type: "AND",
                operator: "eq",
            },
        ];
        dispatch(setFilterCases([...defaultFilters, ...getFilterByState(state)]));
    };
    return (
        <div
            className="flex max-w-full flex-nowrap items-center justify-start gap-0.5 sm:gap-1"
            id="ans_user_container"
            data-testid="ans_user_container"
        >
            {ansStates.map(({ key, idSuffix, color, label }) => {
                const count = Number(contadores?.ans?.[key]);
                const number = Number.isFinite(count) ? count : 0;
                const title = t(label);
                return (
                    <button
                        key={key}
                        type="button"
                        onClick={() => handleCaseFilter(key)}
                        id={`btn_ans_user_${idSuffix}`}
                        data-testid={`btn_ans_user_${idSuffix}`}
                        aria-label={`${title}: ${number}`}
                        className="min-w-0 shrink-0 cursor-pointer rounded-lg border-0 bg-transparent p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                        <span id={`ans_user_badge_${idSuffix}`} data-testid={`ans_user_badge_${idSuffix}`}>
                            <CaseStatusCounter compact title={title} number={number} color={color} />
                        </span>
                    </button>
                );
            })}
        </div>
    );
};

AnsUser.propTypes = {
    contadores: PropTypes.object,
};
