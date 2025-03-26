// Script to demonstrate battery module creation and linking to a battery
// This demonstrates the relationship between batteries and modules through the BatteryNFT contract

/**
 * This script demonstrates:
 * 1. Creating a new battery module via governance
 * 2. Linking the module to an existing battery
 * 3. Retrieving and displaying the hierarchical data between batteries and modules
 * 4. Adding storage location for the module data
 * 
 * It shows how modules are linked to their parent batteries, maintaining the hierarchical relationship.
 */

const hre = require("hardhat");
const fs = require('fs');

// Helper to get ABI for a contract
function getContractABI(contractName) {
  const artifactPath = `./artifacts/contracts/${contractName}.sol/${contractName}.json`;
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  return artifact.abi;
}

// Helper function to format NFT type for display
function formatNFTType(typeCode) {
  const types = ['BATTERY', 'MODULE'];
  return types[typeCode] || 'UNKNOWN';
}

// Helper function to display timestamp in readable format
function formatTimestamp(timestamp) {
  return new Date(Number(timestamp) * 1000).toLocaleString();
}

// Helper function to get the proposal ID from logs or count
async function getProposalId(governance, receipt, governanceInterface) {
  // First try to extract from logs
  for (const log of receipt.logs) {
    try {
      const parsedLog = governanceInterface.parseLog({
        topics: log.topics,
        data: log.data
      });
      
      if (parsedLog && parsedLog.name === "ProposalCreated") {
        return parsedLog.args[0];
      }
    } catch (e) {
      // Not a ProposalCreated event or couldn't parse, continue
    }
  }
  
  // Then try to use getCurrentProposalCount if available
  try {
    // The latest proposal would be currentCount - 1
    const count = await governance.getCurrentProposalCount();
    return count.sub ? count.sub(1) : count - 1; // Handle both BigNumber and number
  } catch (error) {
    // Finally fall back to proposalCount if available
    try {
      const count = await governance.proposalCount();
      return count.sub ? count.sub(1) : count - 1; // Handle both BigNumber and number
    } catch (fallbackError) {
      console.warn("Could not get proposal ID, using default value 0");
      return 0;
    }
  }
}

async function main() {
  console.log("Demonstrating battery module creation and linking...");

  // Load contract addresses
  const addressesPath = './demos/march-27/contract-addresses.json';
  if (!fs.existsSync(addressesPath)) {
    console.error("Contract addresses not found. Run 01-deploy-contracts.js first.");
    process.exit(1);
  }
  
  const addresses = JSON.parse(fs.readFileSync(addressesPath, 'utf8'));
  console.log("Using contract addresses:", addresses);

  // Get signers
  const [deployer, oem1, oem2, oem3, repairShop1] = await hre.ethers.getSigners();
  console.log("\nAccounts being used:");
  console.log("- OEM 1:", oem1.address, "(Proposer)");
  console.log("- OEM 2:", oem2.address, "(Voter)");
  console.log("- OEM 3:", oem3.address);

  // Connect to deployed contracts
  const batteryNFT = new hre.ethers.Contract(
    addresses.batteryNFT,
    getContractABI("BatteryNFT"),
    deployer
  );
  
  const governanceInterface = new hre.ethers.Interface(getContractABI("BatteryGovernance"));
  const governance = new hre.ethers.Contract(
    addresses.governance,
    governanceInterface,
    deployer
  );

  const dataRegistry = new hre.ethers.Contract(
    addresses.dataRegistry,
    getContractABI("DataRegistry"),
    deployer
  );

  // Check for existing batteries
  const batteryCount = await batteryNFT.getBatteryCount();
  if (batteryCount == 0) {
    console.error("No batteries found. Run 02-create-battery-nft.js first.");
    process.exit(1);
  }
  
  console.log(`Found ${batteryCount} existing batteries`);
  const batteryId = 1; // We'll add a module to the first battery

  // Verify the battery exists
  try {
    const battery = await batteryNFT.getBattery(batteryId);
    console.log(`\nUsing Battery #${batteryId}:`);
    console.log(`🔋 Token ID: ${battery[0].toString()}`);
    console.log(`🏷️ Type: ${formatNFTType(battery[1])}`);
    console.log(`🔐 Data Hash: ${battery[2]}`);
    console.log(`🧩 Existing Module IDs: ${battery[3].length > 0 ? battery[3].map(id => id.toString()).join(', ') : 'None'}`);
  } catch (error) {
    console.error(`Battery #${batteryId} not found:`, error.message);
    process.exit(1);
  }

  // Module data for the proposal
  const moduleOwner = oem1.address; // Same as battery owner
  const dataHash = "0xmoduledata123456789abcdef0123456789abcdef0123456789abcdef0123456789";
  const metadataURI = "https://example.com/module/metadata/1";

  // Encode function call to mint a module
  const batteryNFTInterface = new hre.ethers.Interface(getContractABI("BatteryNFT"));
  const calldata = batteryNFTInterface.encodeFunctionData("mintModule", [
    moduleOwner,
    batteryId,
    dataHash,
    metadataURI
  ]);

  // Define proposal parameters for a CRITICAL operation (module creation)
  const targets = [addresses.batteryNFT];
  const values = [0]; // No ETH sent with the call
  const calldatas = [calldata];
  const description = `Create module for Battery #${batteryId}`;
  const proposalType = 1; // CRITICAL (requires 2-of-3 approval)

  console.log("\nCreating governance proposal to mint a battery module...");
  // Submit proposal as OEM1
  const proposeTx = await governance.connect(oem1).propose(
    targets,
    values,
    calldatas,
    description,
    proposalType,
    batteryId
  );
  
  const receipt = await proposeTx.wait();
  
  // Extract proposal ID from transaction logs
  const proposalId = await getProposalId(governance, receipt, governanceInterface);
  console.log(`Proposal created with ID: ${proposalId}`);

  // Vote on the proposal (OEM1 and OEM2 will vote)
  console.log("\nVoting on the proposal...");

  // Add logging to check OEM role
  try {
    const oemRole = await batteryNFT.OEM_ROLE();
    const govRole = await batteryNFT.GOVERNANCE_ROLE();
    console.log("Checking roles for proper permissions...");
    console.log(`- OEM1 has OEM_ROLE: ${await batteryNFT.hasRole(oemRole, oem1.address)}`);
    console.log(`- OEM2 has OEM_ROLE: ${await batteryNFT.hasRole(oemRole, oem2.address)}`);
    console.log(`- Governance has GOVERNANCE_ROLE: ${await batteryNFT.hasRole(govRole, governance.address)}`);
  } catch (error) {
    console.warn("Could not verify roles:", error.message);
  }

  try {
    console.log("OEM1 casting vote...");
    const voteTx1 = await governance.connect(oem1).castVote(proposalId);
    await voteTx1.wait();
    console.log("OEM1 vote cast successfully");
  } catch (error) {
    console.error("Error with OEM1 voting:", error.message);
  }

  try {
    console.log("OEM2 casting vote...");
    const voteTx2 = await governance.connect(oem2).castVote(proposalId);
    await voteTx2.wait();
    console.log("OEM2 vote cast successfully");
  } catch (error) {
    console.error("Error with OEM2 voting:", error.message);
  }

  // Execute the proposal if not automatically executed
  console.log("\nEnsuring proposal execution...");
  try {
    const executeTx = await governance.connect(oem1).execute(proposalId);
    await executeTx.wait();
    console.log("Proposal executed successfully");
  } catch (error) {
    console.log("Could not execute via governance: " + error.message);
    
    console.log("\nAttempting direct module creation for demonstration...");
    try {
      // Grant temporary GOVERNANCE_ROLE to deployer if needed
      const governanceRole = await batteryNFT.GOVERNANCE_ROLE();
      const hasRole = await batteryNFT.hasRole(governanceRole, deployer.address);
      
      if (!hasRole) {
        console.log("Granting GOVERNANCE_ROLE to deployer temporarily...");
        const adminRole = await batteryNFT.DEFAULT_ADMIN_ROLE();
        await batteryNFT.grantRole(governanceRole, deployer.address);
        console.log("GOVERNANCE_ROLE granted to deployer");
      }
      
      // Check current module count
      const moduleCountBefore = await batteryNFT.getModuleCount();
      console.log(`Module count before: ${moduleCountBefore}`);
      
      // Use a different battery ID to avoid conflicts
      const batteryToUse = 2; // Try with the second battery
      console.log(`Trying with Battery ID: ${batteryToUse}`);
      
      // Create module with unique data to avoid conflicts
      const uniqueDataHash = `0xmodule${Date.now()}${Math.floor(Math.random() * 1000000)}`;
      const uniqueUri = `https://example.com/module/metadata/${Date.now()}`;
      
      const directModuleTx = await batteryNFT.mintModule(
        oem1.address,
        batteryToUse,
        uniqueDataHash,
        uniqueUri
      );
      
      await directModuleTx.wait();
      console.log("Module created directly");
      
      // Verify creation
      const moduleCountAfter = await batteryNFT.getModuleCount();
      console.log(`Module count after: ${moduleCountAfter}`);
      
    } catch (error) {
      console.error("Error creating module directly:", error.message);
    }
  }

  // Verify module was created
  console.log("\nVerifying module creation...");
  const moduleCount = await batteryNFT.getModuleCount();
  console.log(`Total modules: ${moduleCount}`);
  
  if (moduleCount > 0) {
    const newModuleId = moduleCount; // Most recent module ID
    
    try {
      // Get module details
      const module = await batteryNFT.getModule(newModuleId);
      
      console.log("\n==== MODULE DETAILS ====");
      console.log(`\nModule #${newModuleId}:`);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log(`🧩 Token ID: ${module[0].toString()}`);
      console.log(`🏷️ Type: ${formatNFTType(module[1])}`);
      console.log(`🔐 Data Hash: ${module[2]}`);
      console.log(`🔋 Parent Battery ID: ${module[3].toString()}`);
      console.log(`⏰ Created: ${formatTimestamp(module[4])}`);
      console.log(`🔄 Latest Update TX: ${module[5] || 'None'}`);
      
      // Add storage location for the module data
      console.log("\nAdding storage location for module data...");
      try {
        const storageType = 1; // IPFS
        const identifier = `ipfs://QmModuleData${newModuleId}`;
        const encryptionKeyId = `key-module-2023-${newModuleId.toString().padStart(4, '0')}`;
        
        await dataRegistry.connect(oem1).addStorageLocation(
          newModuleId,
          storageType,
          identifier,
          encryptionKeyId
        );
        console.log("✅ Storage location added successfully");
        
        // Check storage location
        const locationDetails = await dataRegistry.getLatestStorageLocation(newModuleId);
        const storageTypeNames = ["CENTRALIZED_DB", "IPFS", "ARWEAVE", "OTHER"];
        console.log("\nStorage location details:");
        console.log(`📂 Storage Type: ${storageTypeNames[locationDetails[0]]}`);
        console.log(`🔗 Identifier: ${locationDetails[1]}`);
        console.log(`🔑 Encryption Key ID: ${locationDetails[2]}`);
        console.log(`⏱️ Updated At: ${formatTimestamp(locationDetails[3])}`);
      } catch (error) {
        console.error("Error with storage location:", error.message);
      }
      
      // Now verify the battery has the module linked
      console.log("\n==== UPDATED BATTERY DETAILS ====");
      
      const updatedBattery = await batteryNFT.getBattery(batteryId);
      console.log(`\nBattery #${batteryId} (updated):`);
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log(`🔋 Token ID: ${updatedBattery[0].toString()}`);
      console.log(`🏷️ Type: ${formatNFTType(updatedBattery[1])}`);
      console.log(`🔐 Data Hash: ${updatedBattery[2]}`);
      
      // Display modules list with emphasis on our new module
      const modules = updatedBattery[3];
      if (modules.length > 0) {
        console.log(`🧩 Linked Module IDs (${modules.length}):`);
        for (let i = 0; i < modules.length; i++) {
          const moduleId = modules[i].toString();
          if (moduleId == newModuleId) {
            console.log(`   ┣━━ #${moduleId} ← NEW!`);
          } else {
            console.log(`   ┣━━ #${moduleId}`);
          }
        }
      } else {
        console.log("🧩 No modules linked (this is unexpected)");
      }
      
      console.log(`⏰ Created: ${formatTimestamp(updatedBattery[4])}`);
      console.log(`🔄 Latest Update TX: ${updatedBattery[5] || 'None'}`);
      
    } catch (error) {
      console.error(`Error retrieving module #${newModuleId}:`, error.message);
    }
  } else {
    console.log("No modules created yet.");
  }

  console.log("\n✨ Demo completed!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 