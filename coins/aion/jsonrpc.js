import BigNumber from 'bignumber.js';
import ApiCaller from '../../utils/http_caller';

const getEndpoint = network => {
    return `https://aion.api.nodesmith.io/v1/${network}/jsonrpc?apiKey=c8b8ebb4f10f40358b635afae72c2780`;
};

const checkBlockTag = blockTag => {
    if (blockTag == null) {
        return 'latest';
    }

    if (blockTag === 'earliest') {
        return '0x0';
    }

    if (blockTag === 'latest' || blockTag === 'pending') {
        return blockTag;
    }

    if (typeof blockTag === 'number') {
        return `0x${BigNumber(blockTag).toString(16)}`;
    }

    throw new Error('invalid blockTag');
};

const processRequest = (methodName, params) => {
    const requestData = {
        method: methodName,
        params,
        id: 42,
        jsonrpc: '2.0',
    };

    return JSON.stringify(requestData);
};

const getBlockByNumber = (blockNumber /* hex string */, fullTxs = false, network = 'mainnet') =>
    new Promise((resolve, reject) => {
        const requestData = processRequest('eth_getBlockByNumber', [blockNumber, fullTxs]);
        const promise = ApiCaller.post(getEndpoint(network), requestData, true, {
            'Content-Type': 'application/json',
        });
        console.log(`[aion http req] eth_getBlockByNumber[${blockNumber},${fullTxs}]`);
        promise.then(res => {
            console.log('[aion http resp] ', res.data);
            if (res.data.error) reject(res.data.error);
            else resolve(res.data.result);
        });
    });

const blockNumber = (network = 'mainnet') =>
    new Promise((resolve, reject) => {
        const requestData = processRequest('eth_blockNumber', []);
        const promise = ApiCaller.post(getEndpoint(network), requestData, true, {
            'Content-Type': 'application/json',
        });
        console.log('[aion http req] eth_blockNumber[]');
        promise.then(res => {
            console.log('[aion http resp] ', res.data);
            if (res.data.error) reject(res.data.error);
            else resolve(res.data.result);
        });
    });

const getBalance = (address, network = 'mainnet') =>
    new Promise((resolve, reject) => {
        const params = [address.toLowerCase(), 'latest'];
        const requestData = processRequest('eth_getBalance', params);
        const promise = ApiCaller.post(getEndpoint(network), requestData, true, {
            'Content-Type': 'application/json',
        });
        console.log(`[aion http req] eth_getBalance[${address}, 'latest']`);
        promise.then(res => {
            console.log('[aion http resp] ', res.data);
            if (res.data.error) reject(res.data.error);
            else resolve(BigNumber(res.data.result).shiftedBy(-18));
        });
    });

const getTransactionCount = (address, blockTag, network = 'mainnet') =>
    new Promise((resolve, reject) => {
        const params = [address.toLowerCase(), checkBlockTag(blockTag)];
        const requestData = processRequest('eth_getTransactionCount', params);
        const promise = ApiCaller.post(getEndpoint(network), requestData, true, {
            'Content-Type': 'application/json',
        });
        console.log(`[aion http req] eth_getTransactionCount[${address}, ${blockTag}]`);
        promise.then(res => {
            console.log('[aion http resp] ', res.data);
            if (res.data.error) reject(res.data.error);
            resolve(res.data.result);
        });
    });

const sendSignedTransaction = (signedTx, network = 'mainnet') =>
    new Promise((resolve, reject) => {
        const params = [signedTx];
        const requestData = processRequest('eth_sendRawTransaction', params);
        const promise = ApiCaller.post(getEndpoint(network), requestData, true, {
            'Content-Type': 'application/json',
        });
        console.log(`[aion http req] eth_sendRawTransaction[${signedTx}]`);
        promise.then(res => {
            console.log('[aion http resp] ', res.data);
            if (res.data.error) reject(res.data.error);
            resolve(res.data.result);
        });
    });

const getTransactionReceipt = (hash, network = 'mainnet') =>
    new Promise((resolve, reject) => {
        const params = [hash];
        const requestData = processRequest('eth_getTransactionReceipt', params);
        const promise = ApiCaller.post(getEndpoint(network), requestData, true, {
            'Content-Type': 'application/json',
        });
        console.log(`[aion http req] eth_getTransactionReceipt[${hash}]`);
        promise.then(res => {
            console.log('[aion http resp] ', res.data);
            if (res.data.error) reject(res.data.error);
            else resolve(res.data.result);
        });
    });

module.exports = {
    getBlockByNumber,
    getTransactionReceipt,
    sendSignedTransaction,
    getTransactionCount,
    getBalance,
    blockNumber,
    getEndpoint,
    processRequest,
};
