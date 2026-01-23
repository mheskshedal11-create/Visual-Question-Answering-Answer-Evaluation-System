import express from 'express'
import 'dotenv/config'
import morgan from 'morgan'
import helmet from 'helmet'
import connection from './db/config.js'
import globalError from './middleware/globalError.js'


const app = express()

const PORT = process.env.PORT

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(morgan('dev'))
app.use(helmet())


//global Error Handling
app.use(globalError)

//connect db
connection().then(() => {
    app.listen(PORT, () => {
        console.log(`http://localhost:${PORT}`)
    })
})