/**
 * Battery Passport on Blockchain - Deployment Script
 * ==================================================
 * 
 * This script deploys the entire battery passport system, including all smart contracts
 * and their initial configuration. It demonstrates the complete deployment flow required
 * to set up the system from scratch.
 * 
 * The deployment process involves:
 * 
 * 1. Deploying core contracts in the correct dependency order:
 *    - ParticipantRegistry: Manages roles and tracks compromised wallets
 *    - BatteryGovernance: Provides tiered approval mechanism for system actions
 *    - PermissionNFT: Handles temporary and permanent permissions for repair shops
 *    - BatteryNFT: Manages battery and battery module NFTs and their relations
 *    - DataRegistry: Stores references to off-chain battery data with locations and encryption info
 * 
 * 2. Configuring contract references:
 *    - Setting the PermissionNFT contract reference in the Governance contract
 *    - Setting the DataRegistry reference in the BatteryNFT contract
 * 
 * 3. Setting up the role-based access control system:
 *    - Granting GOVERNANCE_ROLE to the deployer in BatteryNFT for admin tasks
 *    - Configuring the role hierarchy in ParticipantRegistry
 *    - Granting GOVERNANCE_ROLE to the governance contract in ParticipantRegistry
 *    - Assigning OEM_ROLE to initial OEM addresses
 * 
 * 4. Saving deployed contract addresses for use by other demo scripts
 * 
 * The script uses the first 8 addresses from Hardhat's built-in accounts:
 * - Deployer (admin who deploys all contracts)
 * - OEM1, OEM2, OEM3 (three addresses representing OEM representatives)
 * - RepairShop1, RepairShop2 (repair shop addresses for demo scenarios)
 * - Gov1, Gov2 (government representatives)
 * 
 * This deployment creates a fully functional battery passport system ready for the
 * demonstration of battery NFT creation, permission management, battery data updates,
 * and compromised wallet handling in subsequent demo scripts.
 */

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

  // Grant GOVERNANCE_ROLE to deployer in BatteryNFT
  console.log("\nGranting GOVERNANCE_ROLE to deployer in BatteryNFT...");
  const GOVERNANCE_ROLE = await batteryNFT.GOVERNANCE_ROLE();
  await batteryNFT.grantRole(GOVERNANCE_ROLE, deployer.address);
  console.log("GOVERNANCE_ROLE granted to deployer in BatteryNFT");

  // Set DataRegistry in BatteryNFT
  console.log("\nSetting DataRegistry in BatteryNFT...");
  const setDataRegistryTx = await batteryNFT.setDataRegistry(dataRegistryAddress);
  await setDataRegistryTx.wait();
  console.log("DataRegistry set in BatteryNFT");

  // Set up roles in ParticipantRegistry
  console.log("\nSetting up roles in ParticipantRegistry...");
  
  // Make sure deployer has GOVERNANCE_ROLE in ParticipantRegistry
  console.log("Checking if deployer has GOVERNANCE_ROLE in ParticipantRegistry...");
  // Check if the deployer already has the GOVERNANCE_ROLE
  const govRole = await participantRegistry.GOVERNANCE_ROLE();
  const hasGovRole = await participantRegistry.hasRole(govRole, deployer.address);
  
  if (!hasGovRole) {
    // The deployer should have ADMIN_ROLE by default (from constructor)
    // So we can grant GOVERNANCE_ROLE to ourselves first
    console.log("Granting GOVERNANCE_ROLE to deployer...");
    await participantRegistry.grantRole(govRole, deployer.address);
    console.log("GOVERNANCE_ROLE granted to deployer");
  } else {
    console.log("Deployer already has GOVERNANCE_ROLE");
  }
  
  // Grant Governance role to the governance contract
  console.log("Granting GOVERNANCE_ROLE to governance contract...");
  await participantRegistry.grantRole(govRole, governanceAddress);
  console.log("Governance role granted to governance contract");
  
  // Grant OEM roles
  const oemRole = await participantRegistry.getOEMRole();
  console.log("Granting OEM_ROLE to OEMs...");
  for (const oemAddress of initialOEMs) {
    await participantRegistry.grantRole(oemRole, oemAddress);
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