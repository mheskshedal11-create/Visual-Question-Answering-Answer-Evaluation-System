import express from 'express'
import 'dotenv/config'
import connection from './db/config.js'
const app = express()
const PORT = process.env.PORT



connection().then(() => {
    app.listen(PORT, () => {
        console.log(`http://localhost:${PORT}`)
    })
})