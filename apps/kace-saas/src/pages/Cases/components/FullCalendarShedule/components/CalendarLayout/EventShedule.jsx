import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger
} from "../../../../../../components/ui-shared"

export function EventShedule (info) {
    const getHoursMinutes = (date) =>
        `${String(date?.getHours()).padStart(2, "0")}:${String(date?.getMinutes()).padStart(2, "0")}`

    const isHoliday = info.event.extendedProps?.holiday
    const isNotMonthView = info.view.type !== "dayGridMonth"

    let timeText

    if (isHoliday) {
        timeText = info.event.title
    } else if (isNotMonthView) {
        timeText = info.timeText
    } else {
        const startTime = getHoursMinutes(info.event.start)
        const endTime = getHoursMinutes(info.event.end)
        timeText = `${startTime} - ${endTime}`
    }

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className="flex items-center space-x-1 w-full max-w-full overflow-hidden">
                        <div
                            className={`${info.event.backgroundColor ? "bg-red-500" : "bg-blue-500"} w-1.5 h-1.5 rounded-full`}
                        ></div>
                        <b className="truncate">{timeText}</b>
                    </div>
                </TooltipTrigger>
                <TooltipContent>
                    <p>{timeText}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}
