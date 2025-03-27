# Battery Passport on Blockchain - March 27 Demo

## Current Implementation

Our blockchain-based battery passport system currently includes the following core components:

1. **Core Contract Structure**:
   - **BatteryNFT**: Handles battery and module NFTs with data storage capabilities
   - **PermissionNFT**: Implements time-limited and permanent permissions for repair shops
   - **ParticipantRegistry**: Manages roles and compromised identities
   - **DataRegistry**: Maps batteries to their private data storage locations
   - **BatteryGovernance**: Implements proposal and voting mechanism with tiered approvals

2. **Role-Based Access Control**:
   - Hierarchical role system (Admin > Governance > OEM > Repair Shop)
   - Compromised identity tracking system
   - Role management with proper authorization paths

3. **NFT Implementation**:
   - Battery and module NFT creation and linking
   - Permission NFTs with temporary (time-limited) and permanent types
   - Update registry to track history of battery changes

4. **Governance System**:
   - Tiered approvals (Critical: 2-of-3, Routine: 1-of-3)
   - Voting and execution mechanics
   - Role-specific proposal authorization

## Technical Challenges & Solutions

### Governance Implementation
Instead of using Gnosis Safe multisig contracts, we implemented a custom governance system using OpenZeppelin's AccessControl library. This decision was made for several reasons:

1. **Flexible Approval Thresholds**: Our system needed different approval thresholds based on the criticality of operations (Critical: 2-of-3, Routine: 1-of-3). Gnosis Safe uses a fixed m-of-n threshold.

2. **Role Hierarchies**: We implemented a hierarchical role system (Admin > Governance > OEM > Repair Shop) which aligns better with OpenZeppelin's AccessControl.

3. **Integration Simplicity**: Direct integration with our other contracts was simpler with AccessControl, avoiding the complexity of external calls to a separate multisig contract.

4. **Custom Voting Logic**: Our specific governance requirements (like role-based voting) were easier to implement with a custom solution.

5. **Dependancy Support**: The Gnosis Safe contracts do not work with the latest versions of other libraries like ethers.js v6.

### Data Privacy Approach
For private battery data, we're using a hybrid approach:
- Store data off-chain with references stored in the DataRegistry
- Include hash of unencrypted data on-chain for verification
- Support multiple storage types (Centralized DB, IPFS, Arweave)

## Remaining Work

For upcoming development cycles, we plan to:

1. **Implement the remaining storage options:**
   - Complete Arweave integration for public data storage
   - Implement secure off-chain storage mechanisms for private data

2. **Complete governance workflows:**
   - Implement the BatteryTimelock contract for time-delayed operations
   - Add government approval system for OEMs

3. **Implement the demonstration scripts:**
   - End-to-end battery lifecycle demos
   - Permission management workflows
   - Compromised identity handling

4. **Refine the security model:**
   - Implement Shamir's Secret Sharing for key backup
   - Add key rotation mechanisms
   - Complete the revoked wallets functionality

5. **Make Contracts Upgradable**
6. **Battery Module Creation**
   - Currently, the battery NFT creation works but the module creation does not!
   - Therefore, we cannot create and link modules to battery NFTs for now. 
   >>>
    the BatteryNFT contract has a design flaw with module creation - it uses the same token ID space for both batteries and modules but tracks them with separate counters, causing conflicts when creating modules. A fix would involve using a separate ID space for modules (like starting at ID 1000 or using separate NFT contracts).
   >>>
7. **Actual Data Hashing**
   - Instead of using hardcoded hash values for demo purposes, implement a system where the hash of the value can actually be created on the fly (!)
8. **Public vs Private Data**
   - Storing the hash of the private data is fine, but we also need to store the public data on Arweave and attach it's transaction hash in the DataRegistry. Remember that the public data does not need to be encyrpted. It's plain data will be stored on Arweave and the hash and the transaction_if of the Arweave will be stored on-chain.
9. **DataRegistry Extra Fields**
   - See the issue in Linear for details.

## Demo Content

The demo scripts in this directory showcase the core functionality of our system, including:

1. Battery NFT creation
2. Permission NFT management
3. Governance workflows
4. Data update append logs
5. Role management
6. Compromised wallet handling
