// src/utils/weeklyProgress.ts
export function getWeek(day: number) {
    if (day <= 7) return 1;
    if (day <= 14) return 2;
    if (day <= 21) return 3;
    if (day <= 28) return 4;
    return 5;
}

export function calculateWeeklyProgress(
    logs: { day: number; completed: number }[],
    totalHabits: number,
) {
    const weeks = [1, 2, 3, 4, 5];

    return weeks.map((week) => {
        const weekLogs = logs.filter((l) => getWeek(l.day) === week);

        const completed = weekLogs.reduce((sum, l) => sum + l.completed, 0);

        const possible = weekLogs.length * totalHabits;

        return {
            week: `Week ${week}`,
            percent:
                possible === 0 ? 0 : Math.round((completed / possible) * 100),
        };
    });
}
