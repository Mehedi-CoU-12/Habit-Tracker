import { AccountStatus } from "./types";

export function landingFor(result: {
    user: { status: AccountStatus };
    /** Only the Google exchange reports this. */
    isNew?: boolean;
}): "/" | "/pending" | "/onboarding" {
    if (result.user.status !== "ACTIVE") return "/pending";
    return result.isNew ? "/onboarding" : "/";
}
