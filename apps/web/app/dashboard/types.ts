export type Habit = {
    id: number;
    name: string;
    goal: number;
};

export type HabitWithStats = Habit & {
    completed: number;
    left: number;
    percent: number;
};

export type HabitLog = {
    habitId: number;
    day: number;
    completed: boolean;
};
