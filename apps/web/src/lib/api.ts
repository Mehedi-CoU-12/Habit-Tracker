import { ApiHabit } from "../../app/dashboard/types";

export type UserProfile = {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    createdAt: string;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";

function authHeaders(): HeadersInit {
    const token =
        typeof window !== "undefined"
            ? localStorage.getItem("accessToken")
            : null;
    return {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
}

async function handleResponse<T>(res: Response): Promise<T> {
    if (res.status === 401) {
        if (typeof window !== "undefined") {
            const isAuthPage = ["/", "/login", "/signup"].includes(
                window.location.pathname,
            );
            if (!isAuthPage) {
                localStorage.removeItem("accessToken");
                window.location.href = "/login";
            }
        }
        throw new Error("Unauthorized");
    }
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
            (body as { message?: string }).message ?? "Request failed",
        );
    }
    return res.json() as Promise<T>;
}

export async function fetchMe(): Promise<UserProfile> {
    const res = await fetch(`${API_URL}/users/me`, { headers: authHeaders() });
    return handleResponse<UserProfile>(res);
}

export async function updateProfile(data: {
    name?: string;
    currentPassword?: string;
    newPassword?: string;
}): Promise<UserProfile> {
    const res = await fetch(`${API_URL}/users/me`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify(data),
    });
    return handleResponse<UserProfile>(res);
}

export async function uploadAvatar(file: File): Promise<UserProfile> {
    const token =
        typeof window !== "undefined"
            ? localStorage.getItem("accessToken")
            : null;
    const form = new FormData();
    form.append("avatar", file);
    const res = await fetch(`${API_URL}/users/me/avatar`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
    });
    return handleResponse<UserProfile>(res);
}

export async function fetchHabits(
    year: number,
    month: number,
): Promise<ApiHabit[]> {
    const res = await fetch(`${API_URL}/habits?year=${year}&month=${month}`, {
        headers: authHeaders(),
    });
    return handleResponse<ApiHabit[]>(res);
}

export async function createHabit(
    name: string,
    goal: number,
): Promise<ApiHabit> {
    const res = await fetch(`${API_URL}/habits`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ name, goal }),
    });
    return handleResponse<ApiHabit>(res);
}

export async function deleteHabit(id: string): Promise<void> {
    const res = await fetch(`${API_URL}/habits/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
    });
    return handleResponse<void>(res);
}

export async function applyTemplate(
    templateId: string,
): Promise<{ created: number }> {
    const res = await fetch(`${API_URL}/habits/apply-template`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ templateId }),
    });
    return handleResponse<{ created: number }>(res);
}

export async function toggleLog(
    habitId: string,
    year: number,
    month: number,
    day: number,
): Promise<{ completed: boolean }> {
    const res = await fetch(`${API_URL}/habits/logs/toggle`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ habitId, year, month, day }),
    });
    return handleResponse<{ completed: boolean }>(res);
}
