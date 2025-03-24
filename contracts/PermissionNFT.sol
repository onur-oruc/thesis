// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title PermissionNFT
 * @dev Implements NFT representation for repair shop permissions with time-limited validity
 */
contract PermissionNFT is ERC721URIStorage, ERC721Enumerable, AccessControl {
    using Counters for Counters.Counter;

    bytes32 public constant OEM_ROLE = keccak256("OEM_ROLE");
    bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");

    Counters.Counter private _tokenIds;

    enum PermissionType { PERMANENT, TEMPORARY }

    struct PermissionData {
        uint256 tokenId;        // Unique identifier for the permission NFT
        uint256 batteryId;      // ID of battery this permission applies to (0 for permanent permissions)
        PermissionType permType; // Type of permission (PERMANENT or TEMPORARY)
        uint256 expiryTime;     // Timestamp when permission expires (0 for permanent permissions)
        bool revoked;           // Whether this permission has been revoked by an OEM
        bool canSubmitData;     // Whether holder can submit data updates for the battery
        bool canReadData;       // Whether holder can access encrypted private data
        uint256 createdAt;      // Timestamp when permission was created
    }

    // Mapping from token ID to permission data
    mapping(uint256 => PermissionData) private _permissions;
    
    // Mapping from battery ID to list of permission token IDs
    mapping(uint256 => uint256[]) private _batteryPermissions;
    
    // List of compromised identities (wallets)
    mapping(address => bool) private _compromisedIdentities;

    event PermissionCreated(uint256 indexed tokenId, uint256 indexed batteryId, address indexed recipient);
    event PermissionRevoked(uint256 indexed tokenId, address indexed revokedBy);
    event IdentityCompromised(address indexed identity, address indexed reportedBy);

    /**
     * @dev Sets up the permission NFT contract with initial OEM and governance roles
     * @param governanceContract Address of the governance contract
     * @param initialOEMs Array of addresses for initial OEM representatives
     */
    constructor(address governanceContract, address[] memory initialOEMs) 
        ERC721("Battery Permission", "PERM") 
    {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(GOVERNANCE_ROLE, governanceContract);
        
        for (uint256 i = 0; i < initialOEMs.length; i++) {
            _grantRole(OEM_ROLE, initialOEMs[i]);
        }
    }

    /**
     * @dev Creates a new temporary permission NFT for a specific battery
     * @param to Address that will receive the permission NFT (typically repair shop)
     * @param batteryId ID of the battery this permission applies to
     * @param validityPeriod Duration in seconds that this permission is valid
     * @param canSubmitData Whether this permission allows submitting new data
     * @param canReadData Whether this permission allows reading private data
     * @param tokenURI URI for permission metadata
     * @return tokenId The ID of the newly minted permission NFT
     */
    function mintTemporaryPermission(
        address to,
        uint256 batteryId,
        uint256 validityPeriod,
        bool canSubmitData,
        bool canReadData,
        string memory tokenURI
    ) public onlyRole(GOVERNANCE_ROLE) returns (uint256) {
        require(!_compromisedIdentities[to], "Recipient identity is compromised");
        
        _tokenIds.increment();
        uint256 tokenId = _tokenIds.current();
        
        _mint(to, tokenId);
        _setTokenURI(tokenId, tokenURI);
        
        uint256 expiryTime = block.timestamp + validityPeriod;
        
        _permissions[tokenId] = PermissionData({
            tokenId: tokenId,
            batteryId: batteryId,
            permType: PermissionType.TEMPORARY,
            expiryTime: expiryTime,
            revoked: false,
            canSubmitData: canSubmitData,
            canReadData: canReadData,
            createdAt: block.timestamp
        });
        
        // Add to battery permissions list
        _batteryPermissions[batteryId].push(tokenId);
        
        emit PermissionCreated(tokenId, batteryId, to);
        return tokenId;
    }

    /**
     * @dev Creates a new permanent permission NFT (for known repair shops)
     * @param to Address that will receive the permission NFT
     * @param canReadData Whether this permission allows reading private data
     * @param tokenURI URI for permission metadata
     * @return tokenId The ID of the newly minted permission NFT
     */
    function mintPermanentPermission(
        address to,
        bool canReadData,
        string memory tokenURI
    ) public onlyRole(GOVERNANCE_ROLE) returns (uint256) {
        require(!_compromisedIdentities[to], "Recipient identity is compromised");
        
        _tokenIds.increment();
        uint256 tokenId = _tokenIds.current();
        
        _mint(to, tokenId);
        _setTokenURI(tokenId, tokenURI);
        
        _permissions[tokenId] = PermissionData({
            tokenId: tokenId,
            batteryId: 0, // Not tied to a specific battery
            permType: PermissionType.PERMANENT,
            expiryTime: 0, // No expiry
            revoked: false,
            canSubmitData: false, // Permanent permissions are for verification only
            canReadData: canReadData,
            createdAt: block.timestamp
        });
        
        emit PermissionCreated(tokenId, 0, to);
        return tokenId;
    }

    /**
     * @dev Revokes a permission NFT
     * @param tokenId ID of the permission to revoke
     */
    function revokePermission(uint256 tokenId) public onlyRole(GOVERNANCE_ROLE) {
        require(_exists(tokenId), "Permission does not exist");
        
        _permissions[tokenId].revoked = true;
        emit PermissionRevoked(tokenId, msg.sender);
    }

    /**
     * @dev Marks an identity (wallet) as compromised
     * @param identity Address of the compromised wallet
     */
    function markIdentityAsCompromised(address identity) public onlyRole(GOVERNANCE_ROLE) {
        _compromisedIdentities[identity] = true;
        emit IdentityCompromised(identity, msg.sender);
    }

    /**
     * @dev Checks if a permission is valid for a specific battery
     * @param tokenId ID of the permission to check
     * @param batteryId ID of the battery to check authorization for
     * @return True if permission is valid for this battery
     */
    function isValidPermission(uint256 tokenId, uint256 batteryId) public view returns (bool) {
        if (!_exists(tokenId)) return false;
        
        PermissionData storage perm = _permissions[tokenId];
        
        // Check if revoked
        if (perm.revoked) return false;
        
        // Check if owner is compromised
        if (_compromisedIdentities[ownerOf(tokenId)]) return false;
        
        // For temporary permissions
        if (perm.permType == PermissionType.TEMPORARY) {
            // Check expiry
            if (block.timestamp > perm.expiryTime) return false;
            
            // Check battery specificity
            if (perm.batteryId != batteryId) return false;
            
            return true;
        }
        
        // For permanent permissions (only for identity verification)
        return (perm.permType == PermissionType.PERMANENT);
    }

    /**
     * @dev Checks if a wallet has permission to submit data for a battery
     * @param wallet Address to check
     * @param batteryId Battery ID to check authorization for
     * @return True if wallet can submit data for this battery
     */
    function canSubmitDataForBattery(address wallet, uint256 batteryId) public view returns (bool) {
        if (_compromisedIdentities[wallet]) return false;
        
        uint256[] memory tokenIds = _batteryPermissions[batteryId];
        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];
            if (ownerOf(tokenId) == wallet) {
                PermissionData storage perm = _permissions[tokenId];
                
                // Check if permission is valid and can submit data
                if (!perm.revoked && 
                    perm.canSubmitData && 
                    (perm.permType == PermissionType.PERMANENT || block.timestamp <= perm.expiryTime)) {
                    return true;
                }
            }
        }
        
        return false;
    }

    /**
     * @dev Checks if a wallet can read private data
     * @param wallet Address to check
     * @return True if wallet has valid permission to read data
     */
    function canReadData(address wallet) public view returns (bool) {
        if (_compromisedIdentities[wallet]) return false;
        
        // OEMs and governance can always read data
        if (hasRole(OEM_ROLE, wallet) || hasRole(GOVERNANCE_ROLE, wallet)) {
            return true;
        }
        
        // Check owned tokens
        uint256 balance = balanceOf(wallet);
        for (uint256 i = 0; i < balance; i++) {
            uint256 tokenId = tokenOfOwnerByIndex(wallet, i);
            PermissionData storage perm = _permissions[tokenId];
            
            // Check if permission is valid and allows reading data
            if (!perm.revoked && 
                perm.canReadData && 
                (perm.permType == PermissionType.PERMANENT || block.timestamp <= perm.expiryTime)) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * @dev Gets permission data by ID
     * @param tokenId ID of the permission
     * @return tokenId_ The token ID
     * @return batteryId_ ID of the battery this permission applies to
     * @return permType_ Type of permission (PERMANENT or TEMPORARY)
     * @return expiryTime_ Timestamp when permission expires
     * @return revoked_ Whether permission has been revoked
     * @return canSubmitData_ Whether permission allows submitting data
     * @return canReadData_ Whether permission allows reading data
     * @return createdAt_ Timestamp when created
     */
    function getPermission(uint256 tokenId) public view returns (
        uint256 tokenId_,
        uint256 batteryId_,
        PermissionType permType_,
        uint256 expiryTime_,
        bool revoked_,
        bool canSubmitData_,
        bool canReadData_,
        uint256 createdAt_
    ) {
        require(_exists(tokenId), "Permission does not exist");
        
        PermissionData storage perm = _permissions[tokenId];
        return (
            perm.tokenId,
            perm.batteryId,
            perm.permType,
            perm.expiryTime,
            perm.revoked,
            perm.canSubmitData,
            perm.canReadData,
            perm.createdAt
        );
    }

    /**
     * @dev Gets all permissions for a battery
     * @param batteryId ID of the battery
     * @return Array of permission token IDs
     */
    function getBatteryPermissions(uint256 batteryId) public view returns (uint256[] memory) {
        return _batteryPermissions[batteryId];
    }

    /**
     * @dev Checks if an identity is compromised
     * @param identity Address to check
     * @return True if identity is compromised
     */
    function isCompromised(address identity) public view returns (bool) {
        return _compromisedIdentities[identity];
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
        
        // Allow minting (from == 0) or transfers by authorized roles
        if (from != address(0)) {
            require(
                hasRole(OEM_ROLE, msg.sender) || hasRole(GOVERNANCE_ROLE, msg.sender),
                "Transfer restricted to OEM or governance"
            );
        }
        
        // Ensure recipient is not compromised
        require(!_compromisedIdentities[to], "Recipient identity is compromised");
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