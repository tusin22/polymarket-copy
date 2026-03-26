import { describe, expect, it } from '@jest/globals';
import { getActivityCutoffTimestamp, isActivityTooOld } from '../activityAge';

describe('activityAge utilities', () => {
    const nowSeconds = 1_700_000_000;

    it('does not mark a trade inside the window as too old', () => {
        const withinWindow = nowSeconds - (2 * 60 * 60 - 1);

        expect(isActivityTooOld(withinWindow, 2, nowSeconds)).toBe(false);
    });

    it('marks a trade outside the window as too old', () => {
        const outsideWindow = nowSeconds - (2 * 60 * 60 + 1);

        expect(isActivityTooOld(outsideWindow, 2, nowSeconds)).toBe(true);
    });

    it('keeps the exact cutoff timestamp inside the valid window', () => {
        const cutoff = getActivityCutoffTimestamp(2, nowSeconds);

        expect(isActivityTooOld(cutoff, 2, nowSeconds)).toBe(false);
    });

    it('correctly handles a 1-hour window', () => {
        const oneHourCutoff = getActivityCutoffTimestamp(1, nowSeconds);

        expect(oneHourCutoff).toBe(nowSeconds - 3600);
        expect(isActivityTooOld(nowSeconds - 3599, 1, nowSeconds)).toBe(false);
        expect(isActivityTooOld(nowSeconds - 3601, 1, nowSeconds)).toBe(true);
    });
});
