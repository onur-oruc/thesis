# Battery Passport on Blockchain - Demos

This directory contains demonstrations of the battery passport system implemented on a blockchain.

## Available Demos

### March 27 Demo

The March 27 demo showcases the core functionality of our battery passport system, including:

1. **Contract Deployment**: Deploy all core contracts (BatteryNFT, PermissionNFT, ParticipantRegistry, DataRegistry, BatteryGovernance)
2. **Battery NFT Creation**: Create battery NFTs through the governance system with tiered approval requirements
3. **Permission Management**: Issue and manage temporary and permanent permission NFTs for repair shops
4. **Compromised Wallet Handling**: Demonstrate the system's ability to mark wallets as compromised and prevent their actions
5. **Battery Data Updates**: Show how repair shops with valid permissions can submit data updates for batteries

## Running the Demos

### Prerequisites

- Node.js (v14+)
- Hardhat (`npm install --save-dev hardhat`)
- All required dependencies (`npm install`)

### Running the March 27 Demo

1. Navigate to the project root directory:
   ```
   cd /path/to/project
   ```

2. Run all demos in sequence:
   ```
   npx hardhat run demos/march-27/run-all.js
   ```

3. Or run individual demo scripts:
   ```
   npx hardhat run demos/march-27/01-deploy-contracts.js
   npx hardhat run demos/march-27/02-create-battery-nft.js
   ```
   
## Technical Implementation

The demos showcase our implementation of:

1. **NFT representation** for batteries and their permissions
2. **Governance system** with tiered approvals based on operation criticality
3. **Role-based access control** using OpenZeppelin's AccessControl
4. **Compromised identity tracking**
5. **Data history chain** for battery updates

## Project Status

For detailed information on the current state of the project, technical challenges, and remaining work, see the README.md file in the specific demo directory.

## Contact

For questions or issues, please contact the repository maintainer. 