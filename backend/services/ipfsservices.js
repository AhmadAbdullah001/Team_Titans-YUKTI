const axios = require("axios");
const FormData = require("form-data");
const { Readable } = require("stream");

async function uploadToIPFS(buffer, filename) {
  const data = new FormData();
  
  // Convert buffer to stream and append with filename
  const stream = Readable.from(buffer);
  data.append("file", stream, { filename: filename || "file" });

  const response = await axios.post(
    "https://api.pinata.cloud/pinning/pinFileToIPFS",
    data,
    {
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      headers: {
        ...data.getHeaders(),
        pinata_api_key: process.env.PINATA_API_KEY,
        pinata_secret_api_key: process.env.PINATA_API_SECRET,
      },
    }
  );

  return response.data.IpfsHash;
}

module.exports = { uploadToIPFS };