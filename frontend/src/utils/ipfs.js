import { PINATA_JWT } from "./config.js";

export async function uploadDocumentToIPFS(file) {
  if (!file) {
    throw new Error("File is required.");
  }
  if (!PINATA_JWT) {
    throw new Error("Set REACT_APP_PINATA_JWT in frontend/.env");
  }

  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PINATA_JWT}`,
    },
    body: formData,
  });

  const data = await response.json();
  if (!response.ok || !data?.IpfsHash) {
    throw new Error(data?.error || "IPFS upload failed.");
  }

  return data.IpfsHash;
}
