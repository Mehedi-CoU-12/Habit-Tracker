import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { onlineManager, QueryClient } from "@tanstack/react-query";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";

onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => {
        setOnline(
            state.isConnected === true && state.isInternetReachable !== false,
        );
    }),
);

void NetInfo.fetch().then((state) => {
    onlineManager.setOnline(
        state.isConnected === true && state.isInternetReachable !== false,
    );
});

const WEEK = 1000 * 60 * 60 * 24 * 7;

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: { staleTime: 60 * 1000, gcTime: WEEK },
        // Writes are offline-first: every mutationFn here only touches the
        // query cache and the outbox, and the runSync it kicks off already
        // no-ops while offline. The library default ("online") never calls
        // mutationFn at all when disconnected — it parks the mutation as
        // paused — so checking off a habit offline did nothing: no optimistic
        // update, and nothing queued to sync later either. Anything that
        // genuinely needs the network opts back out (see useUploadAvatar).
        mutations: { networkMode: "always" },
    },
});

export const persister = createAsyncStoragePersister({
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
