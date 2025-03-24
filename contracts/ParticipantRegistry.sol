// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title ParticipantRegistry
 * @dev Tracks compromised wallet addresses with their revocation timestamps
 * and maintains role hierarchy for compromise reporting
 */
contract ParticipantRegistry is AccessControl {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");
    bytes32 public constant OEM_ROLE = keccak256("OEM_ROLE");
    bytes32 public constant REPAIR_SHOP_ROLE = keccak256("REPAIR_SHOP_ROLE");

    // Mapping to track compromised wallets
    mapping(address => bool) private _compromisedWallets;
    
    // Mapping from wallet address to revocation timestamp
    mapping(address => uint256) private _revocationTimestamps;

    // Mapping for storing reason for compromise
    mapping(address => string) private _compromiseReasons;

    // Mapping for storing who reported the compromise
    mapping(address => address) private _compromiseReporters;

    // Track all role members
    mapping(bytes32 => address[]) private _roleMembers;

    event WalletCompromised(address indexed wallet, address indexed reporter, uint256 timestamp, string reason);
    event WalletRestored(address indexed wallet, uint256 timestamp);

    /**
     * @dev Sets up the registry with initial admin and role hierarchy
     */
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        
        // Set up role hierarchy
        _setRoleAdmin(OEM_ROLE, GOVERNANCE_ROLE);
        _setRoleAdmin(REPAIR_SHOP_ROLE, OEM_ROLE);
    }
    
    /**
     * @dev Returns the admin role identifier
     * @return bytes32 ADMIN_ROLE
     */
    function getAdminRole() external pure returns (bytes32) {
        return ADMIN_ROLE;
    }
    
    /**
     * @dev Returns the governance role identifier
     * @return bytes32 GOVERNANCE_ROLE
     */
    function getGovernanceRole() external pure returns (bytes32) {
        return GOVERNANCE_ROLE;
    }
    
    /**
     * @dev Returns the OEM role identifier
     * @return bytes32 OEM_ROLE
     */
    function getOEMRole() external pure returns (bytes32) {
        return OEM_ROLE;
    }
    
    /**
     * @dev Returns the repair shop role identifier
     * @return bytes32 REPAIR_SHOP_ROLE
     */
    function getRepairShopRole() external pure returns (bytes32) {
        return REPAIR_SHOP_ROLE;
    }

    /**
     * @dev Marks a wallet as compromised with proper role-based authorization
     * @param wallet Address of the compromised wallet
     * @param reason Reason for marking wallet as compromised
     */
    function markWalletAsCompromised(address wallet, string memory reason) public {
        require(!_compromisedWallets[wallet], "Wallet already marked as compromised");
        
        // Check authorization based on wallet's role
        if (hasRole(OEM_ROLE, wallet)) {
            // Only GOVERNANCE_ROLE or ADMIN_ROLE can mark OEM as compromised
            require(
                hasRole(GOVERNANCE_ROLE, msg.sender) || hasRole(ADMIN_ROLE, msg.sender),
                "Only governance can mark OEM as compromised"
            );
        } else if (hasRole(REPAIR_SHOP_ROLE, wallet)) {
            // OEM_ROLE, GOVERNANCE_ROLE or ADMIN_ROLE can mark repair shop as compromised
            require(
                hasRole(OEM_ROLE, msg.sender) || 
                hasRole(GOVERNANCE_ROLE, msg.sender) || 
                hasRole(ADMIN_ROLE, msg.sender),
                "Only OEM or governance can mark repair shop as compromised"
            );
        } else {
            // For any other wallet, at least OEM role is required
            require(
                hasRole(OEM_ROLE, msg.sender) || 
                hasRole(GOVERNANCE_ROLE, msg.sender) || 
                hasRole(ADMIN_ROLE, msg.sender),
                "Insufficient permissions to mark wallet as compromised"
            );
        }
        
        _compromisedWallets[wallet] = true;
        _revocationTimestamps[wallet] = block.timestamp;
        _compromiseReasons[wallet] = reason;
        _compromiseReporters[wallet] = msg.sender;
        
        emit WalletCompromised(wallet, msg.sender, block.timestamp, reason);
    }

    /**
     * @dev Checks if a wallet is compromised
     * @param wallet Address to check
     * @return True if wallet is compromised
     */
    function isCompromised(address wallet) public view returns (bool) {
        return _compromisedWallets[wallet];
    }

    /**
     * @dev Gets the revocation timestamp for a wallet
     * @param wallet Address to check
     * @return Timestamp when wallet was marked as compromised (0 if not compromised)
     */
    function getRevocationTimestamp(address wallet) public view returns (uint256) {
        return _revocationTimestamps[wallet];
    }

    /**
     * @dev Gets the reason why a wallet was marked as compromised
     * @param wallet Address to check
     * @return Reason string
     */
    function getCompromiseReason(address wallet) public view returns (string memory) {
        require(_compromisedWallets[wallet], "Wallet is not compromised");
        return _compromiseReasons[wallet];
    }

    /**
     * @dev Gets the address that reported a wallet as compromised
     * @param wallet Address to check
     * @return Reporter address
     */
    function getCompromiseReporter(address wallet) public view returns (address) {
        require(_compromisedWallets[wallet], "Wallet is not compromised");
        return _compromiseReporters[wallet];
    }

    /**
     * @dev Restores a compromised wallet (use with caution)
     * @param wallet Address to restore
     */
    function restoreWallet(address wallet) public onlyRole(ADMIN_ROLE) {
        require(_compromisedWallets[wallet], "Wallet is not compromised");
        
        _compromisedWallets[wallet] = false;
        delete _revocationTimestamps[wallet];
        delete _compromiseReasons[wallet];
        delete _compromiseReporters[wallet];
        
        emit WalletRestored(wallet, block.timestamp);
    }
    
    /**
     * @dev Sets governance role for a contract or address
     * @param governanceAddress Address to receive governance role
     */
    function setGovernanceRole(address governanceAddress) external onlyRole(ADMIN_ROLE) {
        _grantCustomRole(GOVERNANCE_ROLE, governanceAddress);
    }

    /**
     * @dev Sets OEM role for an address
     * @param oemAddress Address to receive OEM role
     */
    function setOEMRole(address oemAddress) external onlyRole(GOVERNANCE_ROLE) {
        _grantCustomRole(OEM_ROLE, oemAddress);
    }

    /**
     * @dev Sets repair shop role for an address
     * @param repairShopAddress Address to receive repair shop role
     */
    function setRepairShopRole(address repairShopAddress) external onlyRole(OEM_ROLE) {
        _grantCustomRole(REPAIR_SHOP_ROLE, repairShopAddress);
    }
    
    /**
     * @dev Removes a role from an address
     * @param role Role to remove
     * @param account Address to remove role from
     */
    function revokeRole(bytes32 role, address account) public override onlyRole(getRoleAdmin(role)) {
        super.revokeRole(role, account);
        
        // Remove from role members list
        address[] storage members = _roleMembers[role];
        for (uint256 i = 0; i < members.length; i++) {
            if (members[i] == account) {
                // Replace with last element and remove last (efficient array removal)
                members[i] = members[members.length - 1];
                members.pop();
                break;
            }
        }
    }
    
    /**
     * @dev Internal function to grant role and track member
     * @param role Role to grant
     * @param account Account to grant role to
     */
    function _grantCustomRole(bytes32 role, address account) internal {
        if (!hasRole(role, account)) {
            _grantRole(role, account);
            _roleMembers[role].push(account);
        }
    }
    
    /**
     * @dev Gets all addresses with a specific role
     * @param role Role to query
     * @return Array of addresses with the role
     */
    function getRoleMembers(bytes32 role) public view returns (address[] memory) {
        return _roleMembers[role];
    }
    
    /**
     * @dev Gets all OEM addresses
     * @return Array of OEM addresses
     */
    function getAllOEMs() public view returns (address[] memory) {
        return getRoleMembers(OEM_ROLE);
    }
    
    /**
     * @dev Gets all repair shop addresses
     * @return Array of repair shop addresses
     */
    function getAllRepairShops() public view returns (address[] memory) {
        return getRoleMembers(REPAIR_SHOP_ROLE);
    }
} 