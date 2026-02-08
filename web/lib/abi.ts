export const coordinatorAbi = [
  {
    type: "function",
    name: "createEscrow",
    stateMutability: "nonpayable",
    inputs: [
      { name: "beneficiary", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "deadline", type: "uint256" },
      { name: "memoHash", type: "bytes32" },
    ],
    outputs: [{ name: "id", type: "uint256" }],
  },
  {
    type: "function",
    name: "getEscrow",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "depositor", type: "address" },
          { name: "beneficiary", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "deadline", type: "uint256" },
          { name: "memoHash", type: "bytes32" },
          { name: "status", type: "uint8" },
        ],
      },
    ],
  },
  { type: "function", name: "fundEscrow", stateMutability: "nonpayable", inputs: [{ name: "id", type: "uint256" }], outputs: [] },
  { type: "function", name: "releaseEscrow", stateMutability: "nonpayable", inputs: [{ name: "id", type: "uint256" }], outputs: [] },
  { type: "function", name: "refundEscrow", stateMutability: "nonpayable", inputs: [{ name: "id", type: "uint256" }], outputs: [] },

  // Event for extracting escrow id from tx receipt
  {
    type: "event",
    name: "EscrowCreated",
    inputs: [
      { indexed: true, name: "id", type: "uint256" },
      { indexed: true, name: "depositor", type: "address" },
      { indexed: true, name: "beneficiary", type: "address" },
      { indexed: false, name: "amount", type: "uint256" },
      { indexed: false, name: "deadline", type: "uint256" },
      { indexed: false, name: "memoHash", type: "bytes32" },
    ],
  },
] as const;

export const erc20Abi = [
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "owner", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
] as const;
