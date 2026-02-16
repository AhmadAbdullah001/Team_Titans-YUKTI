// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract DocumentVault {
    struct Property {
        address owner;
        string hash;
        bool verified;
    }

    struct TransferRecord {
        address from;
        address to;
        uint256 timestamp;
    }

    address public admin;
    mapping(string => Property) public properties;
    mapping(address => bool) public registrars;
    mapping(string => TransferRecord[]) public propertyHistory;
    string[] public allPropertyHashes;

    // Legacy storage to avoid breaking existing integrations.
    mapping(string => address) public documentOwner;

    event HashStored(string indexed hash, address indexed owner);
    event PropertyRegistered(address owner, string hash);
    event PropertyApproved(string indexed hash, address indexed registrar);
    event PropertyApproved(address registrar, string hash);
    event RegistrarAdded(address indexed registrar);
    event RegistrarRemoved(address indexed registrar);
    event PropertyTransferred(address from, address to, string hash);

    modifier onlyRegistrar() {
        require(registrars[msg.sender], "Only registrar");
        _;
    }

    constructor() {
        admin = msg.sender;
        registrars[msg.sender] = true;
    }

    function addRegistrar(address registrar) public {
        require(msg.sender == admin, "Only admin");
        require(registrar != address(0), "Invalid registrar");
        registrars[registrar] = true;
        emit RegistrarAdded(registrar);
    }

    function removeRegistrar(address registrar) public {
        require(msg.sender == admin, "Only admin");
        require(registrar != address(0), "Invalid registrar");
        require(registrar != admin, "Cannot remove admin");
        registrars[registrar] = false;
        emit RegistrarRemoved(registrar);
    }

    function registerProperty(string memory hash) public {
        require(bytes(hash).length > 0, "Hash cannot be empty");
        require(properties[hash].owner == address(0), "Property already exists");
        require(!registrars[msg.sender], "Registrar cannot register property");

        properties[hash] = Property({
            owner: msg.sender,
            hash: hash,
            verified: false
        });

        documentOwner[hash] = msg.sender;
        allPropertyHashes.push(hash);
        propertyHistory[hash].push(
            TransferRecord({from: address(0), to: msg.sender, timestamp: block.timestamp})
        );

        emit HashStored(hash, msg.sender);
        emit PropertyRegistered(msg.sender, hash);
    }

    function approveProperty(string memory hash) public onlyRegistrar {
        require(properties[hash].owner != address(0), "Property not found");
        properties[hash].verified = true;
        emit PropertyApproved(hash, msg.sender);
        emit PropertyApproved(msg.sender, hash);
    }

    function verifyProperty(string memory hash) public view returns (bool) {
        return properties[hash].verified;
    }

    function getOwner(string memory hash) public view returns (address) {
        return properties[hash].owner;
    }

    function transferProperty(string memory hash, address newOwner) public {
        require(properties[hash].owner != address(0), "Property not found");
        require(properties[hash].owner == msg.sender, "Only current owner");
        require(newOwner != address(0), "Invalid new owner");
        require(newOwner != msg.sender, "Already owner");

        address previousOwner = properties[hash].owner;
        properties[hash].owner = newOwner;
        properties[hash].verified = false;
        documentOwner[hash] = newOwner;

        propertyHistory[hash].push(
            TransferRecord({from: previousOwner, to: newOwner, timestamp: block.timestamp})
        );

        emit PropertyTransferred(previousOwner, newOwner, hash);
    }

    function getPropertyHistory(string memory hash) public view returns (TransferRecord[] memory) {
        return propertyHistory[hash];
    }

    function getAllProperties() public view returns (string[] memory) {
        return allPropertyHashes;
    }

    // Legacy write method retained for compatibility with existing integrations.
    function storeHash(string memory _hash) public {
        registerProperty(_hash);
    }

    // Legacy read method retained for compatibility with existing integrations.
    function verifyHash(string memory _hash) public view returns (bool) {
        return properties[_hash].owner != address(0);
    }
}
