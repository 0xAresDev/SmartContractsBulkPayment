import { ethers } from "hardhat";
import {
  Mixtral8x7BModelMarket,
  USDC,
  ProofOfStakeForumAI,
} from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

const main = async () => {
  let mixtral8x7BModelMarket: Mixtral8x7BModelMarket;
  let owner: HardhatEthersSigner;
  let usdc: USDC;
  let proofOfStakeForumAI: ProofOfStakeForumAI;
  [owner] = await ethers.getSigners();
  const USDCFactory = await ethers.getContractFactory("USDC");
  usdc = (await USDCFactory.deploy()) as USDC;
  console.log("Deployed USDC", await usdc.getAddress());
  await usdc.mint(5e10);

  const ProofOfStakeForumAIFactory = await ethers.getContractFactory(
    "ProofOfStakeForumAI"
  );
  proofOfStakeForumAI = (await ProofOfStakeForumAIFactory.deploy(
    await usdc.getAddress(),
    owner.address
  )) as ProofOfStakeForumAI;
  console.log(
    "Deployed ProofOfStakeForumAI",
    await proofOfStakeForumAI.getAddress()
  );

  console.log(
    "Deployed Mixtral8x7BModelMarket",
    await proofOfStakeForumAI.modelMarket()
  );

  const Mixtral8x7BModelMarketFactory = await ethers.getContractFactory(
    "Mixtral8x7BModelMarket"
  );
  mixtral8x7BModelMarket = Mixtral8x7BModelMarketFactory.attach(
    await proofOfStakeForumAI.modelMarket()
  ) as Mixtral8x7BModelMarket;

  // const Mixtral8x7BModelMarketFactory = await ethers.getContractFactory(
  //   "Mixtral8x7BModelMarket"
  // );
  // mixtral8x7BModelMarket = (await Mixtral8x7BModelMarketFactory.deploy(
  //   owner.address,
  //   await usdc.getAddress()
  // )) as Mixtral8x7BModelMarket;
  // console.log(
  //   "Deployed Mixtral8x7BModelMarket",
  //   await mixtral8x7BModelMarket.getAddress()
  // );

  await usdc.approve(await mixtral8x7BModelMarket.getAddress(), 5e10);
  await mixtral8x7BModelMarket.deposit(1e10);
};

main();
