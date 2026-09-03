export type Tod = "morning" | "afternoon" | "evening" | "anytime";

export type ApiHabitLog = {
    id: string;
    habitId: string;
    userId: string;
    year: number;
    month: number;
    day: number;
    /** How much was done. Absent in cache written before quantities: means 1. */
    amount?: number;
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
    /** Daily target amount; null or absent is a binary done/not-done habit. */
    target?: number | null;
    unit?: string | null;
    step?: number;
    daysOfWeek?: number[];
    archivedAt?: string | null;
    userId: string;
    createdAt: string;
    updatedAt: string;
    logs: ApiHabitLog[];
};

/** GET /notes — one free-text reflection per calendar day. */
export type ApiDayNote = {
    id: string;
    userId: string;
    year: number;
    month: number;
    day: number;
    text: string;
    createdAt: string;
    updatedAt: string;
};

export type HabitWithStats = {
    id: string;
    name: string;
    goal: number;
    icon: string;
    tod: Tod;
    verb: string | null;
    /** Daily target amount; null for a binary done/not-done habit. */
    target: number | null;
    unit: string | null;
    /** How much one tap adds. */
    step: number;
    /** How much is logged today, 0 when nothing is. */
    todayAmount: number;
    /** Normalized schedule: weekday numbers, or empty for daily. */
    daysOfWeek: number[];
    archivedAt: string | null;
    /** False on days this habit isn't scheduled for. */
    scheduledToday: boolean;
    completed: number;
    left: number;
    percent: number;
    streak: number;
    best: number;
    rate: number;
    doneToday: boolean;
};

export type UserRole = "USER" | "ADMIN";
export type AccountStatus = "PENDING" | "ACTIVE" | "SUSPENDED";

export type UserProfile = {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    role: UserRole;
    status: AccountStatus;
    createdAt: string;
};

export type FocusDayTotals = { sessions: number; minutes: number };

/** GET /focus/stats — dedication aggregates, anchored on the client's today. */
export type FocusStats = {
    today: FocusDayTotals;
    week: FocusDayTotals;
    allTime: FocusDayTotals & { days: number };
    streak: number;
    best: FocusDayTotals;
    /** Trailing 14 days, oldest first. */
    days: ({ date: string } & FocusDayTotals)[];
    /** Null habitId = sessions whose habit was since deleted. */
    byHabit: ({
        habitId: string | null;
        name: string;
        icon: string | null;
    } & FocusDayTotals)[];
};
