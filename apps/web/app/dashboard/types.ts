export type Tod = "morning" | "afternoon" | "evening" | "anytime";

export type Habit = {
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
    /** Minutes from a bound focus session fill this habit automatically. */
    fillFromFocus: boolean;
    /** Days of the shown month that are forgiven (streak insurance). */
    skippedDays: number[];
    /** Skips still available on this habit this month. */
    skipsLeft: number;
    /** How much is logged today, 0 when nothing is. */
    todayAmount: number;
    /** Weekdays it is due on, 0 = Sunday. Empty means every day. */
    daysOfWeek: number[];
    archivedAt: string | null;
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
    /** False on days this habit isn't scheduled for. */
    scheduledToday: boolean;
};

export type HabitLog = {
    habitId: string;
    day: number;
    completed: boolean;
    /** How much was logged that day. */
    amount: number;
};

// Raw shape returned by GET /habits
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
    /**
     * When true, a focus session bound to this habit has its minutes logged
     * server-side (FocusService.recordSession). The client must then NOT also
     * water the habit, or the day is written twice.
     */
    fillFromFocus?: boolean;
    /** Optional on the wire: absent for habits cached before scheduling. */
    daysOfWeek?: number[];
    archivedAt?: string | null;
    userId: string;
    createdAt: string;
    updatedAt: string;
    logs: ApiHabitLog[];
    /** This month's forgiven days. Absent in caches written before skips. */
    skips?: ApiHabitSkip[];
};

/** One deliberately forgiven day (streak insurance). */
export type ApiHabitSkip = {
    id: string;
    habitId: string;
    userId: string;
    year: number;
    month: number;
    day: number;
    createdAt: string;
};

export type ApiHabitLog = {
    id: string;
    habitId: string;
    userId: string;
    year: number;
    month: number;
    day: number;
    /** How much was done. Absent in data written before quantities: means 1. */
    amount?: number;
    createdAt: string;
};
