export type Tod = "morning" | "afternoon" | "evening" | "anytime";

export type Habit = {
    id: string;
    name: string;
    goal: number;
    icon: string;
    tod: Tod;
    verb: string | null;
};

export type HabitWithStats = Habit & {
    completed: number;
    left: number;
    percent: number;
    /* derived from completion logs */
    streak: number;
    best: number;
    rate: number;
    doneToday: boolean;
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
    icon: string;
    tod: string;
    verb: string | null;
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
