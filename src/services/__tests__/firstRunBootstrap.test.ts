import {
    bootstrapAddressActivities,
    markExistingActivitiesAsProcessed,
    seedActivitiesAsKnown,
} from '../firstRunBootstrap';
import { describe, expect, it, jest } from '@jest/globals';

const buildActivity = (overrides: Record<string, unknown> = {}) => ({
    proxyWallet: '0xabc',
    timestamp: 200,
    conditionId: 'cond-1',
    type: 'TRADE',
    size: 10,
    usdcSize: 100,
    transactionHash: '0xtx1',
    price: 0.4,
    asset: 'asset-1',
    side: 'BUY',
    outcomeIndex: 0,
    title: 'Market',
    slug: 'market',
    icon: 'icon',
    eventSlug: 'event',
    outcome: 'YES',
    name: 'name',
    pseudonym: 'pseudo',
    bio: 'bio',
    profileImage: 'image',
    profileImageOptimized: 'image-opt',
    ...overrides,
});

const createUserActivityMock = () => {
    const savedDocs: Record<string, unknown>[] = [];

    const UserActivityMock: any = function (this: any, doc: Record<string, unknown>) {
        this.save = jest.fn(async () => {
            savedDocs.push(doc);
        });
    };

    UserActivityMock.findOne = jest.fn();
    UserActivityMock.updateOne = jest.fn(async () => ({}));
    UserActivityMock.updateMany = jest.fn(async () => ({ modifiedCount: 0 }));

    return { UserActivityMock, savedDocs };
};

describe('seedActivitiesAsKnown', () => {
    it('seeds baseline in empty database', async () => {
        const nowSeconds = Math.floor(Date.now() / 1000);
        const { UserActivityMock, savedDocs } = createUserActivityMock();

        UserActivityMock.findOne.mockReturnValue({ exec: async () => null });

        const count = await seedActivitiesAsKnown({
            activities: [buildActivity({ timestamp: nowSeconds })] as any,
            UserActivity: UserActivityMock,
            tooOldTimestamp: 100,
        });

        expect(count).toBe(1);
        expect(savedDocs).toHaveLength(1);
        expect(savedDocs[0]).toMatchObject({
            transactionHash: '0xtx1',
            bot: true,
            botExcutedTime: 999,
        });
    });

    it('marks existing bot:false activity as processed during bootstrap', async () => {
        const nowSeconds = Math.floor(Date.now() / 1000);
        const { UserActivityMock, savedDocs } = createUserActivityMock();

        UserActivityMock.findOne.mockReturnValue({ exec: async () => ({ _id: 'id-1', bot: false }) });

        const count = await seedActivitiesAsKnown({
            activities: [buildActivity({ timestamp: nowSeconds, transactionHash: '0xexisting' })] as any,
            UserActivity: UserActivityMock,
            tooOldTimestamp: 100,
        });

        expect(count).toBe(0);
        expect(savedDocs).toHaveLength(0);
        expect(UserActivityMock.updateOne).toHaveBeenCalledWith(
            { _id: 'id-1', transactionHash: '0xexisting' },
            { $set: { bot: true, botExcutedTime: 999 } }
        );
    });
});

describe('bootstrapAddressActivities', () => {
    it('does not initialize when payload is invalid', async () => {
        const { UserActivityMock } = createUserActivityMock();

        const result = await bootstrapAddressActivities({
            activitiesPayload: { invalid: true },
            UserActivity: UserActivityMock,
            tooOldTimestamp: 100,
        });

        expect(result).toEqual({ initialized: false, seededCount: 0 });
    });

    it('initializes when payload is a successful empty fetch', async () => {
        const { UserActivityMock } = createUserActivityMock();

        const result = await bootstrapAddressActivities({
            activitiesPayload: [],
            UserActivity: UserActivityMock,
            tooOldTimestamp: 100,
        });

        expect(result).toEqual({ initialized: true, seededCount: 0 });
    });

    it('propagates bootstrap errors so caller does not mark initialized', async () => {
        const nowSeconds = Math.floor(Date.now() / 1000);
        const UserActivityMock: any = function (this: any) {
            this.save = async () => {
                throw new Error('save failed');
            };
        };
        UserActivityMock.findOne = jest.fn().mockReturnValue({ exec: async () => null });
        UserActivityMock.updateOne = jest.fn(async () => ({}));
        UserActivityMock.updateMany = jest.fn(async () => ({ modifiedCount: 0 }));

        await expect(
            bootstrapAddressActivities({
                activitiesPayload: [buildActivity({ timestamp: nowSeconds })],
                UserActivity: UserActivityMock,
                tooOldTimestamp: 100,
            })
        ).rejects.toThrow('save failed');
    });
});

describe('markExistingActivitiesAsProcessed', () => {
    it('preserves startup behavior by processing backlog with bot:false', async () => {
        const { UserActivityMock } = createUserActivityMock();
        UserActivityMock.updateMany.mockResolvedValue({ modifiedCount: 3 });

        const modifiedCount = await markExistingActivitiesAsProcessed({ UserActivity: UserActivityMock });

        expect(modifiedCount).toBe(3);
        expect(UserActivityMock.updateMany).toHaveBeenCalledWith(
            { bot: false },
            { $set: { bot: true, botExcutedTime: 999 } }
        );
    });
});
