const mongoose=require('mongoose')
const {Schema}=mongoose;
const fileSchema=new Schema({
    userID:{
        type:String,
        required:true
    },
    filename:{
        type:String,
        required:true
    },
    ipfshash:{
        type:String,
        required:true
    },
    currentOwnerWallet:{
        type:String,
        default:null
    },
    transferCount:{
        type:Number,
        default:0
    },
    lastTransferAt:{
        type:Date,
        default:null
    },
    verified:{
        type:Boolean,
        default:false
    },
    verifiedAt:{
        type:Date,
        default:null
    },
    verifiedBy:{
        type:String,
        default:null
    },
    workflowStatus: {
        type: String,
        enum: ["pending", "approved", "rejected", "approved_pending_chain"],
        default: "pending"
    },
    approvalCount: {
        type: Number,
        default: 0
    },
    rejectCount: {
        type: Number,
        default: 0
    },
    roleDecisions: {
        registrar: {
            decision: { type: String, enum: ["approve", "reject"], default: null },
            reason: { type: String, default: null },
            by: { type: String, default: null },
            at: { type: Date, default: null }
        },
        notary: {
            decision: { type: String, enum: ["approve", "reject"], default: null },
            reason: { type: String, default: null },
            by: { type: String, default: null },
            at: { type: Date, default: null }
        },
        localAuthority: {
            decision: { type: String, enum: ["approve", "reject"], default: null },
            reason: { type: String, default: null },
            by: { type: String, default: null },
            at: { type: Date, default: null }
        }
    },
    chainTxHash: {
        type: String,
        default: null
    },
    chainPushedAt: {
        type: Date,
        default: null
    },
    uploadedAt:{
        type:Date,
        default:Date.now
    }
})
module.exports=mongoose.model('File',fileSchema)
