const { Pool } = require('pg');

// 데이터베이스 연결 설정
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_IzZjU0Gm6JgF@ep-patient-leaf-a1a5o3mg-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require',
  ssl: {
    rejectUnauthorized: false
  }
});

// 연결 테스트
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('데이터베이스 연결 실패:', err.message);
  } else {
    console.log('✅ 데이터베이스 연결 성공:', res.rows[0].now);
  }
});

module.exports = pool;