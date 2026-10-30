import PropTypes from "prop-types";
import { ChevronRight } from "lucide-react";
import { getClassificationLevelNumber } from "@/pages/Cases/components/CaseDataTable/utils/classificationLevels.util";

const CellClassificationRow = ({ classifications = [], bgColor = "" }) => {
    if (!classifications || classifications?.length === 0) {
        return null;
    }

    return (
        <div
            className="w-full flex items-center gap-3 pl-16 pr-4 py-2.5 bg-slate-50 border-t border-slate-200 animate-fade-in-smooth"
            style={bgColor ? { backgroundColor: bgColor } : undefined}
        >
            <div className="w-1 self-stretch rounded-full bg-greenCustom/50 shrink-0" />

            <div className="flex items-center gap-1 flex-wrap py-0.5">
                {classifications?.map((item, index) => {
                    const isFirst = index === 0;
                    const levelNum = getClassificationLevelNumber(item.id);

                    return (
                        <span key={item.id} className="flex items-center gap-1">
                            {index > 0 && <ChevronRight className="h-3 w-3 text-slate-300 shrink-0" />}
                            <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs border ${
                                    isFirst
                                        ? "bg-greenCustom/15 border-greenCustom/40 text-greenCustom font-semibold"
                                        : "bg-white border-slate-200 text-slate-500"
                                }`}
                            >
                                <span
                                    className={`text-[9px] font-bold rounded-full h-3.5 w-3.5 flex items-center justify-center shrink-0 ${
                                        isFirst ? "bg-greenCustom/20 text-greenCustom" : "bg-slate-100 text-slate-400"
                                    }`}
                                >
                                    {levelNum}
                                </span>
                                {item.label}
                            </span>
                        </span>
                    );
                })}
            </div>
        </div>
    );
};

CellClassificationRow.propTypes = {
    classifications: PropTypes.arrayOf(PropTypes.shape({ id: PropTypes.any, label: PropTypes.string }).isRequired),
    bgColor: PropTypes.string,
};

export default CellClassificationRow;
