const hre = require("hardhat");

async function main() {
  const [admin, citizen1, citizen2, registrar2] = await hre.ethers.getSigners();
  const contractAddress = process.env.CONTRACT_ADDRESS;

  if (!contractAddress) {
    throw new Error("Set CONTRACT_ADDRESS in env before running demo mode.");
  }

  const vault = await hre.ethers.getContractAt("DocumentVault", contractAddress);

  console.log(`[demo] Using contract: ${contractAddress}`);
  console.log(`[demo] Admin: ${admin.address}`);
  console.log(`[demo] Citizen1: ${citizen1.address}`);
  console.log(`[demo] Citizen2: ${citizen2.address}`);
  console.log(`[demo] Registrar2: ${registrar2.address}`);

  // Seed registrar role
  const isRegistrar2 = await vault.registrars(registrar2.address);
  if (!isRegistrar2) {
    const tx = await vault.connect(admin).addRegistrar(registrar2.address);
    await tx.wait();
    console.log("[demo] Added registrar2");
  }

  const hash1 = "QmDemoPropertyHash001";
  const hash2 = "QmDemoPropertyHash002";

  // Seed property registrations
  const exists1 = await vault.verifyHash(hash1);
  if (!exists1) {
    const tx = await vault.connect(citizen1).registerProperty(hash1);
    await tx.wait();
    console.log("[demo] Registered hash1 by citizen1");
  }

  const exists2 = await vault.verifyHash(hash2);
  if (!exists2) {
    const tx = await vault.connect(citizen1).registerProperty(hash2);
    await tx.wait();
    console.log("[demo] Registered hash2 by citizen1");
  }

  // Simulate registrar approval
  const verified1 = await vault.verifyProperty(hash1);
  if (!verified1) {
    const tx = await vault.connect(registrar2).approveProperty(hash1);
    await tx.wait();
    console.log("[demo] Approved hash1 by registrar2");
  }

  // Simulate transfer and re-approval
  const owner1 = await vault.getOwner(hash1);
  if (owner1.toLowerCase() !== citizen2.address.toLowerCase()) {
    const tx = await vault.connect(citizen1).transferProperty(hash1, citizen2.address);
    await tx.wait();
    console.log("[demo] Transferred hash1 citizen1 -> citizen2");
  }

  const verifiedAfterTransfer = await vault.verifyProperty(hash1);
  if (!verifiedAfterTransfer) {
    const tx = await vault.connect(registrar2).approveProperty(hash1);
    await tx.wait();
    console.log("[demo] Re-approved hash1 by registrar2 after transfer");
  }

  const history = await vault.getPropertyHistory(hash1);
  console.log(`[demo] History length for hash1: ${history.length}`);
}

main().catch((error) => {
  console.error("[demo] Failed:", error);
  process.exitCode = 1;
});
