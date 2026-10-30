const useCrontabString = () => {
    return (frequency, selectedDays) => {
        const freqMap = {
            each_minute: { minute: "*", hour: "*" },
            every_5_minutes: { minute: "*/5", hour: "*" },
            every_10_minutes: { minute: "*/10", hour: "*" },
            every_30_minutes: { minute: "*/30", hour: "*" },
            every_hour: { minute: "0", hour: "*" },
            every_6_hours: { minute: "0", hour: "*/6" },
            every_12_hours: { minute: "0", hour: "*/12" },
            once_a_day: { minute: "0", hour: "0" },
        };

        const { minute, hour } = freqMap[frequency] || { minute: "*", hour: "*" };

        const daysOfWeek = selectedDays
            .map((enabled, i) => enabled ? ((i + 1) % 8) : null)
            .filter(day => day !== null);

        const dayOfWeekField = daysOfWeek.length === 7 ? "*" : daysOfWeek.join(",");

        return `${minute} ${hour} * * ${dayOfWeekField}`;
    };
};

export default useCrontabString;
