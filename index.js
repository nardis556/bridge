let provider;
let signer;
let exchangeContract;
let oftContract;
let userAddress;
let usdcBalance = 0n;
let currentQuote = null;
let currentStep = 1;

// DOM elements
const connectBtn = document.getElementById("connectBtn");
const walletAddressEl = document.getElementById("walletAddress");
const balanceSection = document.getElementById("balanceSection");
const usdcBalanceEl = document.getElementById("usdcBalance");
const exchangeBalanceEl = document.getElementById("exchangeBalance");
const statusSection = document.getElementById("statusSection");
const exitStatus = document.getElementById("exitStatus");
const actionsSection = document.getElementById("actionsSection");
const exitBtn = document.getElementById("exitBtn");
const withdrawBtn = document.getElementById("withdrawBtn");
const actionMessage = document.getElementById("actionMessage");
const bridgeSection = document.getElementById("bridgeSection");
const destChainSelect = document.getElementById("destChain");
const bridgeAmountInput = document.getElementById("bridgeAmount");
const maxBtn = document.getElementById("maxBtn");
const quoteBtn = document.getElementById("quoteBtn");
const bridgeBtn = document.getElementById("bridgeBtn");
const feeEstimate = document.getElementById("feeEstimate");
const bridgeFeeEl = document.getElementById("bridgeFee");
const receiveAmountEl = document.getElementById("receiveAmount");
const txStatus = document.getElementById("txStatus");

// Event listeners
connectBtn.addEventListener("click", connectWallet);
exitBtn.addEventListener("click", exitWallet);
withdrawBtn.addEventListener("click", withdrawExit);
maxBtn.addEventListener("click", setMaxAmount);
quoteBtn.addEventListener("click", getQuote);
bridgeBtn.addEventListener("click", executeBridge);
destChainSelect.addEventListener("change", resetQuote);
bridgeAmountInput.addEventListener("input", resetQuote);

async function connectWallet() {
    if (!window.ethereum) {
        alert("Please install MetaMask or another Web3 wallet");
        return;
    }

    try {
        connectBtn.textContent = "Connecting...";
        connectBtn.disabled = true;

        await window.ethereum.request({ method: "eth_requestAccounts" });

        const chainIdHex = "0x" + CHAIN_ID.toString(16);
        try {
            await window.ethereum.request({
                method: "wallet_switchEthereumChain",
                params: [{ chainId: chainIdHex }]
            });
        } catch (switchError) {
            if (switchError.code === 4902) {
                await window.ethereum.request({
                    method: "wallet_addEthereumChain",
                    params: [{
                        chainId: chainIdHex,
                        chainName: "xchain",
                        nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
                        rpcUrls: [RPC_URL],
                    }]
                });
            } else {
                throw switchError;
            }
        }

        provider = new ethers.BrowserProvider(window.ethereum);
        signer = await provider.getSigner();
        userAddress = await signer.getAddress();

        exchangeContract = new ethers.Contract(EXCHANGE_ADDRESS, EXCHANGE_ABI, signer);
        oftContract = new ethers.Contract(OFT_ADDRESS, OFT_ABI, signer);

        connectBtn.textContent = "Connected";
        walletAddressEl.textContent = userAddress;

        balanceSection.classList.remove("hidden");
        statusSection.classList.remove("hidden");
        actionsSection.classList.remove("hidden");
        bridgeSection.classList.remove("hidden");

        await Promise.all([checkExitStatus(), updateBalance()]);
    } catch (error) {
        console.error("Connection error:", error);
        connectBtn.textContent = "Connect Wallet";
        connectBtn.disabled = false;
        showTxStatus("Failed to connect: " + error.message, "error");
    }
}

async function updateBalance() {
    try {
        const [walletBal, exchangeBal] = await Promise.all([
            oftContract.balanceOf(userAddress),
            exchangeContract.loadTotalAccountValueFromIndexPrices(userAddress)
        ]);

        usdcBalance = walletBal;
        const walletFormatted = ethers.formatUnits(usdcBalance, 6);
        usdcBalanceEl.textContent = parseFloat(walletFormatted).toFixed(2) + " USDC";

        // Exchange balance is int64 with 8 decimals
        const exchangeFormatted = ethers.formatUnits(exchangeBal, 8);
        exchangeBalanceEl.textContent = parseFloat(exchangeFormatted).toFixed(2) + " USDC";

        // If user has wallet balance and no exchange balance, they're ready to bridge
        if (usdcBalance > 0n && exchangeBal <= 0n) {
            updateGuideSteps(5);
        }
    } catch (error) {
        console.error("Error fetching balance:", error);
    }
}

async function checkExitStatus() {
    try {
        const [exitInfo, propagationPeriod] = await Promise.all([
            exchangeContract.walletExits(userAddress),
            exchangeContract.chainPropagationPeriodInS()
        ]);

        const exists = exitInfo.exists;
        const effectiveBlockTimestamp = Number(exitInfo.effectiveBlockTimestamp);
        const propagationPeriodSeconds = Number(propagationPeriod);

        if (!exists) {
            exitStatus.innerHTML = `
                <p><span class="status-label">Status:</span> <span class="status-value not-exited">Not Exited</span></p>
                <p><span class="status-label">Propagation Period:</span> <span class="status-value">${formatDuration(propagationPeriodSeconds)}</span></p>
            `;
            exitBtn.classList.remove("hidden");
            withdrawBtn.classList.add("hidden");
            actionMessage.textContent = "Exit your wallet to begin the withdrawal process.";
            updateGuideSteps(2);
        } else {
            // Check localStorage for when exit was initiated
            const exitStartTime = localStorage.getItem(`exitTime_${userAddress}`);
            let timeRemaining;

            if (exitStartTime) {
                const withdrawAvailableAt = parseInt(exitStartTime) + propagationPeriodSeconds;
                timeRemaining = withdrawAvailableAt - Math.floor(Date.now() / 1000);
            } else {
                // Fallback: assume just started
                timeRemaining = propagationPeriodSeconds;
            }

            if (timeRemaining > 0) {
                const exitTime = exitStartTime ? parseInt(exitStartTime) : Math.floor(Date.now() / 1000);
                const withdrawAvailableAt = exitTime + propagationPeriodSeconds;

                exitStatus.innerHTML = `
                    <p><span class="status-label">Status:</span> <span class="status-value pending">Exit Pending</span></p>
                    <p><span class="status-label">Exit Time:</span> <span class="status-value">${formatTimestamp(exitTime)}</span></p>
                    <p><span class="status-label">Withdraw Available:</span> <span class="status-value">${formatTimestamp(withdrawAvailableAt)}</span></p>
                    <p><span class="status-label">Time Remaining:</span> <span class="status-value countdown" id="countdown">${formatDuration(timeRemaining)}</span></p>
                `;
                exitBtn.classList.add("hidden");
                withdrawBtn.classList.add("hidden");
                actionMessage.textContent = "Please wait for the propagation period to complete.";
                startCountdown(withdrawAvailableAt);
                updateGuideSteps(3);
            } else {
                exitStatus.innerHTML = `
                    <p><span class="status-label">Status:</span> <span class="status-value ready">Ready to Withdraw</span></p>
                    <p><span class="status-label">Exit Time:</span> <span class="status-value">${formatTimestamp(effectiveBlockTimestamp)}</span></p>
                `;
                exitBtn.classList.add("hidden");
                withdrawBtn.classList.remove("hidden");
                actionMessage.textContent = "You can now withdraw your funds.";
                updateGuideSteps(4);
            }
        }
    } catch (error) {
        console.error("Error checking exit status:", error);
        exitStatus.innerHTML = `<p class="status-value not-exited">Error loading status</p>`;
    }
}

let countdownInterval;

function startCountdown(targetTimestamp) {
    if (countdownInterval) clearInterval(countdownInterval);

    countdownInterval = setInterval(() => {
        const now = Math.floor(Date.now() / 1000);
        const remaining = targetTimestamp - now;

        if (remaining <= 0) {
            clearInterval(countdownInterval);
            checkExitStatus();
            return;
        }

        const countdownEl = document.getElementById("countdown");
        if (countdownEl) {
            countdownEl.textContent = formatDuration(remaining);
        }
    }, 1000);
}

async function exitWallet() {
    try {
        exitBtn.disabled = true;
        showTxStatus("Submitting exit transaction...", "pending");

        const tx = await exchangeContract.exitWallet();
        showTxStatus("Transaction submitted. Waiting for confirmation...", "pending");

        await tx.wait();

        // Save exit time to localStorage
        localStorage.setItem(`exitTime_${userAddress}`, Math.floor(Date.now() / 1000).toString());

        showTxStatus("Wallet exit successful!", "success");

        await checkExitStatus();
    } catch (error) {
        console.error("Exit error:", error);
        showTxStatus("Exit failed: " + (error.reason || error.message), "error");
    } finally {
        exitBtn.disabled = false;
    }
}

async function withdrawExit() {
    try {
        withdrawBtn.disabled = true;
        showTxStatus("Submitting withdrawal transaction...", "pending");

        const tx = await exchangeContract.withdrawExit(userAddress);
        showTxStatus("Transaction submitted. Waiting for confirmation...", "pending");

        await tx.wait();

        // Clear exit time from localStorage
        localStorage.removeItem(`exitTime_${userAddress}`);

        showTxStatus("Withdrawal successful! Your USDC is now in your wallet.", "success");

        await Promise.all([checkExitStatus(), updateBalance()]);
    } catch (error) {
        console.error("Withdraw error:", error);
        showTxStatus("Withdrawal failed: " + (error.reason || error.message), "error");
    } finally {
        withdrawBtn.disabled = false;
    }
}

function setMaxAmount() {
    const formatted = ethers.formatUnits(usdcBalance, 6);
    bridgeAmountInput.value = formatted;
    resetQuote();
}

// Limit input to 6 decimal places
bridgeAmountInput.addEventListener("blur", () => {
    const value = bridgeAmountInput.value;
    if (value && !isNaN(value)) {
        const parts = value.split(".");
        if (parts[1] && parts[1].length > 6) {
            bridgeAmountInput.value = parseFloat(value).toFixed(6);
        }
    }
});

function resetQuote() {
    currentQuote = null;
    feeEstimate.classList.add("hidden");
    bridgeBtn.classList.add("hidden");
    quoteBtn.classList.remove("hidden");
}

async function getQuote() {
    const amountStr = bridgeAmountInput.value;
    if (!amountStr || parseFloat(amountStr) <= 0) {
        showTxStatus("Please enter a valid amount", "error");
        return;
    }

    const destChain = destChainSelect.value;
    const endpoint = LZ_ENDPOINTS[destChain];

    try {
        quoteBtn.disabled = true;
        quoteBtn.textContent = "Getting quote...";

        const amountLD = ethers.parseUnits(amountStr, 6);

        // Pad address to bytes32
        const toBytes32 = ethers.zeroPadValue(userAddress, 32);

        // SendParam struct
        const sendParam = {
            dstEid: endpoint.id,
            to: toBytes32,
            amountLD: amountLD,
            minAmountLD: amountLD * 99n / 100n, // 1% slippage
            extraOptions: "0x",
            composeMsg: "0x",
            oftCmd: "0x"
        };

        const [nativeFee, lzTokenFee] = await oftContract.quoteSend(sendParam, false);

        currentQuote = {
            sendParam,
            messagingFee: { nativeFee, lzTokenFee }
        };

        const feeInEth = ethers.formatEther(nativeFee);

        bridgeFeeEl.textContent = parseFloat(feeInEth).toFixed(6);
        receiveAmountEl.textContent = amountStr; // Same amount (OFT 1:1)

        feeEstimate.classList.remove("hidden");
        quoteBtn.classList.add("hidden");
        bridgeBtn.classList.remove("hidden");

        showTxStatus(`Quote ready for ${endpoint.name}`, "success");
    } catch (error) {
        console.error("Quote error:", error);
        showTxStatus("Failed to get quote: " + (error.reason || error.message), "error");
    } finally {
        quoteBtn.disabled = false;
        quoteBtn.textContent = "Get Quote";
    }
}

async function executeBridge() {
    if (!currentQuote) {
        showTxStatus("Please get a quote first", "error");
        return;
    }

    try {
        bridgeBtn.disabled = true;
        showTxStatus("Submitting bridge transaction...", "pending");

        const { sendParam, messagingFee } = currentQuote;

        const tx = await oftContract.send(
            sendParam,
            messagingFee,
            userAddress, // refund address
            { value: messagingFee.nativeFee }
        );

        showTxStatus("Transaction submitted. Waiting for confirmation...", "pending");

        await tx.wait();

        const destChain = destChainSelect.value;
        showTxStatus(`Bridge to ${LZ_ENDPOINTS[destChain].name} initiated! Funds will arrive shortly.`, "success");

        resetQuote();
        await updateBalance();
    } catch (error) {
        console.error("Bridge error:", error);
        showTxStatus("Bridge failed: " + (error.reason || error.message), "error");
    } finally {
        bridgeBtn.disabled = false;
    }
}

function showTxStatus(message, type) {
    txStatus.textContent = message;
    txStatus.className = "tx-status " + type;
    txStatus.classList.remove("hidden");
}

function formatTimestamp(timestamp) {
    return new Date(timestamp * 1000).toLocaleString();
}

function formatDuration(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

    return parts.join(" ");
}

if (window.ethereum) {
    window.ethereum.on("accountsChanged", () => window.location.reload());
    window.ethereum.on("chainChanged", () => window.location.reload());
}

function updateGuideSteps(step) {
    currentStep = step;
    for (let i = 1; i <= 5; i++) {
        const stepEl = document.getElementById(`step${i}`);
        stepEl.classList.remove("active", "completed");
        if (i < step) {
            stepEl.classList.add("completed");
        } else if (i === step) {
            stepEl.classList.add("active");
        }
    }
}

// Initialize step 1 as active
updateGuideSteps(1);
