import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const MockERC20Module = buildModule("MockERC20Module", (m) => {
  const name = m.getParameter("name", "Mock PYUSD");
  const symbol = m.getParameter("symbol", "PYUSD");
  const decimals = m.getParameter("decimals", 6);

  const mockToken = m.contract("MockERC20", [name, symbol, decimals]);

  return { mockToken };
});

export default MockERC20Module;
