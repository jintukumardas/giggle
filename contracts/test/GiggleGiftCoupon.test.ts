import { expect } from "chai";
import { network } from "hardhat";
import * as helpers from "@nomicfoundation/hardhat-network-helpers";

const { ethers } = await network.connect();

describe("GiggleGiftCoupon", function () {
  let giftCoupon: any;
  let mockToken: any;
  let owner: any;
  let creator: any;
  let redeemer: any;
  let other: any;

  const INITIAL_BALANCE = ethers.parseUnits("1000", 6); // 1000 tokens

  beforeEach(async function () {
    [owner, creator, redeemer, other] = await ethers.getSigners();

    // Deploy mock ERC20 token
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockToken = await MockERC20.deploy("Mock PYUSD", "PYUSD", 6);
    await mockToken.waitForDeployment();

    // Mint tokens to creator
    await mockToken.mint(creator.address, INITIAL_BALANCE);

    // Deploy GiggleGiftCoupon contract
    const GiggleGiftCoupon = await ethers.getContractFactory("GiggleGiftCoupon");
    giftCoupon = await GiggleGiftCoupon.deploy();
    await giftCoupon.waitForDeployment();

    // Add mock token as supported
    await giftCoupon.connect(owner).addSupportedToken(await mockToken.getAddress());
  });

  describe("Deployment", function () {
    it("Should set the owner correctly", async function () {
      expect(await giftCoupon.owner()).to.equal(owner.address);
    });

    it("Should start with nextCouponId = 1", async function () {
      expect(await giftCoupon.nextCouponId()).to.equal(1);
    });

    it("Should have mock token as supported", async function () {
      expect(await giftCoupon.supportedTokens(await mockToken.getAddress())).to.be.true;
    });
  });

  describe("Token Management", function () {
    it("Should allow owner to add supported tokens", async function () {
      const newTokenAddress = ethers.Wallet.createRandom().address;
      await expect(giftCoupon.connect(owner).addSupportedToken(newTokenAddress))
        .to.emit(giftCoupon, "TokenAdded")
        .withArgs(newTokenAddress);

      expect(await giftCoupon.supportedTokens(newTokenAddress)).to.be.true;
    });

    it("Should not allow non-owner to add tokens", async function () {
      const newTokenAddress = ethers.Wallet.createRandom().address;
      await expect(
        giftCoupon.connect(creator).addSupportedToken(newTokenAddress)
      ).to.be.revertedWithCustomError(giftCoupon, "OwnableUnauthorizedAccount");
    });

    it("Should allow owner to remove supported tokens", async function () {
      const tokenAddress = await mockToken.getAddress();
      await expect(giftCoupon.connect(owner).removeSupportedToken(tokenAddress))
        .to.emit(giftCoupon, "TokenRemoved")
        .withArgs(tokenAddress);

      expect(await giftCoupon.supportedTokens(tokenAddress)).to.be.false;
    });
  });

  describe("Create Coupon", function () {
    const code = "GIFT1234";
    const amount = ethers.parseUnits("50", 6);
    const metadataURI = "ipfs://QmTest123";
    const expiresAt = 0; // No expiration

    it("Should create a coupon successfully", async function () {
      // Approve tokens
      await mockToken.connect(creator).approve(await giftCoupon.getAddress(), amount);

      // Create coupon
      await expect(
        giftCoupon.connect(creator).createCoupon(
          code,
          await mockToken.getAddress(),
          amount,
          metadataURI,
          expiresAt
        )
      )
        .to.emit(giftCoupon, "CouponCreated")
        .withArgs(1, creator.address, await mockToken.getAddress(), amount, metadataURI, expiresAt);

      // Check coupon
      const [exists, isValid, token, amt, uri] = await giftCoupon.checkCoupon(code);
      expect(exists).to.be.true;
      expect(isValid).to.be.true;
      expect(amt).to.equal(amount);
      expect(uri).to.equal(metadataURI);
    });

    it("Should transfer tokens to contract", async function () {
      await mockToken.connect(creator).approve(await giftCoupon.getAddress(), amount);

      const initialBalance = await mockToken.balanceOf(creator.address);
      await giftCoupon.connect(creator).createCoupon(
        code,
        await mockToken.getAddress(),
        amount,
        metadataURI,
        expiresAt
      );

      expect(await mockToken.balanceOf(creator.address)).to.equal(initialBalance - amount);
      expect(await mockToken.balanceOf(await giftCoupon.getAddress())).to.equal(amount);
    });

    it("Should reject code shorter than 6 characters", async function () {
      await mockToken.connect(creator).approve(await giftCoupon.getAddress(), amount);

      await expect(
        giftCoupon.connect(creator).createCoupon(
          "SHORT",
          await mockToken.getAddress(),
          amount,
          metadataURI,
          expiresAt
        )
      ).to.be.revertedWith("Code too short");
    });

    it("Should reject unsupported token", async function () {
      const unsupportedToken = ethers.Wallet.createRandom().address;

      await expect(
        giftCoupon.connect(creator).createCoupon(
          code,
          unsupportedToken,
          amount,
          metadataURI,
          expiresAt
        )
      ).to.be.revertedWith("Token not supported");
    });

    it("Should reject duplicate codes", async function () {
      await mockToken.connect(creator).approve(await giftCoupon.getAddress(), amount * 2n);

      await giftCoupon.connect(creator).createCoupon(
        code,
        await mockToken.getAddress(),
        amount,
        metadataURI,
        expiresAt
      );

      await expect(
        giftCoupon.connect(creator).createCoupon(
          code,
          await mockToken.getAddress(),
          amount,
          metadataURI,
          expiresAt
        )
      ).to.be.revertedWith("Code already used");
    });

    it("Should create coupon with expiration", async function () {
      const futureTimestamp = Math.floor(Date.now() / 1000) + 86400; // 1 day from now

      await mockToken.connect(creator).approve(await giftCoupon.getAddress(), amount);

      await expect(
        giftCoupon.connect(creator).createCoupon(
          code,
          await mockToken.getAddress(),
          amount,
          metadataURI,
          futureTimestamp
        )
      )
        .to.emit(giftCoupon, "CouponCreated")
        .withArgs(1, creator.address, await mockToken.getAddress(), amount, metadataURI, futureTimestamp);
    });
  });

  describe("Redeem Coupon", function () {
    const code = "GIFT1234";
    const amount = ethers.parseUnits("50", 6);
    const metadataURI = "ipfs://QmTest123";

    beforeEach(async function () {
      // Create a coupon for each test
      await mockToken.connect(creator).approve(await giftCoupon.getAddress(), amount);
      await giftCoupon.connect(creator).createCoupon(
        code,
        await mockToken.getAddress(),
        amount,
        metadataURI,
        0
      );
    });

    it("Should redeem coupon successfully", async function () {
      const initialBalance = await mockToken.balanceOf(redeemer.address);

      await expect(giftCoupon.connect(redeemer).redeemCoupon(code))
        .to.emit(giftCoupon, "CouponRedeemed");

      expect(await mockToken.balanceOf(redeemer.address)).to.equal(initialBalance + amount);
    });

    it("Should mark coupon as redeemed", async function () {
      await giftCoupon.connect(redeemer).redeemCoupon(code);

      const [exists, isValid] = await giftCoupon.checkCoupon(code);
      expect(exists).to.be.true;
      expect(isValid).to.be.false; // No longer valid after redemption
    });

    it("Should reject redemption of invalid code", async function () {
      await expect(
        giftCoupon.connect(redeemer).redeemCoupon("INVALID")
      ).to.be.revertedWith("Invalid code");
    });

    it("Should reject double redemption", async function () {
      await giftCoupon.connect(redeemer).redeemCoupon(code);

      await expect(
        giftCoupon.connect(other).redeemCoupon(code)
      ).to.be.revertedWith("Already redeemed");
    });

    it("Should reject creator redeeming own coupon", async function () {
      await expect(
        giftCoupon.connect(creator).redeemCoupon(code)
      ).to.be.revertedWith("Cannot redeem own coupon");
    });

    it("Should reject expired coupon", async function () {
      // Create coupon that expires in 10 seconds
      const expiredCode = "EXPIRED1";
      const currentBlock = await ethers.provider.getBlock("latest");
      const currentTime = currentBlock?.timestamp || 0;
      const expirationTime = currentTime + 10; // 10 seconds from now

      await mockToken.connect(creator).approve(await giftCoupon.getAddress(), amount);
      await giftCoupon.connect(creator).createCoupon(
        expiredCode,
        await mockToken.getAddress(),
        amount,
        metadataURI,
        expirationTime
      );

      // Fast forward time by 11 seconds to make it expired
      await ethers.provider.send("evm_increaseTime", [11]);
      await ethers.provider.send("evm_mine", []);

      await expect(
        giftCoupon.connect(redeemer).redeemCoupon(expiredCode)
      ).to.be.revertedWith("Coupon expired");
    });
  });

  describe("Cancel Coupon", function () {
    const code = "GIFT1234";
    const amount = ethers.parseUnits("50", 6);
    const metadataURI = "ipfs://QmTest123";

    beforeEach(async function () {
      await mockToken.connect(creator).approve(await giftCoupon.getAddress(), amount);
      await giftCoupon.connect(creator).createCoupon(
        code,
        await mockToken.getAddress(),
        amount,
        metadataURI,
        0
      );
    });

    it("Should allow creator to cancel unredeemed coupon", async function () {
      const initialBalance = await mockToken.balanceOf(creator.address);

      await expect(giftCoupon.connect(creator).cancelCoupon(1))
        .to.emit(giftCoupon, "CouponCancelled")
        .withArgs(1, creator.address);

      // Creator should receive refund
      expect(await mockToken.balanceOf(creator.address)).to.equal(initialBalance + amount);
    });

    it("Should reject cancellation by non-creator", async function () {
      await expect(
        giftCoupon.connect(redeemer).cancelCoupon(1)
      ).to.be.revertedWith("Not coupon creator");
    });

    it("Should reject cancellation of redeemed coupon", async function () {
      await giftCoupon.connect(redeemer).redeemCoupon(code);

      await expect(
        giftCoupon.connect(creator).cancelCoupon(1)
      ).to.be.revertedWith("Already redeemed");
    });
  });

  describe("Check Coupon", function () {
    it("Should return false for non-existent code", async function () {
      const [exists] = await giftCoupon.checkCoupon("NONEXISTENT");
      expect(exists).to.be.false;
    });

    it("Should return correct coupon details", async function () {
      const code = "GIFT1234";
      const amount = ethers.parseUnits("50", 6);
      const metadataURI = "ipfs://QmTest123";

      await mockToken.connect(creator).approve(await giftCoupon.getAddress(), amount);
      await giftCoupon.connect(creator).createCoupon(
        code,
        await mockToken.getAddress(),
        amount,
        metadataURI,
        0
      );

      const [exists, isValid, token, amt, uri, expiresAt, creatorAddr] = await giftCoupon.checkCoupon(code);

      expect(exists).to.be.true;
      expect(isValid).to.be.true;
      expect(token).to.equal(await mockToken.getAddress());
      expect(amt).to.equal(amount);
      expect(uri).to.equal(metadataURI);
      expect(expiresAt).to.equal(0);
      expect(creatorAddr).to.equal(creator.address);
    });
  });
});
