import { Router } from 'express'
import { dbSchema, pool } from '../db.js'

const router = Router()

function mapProduct(row) {
  return {
    id: row.item_id,
    name: row.item_name,
    category: row.category,
    sku: row.sku,
    description: row.description || '',
    items: Number(row.quantity || 0),
    updates: row.last_update || 'Recently added item',
    imageUrl: row.image_url || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

router.get('/', async (_req, res) => {
  const result = await pool.query(
    `SELECT item_id, item_name, category, sku, quantity, description, last_update, image_url, created_at, updated_at
     FROM ${dbSchema}.clothing_items
     ORDER BY created_at DESC, item_id DESC`,
  )

  res.json({ products: result.rows.map(mapProduct) })
})

router.post('/', async (req, res) => {
  const { name, category, sku, items, description, updates, imageUrl } = req.body

  const result = await pool.query(
    `INSERT INTO ${dbSchema}.clothing_items
      (item_name, category, sku, quantity, description, last_update, image_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING item_id, item_name, category, sku, quantity, description, last_update, image_url, created_at, updated_at`,
    [name, category, sku, Number(items || 0), description || '', updates || 'Recently added item', imageUrl || ''],
  )

  res.status(201).json({ product: mapProduct(result.rows[0]) })
})

router.put('/:id', async (req, res) => {
  const { name, category, sku, items, description, updates, imageUrl } = req.body

  const result = await pool.query(
    `UPDATE ${dbSchema}.clothing_items
     SET item_name = $1,
         category = $2,
         sku = $3,
         quantity = $4,
         description = $5,
         last_update = $6,
         image_url = $7,
         updated_at = CURRENT_TIMESTAMP
     WHERE item_id = $8
     RETURNING item_id, item_name, category, sku, quantity, description, last_update, image_url, created_at, updated_at`,
    [name, category, sku, Number(items || 0), description || '', updates || 'Item updated', imageUrl || '', Number(req.params.id)],
  )

  if (!result.rows.length) {
    return res.status(404).json({ message: 'Item not found' })
  }

  res.json({ product: mapProduct(result.rows[0]) })
})

router.delete('/:id', async (req, res) => {
  const result = await pool.query(
    `DELETE FROM ${dbSchema}.clothing_items
     WHERE item_id = $1
     RETURNING item_id`,
    [Number(req.params.id)],
  )

  if (!result.rows.length) {
    return res.status(404).json({ message: 'Item not found' })
  }

  res.json({ success: true })
})

export default router
