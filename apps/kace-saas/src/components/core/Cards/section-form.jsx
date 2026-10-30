import PropTypes from "prop-types";
import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@kace/ui-shared";
import { cn } from "../../ui-shared/src/lib/utils";
import { formatTestId } from "@/utils/src/helpers";

const SectionForm = ({
    children,
    title = "",
    className = "",
    isError = false,
    subTitle = null,
    subTitleAsTooltip = false,
    subTitleLabel = null,
    id = "",
    dataTestId = "",
}) => {
    return (
        <div
            id={`section_form_${id}`}
            data-testid={`section_form_${dataTestId}`}
            className={cn("bg-background p-4 shadow-md rounded-md flex flex-col gap-4", className)}
        >
            <div
                id={`section_form_header_${id}`}
                data-testid={`section_form_header_${dataTestId}`}
                className={`flex w-full justify-between ${isError && "text-redCustom"}`}
            >
                <div>
                    {subTitleAsTooltip ? (
                        <div className="flex items-center gap-1.5">
                            <h3
                                className="text-xl font-semibold"
                                id={formatTestId("section_form_title", `${title}`)}
                                data-testid={formatTestId("section_form_title", `${title}`)}
                            >
                                {title}
                            </h3>
                            {subTitle && (
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <button
                                            type="button"
                                            className="text-red-500 hover:text-red-600 focus:outline-none focus:ring-1 focus:ring-red-500 rounded-full"
                                            aria-label={subTitleLabel || title}
                                            id={formatTestId("section_form_subtitle_info", `${title}`)}
                                            data-testid={formatTestId("section_form_subtitle_info", `${title}`)}
                                        >
                                            <Info className="h-4 w-4" />
                                        </button>
                                    </PopoverTrigger>
                                    <PopoverContent
                                        align="start"
                                        side="bottom"
                                        className="w-72 bg-gray-900 text-white text-sm leading-relaxed border-gray-900"
                                        id={formatTestId("section_form_subtitle", `${title}`)}
                                        data-testid={formatTestId("section_form_subtitle", `${title}`)}
                                    >
                                        {subTitle}
                                    </PopoverContent>
                                </Popover>
                            )}
                        </div>
                    ) : (
                        <>
                            <h3
                                className="text-xl font-semibold"
                                id={formatTestId("section_form_title", `${title}`)}
                                data-testid={formatTestId("section_form_title", `${title}`)}
                            >
                                {title}
                            </h3>
                            {subTitle && (
                                <h3
                                    className="text-sm text-gray-400"
                                    id={formatTestId("section_form_subtitle", `${subTitle}`)}
                                    data-testid={formatTestId("section_form_subtitle", `${subTitle}`)}
                                >
                                    {subTitle}
                                </h3>
                            )}
                        </>
                    )}
                </div>
            </div>
            {children}
        </div>
    );
};

SectionForm.propTypes = {
    title: PropTypes.string,
    children: PropTypes.node,
    className: PropTypes.string,
    isError: PropTypes.bool,
    subTitle: PropTypes.string,
    subTitleAsTooltip: PropTypes.bool,
    subTitleLabel: PropTypes.string,
    id: PropTypes.string,
    dataTestId: PropTypes.string,
};

export default SectionForm;
