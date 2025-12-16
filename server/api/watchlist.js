const express = require('express');
const router = express.Router();
const pool = require('../db');

// 토큰으로 사용자 ID 조회
async function getUserIdByToken(token) {
  if (!token) return null;
  const result = await pool.query('SELECT id FROM users WHERE token = $1', [token]);
  return result.rows.length > 0 ? result.rows[0].id : null;
}

// 관심종목 조회
router.get('/', async (req, res) => {
  try {
    const token = req.headers.authorization;
    const userId = await getUserIdByToken(token);
    
    if (!userId) {
      return res.json({ success: false, message: '로그인이 필요합니다.' });
    }
    
    const result = await pool.query(
      'SELECT * FROM watchlist WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('관심종목 조회 오류:', error);
    res.json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// 관심종목 추가
router.post('/add', async (req, res) => {
  try {
    const token = req.headers.authorization;
    const userId = await getUserIdByToken(token);
    
    if (!userId) {
      return res.json({ success: false, message: '로그인이 필요합니다.' });
    }
    
    const { stockCode, stockName } = req.body;
    
    if (!stockCode) {
      return res.json({ success: false, message: '종목코드가 필요합니다.' });
    }
    
    // 중복 체크
    const existing = await pool.query(
      'SELECT id FROM watchlist WHERE user_id = $1 AND stock_code = $2',
      [userId, stockCode]
    );
    
    if (existing.rows.length > 0) {
      return res.json({ success: false, message: '이미 등록된 종목입니다.' });
    }
    
    await pool.query(
      'INSERT INTO watchlist (user_id, stock_code, stock_name) VALUES ($1, $2, $3)',
      [userId, stockCode, stockName || '']
    );
    
    res.json({ success: true, message: '관심종목에 추가되었습니다.' });
  } catch (error) {
    console.error('관심종목 추가 오류:', error);
    res.json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// 관심종목 삭제
router.post('/remove', async (req, res) => {
  try {
    const token = req.headers.authorization;
    const userId = await getUserIdByToken(token);
    
    if (!userId) {
      return res.json({ success: false, message: '로그인이 필요합니다.' });
    }
    
    const { stockCode } = req.body;
    
    await pool.query(
      'DELETE FROM watchlist WHERE user_id = $1 AND stock_code = $2',
      [userId, stockCode]
    );
    
    res.json({ success: true, message: '관심종목에서 삭제되었습니다.' });
  } catch (error) {
    console.error('관심종목 삭제 오류:', error);
    res.json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;