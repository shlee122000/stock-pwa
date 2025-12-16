const express = require('express');
const router = express.Router();
const pool = require('../db');

// 토큰으로 사용자 ID 조회
async function getUserIdByToken(token) {
  if (!token) return null;
  const result = await pool.query('SELECT id FROM users WHERE token = $1', [token]);
  return result.rows.length > 0 ? result.rows[0].id : null;
}

// 포트폴리오 조회
router.get('/', async (req, res) => {
  try {
    const token = req.headers.authorization;
    const userId = await getUserIdByToken(token);
    
    if (!userId) {
      return res.json({ success: false, message: '로그인이 필요합니다.' });
    }
    
    const result = await pool.query(
      'SELECT * FROM portfolio WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('포트폴리오 조회 오류:', error);
    res.json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// 포트폴리오 추가
router.post('/add', async (req, res) => {
  try {
    const token = req.headers.authorization;
    const userId = await getUserIdByToken(token);
    
    if (!userId) {
      return res.json({ success: false, message: '로그인이 필요합니다.' });
    }
    
    const { stockCode, stockName, quantity, buyPrice } = req.body;
    
    if (!stockCode || !quantity || !buyPrice) {
      return res.json({ success: false, message: '종목코드, 수량, 매수가를 입력해주세요.' });
    }
    
    await pool.query(
      'INSERT INTO portfolio (user_id, stock_code, stock_name, quantity, buy_price) VALUES ($1, $2, $3, $4, $5)',
      [userId, stockCode, stockName || '', quantity, buyPrice]
    );
    
    res.json({ success: true, message: '포트폴리오에 추가되었습니다.' });
  } catch (error) {
    console.error('포트폴리오 추가 오류:', error);
    res.json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// 포트폴리오 수정
router.post('/update', async (req, res) => {
  try {
    const token = req.headers.authorization;
    const userId = await getUserIdByToken(token);
    
    if (!userId) {
      return res.json({ success: false, message: '로그인이 필요합니다.' });
    }
    
    const { id, quantity, buyPrice } = req.body;
    
    await pool.query(
      'UPDATE portfolio SET quantity = $1, buy_price = $2 WHERE id = $3 AND user_id = $4',
      [quantity, buyPrice, id, userId]
    );
    
    res.json({ success: true, message: '포트폴리오가 수정되었습니다.' });
  } catch (error) {
    console.error('포트폴리오 수정 오류:', error);
    res.json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// 포트폴리오 삭제
router.post('/remove', async (req, res) => {
  try {
    const token = req.headers.authorization;
    const userId = await getUserIdByToken(token);
    
    if (!userId) {
      return res.json({ success: false, message: '로그인이 필요합니다.' });
    }
    
    const { id } = req.body;
    
    await pool.query(
      'DELETE FROM portfolio WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    
    res.json({ success: true, message: '포트폴리오에서 삭제되었습니다.' });
  } catch (error) {
    console.error('포트폴리오 삭제 오류:', error);
    res.json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;