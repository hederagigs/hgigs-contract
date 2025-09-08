const { ethers, upgrades } = require("hardhat");

async function main() {
  console.log("Deploying upgradeable Bookings contract...");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "HBAR");

  const Bookings = await ethers.getContractFactory("Bookings");
  
  console.log("Deploying proxy...");
  const bookings = await upgrades.deployProxy(Bookings, [], {
    initializer: 'initialize'
  });

  await bookings.waitForDeployment();
  const proxyAddress = await bookings.getAddress();
  const implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);

  console.log("Bookings proxy deployed to:", proxyAddress);
  console.log("Implementation deployed to:", implementationAddress);
  console.log("Transaction hash:", bookings.deploymentTransaction().hash);

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