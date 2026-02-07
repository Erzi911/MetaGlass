const ethers = window.ethers;
const cfg = window.DAPP_CONFIG;
const $ = (id) => document.getElementById(id);

let browserProvider = null;
let account = null;

let nerdWrite = null;
let crowdfundWrite = null;
let nerdRead = null;

let nerdAbi = null;
let crowdfundAbi = null;

async function loadAbi(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error("ABI not found: " + path);
  return await r.json();
}

function fmtEth(weiStr) {
  try { return ethers.formatEther(weiStr); } catch { return String(weiStr); }
}

function fmtTok(weiStr) {
  try { return ethers.formatUnits(weiStr, 18); } catch { return String(weiStr); }
}

function fmtError(e) {
  const msg = (e?.shortMessage || e?.message || String(e)).toLowerCase();
  if (msg.includes("user rejected")) return "";
  if (msg.includes("insufficient funds"))
    return "Not enough ETH in your wallet. Get free Sepolia ETH from a faucet (e.g. sepoliafaucet.com).";
  if (msg.includes("insufficient balance") || msg.includes("erc20insufficientbalance"))
    return "Not enough NRD tokens in your wallet.";
  if (msg.includes("missing revert data"))
    return "Transaction rejected. Possible causes: sold out, max 100 NRD per wallet, or treasury/contract issue. Check supply left above.";
  return e?.shortMessage || e?.message || String(e);
}

async function initWss() {
  if (!cfg.RPC_WSS) {
    $("netStatus").textContent = "No WSS URL";
    return;
  }

  const wssProvider = new ethers.WebSocketProvider(cfg.RPC_WSS);
  nerdRead = new ethers.Contract(cfg.NERD_ADDRESS, nerdAbi, wssProvider);

  nerdRead.on("Transfer", async () => {
    await refreshTop10();
  });
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

  nerdWrite = new ethers.Contract(cfg.NERD_ADDRESS, nerdAbi, signer);
  crowdfundWrite = new ethers.Contract(cfg.CROWDFUND_ADDRESS, crowdfundAbi, signer);

  await refreshState();
  await refreshTop10();
  await refreshWallet();
  startAutoRefresh();
}

let autoRefreshTimer = null;
function startAutoRefresh() {
  if (autoRefreshTimer) clearInterval(autoRefreshTimer);
  autoRefreshTimer = setInterval(() => {
    if (nerdRead) refreshTop10();
    if (browserProvider) refreshState();
    if (browserProvider && account) refreshWallet();
  }, 15000);
}

async function refreshWallet() {
  if (!browserProvider || !account) return;
  const nerd = new ethers.Contract(cfg.NERD_ADDRESS, nerdAbi, browserProvider);
  const [ethBalWei, nrdBalWei, totalSupplyWei, maxSupplyWei] = await Promise.all([
    browserProvider.getBalance(account),
    nerd.balanceOf(account),
    nerd.totalSupply(),
    nerd.MAX_SUPPLY()
  ]);
  $("ethBal").textContent = fmtEth(ethBalWei.toString());
  $("myBal").textContent = fmtTok(nrdBalWei.toString());
  const remainingWei = maxSupplyWei - totalSupplyWei;
  $("tokensLeft").textContent = fmtTok(remainingWei.toString());
}

async function refreshState() {
  if (!browserProvider) return;
  const crowdfund = new ethers.Contract(cfg.CROWDFUND_ADDRESS, crowdfundAbi, browserProvider);
  const count = await crowdfund.getCampaignsCount();
  $("campaignCount").textContent = String(count);
}

async function refreshTop10() {
  if (!nerdRead) return;

  const n = Number(await nerdRead.hsLen());
  const limit = Math.min(n, 500);
  const seen = new Map();
  for (let i = 0; i < limit; i++) {
    const a = await nerdRead.hs(i);
    const b = await nerdRead.balanceOf(a);
    if (b > 0n) {
      const key = a.toLowerCase();
      if (!seen.has(key) || b > seen.get(key).b) seen.set(key, { a, b });
    }
  }
  const arr = [...seen.values()];
  arr.sort((x, y) => (y.b > x.b ? 1 : y.b < x.b ? -1 : x.a.localeCompare(y.a)));

  if (account) {
    const idx = arr.findIndex((x) => x.a.toLowerCase() === account.toLowerCase());
    $("myPos").textContent = idx >= 0 ? String(idx + 1) : "-";
    $("myBal").textContent = idx >= 0 ? fmtTok(arr[idx].b.toString()) : "0";
  }

  const body = $("top10Body");
  body.innerHTML = "";

  const top = arr.slice(0, 10);
  if (top.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="3" class="small">No data yet</td>`;
    body.appendChild(tr);
    return;
  }

  top.forEach((x, idx) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${idx + 1}</td><td class="small">${x.a}</td><td>${fmtTok(x.b.toString())}</td>`;
    body.appendChild(tr);
  });
}

async function createCampaign() {
  $("createCampaignMsg").textContent = "";
  try {
    if (!crowdfundWrite) throw new Error("Connect MetaMask first");
    const title = $("campaignTitle").value.trim();
    const goal = $("campaignGoal").value.trim();
    const durationHours = $("campaignDuration").value.trim();
    if (!title) throw new Error("Enter a title");
    if (!goal || isNaN(parseFloat(goal)) || parseFloat(goal) <= 0)
      throw new Error("Enter a valid goal in ETH");
    if (!durationHours || isNaN(parseFloat(durationHours)) || parseFloat(durationHours) <= 0)
      throw new Error("Enter a valid duration in hours");
    const goalWei = ethers.parseEther(goal);
    const durationSeconds = BigInt(Math.floor(parseFloat(durationHours) * 3600));
    const tx = await crowdfundWrite.createCampaign(title, goalWei, durationSeconds);
    $("createCampaignMsg").textContent = "Pending: " + tx.hash;
    await tx.wait();
    const id = await crowdfundWrite.getCampaignsCount();
    $("createCampaignMsg").textContent = "Created campaign #" + String(id) + ": " + tx.hash;
    await refreshState();
  } catch (e) {
    $("createCampaignMsg").textContent = "Error: " + fmtError(e);
  }
}

async function loadCampaign() {
  $("campaignInfo").textContent = "";
  $("finalizeSection").style.display = "none";
  try {
    if (!browserProvider) throw new Error("Connect MetaMask first");
    const idStr = $("viewCampaignId").value.trim();
    if (!idStr) throw new Error("Enter campaign ID");
    const id = BigInt(idStr);
    const crowdfund = new ethers.Contract(cfg.CROWDFUND_ADDRESS, crowdfundAbi, browserProvider);
    const [title, goal, deadline, totalRaised, finalized, successful, creator] = await crowdfund.getCampaign(id);
    let my = "0";
    if (account && crowdfundWrite) {
      const myWei = await crowdfundWrite.getMyContribution(id);
      my = fmtEth(myWei.toString());
    }
    const finalizedLabel = finalized ? "Yes" : "No";
    const successfulLabel = successful ? "Yes" : "No";
    const deadlineLabel = new Date(Number(deadline) * 1000).toLocaleString();
    const now = Math.floor(Date.now() / 1000);
    const isEnded = Number(deadline) <= now;

    const parts = [];
    parts.push(
      `<div class="stat"><span class="stat-label">Title</span><b>${title}</b></div>`
    );
    parts.push(
      `<div class="stat"><span class="stat-label">Goal</span><b>${fmtEth(goal.toString())} ETH</b></div>`
    );
    parts.push(
      `<div class="stat"><span class="stat-label">Raised</span><b>${fmtEth(totalRaised.toString())} ETH</b></div>`
    );
    parts.push(
      `<div class="stat"><span class="stat-label">Deadline</span><b>${deadlineLabel}</b></div>`
    );
    parts.push(
      `<div class="stat"><span class="stat-label">Finalized</span><b>${finalizedLabel}</b></div>`
    );
    parts.push(
      `<div class="stat"><span class="stat-label">Successful</span><b>${successfulLabel}</b></div>`
    );
    parts.push(
      `<div class="stat"><span class="stat-label">Creator</span><b class="creator-address">${creator}</b></div>`
    );
    if (account) {
      parts.push(
        `<div class="stat"><span class="stat-label">Your contribution</span><b>${my} ETH</b></div>`
      );
    }

    $("campaignInfo").innerHTML = `<div class="stats compact">${parts.join("")}</div>`;

    if (isEnded && !finalized && crowdfundWrite) {
      $("finalizeSection").style.display = "block";
    }
  } catch (e) {
    $("campaignInfo").textContent = "Error: " + fmtError(e);
  }
}

async function finalizeCampaign() {
  $("finalizeMsg").textContent = "";
  try {
    if (!crowdfundWrite) throw new Error("Connect MetaMask first");
    const idStr = $("viewCampaignId").value.trim();
    if (!idStr) throw new Error("Enter campaign ID");
    const id = BigInt(idStr);
    const tx = await crowdfundWrite.finalizeCampaign(id);
    $("finalizeMsg").textContent = "Pending: " + tx.hash;
    await tx.wait();
    $("finalizeMsg").textContent = "Success: " + tx.hash;
    await loadCampaign(); 
    await refreshState();
  } catch (e) {
    $("finalizeMsg").textContent = "Error: " + fmtError(e);
  }
}

async function contribute() {
  $("contributeMsg").textContent = "";
  try {
    if (!crowdfundWrite) throw new Error("Connect MetaMask first");
    const idStr = $("contribCampaignId").value.trim();
    const amountNrd = $("contribAmountEth").value.trim();
    if (!idStr) throw new Error("Enter campaign ID");
    if (!amountNrd || isNaN(parseFloat(amountNrd)) || parseFloat(amountNrd) <= 0)
      throw new Error("Enter a valid NRD amount");
    const id = BigInt(idStr);
    const nrdFloat = parseFloat(amountNrd);
    const ethAmount = nrdFloat / 100; 
    const valueWei = ethers.parseEther(ethAmount.toString());
    const tx = await crowdfundWrite.contribute(id, { value: valueWei });
    $("contributeMsg").textContent = "Pending: " + tx.hash;
    await tx.wait();
    $("contributeMsg").textContent = "Success: " + tx.hash;
    await refreshWallet();
    await refreshState();
    await refreshTop10();
  } catch (e) {
    $("contributeMsg").textContent = "Error: " + fmtError(e);
  }
}

async function sendTokens() {
  $("transferMsg").textContent = "";
  try {
    if (!nerdWrite) throw new Error("Connect MetaMask first");
    const to = $("transferTo").value.trim();
    const amount = $("transferAmount").value.trim();
    if (!to) throw new Error("Enter recipient address");
    if (!ethers.isAddress(to)) throw new Error("Enter a valid Ethereum address");
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0)
      throw new Error("Enter a valid NRD amount");
    const valueWei = ethers.parseUnits(amount, 18);
    const tx = await nerdWrite.transfer(to, valueWei);
    $("transferMsg").textContent = "Pending: " + tx.hash;
    await tx.wait();
    $("transferMsg").textContent = "Success: " + tx.hash;
    await refreshWallet();
    await refreshTop10();
  } catch (e) {
    $("transferMsg").textContent = "Error: " + fmtError(e);
  }
}

async function boot() {
  $("chainId").textContent = String(cfg.CHAIN_ID);
  $("nerdAddr").textContent = cfg.NERD_ADDRESS;
  $("smartAddr").textContent = cfg.CROWDFUND_ADDRESS;

  nerdAbi = await loadAbi("./abi/Nerd.json");
  crowdfundAbi = await loadAbi("./abi/Crowdfund.json");

  await initWss();
  await refreshTop10();

  $("btnConnect").addEventListener("click", connect);
  $("btnCreateCampaign").addEventListener("click", createCampaign);
  $("btnLoadCampaign").addEventListener("click", loadCampaign);
  $("btnContribute").addEventListener("click", contribute);
  $("btnSendTokens").addEventListener("click", sendTokens);
  $("btnFinalizeCampaign").addEventListener("click", finalizeCampaign);
}

boot().catch((e) => console.error(e));
