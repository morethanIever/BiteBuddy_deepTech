const express = require('express');
const { body, validationResult } = require('express-validator');
const { db } = require('../db');

const router = express.Router();

router.post('/',
  body('restaurant_name').notEmpty().trim().isLength({ max: 200 }),
  body('area').notEmpty().trim().isLength({ max: 100 }),
  body('contact_email').optional().isEmail().normalizeEmail(),
  body('cuisine_type').optional().trim(),
  body('contact_phone').optional().trim(),
  body('notes').optional().trim().isLength({ max: 1000 }),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { restaurant_name, cuisine_type, area, contact_email, contact_phone, notes } = req.body;
    const r = db.prepare(
      'INSERT INTO applications (restaurant_name,cuisine_type,area,contact_email,contact_phone,notes) VALUES (?,?,?,?,?,?)'
    ).run(restaurant_name, cuisine_type || null, area, contact_email || null, contact_phone || null, notes || null);
    res.status(201).json({
      data: { id: r.lastInsertRowid, restaurant_name, area },
      message: 'Application received! We will contact you within 24 hours.'
    });
  }
);

module.exports = router;
