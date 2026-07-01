import prettyMs from 'pretty-ms';
import {DurationFormat} from '../gql/__generated__/globalTypes';
import {useSettings} from '../gql/settings';

const pad2 = (n: number): string => (n < 10 ? `0${n}` : `${n}`);

// Legacy pretty-ms options, passed by each call site so the default "Days + hours"
// preset reproduces the exact pre-existing output there (the list view truncated to
// two units, the dashboard showed all units).
export interface LegacyOptions {
    unitCount?: number;
    // Running timers ask for the seconds to be shown in whatever preset is active, so
    // the list makes it obvious the timer is actually ticking. Only presets with a
    // natural seconds slot honor this; Decimal and the user-authored Custom patterns
    // already control their own precision, so they are left untouched.
    withSeconds?: boolean;
}

interface Parts {
    days: number;
    totalHours: number;
    hoursOfDay: number;
    totalMinutes: number;
    minutesOfHour: number;
    totalSeconds: number;
    secondsOfMinute: number;
}

const split = (totalSeconds: number): Parts => {
    const s = Math.max(0, Math.round(totalSeconds));
    return {
        days: Math.floor(s / 86400),
        totalHours: Math.floor(s / 3600),
        hoursOfDay: Math.floor((s % 86400) / 3600),
        totalMinutes: Math.floor(s / 60),
        minutesOfHour: Math.floor((s % 3600) / 60),
        totalSeconds: s,
        secondsOfMinute: s % 60,
    };
};

// The legacy "Days + hours" preset: delegate to pretty-ms exactly as the original code
// did, so existing users see no change. The leading "~" pretty-ms adds when truncating
// is stripped (the list view did this with .substring(1)).
const daysHours = (p: Parts, legacy?: LegacyOptions): string => prettyMs(p.totalSeconds * 1000, legacy).replace(/^~/, '');

const goStyle = (p: Parts, withSeconds?: boolean): string =>
    `${p.totalHours}h${p.minutesOfHour}m${withSeconds ? `${p.secondsOfMinute}s` : ''}`;

// Custom strftime-like tokens (see SettingsPage help text):
//   %d days · %H total hours · %h hours-of-day (2) · %m total minutes
//   %M minutes-of-hour (2) · %s total seconds · %S seconds-of-minute (2) · %% literal %
const strftime = (p: Parts, pattern: string): string =>
    (pattern || '%H:%M').replace(/%[dHhmMsS%]/g, (token) => {
        switch (token) {
            case '%d':
                return `${p.days}`;
            case '%H':
                return `${p.totalHours}`;
            case '%h':
                return pad2(p.hoursOfDay);
            case '%m':
                return `${p.totalMinutes}`;
            case '%M':
                return pad2(p.minutesOfHour);
            case '%s':
                return `${p.totalSeconds}`;
            case '%S':
                return pad2(p.secondsOfMinute);
            case '%%':
                return '%';
            default:
                return token;
        }
    });

// Custom Go-style: the pattern lists which unit letters to render, largest first,
// e.g. "dhm" -> "9d9h0m", "hm" -> "225h0m". Defaults to "hms".
const goCustom = (p: Parts, pattern: string): string => {
    const letters = (pattern || 'hms').replace(/[^dhms]/g, '');
    const order = ['d', 'h', 'm', 's'].filter((l) => letters.includes(l));
    const values: Record<string, number> = {d: p.days, h: p.hoursOfDay, m: p.minutesOfHour, s: p.secondsOfMinute};
    // When days are not shown, fold them into hours; same for any dropped leading unit.
    if (!order.includes('d')) {
        values.h = p.totalHours;
    }
    if (!order.includes('h')) {
        values.m = order.includes('d') ? p.minutesOfHour : p.totalMinutes;
    }
    if (!order.includes('m')) {
        values.s = order.includes('h') || order.includes('d') ? p.secondsOfMinute : p.totalSeconds;
    }
    return (order.length ? order : ['h', 'm', 's']).map((l) => `${values[l]}${l}`).join('');
};

export const formatDuration = (totalSeconds: number, format: DurationFormat, custom: string, legacy?: LegacyOptions): string => {
    const p = split(totalSeconds);
    const withSeconds = legacy && legacy.withSeconds;
    switch (format) {
        case DurationFormat.HHMM:
            return `${p.totalHours}:${pad2(p.minutesOfHour)}${withSeconds ? `:${pad2(p.secondsOfMinute)}` : ''}`;
        case DurationFormat.DecimalHours:
            return `${(p.totalSeconds / 3600).toFixed(2)}h`;
        case DurationFormat.GoStyle:
            return goStyle(p, withSeconds);
        case DurationFormat.CustomStrftime:
            return strftime(p, custom);
        case DurationFormat.CustomGo:
            return goCustom(p, custom);
        case DurationFormat.DaysHours:
        default:
            // pretty-ms truncates to the two largest units; while running, allow a third
            // so the seconds surface (e.g. "1h 5m 23s") and the tick is visible.
            return daysHours(p, withSeconds ? {...legacy, unitCount: ((legacy && legacy.unitCount) || 2) + 1} : legacy);
    }
};

export const useDurationFormatter = (): ((totalSeconds: number, legacy?: LegacyOptions) => string) => {
    const {durationFormat, durationCustomFormat} = useSettings();
    return (totalSeconds: number, legacy?: LegacyOptions) =>
        formatDuration(totalSeconds, durationFormat, durationCustomFormat, legacy);
};
