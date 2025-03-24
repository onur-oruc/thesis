// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./PermissionNFT.sol";
import "./ParticipantRegistry.sol";

/**
 * @title BatteryGovernance
 * @dev Implements a customized governance system for battery data management with tiered approval requirements.
 * This contract allows OEM participants to propose and vote on actions with different thresholds based on criticality.
 */
contract BatteryGovernance {
    /// @dev Types of proposals with different approval thresholds
    /// @param UNKNOWN Default placeholder for uninitialized proposals
    /// @param CRITICAL Proposals requiring 2-of-3 approvals (battery issuance, permissions)
    /// @param ROUTINE Proposals requiring 1-of-3 approvals (data updates)
    enum ProposalType { UNKNOWN, CRITICAL, ROUTINE }
    
    /// @dev Reference to the PermissionNFT contract for checking repair shop authorization
    PermissionNFT public permissionNFT;
    
    /// @dev Reference to the ParticipantRegistry contract for role verification
    ParticipantRegistry public participantRegistry;
    
    /// @dev Original deployer of the contract
    address public immutable deployer;
    
    /**
     * @dev Structure containing all proposal data
     * @param targets Contract addresses that will be called if proposal is executed
     * @param values ETH amounts to be sent with each call (usually 0)
     * @param calldatas Function call data for each target
     * @param description Human-readable description of the proposal
     * @param proposalType Whether proposal is CRITICAL (2-of-3) or ROUTINE (1-of-3)
     * @param hasVoted Mapping to track which OEM representatives have voted
     * @param forVotes Count of votes in favor
     * @param executed Whether proposal has been executed
     */
    struct Proposal {
        address[] targets;
        uint256[] values;
        bytes[] calldatas;
        string description;
        ProposalType proposalType;
        mapping(address => bool) hasVoted;
        uint256 forVotes;
        bool executed;
    }
    
    /// @dev Storage for all proposals indexed by ID
    mapping(uint256 => Proposal) public proposals;
    
    /// @dev Counter to generate unique proposal IDs
    uint256 public proposalCount;
    
    /// @dev Emitted when a new proposal is created
    event ProposalCreated(uint256 proposalId, address proposer, ProposalType proposalType, string description);
    
    /// @dev Emitted when a proposal is executed
    event ProposalExecuted(uint256 proposalId);
    
    /// @dev Emitted when a vote is cast on a proposal
    event VoteCast(uint256 proposalId, address voter);
    
    /**
     * @dev Modifier to ensure caller has the specified role
     * @param role The role identifier
     */
    modifier onlyRole(bytes32 role) {
        require(
            participantRegistry.hasRole(role, msg.sender),
            "Caller does not have the required role"
        );
        _;
    }
    
    /**
     * @dev Modifier to ensure caller is not compromised
     */
    modifier notCompromised() {
        require(
            !participantRegistry.isCompromised(msg.sender),
            "Wallet is compromised"
        );
        _;
    }
    
    /**
     * @dev Sets up the governance contract with registry reference
     * @param _participantRegistry Address of the participant registry contract
     */
    constructor(address _participantRegistry) {
        require(_participantRegistry != address(0), "Invalid registry address");
        participantRegistry = ParticipantRegistry(_participantRegistry);
        deployer = msg.sender;
    }
    
    /**
     * @dev Sets the PermissionNFT contract reference
     * @param _permissionNFT Address of the deployed PermissionNFT contract
     */
    function setPermissionNFT(address _permissionNFT) external {
        require(
            msg.sender == deployer || 
            participantRegistry.hasRole(participantRegistry.getAdminRole(), msg.sender),
            "Caller is not authorized"
        );
        permissionNFT = PermissionNFT(_permissionNFT);
    }
    
    /**
     * @dev Creates a new proposal for OEM approval
     * @param targets The contract addresses to call if proposal passes
     * @param values The ETH values to send with each call (usually 0)
     * @param calldatas The call data for each target function call
     * @param description Human-readable explanation of the proposal
     * @param proposalType CRITICAL (2-of-3) or ROUTINE (1-of-3) approval requirement
     * @param batteryId Optional battery ID if proposal is related to a specific battery
     * @return proposalId Unique identifier for the created proposal
     */
    function propose(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory description,
        ProposalType proposalType,
        uint256 batteryId
    ) public notCompromised returns (uint256) {
        // Check if sender is OEM or authorized repair shop
        bool isAuthorized = participantRegistry.hasRole(participantRegistry.getOEMRole(), msg.sender);
        
        // If not OEM, check if repair shop has valid permission
        if (!isAuthorized && address(permissionNFT) != address(0)) {
            // For ROUTINE proposals (data updates), repair shops need battery-specific permission
            if (proposalType == ProposalType.ROUTINE && batteryId > 0) {
                isAuthorized = permissionNFT.canSubmitDataForBattery(msg.sender, batteryId);
            }
            
            // For known repair shops with permanent permission NFT
            if (!isAuthorized) {
                isAuthorized = permissionNFT.canReadData(msg.sender);
            }
        }
        
        require(isAuthorized, "Not authorized to propose");
        
        // CRITICAL proposals can only be created by OEMs
        if (proposalType == ProposalType.CRITICAL) {
            require(
                participantRegistry.hasRole(participantRegistry.getOEMRole(), msg.sender),
                "Only OEMs can create CRITICAL proposals"
            );
        }
        
        require(targets.length == values.length && targets.length == calldatas.length, "Invalid proposal");
        
        uint256 proposalId = proposalCount++;
        Proposal storage proposal = proposals[proposalId];
        
        proposal.targets = targets;
        proposal.values = values;
        proposal.calldatas = calldatas;
        proposal.description = description;
        proposal.proposalType = proposalType;
        
        emit ProposalCreated(proposalId, msg.sender, proposalType, description);
        return proposalId;
    }
    
    /**
     * @dev Casts a vote on a proposal and executes it if threshold is met
     * @param proposalId The ID of the proposal to vote on
     * 
     * This function automatically executes the proposal when the required
     * threshold is met (2 votes for CRITICAL, 1 vote for ROUTINE)
     */
    function castVote(uint256 proposalId) public notCompromised {
        // Ensure voter is an OEM
        require(
            participantRegistry.hasRole(participantRegistry.getOEMRole(), msg.sender),
            "Only OEMs can vote"
        );
        
        Proposal storage proposal = proposals[proposalId];
        require(!proposal.executed, "Already executed");
        require(!proposal.hasVoted[msg.sender], "Already voted");
        
        proposal.hasVoted[msg.sender] = true;
        proposal.forVotes += 1;
        
        emit VoteCast(proposalId, msg.sender);
        
        // Auto-execute if threshold is met
        if (proposal.proposalType == ProposalType.CRITICAL) {
            // Critical proposals need 2 votes
            if (proposal.forVotes >= 2) {
                _execute(proposalId);
            }
        } else {
            // Routine proposals need 1 vote
            _execute(proposalId);
        }
    }
    
    /**
     * @dev Internal function to execute an approved proposal
     * @param proposalId The ID of the proposal to execute
     * 
     * Executes each target call with the corresponding value and calldata.
     * Sets the proposal as executed to prevent re-execution.
     */
    function _execute(uint256 proposalId) internal {
        Proposal storage proposal = proposals[proposalId];
        
        for (uint256 i = 0; i < proposal.targets.length; i++) {
            (bool success, ) = proposal.targets[i].call{value: proposal.values[i]}(proposal.calldatas[i]);
            require(success, "Proposal execution failed");
        }
        
        proposal.executed = true;
        emit ProposalExecuted(proposalId);
    }
} 