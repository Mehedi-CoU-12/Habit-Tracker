// January 2026 starts on a Thursday — weeks run Thu → Wed
const DAY_NAMES = ["Thu", "Fri", "Sat", "Sun", "Mon", "Tue", "Wed"];

export function calculateWeeklyProgress(
    logs: { habitId: number; day: number; completed: boolean }[],
    totalHabits: number,
) {
    return [1, 2, 3, 4, 5].map((week) => {
        const start = (week - 1) * 7 + 1;
        const end   = Math.min(week * 7, 31);
        const count = end - start + 1;

        const dayLabels = Array.from({ length: count }, (_, i) => DAY_NAMES[i] ?? "");

        const completed = logs.filter(
            (l) => l.day >= start && l.day <= end && l.completed,
        ).length;

        const goal = count * totalHabits;
        const left = goal - completed;
        const percent = goal === 0 ? 0 : Math.round((completed / goal) * 100);

        return { week: `W${week}`, days: count, dayLabels, completed, goal, left, percent };
    });
}
