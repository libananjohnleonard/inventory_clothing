import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { fileURLToPath } from 'node:url'
import process from 'node:process'
import authRoutes from './routes/auth.js'
import productRoutes from './routes/products.js'
import profileRoutes from './routes/profile.js'

dotenv.config()

const app = express()
const port = Number(process.env.PORT || 4000)

app.use(cors())
app.use(express.json({ limit: '10mb' }))

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.use('/api/auth', authRoutes)
app.use('/api/products', productRoutes)
app.use('/api/profile', profileRoutes)

app.use((error, _req, res, next) => {
  void next
  console.error(error)
  res.status(500).json({ message: 'Internal server error' })
})

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]

if (isDirectRun) {
  app.listen(port, () => {
    console.log(`API running on http://localhost:${port}`)
  })
}

export default app
