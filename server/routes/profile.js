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

async function getAdminUser(adminEmail = '') {
  const normalizedEmail = String(adminEmail || '').trim().toLowerCase()

  const result = normalizedEmail
    ? await pool.query(
        `SELECT admin_id, full_name, role, workspace_name, email, member_since
         FROM ${dbSchema}.admin_users
         WHERE is_active = TRUE
           AND email = $1
         LIMIT 1`,
        [normalizedEmail],
      )
    : await pool.query(
        `SELECT admin_id, full_name, role, workspace_name, email, member_since
         FROM ${dbSchema}.admin_users
         WHERE is_active = TRUE
         ORDER BY admin_id ASC
         LIMIT 1`,
      )

  return result.rows[0] || null
}

async function verifyPassword(adminId, password) {
  const result = await pool.query(
    `SELECT admin_id
     FROM ${dbSchema}.admin_users
     WHERE admin_id = $1
       AND password_hash = crypt($2, password_hash)`,
    [adminId, String(password || '')],
  )

  return result.rows.length > 0
}

router.get('/', async (req, res) => {
  const admin = await getAdminUser(req.query.email)

  if (!admin) {
    return res.status(404).json({ message: 'Admin account not found' })
  }

  res.json({ user: mapUser(admin) })
})

router.put('/', async (req, res) => {
  const admin = await getAdminUser(req.body.adminEmail)

  if (!admin) {
    return res.status(404).json({ message: 'Admin account not found' })
  }

  const { name, role, workspace } = req.body

  const result = await pool.query(
    `UPDATE ${dbSchema}.admin_users
     SET full_name = $1,
         role = $2,
         workspace_name = $3,
         updated_at = CURRENT_TIMESTAMP
     WHERE admin_id = $4
     RETURNING admin_id, full_name, role, workspace_name, email, member_since`,
    [String(name || '').trim(), String(role || '').trim(), String(workspace || '').trim(), admin.admin_id],
  )

  res.json({ user: mapUser(result.rows[0]) })
})

router.put('/email', async (req, res) => {
  const admin = await getAdminUser(req.body.adminEmail)

  if (!admin) {
    return res.status(404).json({ message: 'Admin account not found' })
  }

  const { email, currentPassword } = req.body
  const isValidPassword = await verifyPassword(admin.admin_id, currentPassword)

  if (!isValidPassword) {
    return res.status(401).json({ message: 'Current password is incorrect' })
  }

  const result = await pool.query(
    `UPDATE ${dbSchema}.admin_users
     SET email = $1,
         updated_at = CURRENT_TIMESTAMP
     WHERE admin_id = $2
     RETURNING admin_id, full_name, role, workspace_name, email, member_since`,
    [String(email || '').trim().toLowerCase(), admin.admin_id],
  )

  res.json({ user: mapUser(result.rows[0]) })
})

router.put('/password', async (req, res) => {
  const admin = await getAdminUser(req.body.adminEmail)

  if (!admin) {
    return res.status(404).json({ message: 'Admin account not found' })
  }

  const { currentPassword, nextPassword } = req.body
  const isValidPassword = await verifyPassword(admin.admin_id, currentPassword)

  if (!isValidPassword) {
    return res.status(401).json({ message: 'Current password is incorrect' })
  }

  await pool.query(
    `UPDATE ${dbSchema}.admin_users
     SET password_hash = crypt($1, gen_salt('bf')),
         updated_at = CURRENT_TIMESTAMP
     WHERE admin_id = $2`,
    [String(nextPassword || ''), admin.admin_id],
  )

  res.json({ success: true })
})

export default router
