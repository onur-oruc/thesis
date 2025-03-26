// Script to deploy all contracts for the demo
const hre = require("hardhat");

async function main() {
  console.log("Starting deployment of all contracts for the demo...");

  // Get the signers
  const [deployer, oem1, oem2, oem3, repairShop1, repairShop2, gov1, gov2] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  
  console.log("\nAccounts being used:");
  console.log("- Deployer:", deployer.address);
  console.log("- OEM 1:", oem1.address);
  console.log("- OEM 2:", oem2.address);
  console.log("- OEM 3:", oem3.address);
  console.log("- Repair Shop 1:", repairShop1.address);
  console.log("- Repair Shop 2:", repairShop2.address);
  console.log("- Government 1:", gov1.address);
  console.log("- Government 2:", gov2.address);

  // Define initial OEMs
  const initialOEMs = [oem1.address, oem2.address, oem3.address];
  console.log("\nInitial OEMs:", initialOEMs);

  // Deploy ParticipantRegistry first
  console.log("\nDeploying ParticipantRegistry...");
  const ParticipantRegistry = await hre.ethers.getContractFactory("ParticipantRegistry");
  const participantRegistry = await ParticipantRegistry.deploy();
  await participantRegistry.waitForDeployment();
  const participantRegistryAddress = await participantRegistry.getAddress();
  console.log("ParticipantRegistry deployed to:", participantRegistryAddress);

  // Deploy BatteryGovernance with registry
  console.log("\nDeploying BatteryGovernance...");
  const BatteryGovernance = await hre.ethers.getContractFactory("BatteryGovernance");
  const governance = await BatteryGovernance.deploy(participantRegistryAddress);
  await governance.waitForDeployment();
  const governanceAddress = await governance.getAddress();
  console.log("BatteryGovernance deployed to:", governanceAddress);

  // Deploy PermissionNFT with governance address
  console.log("\nDeploying PermissionNFT...");
  const PermissionNFT = await hre.ethers.getContractFactory("PermissionNFT");
  const permissionNFT = await PermissionNFT.deploy(governanceAddress, initialOEMs);
  await permissionNFT.waitForDeployment();
  const permissionNFTAddress = await permissionNFT.getAddress();
  console.log("PermissionNFT deployed to:", permissionNFTAddress);

  // Deploy BatteryNFT with governance address
  console.log("\nDeploying BatteryNFT...");
  const BatteryNFT = await hre.ethers.getContractFactory("BatteryNFT");
  const batteryNFT = await BatteryNFT.deploy(governanceAddress, initialOEMs);
  await batteryNFT.waitForDeployment();
  const batteryNFTAddress = await batteryNFT.getAddress();
  console.log("BatteryNFT deployed to:", batteryNFTAddress);

  // Deploy DataRegistry
  console.log("\nDeploying DataRegistry...");
  const DataRegistry = await hre.ethers.getContractFactory("DataRegistry");
  const dataRegistry = await DataRegistry.deploy(governanceAddress, initialOEMs);
  await dataRegistry.waitForDeployment();
  const dataRegistryAddress = await dataRegistry.getAddress();
  console.log("DataRegistry deployed to:", dataRegistryAddress);

  // Set PermissionNFT in Governance
  console.log("\nSetting up contract references...");
  const setPermissionTx = await governance.setPermissionNFT(permissionNFTAddress);
  await setPermissionTx.wait();
  console.log("PermissionNFT set in BatteryGovernance");

  // Set DataRegistry in BatteryNFT
  const setDataRegistryTx = await batteryNFT.setDataRegistry(dataRegistryAddress);
  await setDataRegistryTx.wait();
  console.log("DataRegistry set in BatteryNFT");

  // Set up roles in ParticipantRegistry
  console.log("\nSetting up roles in ParticipantRegistry...");
  // Grant Governance role
  await participantRegistry.grantRole(await participantRegistry.GOVERNANCE_ROLE(), governanceAddress);
  console.log("Governance role granted to governance contract");
  
  // Grant OEM roles
  for (const oemAddress of initialOEMs) {
    await participantRegistry.grantRole(await participantRegistry.getOEMRole(), oemAddress);
    console.log(`OEM role granted to ${oemAddress}`);
  }

  console.log("\nDeployment complete!");
  console.log("Contract addresses:");
  console.log({
    participantRegistry: participantRegistryAddress,
    governance: governanceAddress,
    permissionNFT: permissionNFTAddress,
    batteryNFT: batteryNFTAddress,
    dataRegistry: dataRegistryAddress
  });

  // Save addresses to a file for other scripts to use
  const fs = require('fs');
  const contractAddresses = {
    participantRegistry: participantRegistryAddress,
    governance: governanceAddress,
    permissionNFT: permissionNFTAddress,
    batteryNFT: batteryNFTAddress,
    dataRegistry: dataRegistryAddress
  };
  
  fs.writeFileSync(
    './demos/march-27/contract-addresses.json',
    JSON.stringify(contractAddresses, null, 2)
  );
  console.log("\nContract addresses saved to demos/march-27/contract-addresses.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 