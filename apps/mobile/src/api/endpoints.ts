import { apiDelete, apiGet, apiPost } from "./client";
import { ApiHabit, UserProfile } from "../lib/types";

// ── Auth ──────────────────────────────────────────────────────────────
export type AuthResult = {
    accessToken: string;
    user: { id: string; name: string; email: string };
};

export function login(email: string, password: string) {
    return apiPost<AuthResult>("/auth/login", { email, password });
}

export function signup(name: string, email: string, password: string) {
    return apiPost<AuthResult>("/auth/signup", { name, email, password });
}

export function fetchMe() {
    return apiGet<UserProfile>("/users/me");
}

// ── Habits ────────────────────────────────────────────────────────────
export function fetchHabits(year: number, month: number) {
    return apiGet<ApiHabit[]>(`/habits?year=${year}&month=${month}`);
}

export function createHabit(input: {
    name: string;
    goal: number;
    icon?: string;
    tod?: string;
    verb?: string;
}) {
    return apiPost<ApiHabit>("/habits", input);
}

export function deleteHabit(id: string) {
    return apiDelete<void>(`/habits/${id}`);
}

export function toggleLog(
    habitId: string,
    year: number,
    month: number,
    day: number,
) {
    return apiPost<{ completed: boolean }>("/habits/logs/toggle", {
        habitId,
        year,
        month,
        day,
    });
}

export function applyTemplate(templateId: string) {
    return apiPost<{ created: number }>("/habits/apply-template", {
        templateId,
    });
}
