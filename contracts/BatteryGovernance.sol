// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/governance/Governor.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorSettings.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorTimelockControl.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract BatteryGovernance is Governor, GovernorSettings, GovernorTimelockControl, AccessControl {
    bytes32 public constant OEM_ROLE = keccak256("OEM_ROLE");
    
    // Mapping to track proposal types
    mapping(uint256 => ProposalType) public proposalTypes;
    
    enum ProposalType { UNKNOWN, CRITICAL, ROUTINE }
    enum VoteType { AGAINST, FOR, ABSTAIN }
    
    // Mapping to track votes
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    mapping(uint256 => uint256) public forVotes;
    
    // Event for tracking proposal creation
    event ProposalCreated(
        uint256 proposalId,
        address proposer,
        ProposalType proposalType,
        string description
    );
    
    constructor(
        TimelockController _timelock,
        address[] memory _initialOEMs
    )
        Governor("BatteryGovernance")
        GovernorSettings(0, 1, 0) // 0 voting delay, 1 block voting period, 0 proposal threshold
        GovernorTimelockControl(_timelock)
    {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        
        // Add initial OEM participants
        for (uint256 i = 0; i < _initialOEMs.length; i++) {
            _grantRole(OEM_ROLE, _initialOEMs[i]);
        }
    }
    
    // Override propose function to include proposal type 
    function propose(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory description,
        ProposalType proposalType
    ) public onlyRole(OEM_ROLE) returns (uint256) {
        uint256 proposalId = super.propose(targets, values, calldatas, description);
        proposalTypes[proposalId] = proposalType;
        
        emit ProposalCreated(proposalId, msg.sender, proposalType, description);
        return proposalId;
    }
    
    // Function to determine if a proposal is critical or routine
    function isProposalCritical(uint256 proposalId) public view returns (bool) {
        return proposalTypes[proposalId] == ProposalType.CRITICAL;
    }
    
    // Override needed functions for Governor
    function votingDelay() public view override(Governor, GovernorSettings) returns (uint256) {
        return super.votingDelay();
    }
    
    function votingPeriod() public view override(Governor, GovernorSettings) returns (uint256) {
        return super.votingPeriod();
    }
    
    // Custom vote counting logic for tiered approvals
    function _countVote(
        uint256 proposalId,
        address account,
        uint8 support,
        uint256 weight,
        bytes memory params
    ) internal override {
        require(!hasVoted[proposalId][account], "Already voted");
        require(hasRole(OEM_ROLE, account), "Not an OEM participant");
        
        hasVoted[proposalId][account] = true;
        
        if (support == uint8(VoteType.FOR)) {
            forVotes[proposalId] += 1;
            
            // Auto-execute if threshold is met
            if (isProposalCritical(proposalId)) {
                // Critical proposals need 2 votes
                if (forVotes[proposalId] >= 2) {
                    _tryExecute(proposalId);
                }
            } else {
                // Routine proposals need 1 vote
                _tryExecute(proposalId);
            }
        }
    }
    
    // Try to execute a proposal if it's in the right state
    function _tryExecute(uint256 proposalId) internal {
        if (state(proposalId) == ProposalState.Active) {
            // This will queue in the timelock if needed
            queue(proposalId);
        }
        
        if (state(proposalId) == ProposalState.Queued && 
            TimelockController(payable(timelock())).isOperationReady(
                keccak256(abi.encode(proposalId))
            )) {
            execute(proposalId);
        }
    }
    
    // Required override for compatibility
    function state(uint256 proposalId) public view override(Governor, GovernorTimelockControl) returns (ProposalState) {
        return super.state(proposalId);
    }
    
    function propose(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory description
    ) public override(Governor) onlyRole(OEM_ROLE) returns (uint256) {
        // Default to CRITICAL if not specified
        return propose(targets, values, calldatas, description, ProposalType.CRITICAL);
    }
    
    function _execute(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) {
        super._execute(proposalId, targets, values, calldatas, descriptionHash);
    }
    
    function _cancel(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) returns (uint256) {
        return super._cancel(targets, values, calldatas, descriptionHash);
    }
    
    function supportsInterface(bytes4 interfaceId) public view override(Governor, AccessControl, GovernorTimelockControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
} 