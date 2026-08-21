export interface RunningKey {
    id: number;
    start: unknown;
}

const runningKeys = (timers: RunningKey[]): string[] => timers.map((t) => `${t.id}|${String(t.start)}`).sort();

// runningTimersDiffer reports whether the set of running timers reported by the
// server differs from what the UI currently has cached (added, removed or edited).
export const runningTimersDiffer = (server: RunningKey[], cached: RunningKey[]): boolean => {
    const a = runningKeys(server);
    const b = runningKeys(cached);
    if (a.length !== b.length) {
        return true;
    }
    return a.some((key, i) => key !== b[i]);
};

// pollError classifies a failed status poll: a network failure or timeout means
// we lost the connection; a GraphQL error (e.g. not logged in) means the server
// answered, so we are still online.
export const isOffline = (err: {networkError?: unknown; timeout?: boolean}): boolean =>
    Boolean(err && (err.timeout || err.networkError));

// withTimeout rejects with {timeout: true} if the promise does not settle in time.
export const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
    new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject({timeout: true}), ms);
        promise.then(
            (value) => {
                clearTimeout(timer);
                resolve(value);
            },
            (err) => {
                clearTimeout(timer);
                reject(err);
            }
        );
    });
