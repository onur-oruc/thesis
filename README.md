# Sample Hardhat Project

This project demonstrates a basic Hardhat use case. It comes with a sample contract, a test for that contract, and a Hardhat Ignition module that deploys that contract.

Try running some of the following tasks:

```shell
npx hardhat help
npx hardhat test
REPORT_GAS=true npx hardhat test
npx hardhat node
npx hardhat ignition deploy ./ignition/modules/Lock.ts
npx hardhat run demos/march-27/run-all.js
npx hardhat run demos/march-27/02-create-battery-nft.js --network localhost
```

## Security Analysis Tools

### Slither

Slither is a Solidity static analysis framework that runs a suite of vulnerability detectors, prints visual information about contract details, and provides an API to easily write custom analyses.

#### Installation
pip3 install slither-analyzer

#### Usage
- Analyze all contracts
`slither .`
- Analyze specific contract
`slither contracts/Battery.sol`
- Generate a report
`slither . --json report.json`

### Mythril

Mythril is a security analysis tool for EVM bytecode. It uses symbolic execution to detect various types of issues.

#### Installation
pip3 install mythril

#### Usage
- Analyze a specific contract
`myth analyze contracts/Battery.sol`
- Use a specific solc version
`myth analyze contracts/Battery.sol --solv 0.8.20`
- Generate a report
`myth analyze contracts/Battery.sol -o markdown > mythril-report.md`


#### Removed Project Cursor Rules
- Implement timelocks for sensitive operations using OpenZeppelin's TimelockController.

## OpenZeppelin Dependencies

This project relies on several OpenZeppelin contracts to ensure security, standardization, and best practices:

### ERC721 Extensions

- **ERC721URIStorage**: Extends the ERC721 standard with storage based token URI management.
  - Used in BatteryNFT and PermissionNFT contracts to store metadata URIs for each token.
  - Documentation: https://docs.openzeppelin.com/contracts/4.x/api/token/erc721#ERC721URIStorage

- **ERC721Enumerable**: Extends the ERC721 standard with enumeration capabilities.
  - Used to keep track of all tokens in existence and their owners.
  - Enables on-chain enumeration of all tokens or tokens owned by a specific address.
  - Documentation: https://docs.openzeppelin.com/contracts/4.x/api/token/erc721#ERC721Enumerable

### Access Control

- **AccessControl**: Provides role-based access control mechanisms.
  - Used to manage different roles (OEM, GOVERNANCE) and their permissions.
  - Allows for granular control over who can mint, update, or transfer tokens.
  - Documentation: https://docs.openzeppelin.com/contracts/4.x/api/access#AccessControl

### Utilities

- **Counters**: Provides a simple way to create and manage counters.
  - Used to generate unique sequential IDs for battery and module tokens.
  - Prevents overflow and race conditions when creating new tokens.
  - Documentation: https://docs.openzeppelin.com/contracts/4.x/api/utils#Counters

### Governance

- **TimelockController**: Implements a timelock mechanism for governance actions.
  - Used in the BatteryTimelock contract to enforce delays before executing sensitive operations.
  - Adds a security layer by allowing time for review of pending actions.
  - Documentation: https://docs.openzeppelin.com/contracts/4.x/api/governance#TimelockController
