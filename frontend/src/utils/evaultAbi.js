export const EVAULT_ABI = [
  {
    inputs: [
      { internalType: "address", name: "_registrar", type: "address" },
      { internalType: "address", name: "_notary", type: "address" },
      { internalType: "address", name: "_localAuthority", type: "address" },
      { internalType: "address", name: "_bank", type: "address" },
    ],
    stateMutability: "nonpayable",
    type: "constructor",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "uint256", name: "propertyId", type: "uint256" },
      { indexed: true, internalType: "address", name: "approver", type: "address" },
      { indexed: false, internalType: "uint256", name: "approvalCount", type: "uint256" },
    ],
    name: "PropertyApproved",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "uint256", name: "propertyId", type: "uint256" },
      { indexed: true, internalType: "address", name: "bank", type: "address" },
    ],
    name: "BankVerified",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "uint256", name: "propertyId", type: "uint256" },
      { indexed: true, internalType: "address", name: "owner", type: "address" },
    ],
    name: "PropertyRegistered",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "uint256", name: "propertyId", type: "uint256" },
      { indexed: true, internalType: "address", name: "owner", type: "address" },
      { indexed: false, internalType: "string", name: "ipfsHash", type: "string" },
    ],
    name: "PropertyRequested",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "uint256", name: "propertyId", type: "uint256" },
      { indexed: true, internalType: "address", name: "previousOwner", type: "address" },
      { indexed: true, internalType: "address", name: "newOwner", type: "address" },
    ],
    name: "PropertyTransferred",
    type: "event",
  },
  {
    inputs: [],
    name: "propertyCounter",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    name: "properties",
    outputs: [
      { internalType: "uint256", name: "id", type: "uint256" },
      { internalType: "address", name: "owner", type: "address" },
      { internalType: "string", name: "ipfsHash", type: "string" },
      { internalType: "bool", name: "registrarApproved", type: "bool" },
      { internalType: "bool", name: "notaryApproved", type: "bool" },
      { internalType: "bool", name: "authorityApproved", type: "bool" },
      { internalType: "uint256", name: "approvalCount", type: "uint256" },
      { internalType: "uint8", name: "status", type: "uint8" },
      { internalType: "bool", name: "bankVerified", type: "bool" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "string", name: "ipfsHash", type: "string" }],
    name: "requestRegistration",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "propertyId", type: "uint256" }],
    name: "approveProperty",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "propertyId", type: "uint256" },
      { internalType: "address", name: "newOwner", type: "address" },
    ],
    name: "transferProperty",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "propertyId", type: "uint256" }],
    name: "verifyByBank",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "propertyId", type: "uint256" }],
    name: "getOwnershipHistory",
    outputs: [
      {
        components: [
          { internalType: "address", name: "owner", type: "address" },
          { internalType: "uint256", name: "timestamp", type: "uint256" },
        ],
        internalType: "struct eVault.OwnershipRecord[]",
        name: "",
        type: "tuple[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
];
