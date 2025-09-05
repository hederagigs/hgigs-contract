const { ethers, upgrades } = require("hardhat");

async function main() {
  // Replace with your proxy address from deployment
  const PROXY_ADDRESS = process.env.PROXY_ADDRESS;
  
  if (!PROXY_ADDRESS) {
    console.error("Please set PROXY_ADDRESS environment variable");
    process.exit(1);
  }

  console.log("Upgrading GigMarketplace contract...");
  console.log("Proxy address:", PROXY_ADDRESS);

  const [deployer] = await ethers.getSigners();
  console.log("Upgrading with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "HBAR");

  // Get the new contract factory
  const GigMarketplaceV2 = await ethers.getContractFactory("GigMarketplace");
  
  console.log("Upgrading proxy...");
  const upgraded = await upgrades.upgradeProxy(PROXY_ADDRESS, GigMarketplaceV2);
  
  const newImplementationAddress = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);

  console.log("Contract upgraded!");
  console.log("Proxy address (unchanged):", PROXY_ADDRESS);
  console.log("New implementation address:", newImplementationAddress);
  console.log("Network:", (await ethers.provider.getNetwork()).name);

  // Verify the upgrade worked
  console.log("\nVerifying upgrade...");
  const contract = await ethers.getContractAt("GigMarketplace", PROXY_ADDRESS);
  const owner = await contract.owner();
  console.log("Contract owner:", owner);
  console.log("✅ Upgrade completed successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });