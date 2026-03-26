const SECONDS_PER_HOUR = 60 * 60;

export const getActivityCutoffTimestamp = (maxAgeHours: number, nowSeconds?: number): number => {
    const currentUnixSeconds = nowSeconds ?? Math.floor(Date.now() / 1000);
    return currentUnixSeconds - maxAgeHours * SECONDS_PER_HOUR;
};

export const isActivityTooOld = (
    activityTimestamp: number,
    maxAgeHours: number,
    nowSeconds?: number
): boolean => {
    return activityTimestamp < getActivityCutoffTimestamp(maxAgeHours, nowSeconds);
};
