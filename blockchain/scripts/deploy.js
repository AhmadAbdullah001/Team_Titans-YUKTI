const hre = require("hardhat");

async function main() {
  const [deployer, registrar, notary, localAuthority] =
    await hre.ethers.getSigners();

  const registrarAddress = process.env.REGISTRAR_ADDRESS || registrar.address;
  const notaryAddress = process.env.NOTARY_ADDRESS || notary.address;
  const authorityAddress =
    process.env.AUTHORITY_ADDRESS || localAuthority.address;
  const EVault = await hre.ethers.getContractFactory("eVault");
  const evault = await EVault.deploy(
    registrarAddress,
    notaryAddress,
    authorityAddress
  );

  await evault.deployed();

  console.log("eVault deployed");
  console.log("address:", evault.address);
  console.log("admin:", deployer.address);
  console.log("registrar:", registrarAddress);
  console.log("notary:", notaryAddress);
  console.log("localAuthority:", authorityAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
