// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title ParticipantRegistry
 * @dev Stores authorized wallet addresses for all system participants (OEMs, repair shops, etc.)
 * and tracks revoked/compromised wallet addresses with revocation timestamps
 */
contract ParticipantRegistry is AccessControl {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OEM_ROLE = keccak256("OEM_ROLE");
    bytes32 public constant REPAIR_SHOP_ROLE = keccak256("REPAIR_SHOP_ROLE");
    bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");

    enum ParticipantType { OEM, REPAIR_SHOP, GOVERNANCE, OTHER }

    struct Participant {
        address wallet;
        ParticipantType participantType;
        bool isValid;
        uint256 registeredAt;
        uint256 revokedAt;
        string details;
    }

    // Mapping from wallet address to participant data
    mapping(address => Participant) private _participants;
    
    // Arrays to track all participants by type
    address[] private _oemAddresses;
    address[] private _repairShopAddresses;
    address[] private _governanceAddresses;
    address[] private _otherAddresses;
    
    // Mapping to track compromised wallets
    mapping(address => bool) private _compromisedWallets;
    
    // Mapping from wallet address to revocation timestamp
    mapping(address => uint256) private _revocationTimestamps;

    event ParticipantRegistered(address indexed wallet, ParticipantType participantType);
    event ParticipantRevoked(address indexed wallet, uint256 timestamp);
    event WalletCompromised(address indexed wallet, uint256 timestamp);

    /**
     * @dev Sets up the registry with initial admin
     */
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    /**
     * @dev Registers a new OEM wallet
     * @param wallet Address of the OEM wallet
     * @param details Additional details about the OEM
     */
    function registerOEM(address wallet, string memory details) public onlyRole(ADMIN_ROLE) {
        require(!_compromisedWallets[wallet], "Wallet is compromised");
        require(!_participants[wallet].isValid, "Wallet already registered");
        
        _participants[wallet] = Participant({
            wallet: wallet,
            participantType: ParticipantType.OEM,
            isValid: true,
            registeredAt: block.timestamp,
            revokedAt: 0,
            details: details
        });
        
        _oemAddresses.push(wallet);
        _grantRole(OEM_ROLE, wallet);
        
        emit ParticipantRegistered(wallet, ParticipantType.OEM);
    }

    /**
     * @dev Registers a new repair shop wallet
     * @param wallet Address of the repair shop wallet
     * @param details Additional details about the repair shop
     */
    function registerRepairShop(address wallet, string memory details) public onlyRole(ADMIN_ROLE) {
        require(!_compromisedWallets[wallet], "Wallet is compromised");
        require(!_participants[wallet].isValid, "Wallet already registered");
        
        _participants[wallet] = Participant({
            wallet: wallet,
            participantType: ParticipantType.REPAIR_SHOP,
            isValid: true,
            registeredAt: block.timestamp,
            revokedAt: 0,
            details: details
        });
        
        _repairShopAddresses.push(wallet);
        _grantRole(REPAIR_SHOP_ROLE, wallet);
        
        emit ParticipantRegistered(wallet, ParticipantType.REPAIR_SHOP);
    }

    /**
     * @dev Registers a new governance wallet
     * @param wallet Address of the governance wallet
     * @param details Additional details about the governance entity
     */
    function registerGovernance(address wallet, string memory details) public onlyRole(ADMIN_ROLE) {
        require(!_compromisedWallets[wallet], "Wallet is compromised");
        require(!_participants[wallet].isValid, "Wallet already registered");
        
        _participants[wallet] = Participant({
            wallet: wallet,
            participantType: ParticipantType.GOVERNANCE,
            isValid: true,
            registeredAt: block.timestamp,
            revokedAt: 0,
            details: details
        });
        
        _governanceAddresses.push(wallet);
        _grantRole(GOVERNANCE_ROLE, wallet);
        
        emit ParticipantRegistered(wallet, ParticipantType.GOVERNANCE);
    }

    /**
     * @dev Registers a wallet with custom type (OTHER)
     * @param wallet Address of the wallet
     * @param details Additional details
     */
    function registerOther(address wallet, string memory details) public onlyRole(ADMIN_ROLE) {
        require(!_compromisedWallets[wallet], "Wallet is compromised");
        require(!_participants[wallet].isValid, "Wallet already registered");
        
        _participants[wallet] = Participant({
            wallet: wallet,
            participantType: ParticipantType.OTHER,
            isValid: true,
            registeredAt: block.timestamp,
            revokedAt: 0,
            details: details
        });
        
        _otherAddresses.push(wallet);
        
        emit ParticipantRegistered(wallet, ParticipantType.OTHER);
    }

    /**
     * @dev Revokes a wallet's authorization
     * @param wallet Address of the wallet to revoke
     */
    function revokeWallet(address wallet) public onlyRole(ADMIN_ROLE) {
        require(_participants[wallet].isValid, "Wallet not registered or already revoked");
        
        _participants[wallet].isValid = false;
        _participants[wallet].revokedAt = block.timestamp;
        _revocationTimestamps[wallet] = block.timestamp;
        
        // Revoke roles based on participant type
        ParticipantType pType = _participants[wallet].participantType;
        
        if (pType == ParticipantType.OEM) {
            _revokeRole(OEM_ROLE, wallet);
        } else if (pType == ParticipantType.REPAIR_SHOP) {
            _revokeRole(REPAIR_SHOP_ROLE, wallet);
        } else if (pType == ParticipantType.GOVERNANCE) {
            _revokeRole(GOVERNANCE_ROLE, wallet);
        }
        
        emit ParticipantRevoked(wallet, block.timestamp);
    }

    /**
     * @dev Marks a wallet as compromised
     * @param wallet Address of the compromised wallet
     */
    function markWalletAsCompromised(address wallet) public onlyRole(ADMIN_ROLE) {
        _compromisedWallets[wallet] = true;
        
        // Also revoke if it was a valid participant
        if (_participants[wallet].isValid) {
            revokeWallet(wallet);
        }
        
        emit WalletCompromised(wallet, block.timestamp);
    }

    /**
     * @dev Checks if a wallet is registered and valid
     * @param wallet Address to check
     * @return True if wallet is registered and valid
     */
    function isValidParticipant(address wallet) public view returns (bool) {
        return _participants[wallet].isValid && !_compromisedWallets[wallet];
    }

    /**
     * @dev Checks if a wallet is an OEM
     * @param wallet Address to check
     * @return True if wallet is a valid OEM
     */
    function isValidOEM(address wallet) public view returns (bool) {
        return _participants[wallet].isValid && 
               _participants[wallet].participantType == ParticipantType.OEM &&
               !_compromisedWallets[wallet];
    }

    /**
     * @dev Checks if a wallet is a repair shop
     * @param wallet Address to check
     * @return True if wallet is a valid repair shop
     */
    function isValidRepairShop(address wallet) public view returns (bool) {
        return _participants[wallet].isValid && 
               _participants[wallet].participantType == ParticipantType.REPAIR_SHOP &&
               !_compromisedWallets[wallet];
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
     * @dev Gets participant data
     * @param wallet Address of the participant
     * @return wallet_ The wallet address
     * @return participantType_ Type of participant
     * @return isValid_ Whether wallet is valid
     * @return registeredAt_ Registration timestamp
     * @return revokedAt_ Revocation timestamp (0 if not revoked)
     * @return details_ Additional details
     */
    function getParticipant(address wallet) public view returns (
        address wallet_,
        ParticipantType participantType_,
        bool isValid_,
        uint256 registeredAt_,
        uint256 revokedAt_,
        string memory details_
    ) {
        Participant storage participant = _participants[wallet];
        return (
            participant.wallet,
            participant.participantType,
            participant.isValid && !_compromisedWallets[wallet],
            participant.registeredAt,
            participant.revokedAt,
            participant.details
        );
    }

    /**
     * @dev Gets all OEM addresses
     * @return Array of all OEM addresses (including revoked ones)
     */
    function getAllOEMs() public view returns (address[] memory) {
        return _oemAddresses;
    }

    /**
     * @dev Gets all repair shop addresses
     * @return Array of all repair shop addresses (including revoked ones)
     */
    function getAllRepairShops() public view returns (address[] memory) {
        return _repairShopAddresses;
    }

    /**
     * @dev Gets all governance addresses
     * @return Array of all governance addresses (including revoked ones)
     */
    function getAllGovernance() public view returns (address[] memory) {
        return _governanceAddresses;
    }

    /**
     * @dev Gets the revocation timestamp for a wallet
     * @param wallet Address to check
     * @return Timestamp when wallet was revoked (0 if not revoked)
     */
    function getRevocationTimestamp(address wallet) public view returns (uint256) {
        return _revocationTimestamps[wallet];
    }
} 