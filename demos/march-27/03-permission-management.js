// Script to demonstrate permission NFT creation and management

// todo: should demonstrate two different types of permission NFTs: temporary and permanent. 
// todo: Also should demonstrate the NFTs that shows that the entity is a known entity 
// todo: and has been verified and authorized to participate in the system.


const hre = require("hardhat");
const fs = require('fs');

// Helper to get ABI for a contract
function getContractABI(contractName) {
  const artifactPath = `./artifacts/contracts/${contractName}.sol/${contractName}.json`;
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  return artifact.abi;
}

async function main() {
  console.log("Demonstrating permission NFT creation and management...");

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
  console.log("- OEM 1:", oem1.address, "(Permission issuer)");
  console.log("- OEM 2:", oem2.address, "(Voter)");
  console.log("- OEM 3:", oem3.address);
  console.log("- Repair Shop 1:", repairShop1.address, "(Permission receiver)");
  console.log("- Repair Shop 2:", repairShop2.address);

  // Connect to deployed contracts
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
  
  const participantRegistry = new hre.ethers.Contract(
    addresses.participantRegistry,
    getContractABI("ParticipantRegistry"),
    deployer
  );

  // Register the repair shop in the participant registry
  console.log("\nRegistering repair shop in participant registry...");
  const repairShopRole = await participantRegistry.getRepairShopRole();
  await participantRegistry.connect(oem1).setRepairShopRole(repairShop1.address);
  console.log(`Repair shop role granted to ${repairShop1.address}`);

  // Create temporary permission for a battery
  console.log("\nCreating temporary permission NFT via governance...");
  
  // In a real demo, we would have a battery already created, but for this demo we'll assume battery ID 1 exists
  const batteryId = 1;
  
  // Permission details
  const recipient = repairShop1.address;
  const validityPeriod = 3600 * 24; // 24 hours in seconds
  const allowDataSubmission = true;
  const allowDataReading = true;
  const metadataURI = "https://example.com/permission/1";

  // Encode function call to mint a temporary permission
  const permissionNFTInterface = new hre.ethers.Interface(getContractABI("PermissionNFT"));
  const calldata = permissionNFTInterface.encodeFunctionData("mintTemporaryPermission", [
    recipient,
    batteryId,
    validityPeriod,
    allowDataSubmission,
    allowDataReading,
    metadataURI
  ]);

  // Define proposal parameters for a CRITICAL operation (permission creation)
  const targets = [addresses.permissionNFT];
  const values = [0]; // No ETH sent with the call
  const calldatas = [calldata];
  const description = "Create temporary permission NFT for Repair Shop 1";
  const proposalType = 1; // CRITICAL (requires 2-of-3 approval)

  // Submit proposal as OEM1
  const proposeTx = await governance.connect(oem1).propose(
    targets,
    values,
    calldatas,
    description,
    proposalType,
    0 // Not applicable for permission creation
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

  // Verify permission was created
  console.log("\nVerifying permission NFT creation...");
  const tokenId = 1; // First permission should have ID 1
  const permissionDetails = await permissionNFT.getPermission(tokenId);
  
  if (permissionDetails) {
    console.log("\nPermission details:");
    console.log("- Token ID:", permissionDetails[0].toString());
    console.log("- Battery ID:", permissionDetails[1].toString());
    console.log("- Permission Type:", permissionDetails[2] === 0 ? "PERMANENT" : "TEMPORARY");
    console.log("- Expiry Time:", new Date(Number(permissionDetails[3]) * 1000).toISOString());
    console.log("- Revoked:", permissionDetails[4]);
    console.log("- Can Submit Data:", permissionDetails[5]);
    console.log("- Can Read Data:", permissionDetails[6]);
    console.log("- Created At:", new Date(Number(permissionDetails[7]) * 1000).toISOString());
  }

  // Check if repair shop can submit data for battery
  const canSubmit = await permissionNFT.canSubmitDataForBattery(repairShop1.address, batteryId);
  console.log(`\nCan repair shop submit data for battery ${batteryId}? ${canSubmit}`);

  // Check if repair shop can read data
  const canRead = await permissionNFT.canReadData(repairShop1.address);
  console.log(`Can repair shop read data? ${canRead}`);

  // Create a permanent permission NFT (for known repair shops)
  console.log("\nCreating permanent permission NFT for Repair Shop 2...");
  
  // Encode function call to mint a permanent permission
  const permanentCalldata = permissionNFTInterface.encodeFunctionData("mintPermanentPermission", [
    repairShop2.address,
    true, // allowDataReading
    "https://example.com/permission/permanent/1"
  ]);

  // Create and execute proposal
  const permanentProposeTx = await governance.connect(oem1).propose(
    [addresses.permissionNFT],
    [0],
    [permanentCalldata],
    "Create permanent permission NFT for Repair Shop 2",
    1, // CRITICAL
    0
  );
  
  const permanentReceipt = await permanentProposeTx.wait();
  
  // Extract proposal ID
  let permanentProposalId;
  for (const event of permanentReceipt.logs) {
    try {
      const parsedLog = governance.interface.parseLog(event);
      if (parsedLog && parsedLog.name === "ProposalCreated") {
        permanentProposalId = parsedLog.args[0];
        break;
      }
    } catch (e) {
      // Not a ProposalCreated event, continue
    }
  }
  
  if (!permanentProposalId) {
    permanentProposalId = 1; // Fallback to second proposal if log parsing fails
  }
  
  console.log(`Proposal created with ID: ${permanentProposalId}`);

  // Vote and execute
  await governance.connect(oem1).castVote(permanentProposalId);
  await governance.connect(oem2).castVote(permanentProposalId);
  await governance.connect(oem1).execute(permanentProposalId);
  
  // Verify permanent permission
  const permanentTokenId = 2; // Second permission should have ID 2
  const permanentDetails = await permissionNFT.getPermission(permanentTokenId);
  
  if (permanentDetails) {
    console.log("\nPermanent permission details:");
    console.log("- Token ID:", permanentDetails[0].toString());
    console.log("- Battery ID:", permanentDetails[1].toString()); // Should be 0 for permanent
    console.log("- Permission Type:", permanentDetails[2] === 0 ? "PERMANENT" : "TEMPORARY");
    console.log("- Expiry Time:", permanentDetails[3].toString()); // Should be 0 for permanent
    console.log("- Revoked:", permanentDetails[4]);
    console.log("- Can Submit Data:", permanentDetails[5]);
    console.log("- Can Read Data:", permanentDetails[6]);
    console.log("- Created At:", new Date(Number(permanentDetails[7]) * 1000).toISOString());
  }

  // Demonstrate revoking a permission
  console.log("\nRevoking temporary permission...");
  await permissionNFT.connect(oem1).revokePermission(tokenId);
  
  // Verify revocation
  const revokedDetails = await permissionNFT.getPermission(tokenId);
  console.log(`Permission revoked: ${revokedDetails[4]}`);
  
  // Check if repair shop can still submit data after revocation
  const canSubmitAfterRevoke = await permissionNFT.canSubmitDataForBattery(repairShop1.address, batteryId);
  console.log(`Can repair shop still submit data? ${canSubmitAfterRevoke}`);

  console.log("\nDemo completed successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 