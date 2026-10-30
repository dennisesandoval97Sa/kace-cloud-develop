import { FREQUENCY_OPTIONS } from "../data/constants.jsx";

const useSimpleCrontab = () => {
    return (crontabStr) => {
        const crontabParts = crontabStr?.trim()?.split(/\s+/);
        if (crontabParts.length !== 5) return false;

        const [minute, hour, day, month, weekdays] = crontabParts;

        const expandRanges = (rangeStr) => {
            if (rangeStr.includes("-")) {
                const [start, end] = rangeStr.split("-").map(Number);
                return Array.from(
                    { length: end - start + 1 },
                    (_, i) => start + i,
                ).join(",");
            }
            return rangeStr;
        };

        let validWeekdays = weekdays.replace("*", "1,2,3,4,5,6,7");
        if (validWeekdays.includes("-")) {
            validWeekdays = validWeekdays.split(",").map(expandRanges).join(",");
        }

        if (!/^([1-7])(,[1-7])*$/.test(validWeekdays)) return false;

        for (const freq of FREQUENCY_OPTIONS) {
            const [f_min, f_hour, f_day, f_month] = freq.cron.split(" ");
            if (
                minute === f_min &&
                hour === f_hour &&
                day === f_day &&
                month === f_month
            ) {
                return [freq, validWeekdays];
            }
        }

        return ["custom", validWeekdays];
    };
};

export default useSimpleCrontab;
