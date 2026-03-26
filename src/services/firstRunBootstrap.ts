import { isActivityTooOld } from '../utils/activityAge';

interface ActivityLike {
    proxyWallet: string;
    timestamp: number;
    conditionId: string;
    type: string;
    size: number;
    usdcSize: number;
    transactionHash: string;
    price: number;
    asset: string;
    side: string;
    outcomeIndex: number;
    title: string;
    slug: string;
    icon: string;
    eventSlug: string;
    outcome: string;
    name: string;
    pseudonym: string;
    bio: string;
    profileImage: string;
    profileImageOptimized: string;
}

interface UserActivityModelLike {
    new (doc: Record<string, unknown>): { save: () => Promise<unknown> };
    findOne: (query: { transactionHash: string }) => { exec: () => Promise<unknown> };
    updateOne: (
        query: { _id?: unknown; transactionHash?: string },
        update: { $set: { bot: boolean; botExcutedTime: number } }
    ) => Promise<unknown>;
    updateMany: (
        query: { bot: boolean },
        update: { $set: { bot: boolean; botExcutedTime: number } }
    ) => Promise<{ modifiedCount?: number }>;
}

const PROCESSED_UPDATE = { $set: { bot: true, botExcutedTime: 999 } };

export const markExistingActivitiesAsProcessed = async ({
    UserActivity,
}: {
    UserActivity: UserActivityModelLike;
}): Promise<number> => {
    const result = await UserActivity.updateMany({ bot: false }, PROCESSED_UPDATE);
    return result.modifiedCount ?? 0;
};

export const bootstrapAddressActivities = async ({
    activitiesPayload,
    UserActivity,
    tooOldTimestamp,
}: {
    activitiesPayload: unknown;
    UserActivity: UserActivityModelLike;
    tooOldTimestamp: number;
}): Promise<{ initialized: boolean; seededCount: number }> => {
    if (!Array.isArray(activitiesPayload)) {
        return { initialized: false, seededCount: 0 };
    }

    const seededCount = await seedActivitiesAsKnown({
        activities: activitiesPayload as ActivityLike[],
        UserActivity,
        tooOldTimestamp,
    });

    return { initialized: true, seededCount };
};

export const seedActivitiesAsKnown = async ({
    activities,
    UserActivity,
    tooOldTimestamp,
}: {
    activities: ActivityLike[];
    UserActivity: UserActivityModelLike;
    tooOldTimestamp: number;
}): Promise<number> => {
    let seededCount = 0;

    for (const activity of activities) {
        if (isActivityTooOld(activity.timestamp, tooOldTimestamp)) {
            continue;
        }

        const existingActivity = await UserActivity.findOne({
            transactionHash: activity.transactionHash,
        }).exec();

        if (existingActivity) {
            if ((existingActivity as { bot?: boolean }).bot === false) {
                await UserActivity.updateOne(
                    {
                        _id: (existingActivity as { _id?: unknown })._id,
                        transactionHash: activity.transactionHash,
                    },
                    PROCESSED_UPDATE
                );
            }
            continue;
        }

        const seededActivity = new UserActivity({
            proxyWallet: activity.proxyWallet,
            timestamp: activity.timestamp,
            conditionId: activity.conditionId,
            type: activity.type,
            size: activity.size,
            usdcSize: activity.usdcSize,
            transactionHash: activity.transactionHash,
            price: activity.price,
            asset: activity.asset,
            side: activity.side,
            outcomeIndex: activity.outcomeIndex,
            title: activity.title,
            slug: activity.slug,
            icon: activity.icon,
            eventSlug: activity.eventSlug,
            outcome: activity.outcome,
            name: activity.name,
            pseudonym: activity.pseudonym,
            bio: activity.bio,
            profileImage: activity.profileImage,
            profileImageOptimized: activity.profileImageOptimized,
            ...PROCESSED_UPDATE.$set,
        });

        await seededActivity.save();
        seededCount += 1;
    }

    return seededCount;
};
