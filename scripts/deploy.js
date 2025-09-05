const { ethers, upgrades } = require("hardhat");

async function main() {
  console.log("Deploying upgradeable GigMarketplace contract...");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "HBAR");

  const GigMarketplace = await ethers.getContractFactory("GigMarketplace");
  
  console.log("Deploying proxy...");
  const gigMarketplace = await upgrades.deployProxy(GigMarketplace, [], {
    initializer: 'initialize'
  });

  await gigMarketplace.waitForDeployment();
  const proxyAddress = await gigMarketplace.getAddress();
  const implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);

  console.log("GigMarketplace proxy deployed to:", proxyAddress);
  console.log("Implementation deployed to:", implementationAddress);
  console.log("Transaction hash:", gigMarketplace.deploymentTransaction().hash);

  console.log("\nDeployment completed!");
  console.log("Proxy address:", proxyAddress);
  console.log("Implementation address:", implementationAddress);
  console.log("Network:", (await ethers.provider.getNetwork()).name);
  
  console.log("\nTo upgrade later, use the upgrade script with these addresses.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });