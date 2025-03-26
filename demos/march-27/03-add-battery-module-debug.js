// Script to debug battery module creation and token ID assignment

const hre = require("hardhat");
const fs = require('fs');

// Helper to get ABI for a contract
function getContractABI(contractName) {
  const artifactPath = `./artifacts/contracts/${contractName}.sol/${contractName}.json`;
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  return artifact.abi;
}

async function main() {
  console.log("Debugging battery and module token ID assignment...");

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

  // Check battery count
  const batteryCount = await batteryNFT.getBatteryCount();
  const moduleCount = await batteryNFT.getModuleCount();
  console.log(`Total batteries: ${batteryCount}`);
  console.log(`Total modules: ${moduleCount}`);

  // Check token ownership for a range of IDs
  console.log("\nChecking token ownership for IDs 1-10:");
  for (let id = 1; id <= 10; id++) {
    try {
      const owner = await batteryNFT.ownerOf(id);
      console.log(`Token ID ${id} is owned by ${owner}`);
      
      // Try to determine if it's a battery or module
      try {
        const battery = await batteryNFT.getBattery(id);
        console.log(`  - This is a BATTERY with ${battery[3].length} modules`);
      } catch (e) {
        try {
          const module = await batteryNFT.getModule(id);
          console.log(`  - This is a MODULE linked to battery ${module[3]}`);
        } catch (e2) {
          console.log(`  - Could not determine token type`);
        }
      }
    } catch (e) {
      console.log(`Token ID ${id} does not exist or is not owned`);
    }
  }

  // Now try to create a brand new battery and module for it
  console.log("\nCreating a new battery and module for testing...");
  
  try {
    // First ensure deployer has GOVERNANCE_ROLE
    const governanceRole = await batteryNFT.GOVERNANCE_ROLE();
    const hasRole = await batteryNFT.hasRole(governanceRole, deployer.address);
    
    if (!hasRole) {
      console.log("Granting GOVERNANCE_ROLE to deployer...");
      const adminRole = await batteryNFT.DEFAULT_ADMIN_ROLE();
      await batteryNFT.grantRole(governanceRole, deployer.address);
      console.log("GOVERNANCE_ROLE granted to deployer");
    }
    
    // Create a new battery
    console.log("Creating new battery...");
    const dataHash = `0xtest${Date.now()}`;
    const metadataURI = `https://example.com/battery/test/${Date.now()}`;
    
    const newBatteryTx = await batteryNFT.mintBattery(
      deployer.address,
      dataHash,
      metadataURI
    );
    
    const batteryReceipt = await newBatteryTx.wait();
    
    // Extract the new battery ID from events if possible
    let newBatteryId = 0;
    for (const log of batteryReceipt.logs) {
      try {
        const iface = new hre.ethers.Interface(getContractABI("BatteryNFT"));
        const parsedLog = iface.parseLog({
          topics: log.topics,
          data: log.data
        });
        
        if (parsedLog && parsedLog.name === "BatteryMinted") {
          newBatteryId = parsedLog.args[0];
          console.log(`New battery minted with ID: ${newBatteryId}`);
          break;
        }
      } catch (e) {
        // Not the event we're looking for
      }
    }
    
    if (newBatteryId == 0) {
      const updatedBatteryCount = await batteryNFT.getBatteryCount();
      newBatteryId = updatedBatteryCount;
      console.log(`Using latest battery count as ID: ${newBatteryId}`);
    }
    
    // Now create a module for this battery
    console.log(`Creating module for battery ID ${newBatteryId}...`);
    const moduleDataHash = `0xmodule${Date.now()}`;
    const moduleMetadataURI = `https://example.com/module/test/${Date.now()}`;
    
    const newModuleTx = await batteryNFT.mintModule(
      deployer.address,
      newBatteryId,
      moduleDataHash,
      moduleMetadataURI
    );
    
    const moduleReceipt = await newModuleTx.wait();
    console.log("Module created successfully");
    
    // Verify the updated counts
    const finalBatteryCount = await batteryNFT.getBatteryCount();
    const finalModuleCount = await batteryNFT.getModuleCount();
    console.log(`Updated battery count: ${finalBatteryCount}`);
    console.log(`Updated module count: ${finalModuleCount}`);
    
    // Get the module details
    if (finalModuleCount > 0) {
      const newModuleId = finalModuleCount;
      console.log(`Checking details for module ID ${newModuleId}...`);
      
      try {
        const module = await batteryNFT.getModule(newModuleId);
        console.log(`Module details:`);
        console.log(`- Token ID: ${module[0].toString()}`);
        console.log(`- Type: ${module[1] == 1 ? 'MODULE' : 'UNKNOWN'}`);
        console.log(`- Data Hash: ${module[2]}`);
        console.log(`- Parent Battery ID: ${module[3].toString()}`);
      } catch (error) {
        console.error(`Error getting module details: ${error.message}`);
        
        // Try checking if the token exists by ownerOf
        try {
          const owner = await batteryNFT.ownerOf(newModuleId);
          console.log(`Token ${newModuleId} exists and is owned by ${owner}`);
        } catch (e) {
          console.log(`Token ${newModuleId} does not exist`);
        }
      }
    }
  } catch (error) {
    console.error(`Error in battery/module creation: ${error.message}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 