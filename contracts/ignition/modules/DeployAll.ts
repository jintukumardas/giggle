import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * Complete deployment module that deploys GiggleGiftCoupon
 * and optionally a MockERC20 token for testing
 */
const DeployAllModule = buildModule("DeployAllModule", (m) => {
  // Get parameters with defaults
  const deployMockToken = m.getParameter("deployMockToken", false);
  const pyusdAddress = m.getParameter("pyusdAddress", "");

  // Deploy GiggleGiftCoupon contract
  const giftCoupon = m.contract("GiggleGiftCoupon");

  let tokenAddress;

  // Conditionally deploy MockERC20 if in testing mode
  if (deployMockToken) {
    const mockToken = m.contract("MockERC20", ["Mock PYUSD", "PYUSD", 6]);
    tokenAddress = mockToken;

    // Add the mock token as supported
    m.call(giftCoupon, "addSupportedToken", [mockToken]);
  } else if (pyusdAddress) {
    // Add real PYUSD token as supported
    m.call(giftCoupon, "addSupportedToken", [pyusdAddress]);
  }

  return { giftCoupon, tokenAddress };
});

export default DeployAllModule;
