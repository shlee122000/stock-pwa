const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// 미들웨어
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public'), {
  etag: false,
  maxAge: 0,
  setHeaders: function(res, path) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
}));


// API 라우트
const koreaRoutes = require('./routes/korea');
const usRoutes = require('./routes/us');
const analysisRoutes = require('./routes/analysis');
const usersRoutes = require('./api/users');
const watchlistRoutes = require('./api/watchlist');
const portfolioRoutes = require('./api/portfolio');

app.use('/api/korea', koreaRoutes);
app.use('/api/us', usRoutes);
app.use('/api/analysis', analysisRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/watchlist', watchlistRoutes);
app.use('/api/portfolio', portfolioRoutes);


// 기본 라우트 (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`서버 실행 중: http://localhost:${PORT}`);
});

module.exports = app;