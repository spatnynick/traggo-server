import {formatDuration} from './durationFormat';
import {DurationFormat} from '../gql/__generated__/globalTypes';

const H = 3600;
const longSpan = 225 * H; // 9d 9h
const shortSpan = 1 * H + 30 * 60; // 1h 30m

describe('formatDuration', () => {
    it('DaysHours keeps the legacy two-unit output', () => {
        expect(formatDuration(longSpan, DurationFormat.DaysHours, '')).toBe('9d 9h');
        expect(formatDuration(shortSpan, DurationFormat.DaysHours, '')).toBe('1h 30m');
        expect(formatDuration(0, DurationFormat.DaysHours, '')).toBe('0m');
    });

    it('HHMM always renders total hours and zero-padded minutes', () => {
        expect(formatDuration(longSpan, DurationFormat.HHMM, '')).toBe('225:00');
        expect(formatDuration(shortSpan, DurationFormat.HHMM, '')).toBe('1:30');
    });

    it('DecimalHours renders fractional hours', () => {
        expect(formatDuration(longSpan, DurationFormat.DecimalHours, '')).toBe('225.00h');
        expect(formatDuration(shortSpan, DurationFormat.DecimalHours, '')).toBe('1.50h');
    });

    it('GoStyle renders total hours and minutes', () => {
        expect(formatDuration(longSpan, DurationFormat.GoStyle, '')).toBe('225h0m');
        expect(formatDuration(shortSpan, DurationFormat.GoStyle, '')).toBe('1h30m');
    });

    it('CustomStrftime replaces tokens', () => {
        expect(formatDuration(longSpan, DurationFormat.CustomStrftime, '%H:%M')).toBe('225:00');
        expect(formatDuration(longSpan, DurationFormat.CustomStrftime, '%dd %hh %Mm')).toBe('9d 09h 00m');
        expect(formatDuration(longSpan, DurationFormat.CustomStrftime, '100%% done')).toBe('100% done');
    });

    it('CustomGo renders the requested unit letters largest-first', () => {
        expect(formatDuration(longSpan, DurationFormat.CustomGo, 'dhm')).toBe('9d9h0m');
        expect(formatDuration(longSpan, DurationFormat.CustomGo, 'hm')).toBe('225h0m');
        expect(formatDuration(longSpan, DurationFormat.CustomGo, '')).toBe('225h0m0s');
    });

    it('clamps negative input to zero', () => {
        expect(formatDuration(-5, DurationFormat.HHMM, '')).toBe('0:00');
    });
});
