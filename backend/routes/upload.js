const express=require('express')
const multer=require('multer')
const {uploadToIPFS}=require('../services/ipfsservices')   
const { hasSignerConfig, storeHashOnChain } = require("../services/blockchainService");


const router=express.Router()
const upload=multer();
const File=require('../DBmodels/fileSchema')

router.get("/all", async (req, res) => {
  try {
    const docs = await File.find().sort({ uploadedAt: -1 });
    res.json({ files: docs });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch files', files: [] });
  }
});

router.post('/handleupload',upload.single('file'),async(req,res)=>{
    try{
        const file=req.file;
        const walletAddress = String(req.body?.walletAddress || "").trim().toLowerCase();
        const userId =
            req.body?.userId ||
            req.body?.userEmail ||
            req.body?.userName ||
            "Demo User";
        if(!file){
            return res.status(400).json({message:'No file uploaded'})
        }
        const result=await uploadToIPFS(file.buffer, file.originalname)
        console.log(result)
        const newDoc= new File({
            userID:userId,
            filename:file.originalname,
            ipfshash:result,
            currentOwnerWallet: walletAddress || null
        })
        await newDoc.save()

        let chainResult = null;
        let chainError = null;
        const writeOnChain = String(req.body?.writeOnChain || "").toLowerCase() === "true";

        // Keep upload/IPFS independent; only write on-chain when explicitly requested.
        if (writeOnChain && hasSignerConfig()) {
            try {
                chainResult = await storeHashOnChain(result);
            } catch (error) {
                chainError = error?.message || "Blockchain write failed";
                console.error("[upload] Blockchain write failed:", error);
            }
        } else if (writeOnChain && !hasSignerConfig()) {
            chainError = "Blockchain signer config missing; skipped on-chain write.";
            console.warn("[upload] On-chain write skipped due to missing env config.");
        } else {
            chainError = "Skipped backend on-chain write (frontend wallet flow).";
        }

        res.status(200).json({
            message:'File uploaded successfully',
            result,
            blockchain: chainResult ? { status: "stored", ...chainResult } : { status: "skipped", error: chainError }
        })
    }catch(error){
        console.log(error)
        res.status(500).json({message:'Upload Failed'})
    }
})
module.exports=router
