import {formatDuration} from './durationFormat';
import {DurationFormat} from '../gql/__generated__/globalTypes';

const H = 3600;
const longSpan = 225 * H; // 9d 9h
const shortSpan = 1 * H + 30 * 60; // 1h 30m
const messySpan = 9 * 86400 + 23 * H + 2 * 60 + 36; // 9d 23h 2m 36s

describe('formatDuration', () => {
    it('DaysHours delegates to pretty-ms; legacy unitCount reproduces the old list output', () => {
        // dashboard called pretty-ms with all units (no legacy options)
        expect(formatDuration(messySpan, DurationFormat.DaysHours, '')).toBe('9d 23h 2m 36s');
        // list view passed unitCount: 2, truncating to the largest two units
        expect(formatDuration(messySpan, DurationFormat.DaysHours, '', {unitCount: 2})).toBe('9d 23h');
        expect(formatDuration(longSpan, DurationFormat.DaysHours, '', {unitCount: 2})).toBe('9d 9h');
        expect(formatDuration(shortSpan, DurationFormat.DaysHours, '')).toBe('1h 30m');
    });

    it('HHMM always renders total hours and zero-padded minutes', () => {
        expect(formatDuration(longSpan, DurationFormat.HHMM, '')).toBe('225:00');
        expect(formatDuration(shortSpan, DurationFormat.HHMM, '')).toBe('1:30');
        expect(formatDuration(messySpan, DurationFormat.HHMM, '')).toBe('239:02');
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

    it('withSeconds surfaces seconds in the presets that have a seconds slot (running timers)', () => {
        // DaysHours: allow a third unit so seconds show and the tick is visible
        expect(formatDuration(shortSpan + 23, DurationFormat.DaysHours, '', {unitCount: 2, withSeconds: true})).toBe('1h 30m 23s');
        expect(formatDuration(45 * 60 + 9, DurationFormat.DaysHours, '', {unitCount: 2, withSeconds: true})).toBe('45m 9s');
        // HHMM gains a seconds field
        expect(formatDuration(shortSpan + 23, DurationFormat.HHMM, '', {withSeconds: true})).toBe('1:30:23');
        // GoStyle appends seconds
        expect(formatDuration(shortSpan + 23, DurationFormat.GoStyle, '', {withSeconds: true})).toBe('1h30m23s');
        // Decimal and user-authored Custom patterns are left untouched
        expect(formatDuration(shortSpan + 23, DurationFormat.DecimalHours, '', {withSeconds: true})).toBe('1.51h');
        expect(formatDuration(shortSpan + 23, DurationFormat.CustomStrftime, '%H:%M', {withSeconds: true})).toBe('1:30');
    });

    it('clamps negative input to zero', () => {
        expect(formatDuration(-5, DurationFormat.HHMM, '')).toBe('0:00');
    });
});
