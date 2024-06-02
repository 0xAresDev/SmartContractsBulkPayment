import { ethers } from "hardhat";
import { Mixtral8x7BModelMarket, USDC } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

const main = async () => {
  let mixtral8x7BModelMarket: Mixtral8x7BModelMarket;
  let owner: HardhatEthersSigner;
  let usdc: USDC;
  [owner] = await ethers.getSigners();
  const USDCFactory = await ethers.getContractFactory("USDC");
  usdc = USDCFactory.attach(
    "0xEDa1F7FE8e1Ec81Db2419C3068044AB8Bf9F322f"
  ) as USDC;
  console.log("USDC", await usdc.getAddress());
  const balance = await usdc.balanceOf(owner.address);
  console.log("Balance token: ", balance);

  const Mixtral8x7BModelMarketFactory = await ethers.getContractFactory(
    "Mixtral8x7BModelMarket"
  );
  mixtral8x7BModelMarket = Mixtral8x7BModelMarketFactory.attach(
    "0xCe7b8b86Ff6044d43035C3142d6484f1aDE9c5DA"
  ) as Mixtral8x7BModelMarket;
  console.log(
    "Mixtral8x7BModelMarket",
    await mixtral8x7BModelMarket.getAddress()
  );

  const balance1 = await mixtral8x7BModelMarket.balances(owner.address);
  console.log("Balance token in llm market: ", balance1);
};

main();
