import { Redirect, useGlobalSearchParams } from "expo-router";

/**
 * Catch-all for links that don't resolve to a route. If the URL carries a
 * Google sign-in code (the habitflow://google-auth redirect can land here
 * on scheme/host parsing quirks or stale route tables), forward it to the
 * real handler instead of dead-ending the sign-in; everything else goes
 * home, where the AuthGate routes signed-out users to /login.
 */
export default function NotFound() {
    const { code } = useGlobalSearchParams<{ code?: string }>();
    const c = Array.isArray(code) ? code[0] : code;
    if (c) {
        return (
            <Redirect
                href={{ pathname: "/google-auth", params: { code: c } }}
            />
        );
    }
    return <Redirect href="/" />;
}
