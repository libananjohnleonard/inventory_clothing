import { Pool } from 'pg'
import dotenv from 'dotenv'
import process from 'node:process'

dotenv.config()

export const dbSchema = process.env.DB_SCHEMA || 'inventory_clothing'

const shouldUseSsl = process.env.DB_SSL === 'true' || Boolean(process.env.DATABASE_URL)

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL || undefined,
  host: process.env.DATABASE_URL ? undefined : process.env.DB_HOST || 'localhost',
  user: process.env.DATABASE_URL ? undefined : process.env.DB_USER || 'postgres',
  password: process.env.DATABASE_URL ? undefined : process.env.DB_PASSWORD || '',
  database: process.env.DATABASE_URL ? undefined : process.env.DB_NAME || 'inventory_clothing',
  port: process.env.DATABASE_URL ? undefined : Number(process.env.DB_PORT || 5432),
  max: Number(process.env.DB_POOL_MAX || 5),
  idleTimeoutMillis: 30000,
  ssl: shouldUseSsl ? { rejectUnauthorized: false } : false,
})
