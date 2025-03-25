// Script to demonstrate the DataRegistry with BatteryNFT
const hre = require("hardhat");

async function main() {
  console.log("Demonstrating DataRegistry integration...");

  // Get signers
  const [deployer, oem1, oem2, oem3, repairShop] = await hre.ethers.getSigners();
  console.log("Using accounts:");
  console.log("- Deployer:", deployer.address);
  console.log("- OEM1:", oem1.address);
  console.log("- Repair Shop:", repairShop.address);

  // Deploy the DataRegistry contract
  console.log("\nDeploying DataRegistry...");
  const DataRegistry = await hre.ethers.getContractFactory("DataRegistry");
  const initialOEMs = [oem1.address, oem2.address, oem3.address];
  const dataRegistry = await DataRegistry.deploy(deployer.address, initialOEMs);
  await dataRegistry.waitForDeployment();
  const dataRegistryAddress = await dataRegistry.getAddress();
  console.log("DataRegistry deployed to:", dataRegistryAddress);

  // Deploy the BatteryNFT contract if needed, or attach to existing
  console.log("\nDeploying BatteryNFT...");
  const BatteryNFT = await hre.ethers.getContractFactory("BatteryNFT");
  const batteryNFT = await BatteryNFT.deploy(deployer.address, initialOEMs);
  await batteryNFT.waitForDeployment();
  const batteryNFTAddress = await batteryNFT.getAddress();
  console.log("BatteryNFT deployed to:", batteryNFTAddress);

  // Link the contracts
  console.log("\nLinking contracts...");
  await batteryNFT.setDataRegistry(dataRegistryAddress);
  console.log("Contracts linked successfully");

  // Mint a new battery (no encrypted data, just a hash)
  console.log("\nMinting a new battery...");
  const sampleDataHash = "0x123456789abcdef"; // Hash of the original data
  const sampleURI = "https://example.com/battery/1";
  
  const mintTx = await batteryNFT.mintBattery(
    oem1.address,
    sampleDataHash,
    sampleURI
  );
  await mintTx.wait();
  console.log("Battery minted successfully");

  // Check battery details
  const batteryId = 1; // First battery has ID 1
  const batteryDetails = await batteryNFT.getBattery(batteryId);
  console.log("\nBattery details:");
  console.log("- Token ID:", batteryDetails[0].toString());
  console.log("- NFT Type:", batteryDetails[1]);
  console.log("- Data Hash:", batteryDetails[2]);
  console.log("- Module IDs:", batteryDetails[3].map(id => id.toString()));
  console.log("- Created At:", new Date(Number(batteryDetails[4]) * 1000).toISOString());
  console.log("- Latest Update TX ID:", batteryDetails[5]);

  // Add storage location for the battery data in the registry
  console.log("\nAdding storage location for battery data...");
  const storageType = 1; // IPFS (0=CENTRALIZED_DB, 1=IPFS, 2=ARWEAVE)
  const identifier = "ipfs://QmYMF3g9VDTDw44bKBSYuQ52RXqgCKKrayqpYCQHmTRCdE"; // Example IPFS CID
  const encryptionKeyId = "key-2023-0001"; // ID of the encryption key (stored securely off-chain)
  
  const storageTx = await dataRegistry.connect(oem1).addStorageLocation(
    batteryId,
    storageType,
    identifier,
    encryptionKeyId
  );
  await storageTx.wait();
  console.log("Storage location added successfully");

  // Check storage location
  console.log("\nRetrieving storage location...");
  const locationDetails = await dataRegistry.getLatestStorageLocation(batteryId);
  
  const storageTypeNames = ["CENTRALIZED_DB", "IPFS", "ARWEAVE", "OTHER"];
  console.log("Storage location details:");
  console.log("- Storage Type:", storageTypeNames[locationDetails[0]]);
  console.log("- Identifier:", locationDetails[1]);
  console.log("- Encryption Key ID:", locationDetails[2]);
  console.log("- Updated At:", new Date(Number(locationDetails[3]) * 1000).toISOString());

  // Update battery data with a new version
  console.log("\nUpdating battery data...");
  const newDataHash = "0xabc123def456"; // Hash of the updated data
  const updateTxId = identifier; // Using same IPFS CID as updateTxId for simplicity
  
  const updateTx = await batteryNFT.updateBatteryData(
    batteryId,
    newDataHash,
    updateTxId
  );
  await updateTx.wait();
  console.log("Battery data updated successfully");

  // Check updated battery details
  const updatedBatteryDetails = await batteryNFT.getBattery(batteryId);
  console.log("\nUpdated battery details:");
  console.log("- Data Hash:", updatedBatteryDetails[2]);
  console.log("- Latest Update TX ID:", updatedBatteryDetails[5]);

  // Check update history
  const updateHistory = await batteryNFT.getBatteryUpdateHistory(batteryId);
  console.log("\nBattery update history:");
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