import {isOffline, runningTimersDiffer, withTimeout} from './connection';

const timer = (id: number, start: string) => ({id, start});

describe('runningTimersDiffer', () => {
    it('is false for equal sets regardless of order', () => {
        const a = [timer(1, 's1'), timer(2, 's2')];
        const b = [timer(2, 's2'), timer(1, 's1')];
        expect(runningTimersDiffer(a, b)).toBe(false);
    });

    it('is true when a timer was stopped (removed)', () => {
        expect(runningTimersDiffer([timer(1, 's1')], [timer(1, 's1'), timer(2, 's2')])).toBe(true);
    });

    it('is true when a timer was started elsewhere (added)', () => {
        expect(runningTimersDiffer([timer(1, 's1'), timer(3, 's3')], [timer(1, 's1')])).toBe(true);
    });

    it('is true when a timer start changed (edited)', () => {
        expect(runningTimersDiffer([timer(1, 's1new')], [timer(1, 's1')])).toBe(true);
    });

    it('is false for two empty sets', () => {
        expect(runningTimersDiffer([], [])).toBe(false);
    });
});

describe('isOffline', () => {
    it('is true for a network error', () => {
        expect(isOffline({networkError: new Error('down')})).toBe(true);
    });
    it('is true for a timeout', () => {
        expect(isOffline({timeout: true})).toBe(true);
    });
    it('is false for a graphQL error (server answered)', () => {
        expect(isOffline({})).toBe(false);
    });
});

describe('withTimeout', () => {
    it('resolves when the promise settles in time', async () => {
        await expect(withTimeout(Promise.resolve('ok'), 50)).resolves.toBe('ok');
    });
    it('rejects with a timeout marker when too slow', async () => {
        const never = new Promise((resolve) => setTimeout(resolve, 100));
        await expect(withTimeout(never, 10)).rejects.toEqual({timeout: true});
    });
});
