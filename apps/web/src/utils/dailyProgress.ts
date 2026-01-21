export function calculateDailyProgress(
    logs: { day: number; completed: number }[],
    totalHabits: number,
    daysInMonth = 31,
) {
    const map = new Map<number, number>();

    logs.forEach((l) => {
        map.set(l.day, l.completed);
    });

    return Array.from({ length: daysInMonth }, (_, i) => {
        const day = i + 1;
        const completed = map.get(day) ?? 0;

        return {
            day,
            percent: Math.round((completed / totalHabits) * 100),
        };
    });
}
