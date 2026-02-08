// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
  function transfer(address to, uint256 amount) external returns (bool);
  function transferFrom(address from, address to, uint256 amount) external returns (bool);
  function balanceOf(address a) external view returns (uint256);
}

contract USDCCoordinator {
  enum Status { None, Created, Funded, Released, Refunded }

  struct Escrow {
    address depositor;
    address beneficiary;
    uint256 amount;     // USDC amount (6 decimals)
    uint256 deadline;   // unix seconds
    bytes32 memoHash;   // optional hash of off-chain memo
    Status status;
  }

  address public immutable usdc;
  address public feeRecipient;
  uint16  public feeBps; // fee on successful release only

  uint256 public nextEscrowId = 1;
  mapping(uint256 => Escrow) public escrows;

  event EscrowCreated(
    uint256 indexed id,
    address indexed depositor,
    address indexed beneficiary,
    uint256 amount,
    uint256 deadline,
    bytes32 memoHash
  );

  event EscrowFunded(uint256 indexed id);
  event EscrowReleased(uint256 indexed id, uint256 fee, uint256 payout);
  event EscrowRefunded(uint256 indexed id);

  constructor(address _usdc, address _feeRecipient, uint16 _feeBps) {
    require(_usdc != address(0), "USDC=0");
    usdc = _usdc;
    feeRecipient = _feeRecipient;
    _setFeeBps(_feeBps);
  }

  function setFeeRecipient(address _feeRecipient) external {
    feeRecipient = _feeRecipient;
  }

  function setFeeBps(uint16 _feeBps) external {
    _setFeeBps(_feeBps);
  }

  function _setFeeBps(uint16 _feeBps) internal {
    require(_feeBps <= 200, "fee too high"); // cap at 2%
    feeBps = _feeBps;
  }

  function createEscrow(
    address beneficiary,
    uint256 amount,
    uint256 deadline,
    bytes32 memoHash
  ) external returns (uint256 id) {
    require(beneficiary != address(0), "beneficiary=0");
    require(amount > 0, "amount=0");
    require(deadline > block.timestamp, "deadline");

    id = nextEscrowId++;
    escrows[id] = Escrow({
      depositor: msg.sender,
      beneficiary: beneficiary,
      amount: amount,
      deadline: deadline,
      memoHash: memoHash,
      status: Status.Created
    });

    emit EscrowCreated(id, msg.sender, beneficiary, amount, deadline, memoHash);
  }

  function fundEscrow(uint256 id) external {
    Escrow storage e = escrows[id];
    require(e.status == Status.Created, "bad state");
    require(msg.sender == e.depositor, "not depositor");

    e.status = Status.Funded;
    require(IERC20(usdc).transferFrom(msg.sender, address(this), e.amount), "transferFrom failed");

    emit EscrowFunded(id);
  }

  function releaseEscrow(uint256 id) external {
    Escrow storage e = escrows[id];
    require(e.status == Status.Funded, "bad state");
    require(msg.sender == e.depositor, "not depositor");

    e.status = Status.Released;

    uint256 fee = (e.amount * feeBps) / 10_000;
    uint256 payout = e.amount - fee;

    if (fee > 0 && feeRecipient != address(0)) {
      require(IERC20(usdc).transfer(feeRecipient, fee), "fee transfer failed");
    }
    require(IERC20(usdc).transfer(e.beneficiary, payout), "payout transfer failed");

    emit EscrowReleased(id, fee, payout);
  }

  function refundEscrow(uint256 id) external {
    Escrow storage e = escrows[id];
    require(e.status == Status.Funded, "bad state");
    require(msg.sender == e.depositor, "not depositor");
    require(block.timestamp >= e.deadline, "too early");

    e.status = Status.Refunded;
    require(IERC20(usdc).transfer(e.depositor, e.amount), "refund transfer failed");

    emit EscrowRefunded(id);
  }

  function getEscrow(uint256 id) external view returns (Escrow memory) {
    return escrows[id];
  }
}
