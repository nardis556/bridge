let provider;
let signer;
let contract;
let userAddress;

const connectBtn = document.getElementById("connectBtn");
const walletAddressEl = document.getElementById("walletAddress");
const statusSection = document.getElementById("statusSection");
const exitStatus = document.getElementById("exitStatus");
const actionsSection = document.getElementById("actionsSection");
const exitBtn = document.getElementById("exitBtn");
const withdrawBtn = document.getElementById("withdrawBtn");
const actionMessage = document.getElementById("actionMessage");
const txStatus = document.getElementById("txStatus");

connectBtn.addEventListener("click", connectWallet);
exitBtn.addEventListener("click", exitWallet);
withdrawBtn.addEventListener("click", withdrawExit);

async function connectWallet() {
    if (!window.ethereum) {
        alert("Please install MetaMask or another Web3 wallet");
        return;
    }

    try {
        connectBtn.textContent = "Connecting...";
        connectBtn.disabled = true;

        // Request accounts first
        await window.ethereum.request({ method: "eth_requestAccounts" });

        // Switch to correct network
        const chainIdHex = "0x" + CHAIN_ID.toString(16);
        try {
            await window.ethereum.request({
                method: "wallet_switchEthereumChain",
                params: [{ chainId: chainIdHex }]
            });
        } catch (switchError) {
            // Chain not added, add it
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

        contract = new ethers.Contract(EXCHANGE_ADDRESS, EXCHANGE_ABI, signer);

        connectBtn.textContent = "Connected";
        walletAddressEl.textContent = userAddress;

        statusSection.classList.remove("hidden");
        actionsSection.classList.remove("hidden");

        await checkExitStatus();
    } catch (error) {
        console.error("Connection error:", error);
        connectBtn.textContent = "Connect Wallet";
        connectBtn.disabled = false;
        showTxStatus("Failed to connect: " + error.message, "error");
    }
}

async function checkExitStatus() {
    try {
        const [exitInfo, propagationPeriod] = await Promise.all([
            contract.walletExits(userAddress),
            contract.chainPropagationPeriodInS()
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
        } else {
            const withdrawAvailableAt = effectiveBlockTimestamp + propagationPeriodSeconds;
            const now = Math.floor(Date.now() / 1000);
            const timeRemaining = withdrawAvailableAt - now;

            if (timeRemaining > 0) {
                exitStatus.innerHTML = `
                    <p><span class="status-label">Status:</span> <span class="status-value pending">Exit Pending</span></p>
                    <p><span class="status-label">Exit Time:</span> <span class="status-value">${formatTimestamp(effectiveBlockTimestamp)}</span></p>
                    <p><span class="status-label">Withdraw Available:</span> <span class="status-value">${formatTimestamp(withdrawAvailableAt)}</span></p>
                    <p><span class="status-label">Time Remaining:</span> <span class="status-value countdown" id="countdown">${formatDuration(timeRemaining)}</span></p>
                `;
                exitBtn.classList.add("hidden");
                withdrawBtn.classList.add("hidden");
                actionMessage.textContent = "Please wait for the propagation period to complete.";

                startCountdown(withdrawAvailableAt);
            } else {
                exitStatus.innerHTML = `
                    <p><span class="status-label">Status:</span> <span class="status-value ready">Ready to Withdraw</span></p>
                    <p><span class="status-label">Exit Time:</span> <span class="status-value">${formatTimestamp(effectiveBlockTimestamp)}</span></p>
                `;
                exitBtn.classList.add("hidden");
                withdrawBtn.classList.remove("hidden");
                actionMessage.textContent = "You can now withdraw your funds.";
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

        const tx = await contract.exitWallet();
        showTxStatus("Transaction submitted. Waiting for confirmation...", "pending");

        await tx.wait();
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

        const tx = await contract.withdrawExit(userAddress);
        showTxStatus("Transaction submitted. Waiting for confirmation...", "pending");

        await tx.wait();
        showTxStatus("Withdrawal successful!", "success");

        await checkExitStatus();
    } catch (error) {
        console.error("Withdraw error:", error);
        showTxStatus("Withdrawal failed: " + (error.reason || error.message), "error");
    } finally {
        withdrawBtn.disabled = false;
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

// Listen for account changes
if (window.ethereum) {
    window.ethereum.on("accountsChanged", (accounts) => {
        if (accounts.length > 0) {
            window.location.reload();
        }
    });
}
