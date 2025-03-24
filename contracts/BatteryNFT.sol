// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title BatteryNFT
 * @dev Implements NFT representation for batteries and battery modules with hierarchical ownership
 */
contract BatteryNFT is ERC721URIStorage, ERC721Enumerable, AccessControl {
    using Counters for Counters.Counter;

    bytes32 public constant OEM_ROLE = keccak256("OEM_ROLE");
    bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");

    Counters.Counter private _batteryIds;
    Counters.Counter private _moduleIds;

    enum NFTType { BATTERY, MODULE }

    struct BatteryData {
        uint256 tokenId;
        NFTType nftType;
        string encryptedData;
        string dataHash;
        uint256[] moduleIds;
        uint256 createdAt;
        string latestUpdateTxId;
    }

    struct ModuleData {
        uint256 tokenId;
        NFTType nftType;
        string encryptedData;
        string dataHash;
        uint256 batteryId;
        uint256 createdAt;
        string latestUpdateTxId;
    }

    // Mapping from token ID to battery data
    mapping(uint256 => BatteryData) private _batteries;
    // Mapping from token ID to module data
    mapping(uint256 => ModuleData) private _modules;
    // Mapping for battery update registry
    mapping(uint256 => string[]) private _batteryUpdateRegistry;
    // Mapping for module update registry
    mapping(uint256 => string[]) private _moduleUpdateRegistry;

    event BatteryMinted(uint256 indexed tokenId, address indexed owner);
    event ModuleMinted(uint256 indexed tokenId, uint256 indexed batteryId, address indexed owner);
    event BatteryUpdated(uint256 indexed tokenId, string updateTxId);
    event ModuleUpdated(uint256 indexed tokenId, string updateTxId);
    event ModuleTransferred(uint256 indexed moduleId, uint256 indexed fromBatteryId, uint256 indexed toBatteryId);

    /**
     * @dev Sets up the NFT contract with initial OEM and governance roles
     * @param governanceContract Address of the governance contract
     * @param initialOEMs Array of addresses for initial OEM representatives
     */
    constructor(address governanceContract, address[] memory initialOEMs) 
        ERC721("Battery Certificate", "BATT") 
    {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(GOVERNANCE_ROLE, governanceContract);
        
        for (uint256 i = 0; i < initialOEMs.length; i++) {
            _grantRole(OEM_ROLE, initialOEMs[i]);
        }
    }

    /**
     * @dev Creates a new battery NFT
     * @param to Address that will own the NFT
     * @param encryptedData Encrypted private battery data
     * @param dataHash Hash of the unencrypted data for verification
     * @param tokenURI URI for battery metadata
     * @return tokenId The ID of the newly minted battery NFT
     */
    function mintBattery(
        address to,
        string memory encryptedData,
        string memory dataHash,
        string memory tokenURI
    ) public onlyRole(GOVERNANCE_ROLE) returns (uint256) {
        _batteryIds.increment();
        uint256 tokenId = _batteryIds.current();
        
        _mint(to, tokenId);
        _setTokenURI(tokenId, tokenURI);
        
        _batteries[tokenId] = BatteryData({
            tokenId: tokenId,
            nftType: NFTType.BATTERY,
            encryptedData: encryptedData,
            dataHash: dataHash,
            moduleIds: new uint256[](0),
            createdAt: block.timestamp,
            latestUpdateTxId: ""
        });
        
        emit BatteryMinted(tokenId, to);
        return tokenId;
    }

    /**
     * @dev Creates a new module NFT and links it to a battery
     * @param to Address that will own the NFT (should be the same as battery owner)
     * @param batteryId ID of the parent battery
     * @param encryptedData Encrypted private module data
     * @param dataHash Hash of the unencrypted data for verification
     * @param tokenURI URI for module metadata
     * @return tokenId The ID of the newly minted module NFT
     */
    function mintModule(
        address to,
        uint256 batteryId,
        string memory encryptedData,
        string memory dataHash,
        string memory tokenURI
    ) public onlyRole(GOVERNANCE_ROLE) returns (uint256) {
        require(_exists(batteryId), "Battery does not exist");
        require(_batteries[batteryId].nftType == NFTType.BATTERY, "Token is not a battery");
        
        _moduleIds.increment();
        uint256 tokenId = _moduleIds.current();
        
        _mint(to, tokenId);
        _setTokenURI(tokenId, tokenURI);
        
        _modules[tokenId] = ModuleData({
            tokenId: tokenId,
            nftType: NFTType.MODULE,
            encryptedData: encryptedData,
            dataHash: dataHash,
            batteryId: batteryId,
            createdAt: block.timestamp,
            latestUpdateTxId: ""
        });
        
        // Link module to battery
        _batteries[batteryId].moduleIds.push(tokenId);
        
        emit ModuleMinted(tokenId, batteryId, to);
        return tokenId;
    }

    /**
     * @dev Updates battery data with new information, preserving history
     * @param batteryId ID of the battery to update
     * @param encryptedData New encrypted private data
     * @param dataHash Hash of the new unencrypted data
     * @param updateTxId Transaction ID for the update (links to history chain)
     */
    function updateBatteryData(
        uint256 batteryId,
        string memory encryptedData,
        string memory dataHash,
        string memory updateTxId
    ) public onlyRole(GOVERNANCE_ROLE) {
        require(_exists(batteryId), "Battery does not exist");
        require(_batteries[batteryId].nftType == NFTType.BATTERY, "Token is not a battery");
        
        // Update the battery data
        _batteries[batteryId].encryptedData = encryptedData;
        _batteries[batteryId].dataHash = dataHash;
        _batteries[batteryId].latestUpdateTxId = updateTxId;
        
        // Add to update registry
        _batteryUpdateRegistry[batteryId].push(updateTxId);
        
        emit BatteryUpdated(batteryId, updateTxId);
    }

    /**
     * @dev Updates module data with new information, preserving history
     * @param moduleId ID of the module to update
     * @param encryptedData New encrypted private data
     * @param dataHash Hash of the new unencrypted data
     * @param updateTxId Transaction ID for the update (links to history chain)
     */
    function updateModuleData(
        uint256 moduleId,
        string memory encryptedData,
        string memory dataHash,
        string memory updateTxId
    ) public onlyRole(GOVERNANCE_ROLE) {
        require(_exists(moduleId), "Module does not exist");
        require(_modules[moduleId].nftType == NFTType.MODULE, "Token is not a module");
        
        // Update the module data
        _modules[moduleId].encryptedData = encryptedData;
        _modules[moduleId].dataHash = dataHash;
        _modules[moduleId].latestUpdateTxId = updateTxId;
        
        // Add to update registry
        _moduleUpdateRegistry[moduleId].push(updateTxId);
        
        emit ModuleUpdated(moduleId, updateTxId);
    }

    /**
     * @dev Transfers a module from one battery to another
     * @param moduleId ID of the module to transfer
     * @param toBatteryId ID of the destination battery
     */
    function transferModule(
        uint256 moduleId,
        uint256 toBatteryId
    ) public onlyRole(GOVERNANCE_ROLE) {
        require(_exists(moduleId), "Module does not exist");
        require(_exists(toBatteryId), "Destination battery does not exist");
        require(_modules[moduleId].nftType == NFTType.MODULE, "Token is not a module");
        require(_batteries[toBatteryId].nftType == NFTType.BATTERY, "Destination is not a battery");
        
        uint256 fromBatteryId = _modules[moduleId].batteryId;
        
        // Remove module from source battery
        uint256[] storage sourceModules = _batteries[fromBatteryId].moduleIds;
        for (uint256 i = 0; i < sourceModules.length; i++) {
            if (sourceModules[i] == moduleId) {
                // Replace with last element and remove last (efficient array removal)
                sourceModules[i] = sourceModules[sourceModules.length - 1];
                sourceModules.pop();
                break;
            }
        }
        
        // Add module to destination battery
        _batteries[toBatteryId].moduleIds.push(moduleId);
        
        // Update module's battery reference
        _modules[moduleId].batteryId = toBatteryId;
        
        emit ModuleTransferred(moduleId, fromBatteryId, toBatteryId);
    }

    /**
     * @dev Gets battery data
     * @param batteryId ID of the battery
     * @return tokenId The token ID
     * @return nftType The NFT type (BATTERY)
     * @return encryptedData The encrypted battery data
     * @return dataHash Hash of the unencrypted data
     * @return moduleIds Array of module IDs linked to this battery
     * @return createdAt Timestamp when created
     * @return latestUpdateTxId Transaction ID of the latest update
     */
    function getBattery(uint256 batteryId) public view returns (
        uint256 tokenId,
        NFTType nftType,
        string memory encryptedData,
        string memory dataHash,
        uint256[] memory moduleIds,
        uint256 createdAt,
        string memory latestUpdateTxId
    ) {
        require(_exists(batteryId), "Battery does not exist");
        require(_batteries[batteryId].nftType == NFTType.BATTERY, "Token is not a battery");
        
        BatteryData storage battery = _batteries[batteryId];
        return (
            battery.tokenId,
            battery.nftType,
            battery.encryptedData,
            battery.dataHash,
            battery.moduleIds,
            battery.createdAt,
            battery.latestUpdateTxId
        );
    }

    /**
     * @dev Gets module data
     * @param moduleId ID of the module
     * @return tokenId The token ID
     * @return nftType The NFT type (MODULE)
     * @return encryptedData The encrypted module data
     * @return dataHash Hash of the unencrypted data
     * @return batteryId ID of the parent battery
     * @return createdAt Timestamp when created
     * @return latestUpdateTxId Transaction ID of the latest update
     */
    function getModule(uint256 moduleId) public view returns (
        uint256 tokenId,
        NFTType nftType,
        string memory encryptedData,
        string memory dataHash,
        uint256 batteryId,
        uint256 createdAt,
        string memory latestUpdateTxId
    ) {
        require(_exists(moduleId), "Module does not exist");
        require(_modules[moduleId].nftType == NFTType.MODULE, "Token is not a module");
        
        ModuleData storage module = _modules[moduleId];
        return (
            module.tokenId,
            module.nftType,
            module.encryptedData,
            module.dataHash,
            module.batteryId,
            module.createdAt,
            module.latestUpdateTxId
        );
    }

    /**
     * @dev Gets battery update history
     * @param batteryId ID of the battery
     * @return Array of update transaction IDs
     */
    function getBatteryUpdateHistory(uint256 batteryId) public view returns (string[] memory) {
        require(_exists(batteryId), "Battery does not exist");
        require(_batteries[batteryId].nftType == NFTType.BATTERY, "Token is not a battery");
        
        return _batteryUpdateRegistry[batteryId];
    }

    /**
     * @dev Gets module update history
     * @param moduleId ID of the module
     * @return Array of update transaction IDs
     */
    function getModuleUpdateHistory(uint256 moduleId) public view returns (string[] memory) {
        require(_exists(moduleId), "Module does not exist");
        require(_modules[moduleId].nftType == NFTType.MODULE, "Token is not a module");
        
        return _moduleUpdateRegistry[moduleId];
    }

    /**
     * @dev Override functions that are in both ERC721URIStorage and ERC721Enumerable
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId, 
        uint256 batchSize
    ) internal virtual override(ERC721, ERC721Enumerable) {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
        
        // Only allow minting (from == 0) or transfers by OEM or governance
        if (from != address(0)) {
            require(
                hasRole(OEM_ROLE, msg.sender) || hasRole(GOVERNANCE_ROLE, msg.sender),
                "Transfer restricted to OEM or governance"
            );
        }
    }

    function tokenURI(uint256 tokenId) 
        public 
        view 
        override(ERC721, ERC721URIStorage) 
        returns (string memory) 
    {
        return super.tokenURI(tokenId);
    }

    function _burn(uint256 tokenId) 
        internal 
        override(ERC721, ERC721URIStorage) 
    {
        super._burn(tokenId);
    }

    // Required override for inherited contracts
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721URIStorage, ERC721Enumerable, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
} 