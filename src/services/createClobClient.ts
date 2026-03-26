import { ethers } from 'ethers';
import { ClobClient } from '@polymarket/clob-client';
import { SignatureType } from '@polymarket/order-utils';
import { ENV } from '../config/env';
import Logger from '../utils/logger';

const PROXY_WALLET = ENV.PROXY_WALLET;
const PRIVATE_KEY = ENV.PRIVATE_KEY;
const CLOB_HTTP_URL = ENV.CLOB_HTTP_URL;
const RPC_URL = ENV.RPC_URL;

/**
 * Detects whether the proxy wallet is a contract wallet (e.g., Gnosis Safe).
 */
const isContractWallet = async (address: string): Promise<boolean> => {
    try {
        const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
        const code = await provider.getCode(address);
        return code !== '0x';
    } catch (error) {
        Logger.error(`Error checking proxy wallet type: ${error}`);
        return false;
    }
};

const createClobClient = async (): Promise<ClobClient> => {
    const chainId = 137;
    const host = CLOB_HTTP_URL as string;

    // Legitimate secret usage: only used for local signer instantiation.
    const wallet = new ethers.Wallet(PRIVATE_KEY as string);

    const proxyIsContract = await isContractWallet(PROXY_WALLET as string);
    const signatureType = proxyIsContract ? SignatureType.POLY_GNOSIS_SAFE : SignatureType.EOA;

    Logger.info(
        `Wallet type detected: ${proxyIsContract ? 'Contract wallet (Gnosis Safe)' : 'EOA'}`
    );

    let clobClient = new ClobClient(
        host,
        chainId,
        wallet,
        undefined,
        signatureType,
        proxyIsContract ? (PROXY_WALLET as string) : undefined
    );

    // Suppress noisy SDK output only during key provisioning.
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;

    let creds;
    try {
        console.log = function () {};
        console.error = function () {};

        creds = await clobClient.createApiKey();
        if (!creds.key) {
            creds = await clobClient.deriveApiKey();
        }
    } finally {
        console.log = originalConsoleLog;
        console.error = originalConsoleError;
    }

    clobClient = new ClobClient(
        host,
        chainId,
        wallet,
        creds,
        signatureType,
        proxyIsContract ? (PROXY_WALLET as string) : undefined
    );

    return clobClient;
};

export default createClobClient;
