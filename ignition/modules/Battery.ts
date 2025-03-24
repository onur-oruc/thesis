// This setup uses Hardhat Ignition to manage smart contract deployments.
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

// The BatteryGovernanceModule handles the deployment of all battery-related contracts
const BatteryGovernanceModule = buildModule("BatteryGovernanceModule", (m) => {
  // Get OEM addresses from parameters or use defaults
  const initialOEMs = m.getParameter(
    "initialOEMs", 
    ["0x70997970C51812dc3A010C7d01b50e0d17dc79C8", "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", "0x90F79bf6EB2c4f870365E785982E1f101E93b906"]
  );

  // Deploy governance contract first
  const governance = m.contract("BatteryGovernance", [initialOEMs]);

  // Deploy NFT contracts with reference to governance
  const batteryNFT = m.contract("BatteryNFT", [governance.address, initialOEMs]);
  const permissionNFT = m.contract("PermissionNFT", [governance.address, initialOEMs]);

  // Set permission NFT reference in governance
  m.call(governance, "setPermissionNFT", [permissionNFT.address]);

  return { governance, batteryNFT, permissionNFT };
});

export default BatteryGovernanceModule; 