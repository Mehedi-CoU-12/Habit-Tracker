import { ApiHabit } from "../../app/dashboard/types";

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

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";

// Identifies this app to the API's ClientGuard so requests aren't rejected as
// non-app traffic. Not a secret in any real sense (it ships in the browser
// bundle) — the JWT is the real authorization; this just blocks casual
// Postman/script calls.
const APP_CLIENT_KEY = process.env.NEXT_PUBLIC_APP_CLIENT_KEY ?? "";

function clientHeader(): Record<string, string> {
    return APP_CLIENT_KEY ? { "x-app-client": APP_CLIENT_KEY } : {};
}

function authHeaders(): HeadersInit {
    const token =
        typeof window !== "undefined"
            ? localStorage.getItem("accessToken")
            : null;
    return {
        "Content-Type": "application/json",
        ...clientHeader(),
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
        const { code } = body as { code?: string };
        // Account-gate 403s: the account exists but isn't ACTIVE — route to
        // the waiting screen. Deliberately not the 401 path: an expired
        // session (even a pending one) still belongs on /login.
        if (
            res.status === 403 &&
            (code === "ACCOUNT_PENDING" || code === "ACCOUNT_SUSPENDED") &&
            typeof window !== "undefined" &&
            window.location.pathname !== "/pending"
        ) {
            window.location.href = "/pending";
        }
        const raw = (body as { message?: string | string[] }).message;
        // NestJS ValidationPipe returns `message` as an array of strings.
        const message = Array.isArray(raw) ? raw.join(", ") : raw;
        throw new Error(message ?? "Request failed");
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
        headers: {
            ...clientHeader(),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
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

export type CreateHabitInput = {
    name: string;
    goal: number;
    icon?: string;
    tod?: string;
    verb?: string;
};

export async function createHabit(input: CreateHabitInput): Promise<ApiHabit> {
    const res = await fetch(`${API_URL}/habits`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(input),
    });
    return handleResponse<ApiHabit>(res);
}

export type UpdateHabitInput = Partial<CreateHabitInput>;

export async function updateHabit(
    id: string,
    input: UpdateHabitInput,
): Promise<ApiHabit> {
    const res = await fetch(`${API_URL}/habits/${id}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify(input),
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

// ── Admin (all endpoints require role ADMIN — enforced by the API) ──────

export type AdminStats = {
    totalUsers: number;
    usersByStatus: Record<AccountStatus, number>;
    totalHabits: number;
    logsToday: number;
    activeUsersToday: number;
    signupsLast7Days: { date: string; count: number }[];
};

export type AdminUserRow = {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    role: UserRole;
    status: AccountStatus;
    createdAt: string;
    habitCount: number;
    lastActiveAt: string | null;
    totalPaid: number;
};

export type AdminPayment = {
    id: string;
    userId: string;
    amount: number;
    currency: string;
    method: string;
    note: string | null;
    recordedById: string;
    createdAt: string;
};

export type AdminUserDetail = AdminUserRow & {
    statusChangedAt: string | null;
    statusChangedBy: string | null;
    statusNote: string | null;
    payments: AdminPayment[];
};

export type AdminUsersFilter = {
    status?: AccountStatus;
    search?: string;
    page?: number;
    pageSize?: number;
};

export type AdminUsersPage = {
    items: AdminUserRow[];
    total: number;
    page: number;
    pageSize: number;
};

export async function fetchAdminStats(): Promise<AdminStats> {
    const res = await fetch(`${API_URL}/admin/stats`, {
        headers: authHeaders(),
    });
    return handleResponse<AdminStats>(res);
}

export async function fetchAdminUsers(
    filter: AdminUsersFilter,
): Promise<AdminUsersPage> {
    const params = new URLSearchParams();
    if (filter.status) params.set("status", filter.status);
    if (filter.search) params.set("search", filter.search);
    if (filter.page) params.set("page", String(filter.page));
    if (filter.pageSize) params.set("pageSize", String(filter.pageSize));
    const qs = params.toString();
    const res = await fetch(`${API_URL}/admin/users${qs ? `?${qs}` : ""}`, {
        headers: authHeaders(),
    });
    return handleResponse<AdminUsersPage>(res);
}

export async function fetchAdminUser(id: string): Promise<AdminUserDetail> {
    const res = await fetch(`${API_URL}/admin/users/${id}`, {
        headers: authHeaders(),
    });
    return handleResponse<AdminUserDetail>(res);
}

// Same payload shape as GET /habits, so the admin progress view reuses the
// dashboard's deriveStats + chart components unchanged.
export async function fetchAdminUserHabits(
    id: string,
    year: number,
    month: number,
): Promise<ApiHabit[]> {
    const res = await fetch(
        `${API_URL}/admin/users/${id}/habits?year=${year}&month=${month}`,
        { headers: authHeaders() },
    );
    return handleResponse<ApiHabit[]>(res);
}

export async function updateAdminUserStatus(
    id: string,
    status: AccountStatus,
    note?: string,
): Promise<AdminUserRow> {
    const res = await fetch(`${API_URL}/admin/users/${id}/status`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ status, ...(note ? { note } : {}) }),
    });
    return handleResponse<AdminUserRow>(res);
}

export async function recordAdminPayment(
    id: string,
    amount: number,
    note?: string,
): Promise<AdminPayment> {
    const res = await fetch(`${API_URL}/admin/users/${id}/payments`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ amount, ...(note ? { note } : {}) }),
    });
    return handleResponse<AdminPayment>(res);
}

export async function deleteAdminUser(
    id: string,
): Promise<{ id: string; deleted: boolean }> {
    const res = await fetch(`${API_URL}/admin/users/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
    });
    return handleResponse<{ id: string; deleted: boolean }>(res);
}
