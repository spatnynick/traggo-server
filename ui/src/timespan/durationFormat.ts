import {DurationFormat} from '../gql/__generated__/globalTypes';
import {useSettings} from '../gql/settings';

const pad2 = (n: number): string => (n < 10 ? `0${n}` : `${n}`);

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

const daysHours = (p: Parts): string => {
    // Mirrors the previous pretty-ms output (unitCount: 2), largest two non-zero units.
    const units: Array<[number, string]> = [
        [p.days, 'd'],
        [p.hoursOfDay, 'h'],
        [p.minutesOfHour, 'm'],
        [p.secondsOfMinute, 's'],
    ];
    const nonZero = units.filter(([v]) => v > 0);
    const shown = (nonZero.length ? nonZero : [[0, 'm'] as [number, string]]).slice(0, 2);
    return shown.map(([v, u]) => `${v}${u}`).join(' ');
};

const goStyle = (p: Parts): string => `${p.totalHours}h${p.minutesOfHour}m`;

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

export const formatDuration = (totalSeconds: number, format: DurationFormat, custom: string): string => {
    const p = split(totalSeconds);
    switch (format) {
        case DurationFormat.HHMM:
            return `${p.totalHours}:${pad2(p.minutesOfHour)}`;
        case DurationFormat.DecimalHours:
            return `${(p.totalSeconds / 3600).toFixed(2)}h`;
        case DurationFormat.GoStyle:
            return goStyle(p);
        case DurationFormat.CustomStrftime:
            return strftime(p, custom);
        case DurationFormat.CustomGo:
            return goCustom(p, custom);
        case DurationFormat.DaysHours:
        default:
            return daysHours(p);
    }
};

export const useDurationFormatter = (): ((totalSeconds: number) => string) => {
    const {durationFormat, durationCustomFormat} = useSettings();
    return (totalSeconds: number) => formatDuration(totalSeconds, durationFormat, durationCustomFormat);
};
