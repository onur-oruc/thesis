// Script to demonstrate battery NFT creation through governance

// todo: should also demonstrate the integration of DataRegistry with the BatteryNFT.
const hre = require("hardhat");
const fs = require('fs');

// Helper to get ABI for a contract
function getContractABI(contractName) {
  const artifactPath = `./artifacts/contracts/${contractName}.sol/${contractName}.json`;
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  return artifact.abi;
}

async function main() {
  console.log("Demonstrating battery NFT creation through governance...");

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

  // Battery data for the proposal
  const batteryOwner = oem1.address;
  const dataHash = "0x123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  const metadataURI = "https://example.com/battery/metadata/1";

  // Encode function call to mint a battery
  const batteryNFTInterface = new hre.ethers.Interface(getContractABI("BatteryNFT"));
  const calldata = batteryNFTInterface.encodeFunctionData("mintBattery", [
    batteryOwner,
    dataHash,
    metadataURI
  ]);

  // Define proposal parameters for a CRITICAL operation (battery creation)
  const targets = [addresses.batteryNFT];
  const values = [0]; // No ETH sent with the call
  const calldatas = [calldata];
  const description = "Create battery NFT for OEM1";
  const proposalType = 1; // CRITICAL (requires 2-of-3 approval)
  const batteryId = 0; // Not applicable for new battery creation

  console.log("\nCreating governance proposal to mint a battery NFT...");
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
  
  // Extract proposal ID from logs
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
    proposalId = 0; // Fallback to first proposal if log parsing fails
  }
  
  console.log(`Proposal created with ID: ${proposalId}`);

  // Vote on the proposal (OEM1 and OEM2 will vote)
  console.log("\nVoting on the proposal...");
  console.log("OEM1 casting vote...");
  await governance.connect(oem1).castVote(proposalId);
  
  console.log("OEM2 casting vote...");
  await governance.connect(oem2).castVote(proposalId);
  
  // Check vote count
  const proposal = await governance.proposals(proposalId);
  console.log(`Votes in favor: ${proposal[6]}`); // forVotes is at index 6

  // Execute the proposal
  console.log("\nExecuting the proposal...");
  const executeTx = await governance.connect(oem1).execute(proposalId);
  await executeTx.wait();
  console.log("Proposal executed successfully");

  // Verify battery was created
  console.log("\nVerifying battery NFT creation...");
  const batteryCount = await batteryNFT.getBatteryCount();
  console.log(`Total batteries: ${batteryCount}`);
  
  if (batteryCount > 0) {
    const newBatteryId = 1; // First battery has ID 1
    const battery = await batteryNFT.getBattery(newBatteryId);
    console.log("\nBattery details:");
    console.log("- Token ID:", battery[0].toString());
    console.log("- NFT Type:", battery[1]);
    console.log("- Data Hash:", battery[2]);
    console.log("- Module IDs:", battery[3].map(id => id.toString()));
    console.log("- Created At:", new Date(Number(battery[4]) * 1000).toISOString());
    console.log("- Latest Update TX ID:", battery[5]);
    
    // Add storage location for the battery data
    console.log("\nAdding storage location for battery data...");
    const storageType = 1; // IPFS
    const identifier = "ipfs://QmYMF3g9VDTDw44bKBSYuQ52RXqgCKKrayqpYCQHmTRCdE";
    const encryptionKeyId = "key-2023-0001";
    
    await dataRegistry.connect(oem1).addStorageLocation(
      newBatteryId,
      storageType,
      identifier,
      encryptionKeyId
    );
    console.log("Storage location added successfully");
    
    // Check storage location
    const locationDetails = await dataRegistry.getLatestStorageLocation(newBatteryId);
    const storageTypeNames = ["CENTRALIZED_DB", "IPFS", "ARWEAVE", "OTHER"];
    console.log("\nStorage location details:");
    console.log("- Storage Type:", storageTypeNames[locationDetails[0]]);
    console.log("- Identifier:", locationDetails[1]);
    console.log("- Encryption Key ID:", locationDetails[2]);
    console.log("- Updated At:", new Date(Number(locationDetails[3]) * 1000).toISOString());
  }

  console.log("\nDemo completed successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 