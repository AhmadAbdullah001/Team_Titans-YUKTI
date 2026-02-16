const express=require('express')
const cors=require('cors')
require('dotenv').config()
const connecttoDB=require('./db')

const app=express()
const port=process.env.PORT || 5000

app.use(cors({ origin: "*" }));
app.use(express.json())

connecttoDB()

// app.get('/',(req,res)=>{
//     res.send('Hello World!')
// })
app.use('/api/upload',require('./routes/upload'))
app.use('/api/verify',require('./routes/verify'))
app.use('/api/auth', require('./routes/auth'))
app.use('/api/files', require('./routes/files'))
app.use('/api/property', require('./routes/property'))
app.use('/api/transfer', require('./routes/transfer'))

app.listen(port,()=>{
    console.log(`Server is running on port ${port}`)
})

module.exports=app
