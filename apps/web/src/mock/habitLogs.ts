// Per-habit daily completion data for January 2026
// January 1 = Thursday, so weeks run Thu–Wed

const completionsByHabit: Record<number, number[]> = {
    // Morning Run  — goal 22, completed 16
    1:  [1,3,5,6,8,10,12,13,15,17,19,20,22,24,26,28],
    // Daily Bath   — goal 31, completed 31
    2:  [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31],
    // Go to Office — goal 22, completed 20
    3:  [2,5,6,7,8,9,12,13,14,15,16,19,20,21,22,23,26,27,28,29],
    // Japanese Study — goal 25, completed 18
    4:  [1,2,3,5,7,9,10,12,14,16,17,19,21,22,24,26,28,31],
    // Read 30 min  — goal 28, completed 19
    5:  [1,2,4,5,7,8,10,12,13,15,17,19,20,22,24,25,27,29,31],
    // Meditate     — goal 30, completed 25
    6:  [1,2,3,4,5,7,8,9,10,12,13,14,15,17,18,19,20,22,23,24,25,27,28,29,30],
    // Drink 2L Water — goal 31, completed 31
    7:  [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31],
    // No Social Media — goal 20, completed 12
    8:  [3,5,8,10,13,15,17,20,22,25,27,30],
    // Sleep by 11pm — goal 25, completed 19
    9:  [1,2,3,5,7,8,10,12,13,15,17,18,20,22,24,25,27,29,31],
    // Exercise     — goal 15, completed 9
    10: [3,7,10,14,17,21,24,28,31],
};

export const habitLogs = Object.entries(completionsByHabit).flatMap(
    ([habitId, days]) =>
        days.map((day) => ({
            habitId: Number(habitId),
            day,
            completed: true,
        })),
);
