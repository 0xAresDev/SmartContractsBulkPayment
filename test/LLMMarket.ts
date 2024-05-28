import { expect } from "chai";
import { ethers } from "hardhat";
import { Mixtral8x7BModelMarket, USDC } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import * as crypto from "crypto";

function verifyPayment(
  payment: {
    sender: string;
    receiver: string;
    amount: number;
    uuid: string;
  },
  signature: string
): boolean {
  // console.log(payment, signature);
  const messageHash = ethers.solidityPackedKeccak256(
    ["address", "address", "uint256", "string"],
    [payment.sender, payment.receiver, payment.amount, payment.uuid]
  );
  const recoveredAddress = ethers.verifyMessage(
    ethers.getBytes(messageHash),
    signature
  );
  return recoveredAddress === payment.sender;
}

describe("LLMMartket Contract", function () {
  let mixtral8x7BModelMarket: Mixtral8x7BModelMarket;
  let owner: HardhatEthersSigner;
  let addr1: HardhatEthersSigner;
  let addr2: HardhatEthersSigner;
  let usdc: USDC;

  this.beforeAll(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();
    const USDCFactory = await ethers.getContractFactory("USDC");
    usdc = (await USDCFactory.deploy()) as USDC;
    console.log("Deployed USDC", await usdc.getAddress());
    await usdc.mint(5e10);
    await usdc.connect(addr1).mint(5e10);

    const Mixtral8x7BModelMarketFactory = await ethers.getContractFactory(
      "Mixtral8x7BModelMarket"
    );
    mixtral8x7BModelMarket = (await Mixtral8x7BModelMarketFactory.deploy(
      owner.address,
      await usdc.getAddress()
    )) as Mixtral8x7BModelMarket;
    console.log(
      "Deployed Mixtral8x7BModelMarket",
      await mixtral8x7BModelMarket.getAddress()
    );

    await usdc.approve(await mixtral8x7BModelMarket.getAddress(), 5e10);
    await mixtral8x7BModelMarket.deposit(1e10);
  });

  it("Withdraw should work properly", async () => {
    const balance0 = await mixtral8x7BModelMarket.balances(owner.address);
    expect(balance0).eq(1e10);
    await expect(mixtral8x7BModelMarket.withdraw()).to.be.revertedWith(
      "Withdraw is not available now"
    );
    await mixtral8x7BModelMarket.setWithdrawHoldTime(2);
    await mixtral8x7BModelMarket.requestWithdraw();
    await expect(mixtral8x7BModelMarket.withdraw()).to.be.revertedWith(
      "Withdraw is not available now"
    );
    await new Promise((r) => setTimeout(r, 2000));
    await mixtral8x7BModelMarket.withdraw();
    const balance1 = await mixtral8x7BModelMarket.balances(owner.address);
    expect(balance1).eq(0);
    const tokenBalance = await usdc.balanceOf(owner.address);
    expect(tokenBalance).eq(5e10);
  });

  it("Claim fund should works properly", async () => {
    const payment = {
      sender: addr1.address,
      receiver: addr2.address,
      amount: 1e10,
      uuid: "12345",
    };

    const messageHash = ethers.solidityPackedKeccak256(
      ["address", "address", "uint256", "string"],
      [payment.sender, payment.receiver, payment.amount, payment.uuid]
    );
    const signature = await addr1.signMessage(ethers.getBytes(messageHash));

    await usdc
      .connect(addr1)
      .approve(await mixtral8x7BModelMarket.getAddress(), 5e10);
    await mixtral8x7BModelMarket.connect(addr1).deposit(1e10);

    await mixtral8x7BModelMarket
      .connect(addr2)
      .claimFunds([payment], [5e9], [signature]);
    const balance1 = await mixtral8x7BModelMarket.balances(addr1.address);
    expect(balance1).eq(5e9);
    const tokenBalance = await usdc.balanceOf(addr2.address);
    expect(tokenBalance).eq(5e9);

    await mixtral8x7BModelMarket
      .connect(addr2)
      .claimFunds([payment], [5e9], [signature]);
    expect(await mixtral8x7BModelMarket.balances(addr1.address)).eq(5e9);
    expect(await usdc.balanceOf(addr2.address)).eq(5e9);
  });

  it("Add host and get host should success", async () => {
    await mixtral8x7BModelMarket.addHost(
      "http://127.0.0.1:8000",
      addr2.address,
      1
    );
    const hostInfo = await mixtral8x7BModelMarket.getHost(addr2.address);
    expect(hostInfo.url).eq("http://127.0.0.1:8000");

    await mixtral8x7BModelMarket.addHost(
      "http://127.0.0.1:8001",
      addr1.address,
      1
    );

    const hosts = await mixtral8x7BModelMarket.getHosts();
    expect(hosts.length).eq(2);

    const activeHosts = await mixtral8x7BModelMarket.getActiveHosts();
    expect(activeHosts.length).eq(2);

    await mixtral8x7BModelMarket.connect(addr1).pause();
    const activeHosts2 = await mixtral8x7BModelMarket.getActiveHosts();
    expect(activeHosts2.length).eq(1);
    expect(activeHosts2[0].url).eq("http://127.0.0.1:8000");

    await mixtral8x7BModelMarket.removeHost(addr1.address);
    const hostsw = await mixtral8x7BModelMarket.getHosts();
    expect(hostsw.length).eq(1);
    expect(hostsw[0].url).eq("http://127.0.0.1:8000");
  });

  it("should verify the signature correctly", async function () {
    const payment = {
      sender: addr1.address,
      receiver: addr2.address,
      amount: 1e9,
      uuid: crypto.randomUUID(),
    };

    const messageHash = ethers.solidityPackedKeccak256(
      ["address", "address", "uint256", "string"],
      [payment.sender, payment.receiver, payment.amount, payment.uuid]
    );

    const signature = await addr1.signMessage(ethers.getBytes(messageHash));
    console.log(payment, signature);

    const isValid = await mixtral8x7BModelMarket.verifyPayment(
      payment,
      signature
    );

    expect(isValid).to.be.true;
  });

  it("should fail for invalid signature", async function () {
    const payment = {
      sender: owner.address,
      receiver: addr1.address,
      amount: 100,
      uuid: "12345",
    };

    const messageHash = ethers.solidityPackedKeccak256(
      ["address", "address", "uint256", "string"],
      [payment.sender, payment.receiver, payment.amount, payment.uuid]
    );
    const signature = await addr1.signMessage(ethers.getBytes(messageHash));

    await expect(
      mixtral8x7BModelMarket.verifyPayment(payment, signature)
    ).to.be.revertedWith("Invalid signature");
  });

  it("Should verify the signed message using Ethers.js", async function () {
    const payment = {
      sender: owner.address,
      receiver: addr1.address,
      amount: 100,
      uuid: "123456",
    };

    const messageHash = ethers.solidityPackedKeccak256(
      ["address", "address", "uint256", "string"],
      [payment.sender, payment.receiver, payment.amount, payment.uuid]
    );
    const signature = await owner.signMessage(ethers.getBytes(messageHash));

    const isVerified = verifyPayment(payment, signature);
    expect(isVerified).to.be.true;
  });

  it("Should not verify the message if signed by another account using Ethers.js", async function () {
    const payment = {
      sender: owner.address,
      receiver: addr1.address,
      amount: 100,
      uuid: "12345",
    };

    const messageHash = ethers.solidityPackedKeccak256(
      ["address", "address", "uint256", "string"],
      [payment.sender, payment.receiver, payment.amount, payment.uuid]
    );
    const signature = await addr1.signMessage(ethers.getBytes(messageHash));

    const isVerified = verifyPayment(payment, signature);
    expect(isVerified).to.be.false;
  });
});
