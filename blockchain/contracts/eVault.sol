// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract eVault {
    enum Status {
        Pending,
        Rejected,
        Registered,
        PartiallyApproved
    }

    struct Property {
        uint256 id;
        address owner;
        string ipfsHash;
        bool registrarApproved;
        bool notaryApproved;
        bool authorityApproved;
        uint256 approvalCount;
        Status status;
        bool bankVerified;
    }

    struct OwnershipRecord {
        address owner;
        uint256 timestamp;
    }

    address public admin;
    address public registrar;
    address public notary;
    address public localAuthority;

    mapping(uint256 => Property) public properties;
    mapping(string => uint256) public hashToPropertyId;
    mapping(uint256 => OwnershipRecord[]) public ownershipHistory;

    uint256 public propertyCounter;

    event PropertyRequested(uint256 indexed propertyId, address indexed owner, string ipfsHash);
    event PropertyApproved(uint256 indexed propertyId, address indexed approver, uint256 approvalCount);
    event PropertyRegistered(uint256 indexed propertyId, address indexed owner);
    event PropertyTransferred(uint256 indexed propertyId, address indexed previousOwner, address indexed newOwner);
    event BankVerified(uint256 indexed propertyId, address indexed bank);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }

    modifier onlyRegistrar() {
        require(msg.sender == registrar, "Only registrar");
        _;
    }

    modifier onlyNotary() {
        require(msg.sender == notary, "Only notary");
        _;
    }

    modifier onlyAuthority() {
        require(msg.sender == localAuthority, "Only local authority");
        _;
    }

    constructor(
        address _registrar,
        address _notary,
        address _authority
    ) {
        require(_registrar != address(0), "Invalid registrar");
        require(_notary != address(0), "Invalid notary");
        require(_authority != address(0), "Invalid authority");

        admin = msg.sender;
        registrar = _registrar;
        notary = _notary;
        localAuthority = _authority;
    }

    function requestRegistration(string memory ipfsHash) external {
        require(bytes(ipfsHash).length > 0, "IPFS hash required");

        propertyCounter += 1;

        properties[propertyCounter] = Property({
            id: propertyCounter,
            owner: msg.sender,
            ipfsHash: ipfsHash,
            registrarApproved: false,
            notaryApproved: false,
            authorityApproved: false,
            approvalCount: 0,
            status: Status.Pending,
            bankVerified: false
        });
        hashToPropertyId[ipfsHash] = propertyCounter;

        emit PropertyRequested(propertyCounter, msg.sender, ipfsHash);
    }

    function getProperty(uint256 propertyId) public view returns (Property memory) {
        require(propertyId > 0 && propertyId <= propertyCounter, "Invalid property");
        return properties[propertyId];
    }

    function getPropertyByHash(string memory hash) public view returns (Property memory) {
        uint256 propertyId = hashToPropertyId[hash];
        require(propertyId > 0 && propertyId <= propertyCounter, "Property not found");
        return properties[propertyId];
    }

    function approveProperty(uint256 propertyId) public {
        require(propertyId > 0 && propertyId <= propertyCounter, "Invalid property");

        Property storage property = properties[propertyId];

        if (msg.sender == registrar) {
            require(!property.registrarApproved, "Registrar already approved");
            property.registrarApproved = true;
        } else if (msg.sender == notary) {
            require(!property.notaryApproved, "Notary already approved");
            property.notaryApproved = true;
        } else if (msg.sender == localAuthority) {
            require(!property.authorityApproved, "Authority already approved");
            property.authorityApproved = true;
        } else {
            revert("Unauthorized approver");
        }

        property.approvalCount += 1;

        emit PropertyApproved(propertyId, msg.sender, property.approvalCount);
        updateStatus(propertyId);
    }

    function transferProperty(uint256 propertyId, address newOwner) external {
        require(propertyId > 0 && propertyId <= propertyCounter, "Invalid property");
        require(newOwner != address(0), "Invalid owner");

        Property storage property = properties[propertyId];
        require(msg.sender == property.owner, "Only current owner");

        address previousOwner = property.owner;
        property.owner = newOwner;

        ownershipHistory[propertyId].push(
            OwnershipRecord({owner: newOwner, timestamp: block.timestamp})
        );

        emit PropertyTransferred(propertyId, previousOwner, newOwner);
    }

    function getOwnershipHistory(uint256 propertyId)
        external
        view
        returns (OwnershipRecord[] memory)
    {
        require(propertyId > 0 && propertyId <= propertyCounter, "Invalid property");
        return ownershipHistory[propertyId];
    }

    function updateStatus(uint256 propertyId) internal {
        Property storage property = properties[propertyId];

        if (property.approvalCount <= 1) {
            property.status = Status.Pending;
        } else if (property.approvalCount >= 2) {
            property.status = Status.PartiallyApproved;
        }

        if (property.approvalCount == 3) {
            property.status = Status.Registered;
            ownershipHistory[propertyId].push(
                OwnershipRecord({owner: property.owner, timestamp: block.timestamp})
            );
            emit PropertyRegistered(propertyId, property.owner);
        }
    }
}
