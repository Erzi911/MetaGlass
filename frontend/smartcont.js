const ethers = window.ethers;
const cfg = window.DAPP_CONFIG;
const $ = (id) => document.getElementById(id);

let browserProvider = null;
let account = null;

let nerdRead = null;
let nerdWrite = null;
let smartWrite = null;

let nerdAbi = null;
let smartAbi = null;

async function loadAbi(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error("ABI not found: " + path);
  return await r.json();
}

function fmtEth(weiStr) {
  try {
    return ethers.formatEther(weiStr);
  } catch {
    return String(weiStr);
  }
}

function fmtError(e) {
  const msg = (e?.shortMessage || e?.message || String(e)).toLowerCase();
  if (msg.includes("user rejected")) return "";
  if (msg.includes("insufficient funds"))
    return "Not enough ETH in your wallet. Get free Sepolia ETH from a faucet (e.g. sepoliafaucet.com).";
  if (msg.includes("insufficient balance") || msg.includes("erc20insufficientbalance"))
    return "Not enough NRD tokens in your wallet.";
  if (msg.includes("missing revert data"))
    return "Transaction rejected. Check drop conditions above.";
  return e?.shortMessage || e?.message || String(e);
}

async function connect() {
  if (!window.ethereum) {
    alert("Install MetaMask");
    return;
  }

  browserProvider = new ethers.BrowserProvider(window.ethereum);
  const net = await browserProvider.getNetwork();
  const ok = Number(net.chainId) === Number(cfg.CHAIN_ID);
  $("netStatus").textContent = ok ? "Connected" : `Wrong (${net.chainId})`;

  if (!ok) {
    alert(`Switch MetaMask network to chainId ${cfg.CHAIN_ID}`);
    return;
  }

  const signer = await browserProvider.getSigner();
  account = await signer.getAddress();
  $("myAddr").textContent = account;

  nerdRead = new ethers.Contract(cfg.NERD_ADDRESS, nerdAbi, browserProvider);
  nerdWrite = new ethers.Contract(cfg.NERD_ADDRESS, nerdAbi, signer);
  smartWrite = new ethers.Contract(cfg.SMARTCONT_ADDRESS, smartAbi, signer);

  await refreshAll();
  startAutoRefresh();
}

async function refreshWalletAndQueue() {
  if (!browserProvider || !account) return;
  const nerd = nerdRead || new ethers.Contract(cfg.NERD_ADDRESS, nerdAbi, browserProvider);

  const [ethBalWei, nrdBalWei] = await Promise.all([
    browserProvider.getBalance(account),
    nerd.balanceOf(account)
  ]);

  $("ethBal").textContent = fmtEth(ethBalWei.toString());
  $("myBal").textContent = ethers.formatUnits(nrdBalWei, 18);

  try {
    const n = Number(await nerd.hsLen());
    const limit = Math.min(n, 500);
    const seen = new Map();
    for (let i = 0; i < limit; i++) {
      const a = await nerd.hs(i);
      const b = await nerd.balanceOf(a);
      if (b > 0n) {
        const key = a.toLowerCase();
        if (!seen.has(key) || b > seen.get(key).b) seen.set(key, { a, b });
      }
    }
    const arr = [...seen.values()];
    arr.sort((x, y) => (y.b > x.b ? 1 : y.b < x.b ? -1 : x.a.localeCompare(y.a)));
    const idx = arr.findIndex((x) => x.a.toLowerCase() === account.toLowerCase());
    $("myPos").textContent = idx >= 0 ? String(idx + 1) : "-";
  } catch {
    $("myPos").textContent = "-";
  }
}

async function refreshQueueState() {
  if (!browserProvider) return;
  const smart = new ethers.Contract(cfg.SMARTCONT_ADDRESS, smartAbi, browserProvider);
  const [lastTs, maxStale] = await Promise.all([
    smart.lastQueueUpdateTs(),
    smart.maxQueueStalenessSeconds()
  ]);

  $("maxQueueStaleness").textContent = maxStale.toString();
  const ts = Number(lastTs);
  $("lastQueueUpdate").textContent = ts === 0 ? "-" : new Date(ts * 1000).toLocaleString();
}

async function refreshDropState() {
  if (!browserProvider) return;
  const smart = new ethers.Contract(cfg.SMARTCONT_ADDRESS, smartAbi, browserProvider);
  const nerd = nerdRead || new ethers.Contract(cfg.NERD_ADDRESS, nerdAbi, browserProvider);

  const [dropId, dropActive, priceWei, left, maxPos, lastQueueTs, maxStale] = await Promise.all([
    smart.dropId(),
    smart.dropActive(),
    smart.glassesPriceWei(),
    smart.glassesLeft(),
    smart.maxPositionAllowed(),
    smart.lastQueueUpdateTs(),
    smart.maxQueueStalenessSeconds()
  ]);

  $("dropId").textContent = dropId.toString();
  $("dropActive").textContent = dropActive ? "Yes" : "No";
  
  let status = "Inactive";
  if (dropActive && Number(left) > 0) {
    status = "Active - Available";
  } else if (dropActive && Number(left) === 0) {
    status = "Active - Sold Out";
  } else if (!dropActive && Number(dropId) > 0) {
    status = "Ended";
  }
  $("dropStatus").textContent = status;
  
  $("glassesPrice").textContent = fmtEth(priceWei.toString());
  $("glassesLeft").textContent = left.toString();
  $("maxPositionAllowed").textContent = maxPos.toString();

  let myPos = "-";
  if (account) {
    try {
      const n = Number(await nerd.hsLen());
      const limit = Math.min(n, 500);
      const seen = new Map();
      for (let i = 0; i < limit; i++) {
        const a = await nerd.hs(i);
        const b = await nerd.balanceOf(a);
        if (b > 0n) {
          const key = a.toLowerCase();
          if (!seen.has(key) || b > seen.get(key).b) seen.set(key, { a, b });
        }
      }
      const arr = [...seen.values()];
      arr.sort((x, y) => (y.b > x.b ? 1 : y.b < x.b ? -1 : x.a.localeCompare(y.a)));
      const idx = arr.findIndex((x) => x.a.toLowerCase() === account.toLowerCase());
      myPos = idx >= 0 ? String(idx + 1) : "-";
    } catch {
      myPos = "-";
    }
  }
  $("myPositionForDrop").textContent = myPos;

  let already = "-";
  if (account) {
    try {
      const lastBought = await smart.lastBoughtDrop(account);
      already = lastBought === dropId ? "Yes" : "No";
    } catch {
      already = "-";
    }
  }
  $("alreadyBoughtDrop").textContent = already;

  const now = Math.floor(Date.now() / 1000);
  const queueTs = Number(lastQueueTs);
  const staleSec = Number(maxStale);
  let queueFresh = "-";
  if (queueTs > 0) {
    const age = now - queueTs;
    queueFresh = age <= staleSec ? "Yes (" + age + "s old)" : "No (" + age + "s old, max " + staleSec + "s)";
  }
  $("queueFresh").textContent = queueFresh;

  let infoMsg = "";
  if (!dropActive) {
    infoMsg = "Drop is not active. Wait for owner to configure a new drop.";
  } else if (Number(left) === 0) {
    infoMsg = "All glasses from this drop have been sold.";
  } else if (account && already === "Yes") {
    infoMsg = "You already bought from this drop. Wait for the next drop.";
  } else if (account && myPos !== "-" && Number(maxPos) > 0 && Number(myPos) > Number(maxPos)) {
    infoMsg = "Your position (" + myPos + ") is too high. Max allowed: " + maxPos + ".";
  } else if (queueFresh !== "-" && !queueFresh.startsWith("Yes")) {
    infoMsg = "Queue is stale. Refresh queue before buying.";
  } else if (dropActive && Number(left) > 0 && account && already === "No") {
    infoMsg = "You can buy glasses! Make sure queue is fresh and your position is within limit.";
  }
  $("dropInfo").textContent = infoMsg || "Check conditions above to see if you can buy.";
}

async function refreshAll() {
  $("chainId").textContent = String(cfg.CHAIN_ID);
  $("nerdAddr").textContent = cfg.NERD_ADDRESS;
  $("smartAddr").textContent = cfg.SMARTCONT_ADDRESS;

  await Promise.allSettled([
    refreshWalletAndQueue(),
    refreshQueueState(),
    refreshDropState()
  ]);
}

let autoRefreshTimer = null;
function startAutoRefresh() {
  if (autoRefreshTimer) clearInterval(autoRefreshTimer);
  autoRefreshTimer = setInterval(async () => {
    if (browserProvider) {
      await Promise.allSettled([
        refreshQueueState(),
        refreshWalletAndQueue(),
        refreshDropState()
      ]);
    }
  }, 15000); 
}

async function refreshQueue() {
  $("queueMsg").textContent = "";
  try {
    if (!smartWrite) throw new Error("Connect MetaMask first");
    const tx = await smartWrite.refreshQueue();
    $("queueMsg").textContent = "Pending: " + tx.hash;
    await tx.wait();
    $("queueMsg").textContent = "Queue refreshed: " + tx.hash;
    await refreshAll();
  } catch (e) {
    const m = fmtError(e);
    $("queueMsg").textContent = m ? "Error: " + m : "";
  }
}

async function buyGlasses() {
  $("buyGlassesMsg").textContent = "";
  try {
    if (!smartWrite) throw new Error("Connect MetaMask first");

    const smart = new ethers.Contract(cfg.SMARTCONT_ADDRESS, smartAbi, browserProvider || smartWrite.runner);
    const priceWei = await smart.glassesPriceWei();

    const tx = await smartWrite.buyGlasses({ value: priceWei });
    $("buyGlassesMsg").textContent = "Pending: " + tx.hash;
    await tx.wait();
    $("buyGlassesMsg").textContent = "Success: " + tx.hash;

    await refreshAll();
  } catch (e) {
    const m = fmtError(e);
    $("buyGlassesMsg").textContent = m ? "Error: " + m : "";
  }
}

async function boot() {
  nerdAbi = await loadAbi("./abi/Nerd.json");
  smartAbi = await loadAbi("./abi/SmartCont.json");

  $("chainId").textContent = String(cfg.CHAIN_ID);
  $("nerdAddr").textContent = cfg.NERD_ADDRESS;
  $("smartAddr").textContent = cfg.SMARTCONT_ADDRESS;

  $("btnConnect").addEventListener("click", connect);
  $("btnBuyGlasses").addEventListener("click", buyGlasses);
  $("btnRefreshQueue").addEventListener("click", refreshQueue);

  await refreshAll();
}

boot().catch((e) => console.error(e));