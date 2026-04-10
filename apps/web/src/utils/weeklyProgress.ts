import dayjs from "dayjs";

export function calculateWeeklyProgress(
    logs: { habitId: string; day: number; completed: boolean }[],
    totalHabits: number,
    year: number,
    month: number,
) {
    const firstDay = dayjs(`${year}-${String(month).padStart(2, "0")}-01`);
    const daysInMonth = firstDay.daysInMonth();
    const startDow = firstDay.day(); // 0=Sun…6=Sat
    const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    // Build all days with their weekday label
    const allDays = Array.from({ length: daysInMonth }, (_, i) => ({
        day: i + 1,
        label: WEEKDAYS[(startDow + i) % 7],
    }));

    // Chunk into groups of 7
    const chunks: (typeof allDays)[] = [];
    for (let i = 0; i < allDays.length; i += 7) {
        chunks.push(allDays.slice(i, i + 7));
    }

    return chunks.map((weekDays, idx) => {
        const start = weekDays[0]!.day;
        const end = weekDays[weekDays.length - 1]!.day;
        const completed = logs.filter(
            (l) => l.day >= start && l.day <= end && l.completed,
        ).length;
        const goal = weekDays.length * totalHabits;
        const left = goal - completed;
        const percent = goal === 0 ? 0 : Math.round((completed / goal) * 100);
        return {
            week: `W${idx + 1}`,
            days: weekDays.length,
            dayLabels: weekDays.map((d) => d.label ?? ""),
            completed,
            goal,
            left,
            percent,
        };
    });
}
