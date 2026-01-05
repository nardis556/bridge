const RPC_URL = "https://xchain-rpc.kuma.bid"
const CHAIN_ID = 94524
const EXCHANGE_ADDRESS = "0xB231947A9B2075BaF978eA321eC6512344071F7C"
const ADAPTER_ADDRESS = "0x9A73ec2D68Fe93f6D1bBEeA4046535Ee95d0FE85"
const OFT_ADDRESS = "0xd56768a659d4c7e2a0a18b6d96f1f74ce3566b97" // USDC OFT on XChain

// LayerZero V2 Endpoint IDs
const LZ_ENDPOINTS = {
    arbitrum: { id: 30110, name: "Arbitrum" },
    ethereum: { id: 30101, name: "Ethereum" },
    base: { id: 30184, name: "Base" },
    optimism: { id: 30111, name: "Optimism" },
    bnb: { id: 30102, name: "BNB Chain" },
    avalanche: { id: 30106, name: "Avalanche" },
    berachain: { id: 30362, name: "Berachain" }
}

// OFT ABI (minimal for send/quote) - this OFT returns simpler types
const OFT_ABI = [
    "function balanceOf(address account) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",
    "function quoteSend((uint32 dstEid, bytes32 to, uint256 amountLD, uint256 minAmountLD, bytes extraOptions, bytes composeMsg, bytes oftCmd), bool payInLzToken) view returns (uint256 nativeFee, uint256 lzTokenFee)",
    "function send((uint32 dstEid, bytes32 to, uint256 amountLD, uint256 minAmountLD, bytes extraOptions, bytes composeMsg, bytes oftCmd), (uint256 nativeFee, uint256 lzTokenFee), address refundAddress) payable"
]

const EXCHANGE_ABI = [
    {
        "inputs": [
            {
                "internalType": "contract IExchange",
                "name": "balanceMigrationSource",
                "type": "address"
            },
            {
                "internalType": "address",
                "name": "exitFundWallet_",
                "type": "address"
            },
            {
                "internalType": "address",
                "name": "feeWallet_",
                "type": "address"
            },
            {
                "internalType": "contract IIndexPriceAdapter[]",
                "name": "indexPriceAdapters_",
                "type": "address[]"
            },
            {
                "internalType": "address",
                "name": "insuranceFundWallet_",
                "type": "address"
            },
            {
                "internalType": "contract IOraclePriceAdapter",
                "name": "oraclePriceAdapter_",
                "type": "address"
            },
            {
                "internalType": "address",
                "name": "quoteTokenAddress_",
                "type": "address"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "constructor"
    },
    {
        "inputs": [],
        "name": "chainPropagationPeriodInS",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "exitWallet",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            }
        ],
        "name": "walletExits",
        "outputs": [
            {
                "internalType": "bool",
                "name": "exists",
                "type": "bool"
            },
            {
                "internalType": "uint64",
                "name": "effectiveBlockTimestamp",
                "type": "uint64"
            },
            {
                "internalType": "enum WalletExitAcquisitionDeleveragePriceStrategy",
                "name": "deleveragePriceStrategy",
                "type": "uint8"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "wallet",
                "type": "address"
            }
        ],
        "name": "withdrawExit",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
]
