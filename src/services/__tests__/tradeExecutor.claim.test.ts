import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { UserActivityInterface } from '../../interfaces/User';

const mockGetUserActivityModel = jest.fn();
const waitingMock = jest.fn();

jest.mock('../../config/env', () => ({
    ENV: {
        USER_ADDRESSES: ['0xuser'],
        RETRY_LIMIT: 1,
        PROXY_WALLET: '0xproxy',
        TRADE_AGGREGATION_ENABLED: false,
        TRADE_AGGREGATION_WINDOW_SECONDS: 1,
    },
}));

jest.mock('../../models/userHistory', () => ({
    getUserActivityModel: (...args: unknown[]) => mockGetUserActivityModel(...args),
}));

jest.mock('../../utils/fetchData', () => ({
    __esModule: true,
    default: jest.fn(async () => []),
}));

jest.mock('../../utils/getMyBalance', () => ({
    __esModule: true,
    default: jest.fn(async () => 0),
}));

jest.mock('../../utils/postOrder', () => ({
    __esModule: true,
    default: jest.fn(async () => undefined),
}));

jest.mock('../../utils/logger', () => ({
    __esModule: true,
    default: {
        success: jest.fn(),
        info: jest.fn(),
        clearLine: jest.fn(),
        header: jest.fn(),
        waiting: waitingMock,
        trade: jest.fn(),
        balance: jest.fn(),
        separator: jest.fn(),
    },
}));

const buildTrade = (overrides: Partial<UserActivityInterface> = {}): UserActivityInterface => ({
    _id: 'trade-1' as any,
    proxyWallet: '0xproxy',
    timestamp: 100,
    conditionId: 'cond-1',
    type: 'TRADE',
    size: 1,
    usdcSize: 2,
    transactionHash: '0xhash',
    price: 0.5,
    asset: 'asset-1',
    side: 'BUY',
    outcomeIndex: 0,
    title: 'title',
    slug: 'slug',
    icon: 'icon',
    eventSlug: 'event',
    outcome: 'YES',
    name: 'name',
    pseudonym: 'pseudo',
    bio: 'bio',
    profileImage: 'img',
    profileImageOptimized: 'img-opt',
    bot: false,
    botExcutedTime: 0,
    ...overrides,
});

const createModelFromDocs = (docs: UserActivityInterface[]) => {
    const mutableDocs = docs.map((doc) => ({ ...doc }));

    return {
        docs: mutableDocs,
        findOneAndUpdate: jest.fn((filter: any, update: any) => ({
            lean: () => ({
                exec: async () => {
                    const selected = mutableDocs
                        .filter(
                            (doc) =>
                                doc.type === filter.type &&
                                doc.bot === filter.bot &&
                                doc.botExcutedTime === filter.botExcutedTime
                        )
                        .sort((a, b) => {
                            const aTimestamp = a.timestamp || 0;
                            const bTimestamp = b.timestamp || 0;
                            if (aTimestamp !== bTimestamp) return aTimestamp - bTimestamp;
                            return String(a._id).localeCompare(String(b._id));
                        })[0];

                    if (!selected) {
                        return null;
                    }

                    selected.botExcutedTime = update.$set.botExcutedTime;
                    return { ...selected };
                },
            }),
        })),
    };
};

describe('claimNextExecutableTrade', () => {
    beforeEach(() => {
        jest.resetModules();
        mockGetUserActivityModel.mockReset();
    });

    it('claims an eligible trade atomically', async () => {
        const { claimNextExecutableTrade } = await import('../tradeExecutor');
        const model = createModelFromDocs([buildTrade({ _id: 'trade-1' as any })]);

        const claimed = await claimNextExecutableTrade([
            { address: '0xuser', model: model as any },
        ] as any);

        expect(claimed?._id).toBe('trade-1');
        expect(claimed?.userAddress).toBe('0xuser');
        expect(model.docs[0].botExcutedTime).toBe(1);
        expect(model.findOneAndUpdate).toHaveBeenCalledTimes(1);
    });

    it('does not return the same trade again after claim', async () => {
        const { claimNextExecutableTrade } = await import('../tradeExecutor');
        const model = createModelFromDocs([buildTrade({ _id: 'trade-2' as any })]);

        const first = await claimNextExecutableTrade([{ address: '0xuser', model: model as any }] as any);
        const second = await claimNextExecutableTrade([{ address: '0xuser', model: model as any }] as any);

        expect(first?._id).toBe('trade-2');
        expect(second).toBeNull();
    });

    it('returns null when there are no eligible trades', async () => {
        const { claimNextExecutableTrade } = await import('../tradeExecutor');
        const model = createModelFromDocs([
            buildTrade({ _id: 'trade-done' as any, bot: true, botExcutedTime: 999 }),
        ]);

        const claimed = await claimNextExecutableTrade([{ address: '0xuser', model: model as any }] as any);

        expect(claimed).toBeNull();
    });

    it('claims in stable ascending timestamp order', async () => {
        const { claimNextExecutableTrade } = await import('../tradeExecutor');
        const model = createModelFromDocs([
            buildTrade({ _id: 'trade-late' as any, timestamp: 200 }),
            buildTrade({ _id: 'trade-early' as any, timestamp: 100 }),
        ]);

        const first = await claimNextExecutableTrade([{ address: '0xuser', model: model as any }] as any);
        const second = await claimNextExecutableTrade([{ address: '0xuser', model: model as any }] as any);

        expect(first?._id).toBe('trade-early');
        expect(second?._id).toBe('trade-late');
    });
});

describe('tradeExecutor loop basic behavior', () => {
    beforeEach(() => {
        jest.resetModules();
        jest.useFakeTimers();
        mockGetUserActivityModel.mockReset();
        waitingMock.mockReset();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('keeps loop running cleanly when no eligible trades exist', async () => {
        const model = {
            findOneAndUpdate: jest.fn(() => ({
                lean: () => ({ exec: async () => null }),
            })),
        };
        mockGetUserActivityModel.mockReturnValue(model);

        const module = await import('../tradeExecutor');
        const runPromise = module.default({} as any);

        await jest.advanceTimersByTimeAsync(350);
        module.stopTradeExecutor();
        await jest.advanceTimersByTimeAsync(350);
        await runPromise;

        expect(model.findOneAndUpdate).toHaveBeenCalled();
    });
});
