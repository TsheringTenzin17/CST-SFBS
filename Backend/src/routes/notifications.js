const express = require('express');
const pool = require('../db');
const { authenticate } = require('../auth');

const router = express.Router();

// Every notification operation is scoped to the authenticated account.
router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, type, message, is_read, created_at
       FROM notifications
       WHERE user_id = $1
         AND created_at >= now() - INTERVAL '7 days'
       ORDER BY created_at DESC, id DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

router.patch('/read-all', async (req, res) => {
  try {
    // Updating only unread rows keeps the response count meaningful and avoids needless writes.
    const result = await pool.query(
      `UPDATE notifications SET is_read = true
       WHERE user_id = $1 AND is_read = false`,
      [req.user.id]
    );
    res.json({ updated: result.rowCount });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to mark notifications as read' });
  }
});

router.delete('/', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM notifications WHERE user_id = $1',
      [req.user.id]
    );
    res.json({ deleted: result.rowCount });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to clear notifications' });
  }
});

router.patch('/:id/read', async (req, res) => {
  const notificationId = Number(req.params.id);
  if (!Number.isSafeInteger(notificationId) || notificationId <= 0) {
    return res.status(400).json({ error: 'Invalid notification id' });
  }

  try {
    // The owner condition prevents users from reading or changing another account's notification.
    const result = await pool.query(
      `UPDATE notifications SET is_read = true
       WHERE id = $1 AND user_id = $2
       RETURNING id, type, message, is_read, created_at`,
      [notificationId, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    res.json({ notification: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

router.delete('/:id', async (req, res) => {
  const notificationId = Number(req.params.id);
  if (!Number.isSafeInteger(notificationId) || notificationId <= 0) {
    return res.status(400).json({ error: 'Invalid notification id' });
  }

  try {
    const result = await pool.query(
      `DELETE FROM notifications
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [notificationId, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    res.json({ deleted: true, id: result.rows[0].id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

module.exports = router;