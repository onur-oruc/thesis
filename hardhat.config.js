module.exports = {
  solidity: "0.8.20",
  networks: {
    ganache: {
      url: "http://127.0.0.1:7545", // Default Ganache GUI URL
      // If using CLI with different port: "http://127.0.0.1:8545"
      accounts: {
        // Leave empty to use default accounts from Ganache
        mnemonic: "tank cousin skin across legend crack smoke wing habit gloom balcony bright"
      }
    }
  }
}; 