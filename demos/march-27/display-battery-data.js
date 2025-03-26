// Script to display all battery data

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

async function main() {
  console.log("📊 Battery NFT Data Dashboard");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  // Load contract addresses
  const addressesPath = './demos/march-27/contract-addresses.json';
  if (!fs.existsSync(addressesPath)) {
    console.error("Contract addresses not found. Run 01-deploy-contracts.js first.");
    process.exit(1);
  }
  
  const addresses = JSON.parse(fs.readFileSync(addressesPath, 'utf8'));
  
  // Get signers
  const [deployer] = await hre.ethers.getSigners();
  
  // Connect to deployed contracts
  const batteryNFT = new hre.ethers.Contract(
    addresses.batteryNFT,
    getContractABI("BatteryNFT"),
    deployer
  );
  
  const dataRegistry = new hre.ethers.Contract(
    addresses.dataRegistry,
    getContractABI("DataRegistry"),
    deployer
  );

  // Get counts
  const batteryCount = await batteryNFT.getBatteryCount();
  const moduleCount = await batteryNFT.getModuleCount();
  
  console.log(`System Overview:`);
  console.log(`🔋 Total Batteries: ${batteryCount}`);
  console.log(`🧩 Total Modules: ${moduleCount} (Note: Module creation may have issues due to token ID overlap)`);
  
  // Display all batteries
  console.log("\n🔋 Battery Details");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  
  if (batteryCount > 0) {
    for (let i = 1; i <= batteryCount; i++) {
      try {
        const battery = await batteryNFT.getBattery(i);
        const owner = await batteryNFT.ownerOf(i);
        
        console.log(`\nBattery #${i}:`);
        console.log(`┣━ 🆔 Token ID: ${battery[0].toString()}`);
        console.log(`┣━ 🏷️ Type: ${formatNFTType(battery[1])}`);
        console.log(`┣━ 🔐 Data Hash: ${battery[2]}`);
        console.log(`┣━ 👤 Owner: ${owner}`);
        console.log(`┣━ ⏰ Created: ${formatTimestamp(battery[4])}`);
        console.log(`┣━ 🔄 Latest Update TX: ${battery[5] || 'None'}`);
        
        // Check if there are any modules linked (though they likely don't exist due to the bug)
        const modules = battery[3];
        if (modules.length > 0) {
          console.log(`┣━ 🧩 Linked Modules (${modules.length}):`);
          for (let j = 0; j < modules.length; j++) {
            console.log(`┃   ┣━ Module #${modules[j].toString()}`);
          }
        } else {
          console.log(`┣━ 🧩 Linked Modules: None`);
        }
        
        // Display storage location data
        try {
          const locationCount = await dataRegistry.getStorageLocationCount(i);
          console.log(`┣━ 📂 Storage Locations: ${locationCount}`);
          
          if (locationCount > 0) {
            const locationDetails = await dataRegistry.getLatestStorageLocation(i);
            const storageTypeNames = ["CENTRALIZED_DB", "IPFS", "ARWEAVE", "OTHER"];
            console.log(`┃   ┣━ 📂 Type: ${storageTypeNames[locationDetails[0]]}`);
            console.log(`┃   ┣━ 🔗 URI: ${locationDetails[1]}`);
            console.log(`┃   ┣━ 🔑 Encryption Key: ${locationDetails[2]}`);
            console.log(`┃   ┗━ ⏱️ Updated: ${formatTimestamp(locationDetails[3])}`);
          }
        } catch (error) {
          console.log(`┗━ 📂 Storage Locations: Error retrieving (${error.message})`);
        }
        
      } catch (error) {
        console.log(`\nBattery #${i}: Error retrieving data - ${error.message}`);
      }
    }
  } else {
    console.log("No batteries found in the system.");
  }
  
  console.log("\n✨ Dashboard Complete");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 