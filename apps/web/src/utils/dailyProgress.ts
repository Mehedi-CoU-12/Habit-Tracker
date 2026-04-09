export function calculateDailyProgress(
    logs: { habitId: string; day: number; completed: boolean }[],
    totalHabits: number,
    daysInMonth = 31,
) {
    return Array.from({ length: daysInMonth }, (_, i) => {
        const day = i + 1;
        const completed = logs.filter((l) => l.day === day && l.completed).length;
        return {
            day,
            percent: totalHabits === 0 ? 0 : Math.round((completed / totalHabits) * 100),
        };
    });
}
