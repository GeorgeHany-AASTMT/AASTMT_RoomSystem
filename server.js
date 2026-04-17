const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve all static files from the Frontend directory
app.use(express.static(path.join(__dirname, 'Frontend')));

// Fallback: serve index.html for any unknown route
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'Frontend', 'login.html'));
});

app.listen(PORT, () => {
    console.log(`AASTMT Room System running on port ${PORT}`);
});
