const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DataRegistry", function () {
  let dataRegistry, batteryNFT;
  let deployer, oem1, oem2, oem3, repairShop;
  let initialOEMs;

  beforeEach(async function () {
    // Get signers
    [deployer, oem1, oem2, oem3, repairShop] = await ethers.getSigners();
    initialOEMs = [oem1.address, oem2.address, oem3.address];

    // Deploy the DataRegistry contract
    const DataRegistry = await ethers.getContractFactory("DataRegistry");
    dataRegistry = await DataRegistry.deploy(deployer.address, initialOEMs);
    await dataRegistry.waitForDeployment();

    // Deploy the BatteryNFT contract
    const BatteryNFT = await ethers.getContractFactory("BatteryNFT");
    batteryNFT = await BatteryNFT.deploy(deployer.address, initialOEMs);
    await batteryNFT.waitForDeployment();

    // Link the contracts
    await batteryNFT.setDataRegistry(await dataRegistry.getAddress());
  });

  describe("Basic Functionality", function () {
    it("should correctly mint a battery and store its data location", async function () {
      // Mint a new battery with hash only
      const sampleDataHash = "0x123456789abcdef";
      const sampleURI = "https://example.com/battery/1";
      
      await batteryNFT.mintBattery(
        oem1.address,
        sampleDataHash,
        sampleURI
      );

      // Verify battery exists
      const batteryId = 1; // First battery ID
      const batteryDetails = await batteryNFT.getBattery(batteryId);
      expect(batteryDetails[0]).to.equal(batteryId);
      expect(batteryDetails[2]).to.equal(sampleDataHash);

      // Add storage location to DataRegistry
      const storageType = 1; // IPFS
      const identifier = "ipfs://QmTestHash123456789";
      const encryptionKeyId = "key-2023-001";
      
      await dataRegistry.connect(oem1).addStorageLocation(
        batteryId,
        storageType,
        identifier,
        encryptionKeyId
      );

      // Verify storage location is correctly saved
      const locationDetails = await dataRegistry.getLatestStorageLocation(batteryId);
      expect(locationDetails[0]).to.equal(storageType);
      expect(locationDetails[1]).to.equal(identifier);
      expect(locationDetails[2]).to.equal(encryptionKeyId);
    });

    it("should track battery data update history", async function () {
      // Mint a battery
      const sampleDataHash = "0x123456789abcdef";
      const sampleURI = "https://example.com/battery/1";
      
      await batteryNFT.mintBattery(
        oem1.address,
        sampleDataHash,
        sampleURI
      );
      
      const batteryId = 1;
      
      // Update the battery data
      const newDataHash = "0xabc123def456";
      const updateTxId = "ipfs://QmUpdateHash123";
      
      await batteryNFT.updateBatteryData(
        batteryId,
        newDataHash,
        updateTxId
      );
      
      // Verify the update
      const batteryDetails = await batteryNFT.getBattery(batteryId);
      expect(batteryDetails[2]).to.equal(newDataHash);
      expect(batteryDetails[5]).to.equal(updateTxId);
      
      // Check the update history
      const updateHistory = await batteryNFT.getBatteryUpdateHistory(batteryId);
      expect(updateHistory.length).to.equal(1);
      expect(updateHistory[0]).to.equal(updateTxId);
      
      // Add multiple updates
      const secondUpdateHash = "0xsecond123update456";
      const secondUpdateTxId = "ipfs://QmSecondUpdate";
      
      await batteryNFT.updateBatteryData(
        batteryId,
        secondUpdateHash,
        secondUpdateTxId
      );
      
      const finalUpdateHistory = await batteryNFT.getBatteryUpdateHistory(batteryId);
      expect(finalUpdateHistory.length).to.equal(2);
      expect(finalUpdateHistory[1]).to.equal(secondUpdateTxId);
    });
  });

  describe("Data Registry Functionality", function () {
    it("should manage multiple data storage locations", async function () {
      // Mint a battery
      await batteryNFT.mintBattery(
        oem1.address,
        "0xdataHash123",
        "https://example.com/battery/1"
      );
      
      const batteryId = 1;
      
      // Add first storage location
      await dataRegistry.connect(oem1).addStorageLocation(
        batteryId,
        1, // IPFS
        "ipfs://QmFirstLocation",
        "key-first"
      );
      
      // Add second storage location
      await dataRegistry.connect(oem1).addStorageLocation(
        batteryId,
        2, // ARWEAVE
        "ar://SecondLocation",
        "key-second"
      );
      
      // Verify we have two locations
      const locationCount = await dataRegistry.getStorageLocationCount(batteryId);
      expect(locationCount).to.equal(2);
      
      // Verify latest is the second one
      const latestLocation = await dataRegistry.getLatestStorageLocation(batteryId);
      expect(latestLocation[0]).to.equal(2); // ARWEAVE
      expect(latestLocation[1]).to.equal("ar://SecondLocation");
    });

    it("should handle invalidation of storage locations", async function () {
      // Mint a battery
      await batteryNFT.mintBattery(
        oem1.address,
        "0xdataHash123",
        "https://example.com/battery/1"
      );
      
      const batteryId = 1;
      
      // Add first storage location
      await dataRegistry.connect(oem1).addStorageLocation(
        batteryId,
        0, // CENTRALIZED_DB
        "db://original/location",
        "key-original"
      );
      
      // Add second storage location
      await dataRegistry.connect(oem1).addStorageLocation(
        batteryId,
        0, // CENTRALIZED_DB
        "db://new/location",
        "key-new"
      );
      
      // Invalidate the latest (second) location
      await dataRegistry.connect(oem1).invalidateStorageLocation(batteryId, 1);
      
      // Try to get latest - should revert because it's invalidated
      await expect(
        dataRegistry.getLatestStorageLocation(batteryId)
      ).to.be.revertedWith("Latest location is invalidated");
      
      // Add a third valid location
      await dataRegistry.connect(oem1).addStorageLocation(
        batteryId,
        0, // CENTRALIZED_DB
        "db://final/location",
        "key-final"
      );
      
      // Verify we can now get a valid latest location
      const latestLocation = await dataRegistry.getLatestStorageLocation(batteryId);
      expect(latestLocation[1]).to.equal("db://final/location");
    });
  });

  describe("Access Control", function () {
    it("should restrict storage location operations to OEMs", async function () {
      // Mint a battery
      await batteryNFT.mintBattery(
        oem1.address,
        "0xdataHash123",
        "https://example.com/battery/1"
      );
      
      const batteryId = 1;
      
      // Try to add a storage location as repair shop (should fail)
      await expect(
        dataRegistry.connect(repairShop).addStorageLocation(
          batteryId,
          1,
          "ipfs://QmUnauthorizedLocation",
          "key-unauthorized"
        )
      ).to.be.reverted;
      
      // Add as OEM (should succeed)
      await dataRegistry.connect(oem1).addStorageLocation(
        batteryId,
        1,
        "ipfs://QmAuthorizedLocation",
        "key-authorized"
      );
      
      // Try to invalidate as repair shop (should fail)
      await expect(
        dataRegistry.connect(repairShop).invalidateStorageLocation(batteryId, 0)
      ).to.be.reverted;
    });
  });
}); 