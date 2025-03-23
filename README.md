# Sample Hardhat Project

This project demonstrates a basic Hardhat use case. It comes with a sample contract, a test for that contract, and a Hardhat Ignition module that deploys that contract.

Try running some of the following tasks:

```shell
npx hardhat help
npx hardhat test
REPORT_GAS=true npx hardhat test
npx hardhat node
npx hardhat ignition deploy ./ignition/modules/Lock.ts
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
