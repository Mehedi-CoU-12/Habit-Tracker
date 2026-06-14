export type Tod = "morning" | "afternoon" | "evening" | "anytime";

export type ApiHabitLog = {
    id: string;
    habitId: string;
    userId: string;
    year: number;
    month: number;
    day: number;
    createdAt: string;
};

/** Raw shape from GET /habits (matches the NestJS Habit model + icon/tod/verb). */
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

export type HabitWithStats = {
    id: string;
    name: string;
    goal: number;
    icon: string;
    tod: Tod;
    verb: string | null;
    completed: number;
    left: number;
    percent: number;
    streak: number;
    best: number;
    rate: number;
    doneToday: boolean;
};

export type UserProfile = {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    createdAt: string;
};
