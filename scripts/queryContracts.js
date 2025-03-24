// Script to query contract view functions
const hre = require("hardhat");

async function main() {
  console.log("Querying contracts...");

  // Contract addresses from deployment
  const governanceAddress = "0x3d54048b876f4C0663B032988F3ae1c7AbC5A282";
  const permissionNFTAddress = "0xE919C8A82b823e513E4f1fe1766557E8badfF643";
  const batteryNFTAddress = "0x8694393E83dc7B53Ea1E53D94BAaaAdF9E992088";

  // Get contract factories
  const BatteryGovernance = await hre.ethers.getContractFactory("BatteryGovernance");
  const PermissionNFT = await hre.ethers.getContractFactory("PermissionNFT");
  const BatteryNFT = await hre.ethers.getContractFactory("BatteryNFT");

  // Get contract instances
  const governance = BatteryGovernance.attach(governanceAddress);
  const permissionNFT = PermissionNFT.attach(permissionNFTAddress);
  const batteryNFT = BatteryNFT.attach(batteryNFTAddress);

  // Query governance for OEM role
  const OEM_ROLE = await governance.OEM_ROLE();
  console.log("OEM_ROLE hash:", OEM_ROLE);

  // Get signers
  const [deployer, ...otherAccounts] = await hre.ethers.getSigners();
  
  // Check if first OEM has OEM role in governance
  const hasRole = await governance.hasRole(OEM_ROLE, otherAccounts[0].address);
  console.log(`Account ${otherAccounts[0].address} has OEM role: ${hasRole}`);

  // Check PermissionNFT address in governance
  const permAddress = await governance.permissionNFT();
  console.log("PermissionNFT address in governance:", permAddress);

  console.log("Query complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 