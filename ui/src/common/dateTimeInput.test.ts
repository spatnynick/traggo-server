import {getDigitOverwriteSelection} from './dateTimeInput';

describe('getDigitOverwriteSelection', () => {
    it('selects digit at caret', () => {
        expect(getDigitOverwriteSelection('16:30', 1, 1)).toEqual({start: 1, end: 2});
    });

    it('skips separators', () => {
        expect(getDigitOverwriteSelection('16:30', 2, 2)).toEqual({start: 3, end: 4});
    });

    it('does not change an existing selection', () => {
        expect(getDigitOverwriteSelection('16:30', 1, 3)).toBeNull();
    });

    it('returns nothing at end of input', () => {
        expect(getDigitOverwriteSelection('16:30', 5, 5)).toBeNull();
    });
});
