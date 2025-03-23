// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

contract BatteryGovernance is AccessControl {
    bytes32 public constant OEM_ROLE = keccak256("OEM_ROLE");
    
    enum ProposalType { UNKNOWN, CRITICAL, ROUTINE }
    
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
    
    mapping(uint256 => Proposal) public proposals;
    uint256 public proposalCount;
    
    event ProposalCreated(uint256 proposalId, address proposer, ProposalType proposalType, string description);
    event ProposalExecuted(uint256 proposalId);
    event VoteCast(uint256 proposalId, address voter);
    
    constructor(address[] memory _initialOEMs) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        
        for (uint256 i = 0; i < _initialOEMs.length; i++) {
            _grantRole(OEM_ROLE, _initialOEMs[i]);
        }
    }
    
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