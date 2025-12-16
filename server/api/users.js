const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const pool = require('../db');

// 비밀번호 해시
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// 토큰 생성
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// 회원가입
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    // 유효성 검사
    if (!email || !password || !name) {
      return res.json({ success: false, message: '모든 필드를 입력해주세요.' });
    }
    
    // 이메일 형식 검사
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.json({ success: false, message: '올바른 이메일 형식이 아닙니다.' });
    }
    
    // 비밀번호 길이 검사
    if (password.length < 6) {
      return res.json({ success: false, message: '비밀번호는 6자 이상이어야 합니다.' });
    }
    
    // 이메일 중복 검사
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.json({ success: false, message: '이미 등록된 이메일입니다.' });
    }
    
    // 새 사용자 생성
    const hashedPassword = hashPassword(password);
    const result = await pool.query(
      'INSERT INTO users (email, password, name) VALUES ($1, $2, $3) RETURNING id, email, name, plan, created_at',
      [email, hashedPassword, name]
    );
    
    const newUser = result.rows[0];
    res.json({ success: true, message: '회원가입 성공!', user: newUser });
  } catch (error) {
    console.error('회원가입 오류:', error);
    res.json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// 로그인
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.json({ success: false, message: '이메일과 비밀번호를 입력해주세요.' });
    }
    
    // 사용자 조회
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    
    if (result.rows.length === 0) {
      return res.json({ success: false, message: '등록되지 않은 이메일입니다.' });
    }
    
    const user = result.rows[0];
    
    if (user.password !== hashPassword(password)) {
      return res.json({ success: false, message: '비밀번호가 일치하지 않습니다.' });
    }
    
    // 토큰 생성 및 저장
    const token = generateToken();
    await pool.query(
      'UPDATE users SET token = $1, last_login = CURRENT_TIMESTAMP WHERE id = $2',
      [token, user.id]
    );
    
    // 비밀번호 제외하고 반환
    const { password: _, ...userWithoutPassword } = user;
    res.json({ success: true, message: '로그인 성공!', user: userWithoutPassword, token });
  } catch (error) {
    console.error('로그인 오류:', error);
    res.json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// 토큰 검증
router.post('/verify', async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.json({ success: false, message: '토큰이 없습니다.' });
    }
    
    const result = await pool.query('SELECT * FROM users WHERE token = $1', [token]);
    
    if (result.rows.length === 0) {
      return res.json({ success: false, message: '유효하지 않은 토큰입니다.' });
    }
    
    const user = result.rows[0];
    const { password: _, ...userWithoutPassword } = user;
    res.json({ success: true, user: userWithoutPassword });
  } catch (error) {
    console.error('토큰 검증 오류:', error);
    res.json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// 로그아웃
router.post('/logout', async (req, res) => {
  try {
    const { token } = req.body;
    
    if (token) {
      await pool.query('UPDATE users SET token = NULL WHERE token = $1', [token]);
    }
    
    res.json({ success: true, message: '로그아웃 되었습니다.' });
  } catch (error) {
    console.error('로그아웃 오류:', error);
    res.json({ success: true, message: '로그아웃 되었습니다.' });
  }
});

module.exports = router;