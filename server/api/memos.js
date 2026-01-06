const express = require('express');
const router = express.Router();
const pool = require('../db');

// 토큰으로 사용자 ID 조회
async function getUserIdByToken(token) {
  if (!token) return null;
  const result = await pool.query('SELECT id FROM users WHERE token = $1', [token]);
  return result.rows.length > 0 ? result.rows[0].id : null;
}

// 메모 조회
router.get('/:stockCode', async (req, res) => {
  try {
    const token = req.headers.authorization;
    const userId = await getUserIdByToken(token);
    
    if (!userId) {
      return res.json({ success: false, message: '로그인이 필요합니다.' });
    }
    
    const { stockCode } = req.params;
    const market = req.query.market || 'korea';
    
    const result = await pool.query(
      'SELECT * FROM memos WHERE user_id = $1 AND stock_code = $2 AND market = $3',
      [userId, stockCode, market]
    );
    
    if (result.rows.length > 0) {
      res.json({ success: true, data: result.rows[0] });
    } else {
      res.json({ success: true, data: null });
    }
  } catch (error) {
    console.error('메모 조회 오류:', error);
    res.json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// 메모 저장 (추가/수정)
router.post('/save', async (req, res) => {
  try {
    const token = req.headers.authorization;
    const userId = await getUserIdByToken(token);
    
    if (!userId) {
      return res.json({ success: false, message: '로그인이 필요합니다.' });
    }
    
    const { stockCode, memoText, market } = req.body;
    const marketValue = market || 'korea';
    
    if (!stockCode) {
      return res.json({ success: false, message: '종목코드를 입력해주세요.' });
    }
    
    // 기존 메모 확인
    const existing = await pool.query(
      'SELECT id FROM memos WHERE user_id = $1 AND stock_code = $2 AND market = $3',
      [userId, stockCode, marketValue]
    );
    
    if (existing.rows.length > 0) {
      // 수정
      await pool.query(
        'UPDATE memos SET memo_text = $1, updated_at = NOW() WHERE id = $2',
        [memoText, existing.rows[0].id]
      );
    } else {
      // 추가
      await pool.query(
        'INSERT INTO memos (user_id, stock_code, market, memo_text) VALUES ($1, $2, $3, $4)',
        [userId, stockCode, marketValue, memoText]
      );
    }
    
    res.json({ success: true, message: '메모가 저장되었습니다.' });
  } catch (error) {
    console.error('메모 저장 오류:', error);
    res.json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// 메모 삭제
router.post('/delete', async (req, res) => {
  try {
    const token = req.headers.authorization;
    const userId = await getUserIdByToken(token);
    
    if (!userId) {
      return res.json({ success: false, message: '로그인이 필요합니다.' });
    }
    
    const { stockCode, market } = req.body;
    const marketValue = market || 'korea';
    
    await pool.query(
      'DELETE FROM memos WHERE user_id = $1 AND stock_code = $2 AND market = $3',
      [userId, stockCode, marketValue]
    );
    
    res.json({ success: true, message: '메모가 삭제되었습니다.' });
  } catch (error) {
    console.error('메모 삭제 오류:', error);
    res.json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;