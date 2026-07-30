import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import rateLimit from 'express-rate-limit'
import { ApiError } from './errors.js'
import { employeesRouter } from './routes/employees.js'
import { emailRouter } from './routes/email.js'
import { payrollRouter } from './routes/payroll.js'

const app = express()

const allowedOrigins = (process.env.ALLOWED_ORIGIN ?? 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)

app.disable('x-powered-by')

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'no-referrer')
  // JSON-only API; a restrictive CSP defangs any reflected content.
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'")
  next()
})

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
app.use(express.json({ limit: '100kb' }))

app.use(
  '/api/',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'rate-limited', message: 'Too many requests. Please try again later.' },
  }),
)

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.use('/api/employees', employeesRouter)
app.use('/api/email', emailRouter)
app.use('/api/payroll', payrollRouter)

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
