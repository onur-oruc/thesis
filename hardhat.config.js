module.exports = {
  solidity: "0.8.20",
  networks: {
    ganache: {
      url: "http://127.0.0.1:7545", // Default Ganache GUI URL
      // If using CLI with different port: "http://127.0.0.1:8545"
      accounts: {
        // Use your private keys from Ganache here or use mnemonic
        mnemonic: "your ganache mnemonic here"
      }
    }
  }
}; 