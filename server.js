const express = require('express');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

app.get('/favicon.ico', (req, res) => {
  res.type('image/png');
  res.sendFile(path.join(__dirname, 'icons', 'icon-192.png'));
});

app.get('/sw.js', (req, res) => {
  res.set('Cache-Control', 'no-cache');
  res.type('application/javascript');
  res.sendFile(path.join(__dirname, 'sw.js'));
});

app.get('/manifest.json', (req, res) => {
  res.set('Content-Type', 'application/manifest+json');
  res.set('Cache-Control', 'no-cache');
  res.sendFile(path.join(__dirname, 'manifest.json'));
});

// Serve static files from the root directory
app.use(express.static(__dirname));

app.listen(port, () => {
  console.log(`Fitness Progress Viewer running at http://localhost:${port}`);
});
