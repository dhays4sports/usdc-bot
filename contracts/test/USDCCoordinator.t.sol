// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/USDCCoordinator.sol";

contract MockUSDC {
  mapping(address => uint256) public balanceOf;
  mapping(address => mapping(address => uint256)) public allowance;

  function mint(address to, uint256 amt) external { balanceOf[to] += amt; }

  function approve(address spender, uint256 amt) external returns (bool) {
    allowance[msg.sender][spender] = amt;
    return true;
  }

  function transfer(address to, uint256 amt) external returns (bool) {
    require(balanceOf[msg.sender] >= amt, "bal");
    balanceOf[msg.sender] -= amt;
    balanceOf[to] += amt;
    return true;
  }

  function transferFrom(address from, address to, uint256 amt) external returns (bool) {
    uint256 a = allowance[from][msg.sender];
    require(a >= amt, "allow");
    require(balanceOf[from] >= amt, "bal");
    allowance[from][msg.sender] = a - amt;
    balanceOf[from] -= amt;
    balanceOf[to] += amt;
    return true;
  }
}

contract USDCCoordinatorTest is Test {
  MockUSDC usdc;
  USDCCoordinator coord;

  address depositor = address(0xA);
  address beneficiary = address(0xB);
  address feeRecipient = address(0xC);

  function setUp() public {
    usdc = new MockUSDC();
    coord = new USDCCoordinator(address(usdc), feeRecipient, 0); // fee off for test
    usdc.mint(depositor, 10_000_000); // 10 USDC (6 decimals)
  }

  function testCreateFundRelease() public {
    vm.startPrank(depositor);

    uint256 id = coord.createEscrow(beneficiary, 1_000_000, block.timestamp + 7 days, bytes32(0));
    usdc.approve(address(coord), type(uint256).max);

    coord.fundEscrow(id);
    coord.releaseEscrow(id);

    vm.stopPrank();

    assertEq(usdc.balanceOf(beneficiary), 1_000_000);
  }
}
