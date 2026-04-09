export type Habit = {
    id: string;
    name: string;
    goal: number;
};

export type HabitWithStats = Habit & {
    completed: number;
    left: number;
    percent: number;
};

export type HabitLog = {
    habitId: string;
    day: number;
    completed: boolean;
};

// Raw shape returned by GET /habits
export type ApiHabit = {
    id: string;
    name: string;
    goal: number;
    userId: string;
    createdAt: string;
    updatedAt: string;
    logs: ApiHabitLog[];
};

export type ApiHabitLog = {
    id: string;
    habitId: string;
    userId: string;
    year: number;
    month: number;
    day: number;
    createdAt: string;
};
