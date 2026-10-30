import PropTypes from "prop-types";
import Button from "@kace_v2/shared/ui/atoms/Button";
import { getBoardContrastColor } from "@kace_v2/features/boards/utils/boardContrastColor.util";

const QuickAnsFilterButtons = ({
    quickAnsFilter = null,
    activeAnsValue = null,
    applyQuickAnsFilter,
    countByAns = null,
}) => {
    if (!quickAnsFilter) return null;

    const countMap = countByAns ? Object.fromEntries(countByAns.map(({ id, count }) => [id, count])) : null;

    return (
        <div className="flex items-center gap-1" data-testid="quick-ans-filter-buttons">
            {quickAnsFilter.buttons.map((button) => {
                const isActive = Number(activeAnsValue) === Number(button.value);
                return (
                    <Button
                        key={button.value}
                        variant="outline"
                        onClick={() => applyQuickAnsFilter(button.value)}
                        style={
                            isActive
                                ? {
                                      borderColor: button.color,
                                      backgroundColor: button.color,
                                      color: getBoardContrastColor(button.color),
                                      outline: `2px solid ${button.color}`,
                                      outlineOffset: "2px",
                                  }
                                : {
                                      borderColor: button.color,
                                      backgroundColor: `${button.color}33`,
                                      color: button.color,
                                  }
                        }
                    >
                        {button.label}
                        {countMap !== null && Number.isFinite(countMap[button.value]) && (
                            <span className="ml-1 font-semibold tabular-nums">({countMap[button.value]})</span>
                        )}
                    </Button>
                );
            })}
        </div>
    );
};

QuickAnsFilterButtons.propTypes = {
    quickAnsFilter: PropTypes.shape({
        field: PropTypes.string.isRequired,
        entity: PropTypes.string,
        buttons: PropTypes.arrayOf(
            PropTypes.shape({
                value: PropTypes.number.isRequired,
                label: PropTypes.string.isRequired,
                color: PropTypes.string.isRequired,
            }),
        ).isRequired,
    }),
    activeAnsValue: PropTypes.number,
    applyQuickAnsFilter: PropTypes.func.isRequired,
    countByAns: PropTypes.arrayOf(
        PropTypes.shape({
            id: PropTypes.number.isRequired,
            count: PropTypes.number.isRequired,
        }),
    ),
};

export default QuickAnsFilterButtons;
