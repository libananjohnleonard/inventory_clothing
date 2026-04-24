import { Router } from 'express'
import { dbSchema, pool } from '../db.js'

const router = Router()

function mapUser(row) {
  return {
    id: row.admin_id,
    name: row.full_name,
    role: row.role,
    workspace: row.workspace_name,
    email: row.email,
    memberSince: row.member_since,
  }
}

router.post('/login', async (req, res) => {
  const { email, password } = req.body

  const result = await pool.query(
    `SELECT admin_id, full_name, role, workspace_name, email, member_since
     FROM ${dbSchema}.admin_users
     WHERE email = $1
       AND is_active = TRUE
       AND password_hash = crypt($2, password_hash)
     LIMIT 1`,
    [String(email || '').trim().toLowerCase(), String(password || '')],
  )

  if (!result.rows.length) {
    return res.status(401).json({ message: 'Invalid email or password' })
  }

  res.json({ user: mapUser(result.rows[0]) })
})

export default router
