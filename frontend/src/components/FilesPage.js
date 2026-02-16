import React, { useEffect, useState } from 'react';
import {
  ensureContractCode,
  ensureCorrectNetwork,
  ensureWalletConnected,
  getBrowserProvider,
  getReadOnlyContract,
} from '../contract/eth.js';

function FilesPage() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [verifyingHash, setVerifyingHash] = useState('');
  const [verificationResults, setVerificationResults] = useState({});

  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/upload/all');

        if (!response.ok) {
          throw new Error('Failed to fetch files');
        }

        const data = await response.json();
        console.log(data)
        setFiles(data.files || []);
      } catch (err) {
        setError(err.message || 'Something went wrong');
      } finally {
        setLoading(false);
      }
    };

    fetchFiles();
  }, []);

  const verifyFile = async (hash) => {
    try {
      setVerifyingHash(hash);

      const provider = await getBrowserProvider();
      await ensureWalletConnected(provider);
      await ensureCorrectNetwork(provider);
      await ensureContractCode(provider);
      const contract = getReadOnlyContract(provider);
      const isVerified = await contract.verifyHash(hash);

      setVerificationResults((prev) => ({
        ...prev,
        [hash]: isVerified ? 'Verified' : 'Not Verified',
      }));
    } catch (err) {
      setVerificationResults((prev) => ({
        ...prev,
        [hash]: err?.message || 'Verification Failed',
      }));
    } finally {
      setVerifyingHash('');
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-10">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-6 rounded-2xl bg-white p-6 shadow-sm">
          <h1 className="text-3xl font-bold text-slate-800">All Uploaded Files</h1>
          <p className="mt-2 text-sm text-slate-500">Live list of files saved in your vault</p>
        </div>

        {loading && (
          <div className="rounded-2xl bg-white p-8 text-center text-slate-500 shadow-sm">
            Loading files...
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700 shadow-sm">
            {error}
          </div>
        )}

        {!loading && !error && files.length === 0 && (
          <div className="rounded-2xl bg-white p-8 text-center text-slate-500 shadow-sm">
            No files found.
          </div>
        )}

        {!loading && !error && files.length > 0 && (
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                      Action
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                      File Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                      Owner
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                      IPFS Hash
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                      Uploaded At
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {files.map((item) => (
                    <tr key={item._id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 text-sm">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => window.open(`https://gateway.pinata.cloud/ipfs/${item.ipfshash}`, '_blank', 'noopener,noreferrer')}
                            className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700"
                          >
                            Open
                          </button>
                          <button
                            type="button"
                            onClick={() => verifyFile(item.ipfshash)}
                            disabled={verifyingHash === item.ipfshash}
                            className={`rounded-md px-3 py-1.5 text-xs font-semibold text-white transition ${
                              verifyingHash === item.ipfshash
                                ? 'bg-slate-400 cursor-not-allowed'
                                : 'bg-emerald-600 hover:bg-emerald-700'
                            }`}
                          >
                            {verifyingHash === item.ipfshash ? 'Verifying...' : 'Verify'}
                          </button>
                        </div>
                        {verificationResults[item.ipfshash] && (
                          <p
                            className={`mt-2 text-xs ${
                              verificationResults[item.ipfshash] === 'Verified'
                                ? 'text-emerald-700'
                                : 'text-red-600'
                            }`}
                          >
                            {verificationResults[item.ipfshash]}
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-800">{item.filename}</td>
                      <td className="px-6 py-4 text-sm text-slate-700">{item.userID}</td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-600">{item.ipfshash}</td>
                      <td className="px-6 py-4 text-sm text-slate-700">
                        {item.uploadedAt ? new Date(item.uploadedAt).toLocaleString() : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default FilesPage;
