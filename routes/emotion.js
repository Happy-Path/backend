const express = require('express');
const axios = require('axios');
const multer = require('multer');
const upload = multer();
const router = express.Router();

router.post('/predict', upload.single('file'), async (req, res) => {
    try {
        const response = await axios.post('http://localhost:8000/predict-emotion/', req.file.buffer, {
            headers: { 'Content-Type': 'application/octet-stream' },
        });
        res.json(response.data);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error predicting emotion' });
    }
});

module.exports = router;
