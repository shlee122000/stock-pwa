const pool = require('./db');

async function initDatabase() {
  try {
    // 사용자 테이블
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(100) NOT NULL,
        plan VARCHAR(20) DEFAULT 'free',
        token VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP
      )
    `);
    console.log('✅ users 테이블 생성 완료');

    // 관심종목 테이블
    await pool.query(`
      CREATE TABLE IF NOT EXISTS watchlist (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        stock_code VARCHAR(20) NOT NULL,
        stock_name VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ watchlist 테이블 생성 완료');

    // 포트폴리오 테이블
    await pool.query(`
      CREATE TABLE IF NOT EXISTS portfolio (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        stock_code VARCHAR(20) NOT NULL,
        stock_name VARCHAR(100),
        quantity INTEGER NOT NULL,
        buy_price DECIMAL(15, 2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ portfolio 테이블 생성 완료');

    // 알림 설정 테이블
    await pool.query(`
      CREATE TABLE IF NOT EXISTS alerts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        stock_code VARCHAR(20) NOT NULL,
        stock_name VARCHAR(100),
        target_price DECIMAL(15, 2),
        alert_type VARCHAR(20),
        is_triggered BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ alerts 테이블 생성 완료');

    console.log('🎉 모든 테이블 생성 완료!');
    process.exit(0);
  } catch (error) {
    console.error('테이블 생성 오류:', error);
    process.exit(1);
  }
}

initDatabase();