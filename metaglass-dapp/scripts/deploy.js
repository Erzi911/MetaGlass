const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  const treasury = deployer.address;

  const Nerd = await ethers.getContractFactory("Nerd");
  const nerd = await Nerd.deploy(treasury);
  await nerd.waitForDeployment();
  const nerdAddr = await nerd.getAddress();

  const Crowdfund = await ethers.getContractFactory("Crowdfund");
  const crowdfund = await Crowdfund.deploy(nerdAddr, treasury);
  await crowdfund.waitForDeployment();
  const crowdfundAddr = await crowdfund.getAddress();

  const SmartCont = await ethers.getContractFactory("SmartCont");
  const priceWeiPerToken = ethers.parseEther("0.01"); 
  const smartcont = await SmartCont.deploy(nerdAddr, treasury, priceWeiPerToken);
  await smartcont.waitForDeployment();
  const smartcontAddr = await smartcont.getAddress();

  await (await nerd.setMinter(crowdfundAddr, true)).wait();
  await (await nerd.setMinter(smartcontAddr, true)).wait();

  const nerdArtifact = await artifacts.readArtifact("Nerd");
  const crowdfundArtifact = await artifacts.readArtifact("Crowdfund");
  const smartcontArtifact = await artifacts.readArtifact("SmartCont");

  const frontendDirs = [
    path.join(__dirname, "..", "frontend"),
    path.join(__dirname, "..", "..", "frontend")
  ];

  for (const fe of frontendDirs) {
    const abiDir = path.join(fe, "abi");
    fs.mkdirSync(abiDir, { recursive: true });
    fs.writeFileSync(path.join(abiDir, "Nerd.json"), JSON.stringify(nerdArtifact.abi, null, 2));
    fs.writeFileSync(path.join(abiDir, "Crowdfund.json"), JSON.stringify(crowdfundArtifact.abi, null, 2));
    fs.writeFileSync(path.join(abiDir, "SmartCont.json"), JSON.stringify(smartcontArtifact.abi, null, 2));

    const cfg = `window.DAPP_CONFIG = {
  CHAIN_ID: 11155111,
  NERD_ADDRESS: "${nerdAddr}",
  CROWDFUND_ADDRESS: "${crowdfundAddr}",
  SMARTCONT_ADDRESS: "${smartcontAddr}",
  RPC_WSS: "${process.env.SEPOLIA_WSS_URL || ""}"
};`;
    fs.writeFileSync(path.join(fe, "config.js"), cfg);
  }

  console.log("Nerd:", nerdAddr);
  console.log("Crowdfund:", crowdfundAddr);
  console.log("SmartCont:", smartcontAddr);
  console.log("Saved ABI + frontend/config.js (both frontends)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
