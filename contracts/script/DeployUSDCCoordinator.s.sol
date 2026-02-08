// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/USDCCoordinator.sol";

contract DeployUSDCCoordinator is Script {
  function run() external returns (USDCCoordinator coord) {
    // Base Sepolia USDC (Circle)
    address usdc = vm.envAddress("USDC_ADDRESS");

    // Fee setup (start at 0 bps while testing)
    address feeRecipient = vm.envAddress("FEE_RECIPIENT");
    uint16 feeBps = uint16(vm.envUint("FEE_BPS"));

    vm.startBroadcast();

    coord = new USDCCoordinator(usdc, feeRecipient, feeBps);

    vm.stopBroadcast();
  }
}
