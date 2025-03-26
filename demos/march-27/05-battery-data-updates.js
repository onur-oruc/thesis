// Script to demonstrate battery data updates by the repair shop with permission NFT

// todo: should demonstrate the integration of DataRegistry with the BatteryNFT.

const hre = require("hardhat");
const fs = require('fs');

// Helper to get ABI for a contract
function getContractABI(contractName) {
  const artifactPath = `./artifacts/contracts/${contractName}.sol/${contractName}.json`;
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  return artifact.abi;
}

async function main() {
  console.log("Demonstrating battery data updates by repair shop...");

  // Load contract addresses
  const addressesPath = './demos/march-27/contract-addresses.json';
  if (!fs.existsSync(addressesPath)) {
    console.error("Contract addresses not found. Run 01-deploy-contracts.js first.");
    process.exit(1);
  }
  
  const addresses = JSON.parse(fs.readFileSync(addressesPath, 'utf8'));
  console.log("Using contract addresses:", addresses);

  // Get signers
  const [deployer, oem1, oem2, oem3, repairShop1, repairShop2] = await hre.ethers.getSigners();
  console.log("\nAccounts being used:");
  console.log("- OEM 1:", oem1.address);
  console.log("- Repair Shop 1:", repairShop1.address, "(Will update battery data)");

  // Connect to deployed contracts
  const batteryNFT = new hre.ethers.Contract(
    addresses.batteryNFT,
    getContractABI("BatteryNFT"),
    deployer
  );
  
  const permissionNFT = new hre.ethers.Contract(
    addresses.permissionNFT,
    getContractABI("PermissionNFT"),
    deployer
  );
  
  const governance = new hre.ethers.Contract(
    addresses.governance,
    getContractABI("BatteryGovernance"),
    deployer
  );
  
  const dataRegistry = new hre.ethers.Contract(
    addresses.dataRegistry,
    getContractABI("DataRegistry"),
    deployer
  );

  // Assume we have a battery with ID 1 from previous scripts
  const batteryId = 1;
  
  // Check initial battery data
  console.log(`\nChecking initial battery data for ID ${batteryId}...`);
  try {
    const initialBatteryData = await batteryNFT.getBattery(batteryId);
    console.log("Initial battery details:");
    console.log("- Data Hash:", initialBatteryData[2]);
    console.log("- Latest Update TX ID:", initialBatteryData[5]);
    
    // Get update history
    const initialUpdateHistory = await batteryNFT.getBatteryUpdateHistory(batteryId);
    console.log("Initial update history:", initialUpdateHistory);
  } catch (error) {
    console.log("Error getting battery data, battery may not exist yet. Creating a new one...");
    
    // Create a battery if one doesn't exist
    const batteryNFTInterface = new hre.ethers.Interface(getContractABI("BatteryNFT"));
    const calldata = batteryNFTInterface.encodeFunctionData("mintBattery", [
      oem1.address,
      "0x123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      "https://example.com/battery/metadata/1"
    ]);

    const targets = [addresses.batteryNFT];
    const values = [0];
    const calldatas = [calldata];
    const description = "Create battery NFT for demo";
    const proposalType = 1; // CRITICAL
    
    const proposeTx = await governance.connect(oem1).propose(
      targets,
      values,
      calldatas,
      description,
      proposalType,
      0
    );
    
    const receipt = await proposeTx.wait();
    
    let proposalId;
    for (const event of receipt.logs) {
      try {
        const parsedLog = governance.interface.parseLog(event);
        if (parsedLog && parsedLog.name === "ProposalCreated") {
          proposalId = parsedLog.args[0];
          break;
        }
      } catch (e) {
        // Not a ProposalCreated event, continue
      }
    }
    
    if (!proposalId) {
      proposalId = 0;
    }
    
    await governance.connect(oem1).castVote(proposalId);
    await governance.connect(oem2).castVote(proposalId);
    await governance.connect(oem1).execute(proposalId);
    console.log("Battery created successfully");
  }

  // Ensure repair shop has permission for the battery
  console.log("\nChecking if repair shop has permission for the battery...");
  const hasPermission = await permissionNFT.canSubmitDataForBattery(repairShop1.address, batteryId);
  
  if (!hasPermission) {
    console.log("Repair shop doesn't have permission. Creating temporary permission...");
    
    // Create permission for the repair shop
    const permissionNFTInterface = new hre.ethers.Interface(getContractABI("PermissionNFT"));
    const calldata = permissionNFTInterface.encodeFunctionData("mintTemporaryPermission", [
      repairShop1.address,
      batteryId,
      3600 * 24, // 24 hours
      true, // can submit data
      true, // can read data
      "https://example.com/permission/for-update-demo"
    ]);

    const targets = [addresses.permissionNFT];
    const values = [0];
    const calldatas = [calldata];
    const description = "Create temporary permission for repair shop to update battery";
    const proposalType = 1; // CRITICAL
    
    const proposeTx = await governance.connect(oem1).propose(
      targets,
      values,
      calldatas,
      description,
      proposalType,
      0
    );
    
    const receipt = await proposeTx.wait();
    
    let proposalId;
    for (const event of receipt.logs) {
      try {
        const parsedLog = governance.interface.parseLog(event);
        if (parsedLog && parsedLog.name === "ProposalCreated") {
          proposalId = parsedLog.args[0];
          break;
        }
      } catch (e) {
        // Not a ProposalCreated event, continue
      }
    }
    
    if (!proposalId) {
      proposalId = 0;
    }
    
    await governance.connect(oem1).castVote(proposalId);
    await governance.connect(oem2).castVote(proposalId);
    await governance.connect(oem1).execute(proposalId);
    console.log("Permission created successfully");
    
    // Verify permission was created
    const newHasPermission = await permissionNFT.canSubmitDataForBattery(repairShop1.address, batteryId);
    console.log(`Repair shop now has permission: ${newHasPermission}`);
  } else {
    console.log("Repair shop already has permission for the battery");
  }

  // Prepare battery data update
  console.log("\nPreparing data update for battery...");
  
  // For the demo, let's assume the repair shop replaced a module and needs to update the data
  const newDataHash = "0xabcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";
  const updateTxId = "ipfs://QmNewDataStoredHereAfterBatteryRepair"; // Reference to where the actual data is stored
  
  // Create a ROUTINE proposal for the battery data update
  const batteryNFTInterface = new hre.ethers.Interface(getContractABI("BatteryNFT"));
  const updateCalldata = batteryNFTInterface.encodeFunctionData("updateBatteryData", [
    batteryId,
    newDataHash,
    updateTxId
  ]);

  // Define proposal parameters for a ROUTINE operation (data update)
  const updateTargets = [addresses.batteryNFT];
  const updateValues = [0];
  const updateCalldatas = [updateCalldata];
  const updateDescription = "Update battery data after repair";
  const updateProposalType = 2; // ROUTINE (requires 1-of-3 approval)
  
  console.log("\nCreating proposal to update battery data...");
  // Submit proposal as repair shop
  const updateProposeTx = await governance.connect(repairShop1).propose(
    updateTargets,
    updateValues,
    updateCalldatas,
    updateDescription,
    updateProposalType,
    batteryId // Now we provide the battery ID since this is a battery-specific update
  );
  
  const updateReceipt = await updateProposeTx.wait();
  
  // Extract proposal ID from logs
  let updateProposalId;
  for (const event of updateReceipt.logs) {
    try {
      const parsedLog = governance.interface.parseLog(event);
      if (parsedLog && parsedLog.name === "ProposalCreated") {
        updateProposalId = parsedLog.args[0];
        break;
      }
    } catch (e) {
      // Not a ProposalCreated event, continue
    }
  }
  
  if (!updateProposalId) {
    updateProposalId = 1; // Fallback if log parsing fails
  }
  
  console.log(`Proposal created with ID: ${updateProposalId}`);

  // For ROUTINE proposals, only one OEM vote is needed
  console.log("\nVoting on the proposal...");
  console.log("OEM1 casting vote...");
  await governance.connect(oem1).castVote(updateProposalId);
  
  // Execute the proposal
  console.log("\nExecuting the proposal...");
  const executeUpdateTx = await governance.connect(repairShop1).execute(updateProposalId);
  await executeUpdateTx.wait();
  console.log("Proposal executed successfully");

  // Verify the data was updated
  console.log("\nVerifying battery data was updated...");
  const updatedBatteryData = await batteryNFT.getBattery(batteryId);
  console.log("Updated battery details:");
  console.log("- Data Hash:", updatedBatteryData[2]);
  console.log("- Latest Update TX ID:", updatedBatteryData[5]);
  
  // Get update history
  const updateHistory = await batteryNFT.getBatteryUpdateHistory(batteryId);
  console.log("\nUpdate history:");
  updateHistory.forEach((txId, index) => {
    console.log(`- Update ${index + 1}: ${txId}`);
  });

  console.log("\nDemo completed successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 