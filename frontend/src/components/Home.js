import React, { useRef, useState } from "react";
import {
  CloudArrowUpIcon,
  DocumentIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";
import storeOnBlockchain from "../contract/storeOnBlockchain.js";
import {
  ensureContractCode,
  ensureCorrectNetwork,
  ensureWalletConnected,
  getBrowserProvider,
  getReadOnlyContract,
} from "../contract/eth.js";

function Home() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [hash, setHash] = useState("");
  const [storedHash, setStoredHash] = useState("");
  const [storedOwner, setStoredOwner] = useState("");
  const fileInputRef = useRef(null);

  const resetStatus = () => {
    setUploadStatus("");
    setHash("");
    setStoredHash("");
    setStoredOwner("");
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      resetStatus();
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      resetStatus();
    }
  };

  const verifyFromBlockchain = async (value) => {
    const provider = await getBrowserProvider();
    await ensureWalletConnected(provider);
    await ensureCorrectNetwork(provider);
    await ensureContractCode(provider);
    const contract = getReadOnlyContract(provider);
    return contract.verifyHash(value);
  };

  const retrieveHashFromBlockchain = async () => {
    if (!hash) {
      alert("Upload a file first so a hash is available.");
      return;
    }

    try {
      const provider = await getBrowserProvider();
      await ensureWalletConnected(provider);
      await ensureCorrectNetwork(provider);
      await ensureContractCode(provider);
      const contract = getReadOnlyContract(provider);

      const exists = await contract.verifyHash(hash);
      if (!exists) {
        setStoredHash("");
        setStoredOwner("");
        alert("Hash not found on blockchain");
        return;
      }

      const owner = await contract.documentOwner(hash);
      setStoredHash(hash);
      setStoredOwner(owner);
    } catch (error) {
      alert(error?.message || "Failed to retrieve hash from blockchain");
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    try {
      setUploading(true);
      setUploadStatus("uploading");

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("http://localhost:5000/api/upload/handleupload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("File upload failed");
      }

      const data = await response.json();
      if (!data?.result) {
        throw new Error("Upload response missing hash");
      }

      setUploadStatus("hashing");

      try {
        await storeOnBlockchain(data.result);
      } catch (chainError) {
        alert(chainError?.message || "Uploaded to IPFS, but failed to store hash on blockchain");
      }

      setTimeout(() => {
        setUploadStatus("done");
        setHash(data.result);
        setStoredHash("");
        setStoredOwner("");
        setUploading(false);
      }, 800);
    } catch (error) {
      console.error(error);
      setUploading(false);
      setUploadStatus("");
      alert("Upload failed");
    }
  };

  const handleVerify = async () => {
    if (!hash) {
      alert("Hash not available");
      return;
    }

    try {
      const result = await verifyFromBlockchain(hash);
      alert(result ? "Document Authentic (Blockchain Verified)" : "Not Found on Blockchain");
    } catch (error) {
      alert(error?.message || "Blockchain verification failed");
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const role = typeof window !== 'undefined' ? localStorage.getItem('role') : null;

  const handleApprove = async () => {
    // Placeholder approve action for registrar role.
    // In a production system this should call a backend / blockchain flow.
    if (!storedHash) return alert('No stored hash available to approve');
    alert(`Approved document ${storedHash} (simulated)`);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full transition-all duration-300 hover:shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Document Vault</h1>
          <p className="text-gray-500">Securely store and verify documents</p>
          <p className="text-xs text-gray-400 mt-1">Role: {role || 'guest'}</p>
        </div>

        {/* Bank role: only verification UI */}
        {role === 'bank' ? (
          <div>
            <label className="text-sm text-gray-600">Document Hash</label>
            <div className="flex gap-2 mt-2">
              <input
                value={hash}
                onChange={(e) => setHash(e.target.value)}
                placeholder="Enter hash to verify"
                className="flex-1 px-4 py-2 rounded-lg border border-gray-200"
              />
              <button
                onClick={handleVerify}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
              >
                Verify
              </button>
            </div>
          </div>
        ) : (
          // Citizen and Registrar: upload UI
          <>
            <div
              className={`border-2 border-dashed rounded-xl p-8 mb-6 text-center cursor-pointer transition-colors duration-200 ${
                file ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
              }`}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={triggerFileInput}
            >
              <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileSelect} />

              {!file ? (
                <div className="flex flex-col items-center">
                  <CloudArrowUpIcon className="h-12 w-12 text-gray-400 mb-3" />
                  <p className="text-gray-600 font-medium">Drag & Drop or Click to Upload</p>
                  <p className="text-xs text-gray-400 mt-1">Supported formats: PDF, DOCX, PNG, JPG</p>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <DocumentIcon className="h-12 w-12 text-blue-500 mb-3" />
                  <p className="text-gray-800 font-medium truncate max-w-full">{file.name}</p>
                  <p className="text-xs text-gray-500 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              )}
            </div>

            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              className={`w-full py-3 px-4 rounded-lg text-white font-semibold shadow-md transition-all duration-200 transform hover:-translate-y-0.5 ${
                !file || uploading
                  ? 'bg-gray-400 cursor-not-allowed shadow-none hover:transform-none'
                  : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg'
              }`}
            >
              {uploading ? 'Processing...' : 'Upload to Vault'}
            </button>

            {uploadStatus && (
              <div className="mt-6 border-t border-gray-100 pt-6">
                <div className="space-y-3">
                  <div
                    className={`flex items-center space-x-3 text-sm ${
                      uploadStatus === 'uploading' ? 'text-blue-600 font-medium' : 'text-gray-400'
                    }`}
                  >
                    <div
                      className={`h-2 w-2 rounded-full ${
                        uploadStatus === 'uploading' ? 'bg-blue-600 animate-pulse' : 'bg-gray-300'
                      }`}
                    />
                    <span>Uploading to IPFS...</span>
                  </div>

                  <div
                    className={`flex items-center space-x-3 text-sm ${
                      uploadStatus === 'hashing'
                        ? 'text-purple-600 font-medium'
                        : uploadStatus === 'done'
                        ? 'text-gray-500'
                        : 'text-gray-400'
                    }`}
                  >
                    <div
                      className={`h-2 w-2 rounded-full ${
                        uploadStatus === 'hashing' ? 'bg-purple-600 animate-pulse' : 'bg-gray-300'
                      }`}
                    />
                    <span>Storing Hash on Blockchain...</span>
                  </div>

                  {uploadStatus === 'done' && (
                    <div className="bg-green-50 border border-green-100 rounded-lg p-3 flex items-start space-x-3">
                      <CheckCircleIcon className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <div className="overflow-hidden w-full">
                        <p className="text-green-800 font-medium text-sm">Upload Complete</p>
                        <p className="text-green-600 text-xs mt-1 truncate font-mono bg-green-100 p-1 rounded select-all">
                          {hash}
                        </p>
                        <div className="mt-2 flex gap-2">
                          <button
                            onClick={handleVerify}
                            className="w-full py-1 px-3 rounded-md text-white bg-indigo-600 hover:bg-indigo-700 text-xs"
                          >
                            Verify on Blockchain
                          </button>
                          <button
                            onClick={retrieveHashFromBlockchain}
                            className="w-full py-1 px-3 rounded-md text-white bg-slate-700 hover:bg-slate-800 text-xs"
                          >
                            Retrieve Stored Hash
                          </button>
                        </div>

                        {role === 'registrar' && (
                          <div className="mt-3">
                            <button
                              onClick={handleApprove}
                              className="w-full py-2 rounded-md bg-amber-600 text-white hover:bg-amber-700 text-sm"
                            >
                              Approve Document
                            </button>
                          </div>
                        )}

                        {storedHash && (
                          <div className="mt-2 rounded bg-white p-2 border border-green-100">
                            <p className="text-[11px] text-slate-700 break-all">
                              <strong>Stored Hash:</strong> {storedHash}
                            </p>
                            <p className="text-[11px] text-slate-700 break-all">
                              <strong>Owner:</strong> {storedOwner}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default Home;
