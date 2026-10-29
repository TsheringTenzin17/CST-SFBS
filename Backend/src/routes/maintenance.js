// =============================================================
// Backend/src/routes/maintenance.js  —  closing a facility for repairs
// =============================================================
// GET    /maintenance                       list all blocks (anyone can read)
// POST   /maintenance                       add a block      (admin only)
// PATCH  /maintenance/:id                  edit a block     (admin only)
// DELETE /maintenance/:id                  remove a block   (admin only)
// While a block covers a date, the booking API refuses that facility
// and the availability page shows "closed for maintenance".
const express = require('express');
const pool = require('../db');
const { requireAdmin } = require('../auth');
const { isValidDate } = require('../time');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT m.id, m.facility_id, f.name AS facility_name, m.reason,
              to_char(m.start_date, 'YYYY-MM-DD') AS start_date,
              to_char(m.end_date, 'YYYY-MM-DD') AS end_date
       FROM maintenance_blocks m JOIN facilities f ON f.id = m.facility_id
       ORDER BY m.start_date DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch maintenance blocks' });
  }
});

router.post('/', requireAdmin, async (req, res) => {
  const { facility_id, start_date, end_date, reason } = req.body;
  if (!facility_id || !isValidDate(start_date) || !isValidDate(end_date)) {
    return res.status(400).json({ error: 'facility_id, start_date and end_date (YYYY-MM-DD) are required' });
  }
  if (end_date < start_date) return res.status(400).json({ error: 'End date cannot be before start date' });
  if (reason != null && (typeof reason !== 'string' || reason.trim().length > 500)) {
    return res.status(400).json({ error: 'Reason must be 500 characters or fewer' });
  }
  const cleanReason = typeof reason === 'string' ? reason.trim() : '';

  const client = await pool.connect();
  let transactionStarted = false;
  try {
    await client.query('BEGIN');
    transactionStarted = true;

    const inserted = await client.query(
      `INSERT INTO maintenance_blocks (facility_id, start_date, end_date, reason, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [facility_id, start_date, end_date, cleanReason || null, req.user.id]
    );

    // Count affected reservations and notify each affected account once, respecting saved preferences.
    const affected = await client.query(
      `SELECT COUNT(*)::int AS n FROM bookings
       WHERE facility_id = $1 AND status <> 'cancelled' AND booking_date BETWEEN $2 AND $3`,
      [facility_id, start_date, end_date]
    );
    const recipients = await client.query(
      `SELECT b.user_id, COUNT(*)::int AS booking_count, f.name AS facility_name
       FROM bookings b
       JOIN facilities f ON f.id = b.facility_id
       LEFT JOIN user_notification_preferences p ON p.user_id = b.user_id
       WHERE b.facility_id = $1
         AND b.status <> 'cancelled'
         AND b.booking_date BETWEEN $2 AND $3
         AND COALESCE(p.maintenance_alerts, true) = true
       GROUP BY b.user_id, f.name`,
      [facility_id, start_date, end_date]
    );

    for (const recipient of recipients.rows) {
      const reasonText = cleanReason ? ` Reason: ${cleanReason}` : '';
      await client.query(
        `INSERT INTO notifications (user_id, type, message)
         VALUES ($1, 'maintenance_scheduled', $2)`,
        [
          recipient.user_id,
          `Maintenance has been scheduled for ${recipient.facility_name} from ${start_date} to ${end_date}. ` +
            `${recipient.booking_count} of your active booking(s) may be affected.${reasonText}`,
        ]
      );
    }

    await client.query('COMMIT');
    transactionStarted = false;
    res.status(201).json({
      id: inserted.rows[0].id,
      affected_bookings: affected.rows[0].n,
      notified_users: recipients.rows.length,
    });
  } catch (err) {
    if (transactionStarted) await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to create maintenance block' });
  } finally {
    client.release();
  }
});

router.patch('/:id', requireAdmin, async (req, res) => {
  const blockId = Number(req.params.id);
  if (!Number.isSafeInteger(blockId) || blockId <= 0) return res.status(400).json({ error: 'Invalid block id' });
  const { facility_id, start_date, end_date, reason } = req.body;
  if (!facility_id || !isValidDate(start_date) || !isValidDate(end_date)) {
    return res.status(400).json({ error: 'facility_id, start_date and end_date (YYYY-MM-DD) are required' });
  }
  if (end_date < start_date) return res.status(400).json({ error: 'End date cannot be before start date' });
  if (reason != null && (typeof reason !== 'string' || reason.trim().length > 500)) {
    return res.status(400).json({ error: 'Reason must be 500 characters or fewer' });
  }
  const cleanReason = typeof reason === 'string' ? reason.trim() : '';

  const client = await pool.connect();
  let transactionStarted = false;
  try {
    await client.query('BEGIN');
    transactionStarted = true;

    const updated = await client.query(
      `UPDATE maintenance_blocks SET facility_id = $1, start_date = $2, end_date = $3, reason = $4
       WHERE id = $5 RETURNING id`,
      [facility_id, start_date, end_date, cleanReason || null, blockId]
    );
    if (updated.rows.length === 0) {
      await client.query('ROLLBACK');
      transactionStarted = false;
      return res.status(404).json({ error: 'Maintenance block not found' });
    }

    // Same notification rules as creating a block, for the new facility and dates.
    const affected = await client.query(
      `SELECT COUNT(*)::int AS n FROM bookings
       WHERE facility_id = $1 AND status <> 'cancelled' AND booking_date BETWEEN $2 AND $3`,
      [facility_id, start_date, end_date]
    );
    const recipients = await client.query(
      `SELECT b.user_id, COUNT(*)::int AS booking_count, f.name AS facility_name
       FROM bookings b
       JOIN facilities f ON f.id = b.facility_id
       LEFT JOIN user_notification_preferences p ON p.user_id = b.user_id
       WHERE b.facility_id = $1
         AND b.status <> 'cancelled'
         AND b.booking_date BETWEEN $2 AND $3
         AND COALESCE(p.maintenance_alerts, true) = true
       GROUP BY b.user_id, f.name`,
      [facility_id, start_date, end_date]
    );
    for (const recipient of recipients.rows) {
      const reasonText = cleanReason ? ` Reason: ${cleanReason}` : '';
      await client.query(
        `INSERT INTO notifications (user_id, type, message)
         VALUES ($1, 'maintenance_scheduled', $2)`,
        [
          recipient.user_id,
          `Maintenance for ${recipient.facility_name} has been updated to ${start_date} - ${end_date}. ` +
            `${recipient.booking_count} of your active booking(s) may be affected.${reasonText}`,
        ]
      );
    }

    await client.query('COMMIT');
    transactionStarted = false;
    res.json({ id: blockId, affected_bookings: affected.rows[0].n, notified_users: recipients.rows.length });
  } catch (err) {
    if (transactionStarted) await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to update maintenance block' });
  } finally {
    client.release();
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM maintenance_blocks WHERE id = $1', [req.params.id]);
    res.json({ deleted: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to remove maintenance block' });
  }
});

module.exports = router;