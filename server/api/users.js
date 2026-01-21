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

// 토큰으로 사용자 조회
async function getUserByToken(token) {
  if (!token) return null;
  const result = await pool.query('SELECT * FROM users WHERE token = $1', [token]);
  return result.rows.length > 0 ? result.rows[0] : null;
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
      'INSERT INTO users (email, password, name, is_active, is_admin, created_at) VALUES ($1, $2, $3, true, false, NOW()) RETURNING id, email, name, plan, created_at',
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
    
    // 비밀번호 확인
    if (user.password !== hashPassword(password)) {
      return res.json({ success: false, message: '비밀번호가 일치하지 않습니다.' });
    }
    
    // 활성 상태 확인
    if (user.is_active === false) {
      return res.json({ success: false, message: '계정이 비활성화되었습니다. 관리자에게 문의하세요.' });
    }
    
    // 토큰 생성 및 저장
    const token = generateToken();
    await pool.query(
      'UPDATE users SET token = $1, last_login = CURRENT_TIMESTAMP WHERE id = $2',
      [token, user.id]
    );
    
    // 비밀번호 제외하고 반환
    const { password: _, ...userWithoutPassword } = user;
    res.json({ 
      success: true, 
      message: '로그인 성공!', 
      user: userWithoutPassword, 
      token,
      adminMessage: user.admin_message || null
    });
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
    
    // 활성 상태 확인
    if (user.is_active === false) {
      return res.json({ success: false, message: '계정이 비활성화되었습니다.' });
    }
    
    const { password: _, ...userWithoutPassword } = user;
    res.json({ 
      success: true, 
      user: userWithoutPassword,
      adminMessage: user.admin_message || null
    });
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

// ==================== 관리자 API ====================

// 전체 사용자 목록 (관리자 전용)
router.get('/admin/list', async (req, res) => {
  try {
    const token = req.headers.authorization;
    const admin = await getUserByToken(token);
    
    if (!admin || !admin.is_admin) {
      return res.json({ success: false, message: '관리자 권한이 필요합니다.' });
    }
    
    const result = await pool.query(
      'SELECT id, email, name, plan, is_active, is_admin, created_at, last_login, admin_message FROM users ORDER BY created_at DESC'
    );
    
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('사용자 목록 조회 오류:', error);
    res.json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// 사용자 활성화/비활성화 (관리자 전용)
router.post('/admin/toggle-active', async (req, res) => {
  try {
    const token = req.headers.authorization;
    const admin = await getUserByToken(token);
    
    if (!admin || !admin.is_admin) {
      return res.json({ success: false, message: '관리자 권한이 필요합니다.' });
    }
    
    const { userId, isActive } = req.body;
    
    await pool.query(
      'UPDATE users SET is_active = $1 WHERE id = $2',
      [isActive, userId]
    );
    
    res.json({ success: true, message: isActive ? '사용자가 활성화되었습니다.' : '사용자가 비활성화되었습니다.' });
  } catch (error) {
    console.error('사용자 상태 변경 오류:', error);
    res.json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// 사용자 메시지 설정 (관리자 전용)
router.post('/admin/set-message', async (req, res) => {
  try {
    const token = req.headers.authorization;
    const admin = await getUserByToken(token);
    
    if (!admin || !admin.is_admin) {
      return res.json({ success: false, message: '관리자 권한이 필요합니다.' });
    }
    
    const { userId, message } = req.body;
    
    await pool.query(
      'UPDATE users SET admin_message = $1 WHERE id = $2',
      [message || null, userId]
    );
    
    res.json({ success: true, message: '메시지가 설정되었습니다.' });
  } catch (error) {
    console.error('메시지 설정 오류:', error);
    res.json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// 전체 공지 메시지 설정 (관리자 전용)
router.post('/admin/set-global-message', async (req, res) => {
  try {
    const token = req.headers.authorization;
    const admin = await getUserByToken(token);
    
    if (!admin || !admin.is_admin) {
      return res.json({ success: false, message: '관리자 권한이 필요합니다.' });
    }
    
    const { message } = req.body;
    
    await pool.query(
      'UPDATE users SET admin_message = $1 WHERE is_admin = false',
      [message || null]
    );
    
    res.json({ success: true, message: '전체 공지가 설정되었습니다.' });
  } catch (error) {
    console.error('전체 공지 설정 오류:', error);
    res.json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});


// 모니터링 상태 조회
router.get('/monitoring-status', async (req, res) => {
  try {
    const { user_id } = req.query;
    
    if (!user_id) {
      return res.json({ success: false, message: 'user_id is required' });
    }
    
    const result = await pool.query(
      'SELECT monitoring_status FROM users WHERE id = $1',
      [user_id]
    );
    
    if (result.rows.length === 0) {
      return res.json({ success: false, message: 'User not found' });
    }
    
    res.json({ 
      success: true, 
      data: result.rows[0].monitoring_status || {
        kr: { active: false, interval: 1 },
        us: { active: false, interval: 10 }
      }
    });
  } catch (error) {
    console.error('모니터링 상태 조회 오류:', error);
    res.json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// 모니터링 상태 업데이트
router.put('/monitoring-status', async (req, res) => {
  try {
    const { user_id, monitoring_status } = req.body;
    
    if (!user_id || !monitoring_status) {
      return res.json({ success: false, message: 'Missing required fields' });
    }
    
    const result = await pool.query(
      'UPDATE users SET monitoring_status = $1 WHERE id = $2 RETURNING monitoring_status',
      [JSON.stringify(monitoring_status), user_id]
    );
    
    if (result.rows.length === 0) {
      return res.json({ success: false, message: 'User not found' });
    }
    
    res.json({ success: true, data: result.rows[0].monitoring_status });
  } catch (error) {
    console.error('모니터링 상태 업데이트 오류:', error);
    res.json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});


module.exports = router;