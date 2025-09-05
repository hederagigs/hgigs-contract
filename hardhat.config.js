require("@nomicfoundation/hardhat-toolbox");
require("@openzeppelin/hardhat-upgrades");
require("dotenv").config();

module.exports = {
  solidity: "0.8.20",
  networks: {
    hedera_testnet: {
      url: "https://testnet.hashio.io/api",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 296,
      gas: 3000000,
      gasPrice: 410000000000, // 410 gwei
    },
    hedera_mainnet: {
      url: "https://mainnet.hashio.io/api",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 295,
      gas: 3000000,
      gasPrice: 410000000000, // 410 gwei
    }
  },
  etherscan: {
    apiKey: {
      hedera_testnet: "ABC123ABC123ABC123ABC123ABC123ABC1",
      hedera_mainnet: "ABC123ABC123ABC123ABC123ABC123ABC1"
    },
    customChains: [
      {
        network: "hedera_testnet",
        chainId: 296,
        urls: {
          apiURL: "https://server-verify.hashscan.io",
          browserURL: "https://hashscan.io/testnet"
        }
      },
      {
        network: "hedera_mainnet", 
        chainId: 295,
        urls: {
          apiURL: "https://server-verify.hashscan.io",
          browserURL: "https://hashscan.io/mainnet"
        }
      }
    ]
  }
};