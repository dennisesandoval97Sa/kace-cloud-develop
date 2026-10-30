import { RegexPatterns } from "../utils/regex/RegexPatterns";

const useValidateCrontab = () => {
    return (cronString) => {
        if (typeof cronString !== "string" || !cronString.trim()) {
            return false;
        }

        const parts = cronString.trim().split(/\s+/);
        if (parts.length !== 5) {
            return false;
        }

        const regexPatterns = [
            RegexPatterns.minuteCrontab(),
            RegexPatterns.hourCrontab(),
            RegexPatterns.dayOfMonthCrontab(),
            RegexPatterns.monthCrontab(),
            RegexPatterns.dayOfWeekCrontab(),
        ];

        for (let i = 0; i < 5; i++) {
            if (!regexPatterns[i].test(parts[i])) {
                return false;
            }
        }

        return true;
    };
};

export default useValidateCrontab;
