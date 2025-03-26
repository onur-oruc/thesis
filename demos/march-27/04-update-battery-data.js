// Script to demonstrate updating battery data
// This shows how to update existing battery data while preserving history

/**
 * This script demonstrates:
 * 1. Updating the data of an existing battery
 * 2. Adding a new storage location for the updated data
 * 3. Verifying the history is preserved with the update
 * 
 * It shows how data updates work while maintaining a chain of history.
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

// Helper to get proposal ID from various methods
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
    const count = await governance.getCurrentProposalCount();
    return count.sub ? count.sub(1) : count - 1;
  } catch (error) {
    try {
      const count = await governance.proposalCount();
      return count.sub ? count.sub(1) : count - 1;
    } catch (fallbackError) {
      console.warn("Could not get proposal ID, using default value 0");
      return 0;
    }
  }
}

async function displayBatteryDetails(batteryNFT, batteryId) {
  try {
    const battery = await batteryNFT.getBattery(batteryId);
    const owner = await batteryNFT.ownerOf(batteryId);
    
    console.log(`\nBattery #${batteryId} Details:`);
    console.log(`┣━ 🆔 Token ID: ${battery[0].toString()}`);
    console.log(`┣━ 🏷️ Type: ${formatNFTType(battery[1])}`);
    console.log(`┣━ 🔐 Data Hash: ${battery[2]}`);
    console.log(`┣━ 👤 Owner: ${owner}`);
    console.log(`┣━ ⏰ Created: ${formatTimestamp(battery[4])}`);
    console.log(`┣━ 🔄 Latest Update TX: ${battery[5] || 'None'}`);
    
    // Get update history if available
    try {
      const history = await batteryNFT.getBatteryUpdateHistory(batteryId);
      console.log(`┣━ 📜 Update History: ${history.length} updates`);
      if (history.length > 0) {
        for (let i = 0; i < history.length; i++) {
          console.log(`┃   ┣━ Update #${i+1}: ${history[i]}`);
        }
      }
    } catch (error) {
      console.log(`┗━ 📜 Update History: Error retrieving (${error.message})`);
    }
  } catch (error) {
    console.error(`Error displaying battery details: ${error.message}`);
  }
}

async function main() {
  console.log("Demonstrating battery data update process...");

  // Load contract addresses
  const addressesPath = './demos/march-27/contract-addresses.json';
  if (!fs.existsSync(addressesPath)) {
    console.error("Contract addresses not found. Run 01-deploy-contracts.js first.");
    process.exit(1);
  }
  
  const addresses = JSON.parse(fs.readFileSync(addressesPath, 'utf8'));
  console.log("Using contract addresses:", addresses);

  // Get signers
  const [deployer, oem1, oem2, oem3] = await hre.ethers.getSigners();
  console.log("\nAccounts being used:");
  console.log("- OEM 1:", oem1.address, "(Proposer & Battery Owner)");
  console.log("- OEM 2:", oem2.address, "(Voter)");

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

  // Select a battery to update
  const batteryId = 1; // Update the first battery
  console.log(`\nUpdating Battery #${batteryId}`);
  
  // Display current battery data
  console.log("\nCurrent battery data:");
  await displayBatteryDetails(batteryNFT, batteryId);
  
  // Create update data
  const newDataHash = `0xupdated_${Date.now()}`;
  const updateTxId = `update_tx_${Date.now()}`;
  
  // Encode function call to update battery data
  const batteryNFTInterface = new hre.ethers.Interface(getContractABI("BatteryNFT"));
  const calldata = batteryNFTInterface.encodeFunctionData("updateBatteryData", [
    batteryId,
    newDataHash,
    updateTxId
  ]);

  // Define proposal parameters for a ROUTINE operation (data update)
  const targets = [addresses.batteryNFT];
  const values = [0]; // No ETH sent with the call
  const calldatas = [calldata];
  const description = `Update data for Battery #${batteryId}`;
  const proposalType = 2; // ROUTINE (requires 1-of-3 approval)

  console.log("\nCreating governance proposal to update battery data...");
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

  // Vote on the proposal (only OEM1 needed for ROUTINE)
  console.log("\nVoting on the proposal...");
  console.log("OEM1 casting vote...");
  
  try {
    const voteTx = await governance.connect(oem1).castVote(proposalId);
    await voteTx.wait();
    console.log("Vote cast and proposal should be executed automatically");
  } catch (error) {
    console.error("Error with proposal execution:", error.message);
    
    // Try direct update as a fallback
    console.log("\nAttempting direct update for demonstration...");
    
    try {
      // First ensure deployer has GOVERNANCE_ROLE
      const governanceRole = await batteryNFT.GOVERNANCE_ROLE();
      const hasRole = await batteryNFT.hasRole(governanceRole, deployer.address);
      
      if (!hasRole) {
        console.log("Granting GOVERNANCE_ROLE to deployer...");
        await batteryNFT.grantRole(governanceRole, deployer.address);
      }
      
      const updateTx = await batteryNFT.updateBatteryData(
        batteryId,
        newDataHash,
        updateTxId
      );
      
      await updateTx.wait();
      console.log("Battery data updated directly");
    } catch (directError) {
      console.error("Could not update battery directly:", directError.message);
    }
  }
  
  // Display updated battery data
  console.log("\nUpdated battery data:");
  await displayBatteryDetails(batteryNFT, batteryId);
  
  // Add a new storage location for the updated data
  console.log("\nAdding new storage location for updated data...");
  try {
    const storageType = 1; // IPFS
    const identifier = `ipfs://QmUpdatedData${batteryId}_${Date.now()}`;
    const encryptionKeyId = `key-2023-${batteryId.toString().padStart(4, '0')}-update`;
    
    const storageTx = await dataRegistry.connect(oem1).addStorageLocation(
      batteryId,
      storageType,
      identifier,
      encryptionKeyId
    );
    
    await storageTx.wait();
    console.log("New storage location added successfully");
    
    // Check all storage locations
    const locationCount = await dataRegistry.getStorageLocationCount(batteryId);
    console.log(`\nTotal storage locations for Battery #${batteryId}: ${locationCount}`);
    
    if (locationCount > 0) {
      console.log("Latest storage location:");
      const latestLocation = await dataRegistry.getLatestStorageLocation(batteryId);
      const storageTypeNames = ["CENTRALIZED_DB", "IPFS", "ARWEAVE", "OTHER"];
      console.log(`- Storage Type: ${storageTypeNames[latestLocation[0]]}`);
      console.log(`- Identifier: ${latestLocation[1]}`);
      console.log(`- Encryption Key ID: ${latestLocation[2]}`);
      console.log(`- Updated At: ${formatTimestamp(latestLocation[3])}`);
    }
  } catch (error) {
    console.error("Error adding storage location:", error.message);
  }

  console.log("\n✨ Battery update demo completed!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 