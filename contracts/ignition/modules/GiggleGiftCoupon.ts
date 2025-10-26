import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const GiggleGiftCouponModule = buildModule("GiggleGiftCouponModule", (m) => {
  const giftCoupon = m.contract("GiggleGiftCoupon");

  return { giftCoupon };
});

export default GiggleGiftCouponModule;
