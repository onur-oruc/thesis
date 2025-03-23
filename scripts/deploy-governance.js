const { ethers } = require("hardhat");

async function main() {
  const [deployer, oem1, oem2] = await ethers.getSigners();
  console.log("Deploying governance with the account:", deployer.address);

  // Get the timelock address from previous deployment
  const timelockAddress = "PASTE_TIMELOCK_ADDRESS_HERE"; // Replace with actual address
  
  // Create array of initial OEM participants (3 addresses)
  const initialOEMs = [
    deployer.address, // First OEM participant
    oem1.address,     // Second OEM participant  
    oem2.address      // Third OEM participant
  ];
  
  // Deploy Governor
  const BatteryGovernance = await ethers.getContractFactory("BatteryGovernance");
  const governance = await BatteryGovernance.deploy(
    timelockAddress,
    initialOEMs
  );
  
  await governance.waitForDeployment();
  
  console.log("BatteryGovernance deployed to:", await governance.getAddress());
  console.log("Initial OEM participants:", initialOEMs);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 