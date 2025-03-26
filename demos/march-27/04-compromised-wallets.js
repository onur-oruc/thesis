// Script to demonstrate compromised wallet handling
const hre = require("hardhat");
const fs = require('fs');

// Helper to get ABI for a contract
function getContractABI(contractName) {
  const artifactPath = `./artifacts/contracts/${contractName}.sol/${contractName}.json`;
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  return artifact.abi;
}

async function main() {
  console.log("Demonstrating compromised wallet handling...");

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
  console.log("- Admin:", deployer.address);
  console.log("- OEM 1:", oem1.address);
  console.log("- OEM 2:", oem2.address, "(Will be compromised)");
  console.log("- OEM 3:", oem3.address);
  console.log("- Repair Shop 1:", repairShop1.address);

  // Connect to deployed contracts
  const participantRegistry = new hre.ethers.Contract(
    addresses.participantRegistry,
    getContractABI("ParticipantRegistry"),
    deployer
  );
  
  const governance = new hre.ethers.Contract(
    addresses.governance,
    getContractABI("BatteryGovernance"),
    deployer
  );
  
  const batteryNFT = new hre.ethers.Contract(
    addresses.batteryNFT,
    getContractABI("BatteryNFT"),
    deployer
  );

  // Get initial state
  console.log("\nInitial state:");
  
  // Check if OEM2 is compromised
  const isCompromisedBefore = await participantRegistry.isCompromised(oem2.address);
  console.log(`Is OEM2 wallet compromised? ${isCompromisedBefore}`);
  
  // Check if OEM2 has OEM role
  const hasOEMRole = await participantRegistry.hasRole(
    await participantRegistry.getOEMRole(),
    oem2.address
  );
  console.log(`Does OEM2 have OEM role? ${hasOEMRole}`);

  // Attempt to create a battery with OEM2 (not compromised yet)
  console.log("\nAttempting to create a battery with OEM2 (not compromised yet)...");
  
  // Encode function call to mint a battery
  const batteryNFTInterface = new hre.ethers.Interface(getContractABI("BatteryNFT"));
  const calldata = batteryNFTInterface.encodeFunctionData("mintBattery", [
    oem2.address,
    "0x123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    "https://example.com/battery/metadata/2"
  ]);

  // Define proposal parameters
  const targets = [addresses.batteryNFT];
  const values = [0]; // No ETH sent with the call
  const calldatas = [calldata];
  const description = "Create battery NFT for OEM2";
  const proposalType = 1; // CRITICAL (requires 2-of-3 approval)

  // Submit proposal as OEM2
  const proposeTx = await governance.connect(oem2).propose(
    targets,
    values,
    calldatas,
    description,
    proposalType,
    0
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
    proposalId = 0; // Fallback if log parsing fails
  }
  
  console.log(`Proposal created with ID: ${proposalId}`);

  // Vote on the proposal with OEM1 and OEM2
  console.log("\nVoting on the proposal...");
  await governance.connect(oem1).castVote(proposalId);
  await governance.connect(oem2).castVote(proposalId);
  
  // Execute the proposal
  await governance.connect(oem2).execute(proposalId);
  console.log("Proposal executed successfully");

  // Now mark OEM2 as compromised
  console.log("\nMarking OEM2 wallet as compromised...");
  const compromiseReason = "Private key suspected to be leaked";
  
  await participantRegistry.connect(oem1).markAsCompromised(
    oem2.address,
    compromiseReason
  );
  
  // Verify OEM2 is now compromised
  const isCompromisedAfter = await participantRegistry.isCompromised(oem2.address);
  console.log(`Is OEM2 wallet compromised now? ${isCompromisedAfter}`);
  
  // Get compromise details
  const compromiseDetails = await participantRegistry.getCompromiseDetails(oem2.address);
  console.log("\nCompromise details:");
  console.log("- Reporter:", compromiseDetails[0]);
  console.log("- Timestamp:", new Date(Number(compromiseDetails[1]) * 1000).toISOString());
  console.log("- Reason:", compromiseDetails[2]);

  // Attempt to create another proposal with compromised wallet
  console.log("\nAttempting to create a proposal with compromised wallet...");
  try {
    await governance.connect(oem2).propose(
      targets,
      values,
      calldatas,
      "This should fail - wallet is compromised",
      proposalType,
      0
    );
    console.log("ERROR: Proposal creation succeeded but should have failed!");
  } catch (error) {
    console.log("Proposal creation failed as expected:", error.message);
  }

  // Restore the wallet
  console.log("\nRestoring the compromised wallet...");
  await participantRegistry.connect(deployer).restoreCompromisedWallet(oem2.address);
  
  // Verify wallet is restored
  const isCompromisedFinal = await participantRegistry.isCompromised(oem2.address);
  console.log(`Is OEM2 wallet still compromised? ${isCompromisedFinal}`);

  // Attempt to create proposal after wallet restoration
  console.log("\nAttempting to create a proposal after wallet restoration...");
  await governance.connect(oem2).propose(
    targets,
    values,
    calldatas,
    "Create battery NFT for OEM2 after restoration",
    proposalType,
    0
  );
  console.log("Proposal creation succeeded as expected");

  console.log("\nDemo completed successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 