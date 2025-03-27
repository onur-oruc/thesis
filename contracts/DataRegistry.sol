// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title DataRegistry
 * @dev Maintains mappings between battery NFTs and their private data storage locations
 */
contract DataRegistry is AccessControl {
    bytes32 public constant OEM_ROLE = keccak256("OEM_ROLE");
    bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");

    // Storage type for battery data
    enum StorageType { CENTRALIZED_DB, IPFS, ARWEAVE, OTHER }

    // Structure containing storage location info
    struct StorageLocation {
        uint256 batteryId;          // ID of the battery NFT
        StorageType storageType;    // Type of storage used
        string identifier;          // Identifier or path in the storage system
        string encryptionKeyId;     // ID of the encryption key used
        uint256 updatedAt;          // Last update timestamp
        bool isValid;               // Whether this location is still valid
    }

    // Mapping from battery ID to its storage locations (can have multiple for different versions)
    mapping(uint256 => StorageLocation[]) private _batteryStorageLocations;
    
    // Latest storage location index for quick access
    mapping(uint256 => uint256) private _latestLocationIndex;

    // Events
    event StorageLocationAdded(uint256 indexed batteryId, StorageType storageType, string identifier);
    event StorageLocationInvalidated(uint256 indexed batteryId, uint256 locationIndex);

    /**
     * @dev Sets up registry with initial OEM and governance roles
     * @param governanceContract Address of the governance contract
     * @param initialOEMs Array of addresses for initial OEM representatives
     */
    constructor(address governanceContract, address[] memory initialOEMs) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(GOVERNANCE_ROLE, governanceContract);
        
        for (uint256 i = 0; i < initialOEMs.length; i++) {
            _grantRole(OEM_ROLE, initialOEMs[i]);
        }
    }

    /**
     * @dev Adds a new storage location for a battery's private data
     * @param batteryId ID of the battery NFT
     * @param storageType Type of storage used
     * @param identifier Identifier or path in the storage system
     * @param encryptionKeyId ID of the encryption key used
     */
    function addStorageLocation(
        uint256 batteryId,
        StorageType storageType,
        string memory identifier,
        string memory encryptionKeyId
    ) public onlyRole(OEM_ROLE) {
        StorageLocation memory newLocation = StorageLocation({
            batteryId: batteryId,
            storageType: storageType,
            identifier: identifier,
            encryptionKeyId: encryptionKeyId,
            updatedAt: block.timestamp,
            isValid: true
        });
        
        // Add new location
        _batteryStorageLocations[batteryId].push(newLocation);
        
        // Update latest index
        _latestLocationIndex[batteryId] = _batteryStorageLocations[batteryId].length - 1;
        
        emit StorageLocationAdded(batteryId, storageType, identifier);
    }

    /**
     * @dev Invalidates a storage location for a battery's private data
     * @param batteryId ID of the battery NFT
     * @param locationIndex Index of the storage location to invalidate
     */
    function invalidateStorageLocation(
        uint256 batteryId,
        uint256 locationIndex
    ) public onlyRole(OEM_ROLE) {
        require(locationIndex < _batteryStorageLocations[batteryId].length, "Invalid location index");
        
        // Mark location as invalid
        _batteryStorageLocations[batteryId][locationIndex].isValid = false;
        
        emit StorageLocationInvalidated(batteryId, locationIndex);
    }

    /**
     * @dev Gets the latest valid storage location for a battery
     * @param batteryId ID of the battery NFT
     * @return storageType Type of storage
     * @return identifier Identifier in the storage system
     * @return encryptionKeyId ID of the encryption key used
     * @return updatedAt Last update timestamp
     */
    function getLatestStorageLocation(uint256 batteryId) public view returns (
        StorageType storageType,
        string memory identifier,
        string memory encryptionKeyId,
        uint256 updatedAt
    ) {
        require(_batteryStorageLocations[batteryId].length > 0, "No storage locations for this battery");
        
        uint256 latestIndex = _latestLocationIndex[batteryId];
        StorageLocation storage location = _batteryStorageLocations[batteryId][latestIndex];
        
        require(location.isValid, "Latest location is invalidated");
        
        return (
            location.storageType,
            location.identifier,
            location.encryptionKeyId,
            location.updatedAt
        );
    }

    /**
     * @dev Gets all storage locations for a battery
     * @param batteryId ID of the battery NFT
     * @return Array of storage locations
     */
    function getAllStorageLocations(uint256 batteryId) public view onlyRole(OEM_ROLE) returns (StorageLocation[] memory) {
        return _batteryStorageLocations[batteryId];
    }

    /**
     * @dev Gets the count of storage locations for a battery
     * @param batteryId ID of the battery NFT
     * @return Count of storage locations
     */
    function getStorageLocationCount(uint256 batteryId) public view returns (uint256) {
        return _batteryStorageLocations[batteryId].length;
    }
} 