// Script to deploy the Battery NFT, Permission NFT, and Governance contracts
const hre = require("hardhat");

async function main() {
  console.log("Starting deployment...");

  // Get the signers
  const [deployer, ...otherAccounts] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // Define initial OEMs (first 3 accounts)
  const initialOEMs = otherAccounts.slice(0, 3).map(acct => acct.address);
  console.log("Initial OEMs:", initialOEMs);

  // Deploy BatteryGovernance first
  const BatteryGovernance = await hre.ethers.getContractFactory("BatteryGovernance");
  const governance = await BatteryGovernance.deploy(initialOEMs);
  await governance.waitForDeployment();
  const governanceAddress = await governance.getAddress();
  console.log("BatteryGovernance deployed to:", governanceAddress);

  // Deploy PermissionNFT with governance address
  const PermissionNFT = await hre.ethers.getContractFactory("PermissionNFT");
  const permissionNFT = await PermissionNFT.deploy(governanceAddress, initialOEMs);
  await permissionNFT.waitForDeployment();
  const permissionNFTAddress = await permissionNFT.getAddress();
  console.log("PermissionNFT deployed to:", permissionNFTAddress);

  // Deploy BatteryNFT with governance address
  const BatteryNFT = await hre.ethers.getContractFactory("BatteryNFT");
  const batteryNFT = await BatteryNFT.deploy(governanceAddress, initialOEMs);
  await batteryNFT.waitForDeployment();
  const batteryNFTAddress = await batteryNFT.getAddress();
  console.log("BatteryNFT deployed to:", batteryNFTAddress);

  // Set PermissionNFT in Governance
  const setPermissionTx = await governance.setPermissionNFT(permissionNFTAddress);
  await setPermissionTx.wait();
  console.log("PermissionNFT set in BatteryGovernance");

  console.log("Deployment complete!");
  console.log({
    governanceAddress,
    permissionNFTAddress,
    batteryNFTAddress
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 