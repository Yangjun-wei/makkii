import keyStore from 'react-native-makkii-core';
import Contract from 'web3-eth-contract';
import BigNumber from 'bignumber.js';
import { getTransactionReceipt, getTransactionCount, sendSignedTransaction } from './jsonrpc';
import { appendHexStart, toHex } from '../../utils';
import ApiCaller from '../../utils/http_caller';
import { ERC20ABI } from './token';

const etherscanApikey = 'W97WSD5JD814S3EJCJXHW7H8Y3TM3D2UK2';
const getEtherscanBaseUrl = network => {
    if (network === 'mainnet') {
        return `https://api.etherscan.io/api`;
    }
    return `https://api-${network}.etherscan.io/api`;
};

function sendNativeTx(account, to, value, gasPrice, gasLimit, data, network = 'mainnet') {
    return new Promise((resolve, reject) => {
        getTransactionCount(account.address, 'latest', network)
            .then(count => {
                let tx = {
                    network,
                    amount: toHex(value.shiftedBy(18)),
                    nonce: toHex(count),
                    gasLimit: toHex(gasLimit),
                    gasPrice: toHex(gasPrice),
                    to: toHex(to),
                    private_key: account.private_key,
                };
                if (data !== undefined) {
                    tx = { ...tx, data };
                }
                keyStore
                    .signTransaction(tx, 60)
                    .then(res => {
                        const { v, r, s, encoded } = res;
                        console.log('sign result:');
                        console.log(`v:${v},r=${r},s=${s}`);
                        const encodedTx = appendHexStart(encoded);
                        console.log('encoded eth tx => ', encodedTx);
                        sendSignedTransaction(encodedTx, network)
                            .then(hash => {
                                const pendingTx = {
                                    hash,
                                    from: account.address,
                                    to,
                                    value,
                                    status: 'PENDING',
                                };
                                resolve({ pendingTx });
                            })
                            .catch(e => {
                                console.log('send signed tx:', e);
                                reject(e);
                            });
                    })
                    .catch(e => {
                        console.log('sign error:', e);
                        reject(e);
                    });
            })
            .catch(err => {
                console.log('get tx count error:', err);
                reject(err);
            });
    });
}

function sendTokenTx(account, symbol, to, value, gasPrice, gasLimit, network = 'mainnet') {
    const { tokens } = account;
    const { contractAddr, tokenDecimal } = tokens[symbol];

    const tokenContract = new Contract(ERC20ABI, contractAddr);
    const methodsData = tokenContract.methods
        .transfer(
            to,
            value
                .shiftedBy(tokenDecimal - 0)
                .toFixed(0)
                .toString(),
        )
        .encodeABI();
    return new Promise((resolve, reject) => {
        sendNativeTx(
            account,
            contractAddr,
            new BigNumber(0),
            gasPrice,
            gasLimit,
            methodsData,
            network,
        )
            .then(res => {
                const { pendingTx } = res;
                const pendingTokenTx = {
                    hash: pendingTx.hash,
                    from: pendingTx.from,
                    to,
                    value,
                    status: 'PENDING',
                };

                resolve({ pendingTx, pendingTokenTx });
            })
            .catch(err => {
                reject(err);
            });
    });
}

function sendTransaction(account, symbol, to, value, extraParams, data, network = 'mainnet') {
    const { gasPrice } = extraParams;
    const { gasLimit } = extraParams;
    if (account.symbol === symbol) {
        return sendNativeTx(account, to, value, gasPrice, gasLimit, data, network);
    }
    return sendTokenTx(account, symbol, to, value, gasPrice, gasLimit, network);
}

function getTransactionsByAddress(address, page, size, network = 'mainnet') {
    const url = `${getEtherscanBaseUrl(
        network,
    )}?module=account&action=txlist&address=${address}&page=${page}&offset=${size}&sort=asc&apikey=${etherscanApikey}`;
    console.log(`[eth http req] get transactions by address: ${url}`);
    return new Promise((resolve, reject) => {
        ApiCaller.get(url, false).then(
            res => {
                console.log('[http resp]', res.data);
                const { result } = res.data;
                const txs = {};
                result.forEach(t => {
                    const tx = {};
                    tx.hash = t.hash;
                    tx.timestamp = parseInt(t.timeStamp) * 1000;
                    tx.from = t.from;
                    tx.to = t.to;
                    tx.value = new BigNumber(t.value, 10).shiftedBy(-18).toNumber();
                    tx.status = t.isError === '0' ? 'CONFIRMED' : 'FAILED';
                    tx.blockNumber = parseInt(t.blockNumber);
                    txs[tx.hash] = tx;
                });
                resolve(txs);
            },
            err => {
                console.log('[http resp] err: ', err);
                reject(err);
            },
        );
    });
}

function getTransactionUrlInExplorer(txHash, network = 'mainnet') {
    if (network === 'mainnet') {
        return `https://etherscan.io/tx/${txHash}`;
    }
    return `https://${network}.etherscan.io/tx/${txHash}`;
}

function getTransactionStatus(txHash, network = 'mainnet') {
    return new Promise((resolve, reject) => {
        getTransactionReceipt(txHash, network)
            .then(receipt => {
                if (receipt !== null) {
                    resolve({
                        status: parseInt(receipt.status, 16) === 1,
                        blockNumber: parseInt(receipt.blockNumber, 16),
                    });
                } else {
                    resolve(null);
                }
            })
            .catch(err => {
                reject(err);
            });
    });
}

module.exports = {
    sendTransaction,
    getTransactionsByAddress,
    getTransactionUrlInExplorer,
    getTransactionStatus,
};
