// Simple server to test the environment
import express from 'express';

const app = express();
const port = 5000;

app.get('/', (req, res) => {
  res.json({ 
    status: 'Server is running!', 
    message: 'Development environment is working',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', env: process.env.NODE_ENV || 'development' });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`✅ Simple server running on http://0.0.0.0:${port}`);
  console.log('Environment test successful!');
});
