const express = require('express');
const pool = require('../db');
const { requireAdmin } = require('../auth');
const { bhutanNow, isValidDate } = require('../time');

const router = express.Router();

function readPeriod(body = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Booking restriction details are required.' };
  }
  const { start_date, end_date, reason } = body;
  if (!isValidDate(start_date) || !isValidDate(end_date)) {
    return { error: 'Start date and end date must be valid dates.' };
  }
  if (end_date < start_date) {
    return { error: 'End date cannot be before start date.' };
  }
  if (typeof reason !== 'string' || !reason.trim() || reason.trim().length > 500) {
    return { error: 'Enter a reason of 1-500 characters.' };
  }
  return { value: { start_date, end_date, reason: reason.trim() } };
}

async function findOverlap(client, period, excludeId = 0) {
  const result = await client.query(
    `SELECT reason
     FROM booking_blackout_dates
     WHERE id <> $3 AND start_date <= $2::date AND end_date >= $1::date
     LIMIT 1`,
    [period.start_date, period.end_date, excludeId],
  );
  return result.rows[0] || null;
}

async function countAffectedBookings(client, period) {
  const result = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM bookings b
     JOIN users u ON u.id = b.user_id
     WHERE b.booking_date BETWEEN $1::date AND $2::date
       AND b.booking_date >= $3::date
       AND b.status NOT IN ('cancelled', 'expired')
       AND u.role = 'student'`,
    [period.start_date, period.end_date, bhutanNow().date],
  );
  return result.rows[0].count;
}

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, reason,
              to_char(start_date, 'YYYY-MM-DD') AS start_date,
              to_char(end_date, 'YYYY-MM-DD') AS end_date
       FROM booking_blackout_dates
       ORDER BY start_date, id`,
    );
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to load booking restrictions.' });
  }
});

router.post('/', requireAdmin, async (req, res) => {
  const parsed = readPeriod(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });

  const client = await pool.connect();
  let transactionStarted = false;
  try {
    await client.query('BEGIN');
    transactionStarted = true;
    await client.query('SELECT pg_advisory_xact_lock(1003, 1)');

    const overlap = await findOverlap(client, parsed.value);
    if (overlap) {
      await client.query('ROLLBACK');
      transactionStarted = false;
      return res.status(409).json({
        error: `This period overlaps an existing restriction: ${overlap.reason}`,
      });
    }

    const affectedBookings = await countAffectedBookings(client, parsed.value);
    const inserted = await client.query(
      `INSERT INTO booking_blackout_dates (start_date, end_date, reason, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING id, reason,
                 to_char(start_date, 'YYYY-MM-DD') AS start_date,
                 to_char(end_date, 'YYYY-MM-DD') AS end_date`,
      [parsed.value.start_date, parsed.value.end_date, parsed.value.reason, req.user.id],
    );
    await client.query('COMMIT');
    transactionStarted = false;
    res.status(201).json({ ...inserted.rows[0], affected_bookings: affectedBookings });
  } catch (error) {
    if (transactionStarted) await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'Failed to add booking restriction.' });
  } finally {
    client.release();
  }
});

router.patch('/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid restriction id.' });
  }
  const parsed = readPeriod(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });

  const client = await pool.connect();
  let transactionStarted = false;
  try {
    await client.query('BEGIN');
    transactionStarted = true;
    await client.query('SELECT pg_advisory_xact_lock(1003, 1)');

    const overlap = await findOverlap(client, parsed.value, id);
    if (overlap) {
      await client.query('ROLLBACK');
      transactionStarted = false;
      return res.status(409).json({
        error: `This period overlaps an existing restriction: ${overlap.reason}`,
      });
    }

    const updated = await client.query(
      `UPDATE booking_blackout_dates
       SET start_date = $1, end_date = $2, reason = $3
       WHERE id = $4
       RETURNING id, reason,
                 to_char(start_date, 'YYYY-MM-DD') AS start_date,
                 to_char(end_date, 'YYYY-MM-DD') AS end_date`,
      [parsed.value.start_date, parsed.value.end_date, parsed.value.reason, id],
    );
    if (updated.rows.length === 0) {
      await client.query('ROLLBACK');
      transactionStarted = false;
      return res.status(404).json({ error: 'Booking restriction not found.' });
    }

    const affectedBookings = await countAffectedBookings(client, parsed.value);
    await client.query('COMMIT');
    transactionStarted = false;
    res.json({ ...updated.rows[0], affected_bookings: affectedBookings });
  } catch (error) {
    if (transactionStarted) await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'Failed to update booking restriction.' });
  } finally {
    client.release();
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid restriction id.' });
  }

  const client = await pool.connect();
  let transactionStarted = false;
  try {
    await client.query('BEGIN');
    transactionStarted = true;
    await client.query('SELECT pg_advisory_xact_lock(1003, 1)');
    const deleted = await client.query(
      'DELETE FROM booking_blackout_dates WHERE id = $1 RETURNING id',
      [id],
    );
    if (deleted.rows.length === 0) {
      await client.query('ROLLBACK');
      transactionStarted = false;
      return res.status(404).json({ error: 'Booking restriction not found.' });
    }
    await client.query('COMMIT');
    transactionStarted = false;
    res.json({ deleted: true });
  } catch (error) {
    if (transactionStarted) await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'Failed to remove booking restriction.' });
  } finally {
    client.release();
  }
});

module.exports = router;
