import { Redirect, useGlobalSearchParams } from "expo-router";

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
