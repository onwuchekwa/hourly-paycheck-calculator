import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import { ApiError } from './errors.js'
import { employeesRouter } from './routes/employees.js'
import { emailRouter } from './routes/email.js'

const app = express()

const allowedOrigins = (process.env.ALLOWED_ORIGIN ?? 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true)
        return
      }
      callback(new Error('Not allowed by CORS'))
    },
  }),
)
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.use('/api/employees', employeesRouter)
app.use('/api/email', emailRouter)

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof ApiError) {
    res.status(err.status).json({ error: err.code, message: err.message })
    return
  }
  console.error(err)
  res.status(500).json({ error: 'internal', message: 'Something went wrong. Please try again.' })
})

const port = Number(process.env.PORT ?? 3001)

if (process.env.VERCEL !== '1') {
  app.listen(port, () => {
    console.log(`HourlyPay API listening on http://localhost:${port}`)
  })
}

export default app
