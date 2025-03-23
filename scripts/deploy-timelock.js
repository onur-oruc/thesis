const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // Deploy the TimeController first (it's needed for Governor)
  const minDelay = 0; // No delay for prototype
  const proposers = [deployer.address]; // Initially just the deployer can propose
  const executors = [ethers.ZeroAddress]; // Anyone can execute
  
  const BatteryTimelock = await ethers.getContractFactory("BatteryTimelock");
  const timelock = await BatteryTimelock.deploy(
    minDelay,
    proposers,
    executors,
    deployer.address // Admin
  );
  
  await timelock.waitForDeployment();
  
  console.log("BatteryTimelock deployed to:", await timelock.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 