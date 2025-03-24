// Script to create a proposal and mint a battery through governance
const hre = require("hardhat");

async function main() {
  console.log("Interacting with contracts...");

  // Contract addresses
  const governanceAddress = "0x3d54048b876f4C0663B032988F3ae1c7AbC5A282";
  const permissionNFTAddress = "0xE919C8A82b823e513E4f1fe1766557E8badfF643";
  const batteryNFTAddress = "0x8694393E83dc7B53Ea1E53D94BAaaAdF9E992088";

  // Get contract instances
  const BatteryGovernance = await hre.ethers.getContractFactory("BatteryGovernance");
  const PermissionNFT = await hre.ethers.getContractFactory("PermissionNFT");
  const BatteryNFT = await hre.ethers.getContractFactory("BatteryNFT");

  const governance = BatteryGovernance.attach(governanceAddress);
  const permissionNFT = PermissionNFT.attach(permissionNFTAddress);
  const batteryNFT = BatteryNFT.attach(batteryNFTAddress);

  // Get signers (OEMs)
  const [deployer, oem1, oem2, oem3] = await hre.ethers.getSigners();
  
  console.log("Using OEM account:", oem1.address);

  // Create data for the battery
  const sampleEncryptedData = "This is encrypted battery data";
  const sampleDataHash = "0x123456789abcdef";
  const sampleURI = "https://example.com/battery/1";
  
  // Create calldata for battery minting
  const batteryInterface = batteryNFT.interface;
  const mintBatteryCalldata = batteryInterface.encodeFunctionData(
    "mintBattery",
    [oem1.address, sampleEncryptedData, sampleDataHash, sampleURI]
  );
  
  console.log("Creating proposal to mint battery...");

  // Create a proposal to mint a battery
  const tx = await governance.connect(oem1).propose(
    [batteryNFTAddress], // target contract
    [0], // no ETH sent
    [mintBatteryCalldata], // calldata
    "Mint a new battery NFT", // description
    1, // ProposalType.CRITICAL (requires 2 votes)
    0 // no specific battery ID for this operation
  );
  
  // Wait for proposal to be created
  const receipt = await tx.wait();
  console.log("Proposal transaction confirmed");
  
  // Use proposalCount to get the current proposal ID
  const proposalId = await governance.proposalCount() - 1n;
  console.log("Proposal created with ID:", proposalId.toString());
  
  // Cast votes from first and second OEMs
  console.log("OEM1 voting on proposal...");
  await governance.connect(oem1).castVote(proposalId);
  
  console.log("OEM2 voting on proposal...");
  const voteTx = await governance.connect(oem2).castVote(proposalId);
  await voteTx.wait();
  console.log("OEM2 vote confirmed");
  
  // Query to see if the battery was minted
  try {
    // Wait a bit for the transaction to process
    console.log("Waiting for transaction to be fully processed...");
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check the balance of OEM1 for battery NFTs
    const balance = await batteryNFT.balanceOf(oem1.address);
    console.log(`OEM1 now has ${balance.toString()} battery NFTs`);
    
    if (balance > 0) {
      // Get the first token ID owned by OEM1
      const tokenId = await batteryNFT.tokenOfOwnerByIndex(oem1.address, 0);
      console.log("Battery NFT ID:", tokenId.toString());
      
      // Get battery details
      const batteryDetails = await batteryNFT.getBattery(tokenId);
      console.log("Battery details:", {
        tokenId: batteryDetails[0].toString(),
        nftType: batteryDetails[1],
        encryptedData: batteryDetails[2],
        dataHash: batteryDetails[3],
        moduleIds: batteryDetails[4].map(id => id.toString()),
        createdAt: new Date(Number(batteryDetails[5]) * 1000).toISOString(),
        latestUpdateTxId: batteryDetails[6]
      });
    }
  } catch (error) {
    console.error("Error querying battery:", error.message);
  }
  
  console.log("Interaction complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 