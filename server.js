const express = require('express');
const app = express();

app.use(express.json());

// Test route
app.get('/', (req, res) => {
  res.send('Backend is working! 🚀');
});

app.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'API is working perfectly!'
  });
});

// Don't listen when in serverless environment
if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;