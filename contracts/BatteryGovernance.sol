// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title BatteryGovernance
 * @dev Implements a customized governance system for battery data management with tiered approval requirements.
 * This contract allows OEM participants to propose and vote on actions with different thresholds based on criticality.
 */
contract BatteryGovernance is AccessControl {
    /// @dev Role identifier for OEM participants authorized to create and vote on proposals
    bytes32 public constant OEM_ROLE = keccak256("OEM_ROLE");
    
    /// @dev Types of proposals with different approval thresholds
    /// @param UNKNOWN Default placeholder for uninitialized proposals
    /// @param CRITICAL Proposals requiring 2-of-3 approvals (battery issuance, permissions)
    /// @param ROUTINE Proposals requiring 1-of-3 approvals (data updates)
    enum ProposalType { UNKNOWN, CRITICAL, ROUTINE }
    
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
     * @dev Sets up the governance contract with initial OEM participants
     * @param _initialOEMs Array of addresses for initial OEM representatives
     */
    constructor(address[] memory _initialOEMs) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        
        for (uint256 i = 0; i < _initialOEMs.length; i++) {
            _grantRole(OEM_ROLE, _initialOEMs[i]);
        }
    }
    
    /**
     * @dev Creates a new proposal for OEM approval
     * @param targets The contract addresses to call if proposal passes
     * @param values The ETH values to send with each call (usually 0)
     * @param calldatas The call data for each target function call
     * @param description Human-readable explanation of the proposal
     * @param proposalType CRITICAL (2-of-3) or ROUTINE (1-of-3) approval requirement
     * @return proposalId Unique identifier for the created proposal
     */
    function propose(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory description,
        ProposalType proposalType
    ) public onlyRole(OEM_ROLE) returns (uint256) {
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
    function castVote(uint256 proposalId) public onlyRole(OEM_ROLE) {
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