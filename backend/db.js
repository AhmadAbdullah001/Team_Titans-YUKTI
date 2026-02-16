const URL=process.env.URL
const dns = require("dns");
dns.setServers(["1.1.1.1", "8.8.8.8"]);
const mongoose=require('mongoose')

async function ensureUserIndexes() {
    try {
        const users = mongoose.connection.collection("users");
        const indexes = await users.indexes();

        // Migrate old auth schema index so citizen signup doesn't fail with duplicate null email.
        if (indexes.some((idx) => idx.name === "email_1")) {
            await users.dropIndex("email_1");
            console.log("Dropped legacy users.email_1 index");
        }

        await users.createIndex({ aadhaar: 1 }, { unique: true, sparse: true });
        await users.createIndex({ employeeId: 1 }, { unique: true, sparse: true });
        console.log("Ensured users Aadhaar/employeeId indexes");
    } catch (error) {
        console.log("User index migration warning:", error?.message || error);
    }
}

const connecttoDB=async ()=>{
    try{
        await mongoose.connect(URL)
        console.log("Connected to MongoDB")
        await ensureUserIndexes()
    }
    catch(error){
        console.log(error)
    }
}

module.exports=connecttoDB
