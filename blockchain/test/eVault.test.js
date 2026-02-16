const assert = require("assert");
const { ethers } = require("hardhat");

async function expectRevert(promise, expectedMessage) {
  let reverted = false;
  try {
    await promise;
  } catch (error) {
    reverted = true;
    const message = String(error?.message || "");
    assert(
      message.includes(expectedMessage),
      `Expected revert including "${expectedMessage}", got "${message}"`
    );
  }
  assert(reverted, "Expected transaction to revert");
}

describe("eVault", function () {
  async function deployFixture() {
    const [admin, registrar, notary, localAuthority, bank, citizen, buyer, outsider] =
      await ethers.getSigners();

    const EVault = await ethers.getContractFactory("eVault");
    const evault = await EVault.deploy(
      registrar.address,
      notary.address,
      localAuthority.address,
      bank.address
    );
    await evault.deployed();

    return {
      evault,
      admin,
      registrar,
      notary,
      localAuthority,
      bank,
      citizen,
      buyer,
      outsider,
    };
  }

  async function requestOneProperty(evault, citizen, hash = "ipfs://doc-1") {
    await evault.connect(citizen).requestRegistration(hash);
    return 1;
  }

  it("CASE 1: 1 approval sets status to Rejected", async function () {
    const { evault, citizen, registrar } = await deployFixture();
    const propertyId = await requestOneProperty(evault, citizen);

    await evault.connect(registrar).approveProperty(propertyId);

    const property = await evault.properties(propertyId);
    assert.equal(property.approvalCount.toString(), "1");
    assert.equal(property.status.toString(), "1");

    const history = await evault.getOwnershipHistory(propertyId);
    assert.equal(history.length, 0);
  });

  it("CASE 2: 2 approvals sets status to Pending", async function () {
    const { evault, citizen, registrar, notary } = await deployFixture();
    const propertyId = await requestOneProperty(evault, citizen);

    await evault.connect(registrar).approveProperty(propertyId);
    await evault.connect(notary).approveProperty(propertyId);

    const property = await evault.properties(propertyId);
    assert.equal(property.approvalCount.toString(), "2");
    assert.equal(property.status.toString(), "0");

    const history = await evault.getOwnershipHistory(propertyId);
    assert.equal(history.length, 0);
  });

  it("CASE 3: 3 approvals sets status to Registered and writes ownership history", async function () {
    const { evault, citizen, registrar, notary, localAuthority } =
      await deployFixture();
    const propertyId = await requestOneProperty(evault, citizen);

    await evault.connect(registrar).approveProperty(propertyId);
    await evault.connect(notary).approveProperty(propertyId);
    await evault.connect(localAuthority).approveProperty(propertyId);

    const property = await evault.properties(propertyId);
    assert.equal(property.approvalCount.toString(), "3");
    assert.equal(property.status.toString(), "2");

    const history = await evault.getOwnershipHistory(propertyId);
    assert.equal(history.length, 1);
    assert.equal(history[0].owner, citizen.address);
    assert(Number(history[0].timestamp.toString()) > 0);
  });

  it("prevents duplicate approvals from same role and unauthorized approvals", async function () {
    const { evault, citizen, registrar, outsider } = await deployFixture();
    const propertyId = await requestOneProperty(evault, citizen);

    await evault.connect(registrar).approveProperty(propertyId);

    await expectRevert(
      evault.connect(registrar).approveProperty(propertyId),
      "Registrar already approved"
    );

    await expectRevert(
      evault.connect(outsider).approveProperty(propertyId),
      "Unauthorized approver"
    );
  });

  it("Transfer ownership test", async function () {
    const { evault, citizen, buyer, registrar, notary, localAuthority, outsider } =
      await deployFixture();
    const propertyId = await requestOneProperty(evault, citizen);

    await evault.connect(registrar).approveProperty(propertyId);
    await evault.connect(notary).approveProperty(propertyId);
    await evault.connect(localAuthority).approveProperty(propertyId);

    await expectRevert(
      evault.connect(outsider).transferProperty(propertyId, buyer.address),
      "Only current owner"
    );

    await evault.connect(citizen).transferProperty(propertyId, buyer.address);

    const property = await evault.properties(propertyId);
    assert.equal(property.owner, buyer.address);

    const history = await evault.getOwnershipHistory(propertyId);
    assert.equal(history.length, 2);
    assert.equal(history[1].owner, buyer.address);
  });

  it("Bank verification test", async function () {
    const { evault, citizen, bank, outsider } = await deployFixture();
    const propertyId = await requestOneProperty(evault, citizen);

    await expectRevert(
      evault.connect(outsider).verifyByBank(propertyId),
      "Only bank"
    );

    await evault.connect(bank).verifyByBank(propertyId);
    const property = await evault.properties(propertyId);
    assert.equal(property.bankVerified, true);
  });
});
