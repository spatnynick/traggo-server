export interface DigitSelection {
    start: number;
    end: number;
}

// Return next numeric character at collapsed caret. Selecting it before the
// browser inserts a digit gives masked inputs overwrite semantics.
export const getDigitOverwriteSelection = (
    value: string,
    selectionStart: number | null,
    selectionEnd: number | null
): DigitSelection | null => {
    if (selectionStart === null || selectionEnd === null || selectionStart !== selectionEnd) {
        return null;
    }

    const offset = value.slice(selectionStart).search(/\d/);
    if (offset < 0) {
        return null;
    }

    const start = selectionStart + offset;
    return {start, end: start + 1};
};
