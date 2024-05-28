import { HardhatUserConfig, task } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-ignition-ethers";
import 'dotenv/config'

const config: HardhatUserConfig = {
  solidity: "0.8.24",
  networks: {
    skale_titan_test: {
      url: "https://testnet.skalenodes.com/v1/aware-fake-trim-testnet",
      accounts: [
        process.env.SKALE_ACCOUNT_PRIVATE_KEY!,
      ],
    },
  },
};

task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account);
  }
});

export default config;
