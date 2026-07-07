import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { onlineManager, QueryClient } from "@tanstack/react-query";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";

// Feed React Native connectivity into React Query. React Query has no built-in
// way to detect online status on RN (its default relies on the browser's
// `navigator.onLine`), so without this it assumes it is always online and
// fires requests that immediately fail while offline. Wired up, queries
// triggered while offline stay `paused` instead of erroring, and resume
// automatically on reconnect. Registered once at module load; the inner
// listener's unsubscribe is returned so React Query can tear it down.
onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => {
        setOnline(!!state.isConnected);
    }),
);

// Keep queries around long enough to survive a cold start so they can be
// persisted to disk and rehydrated offline. gcTime must be >= the persister's
// maxAge or React Query would drop them before they're restored.
const WEEK = 1000 * 60 * 60 * 24 * 7;

/**
 * Module-scope QueryClient (previously created inside RootLayout) so
 * non-React code — the api client's central 401/403 handling — can reach the
 * cache. RootLayout passes this same instance to PersistQueryClientProvider.
 */
export const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: 60 * 1000, gcTime: WEEK } },
});

// Persist the query cache to AsyncStorage so the app opens with the last-known
// habits/logs while offline. Only successful queries are written; `buster`
// invalidates the whole cache when the shape changes.
const persister = createAsyncStoragePersister({
    storage: AsyncStorage,
    key: "habitflow.rq-cache.v1",
    throttleTime: 1000,
});

export const persistOptions = {
    persister,
    maxAge: WEEK,
    buster: "v1",
    dehydrateOptions: {
        shouldDehydrateQuery: (q: { state: { status: string } }) =>
            q.state.status === "success",
    },
};
