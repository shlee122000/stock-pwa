const express = require('express');
const router = express.Router();
const { findDoubleTop, findDoubleBottom } = require('../api/patterns');

/**
 * POST /api/patterns/analyze
 * 차트 패턴 분석
 * Body: { data: [{time, open, high, low, close}], patterns: ['doubleTop', 'doubleBottom'] }
 */
router.post('/analyze', async (req, res) => {
  try {
    const { data, patterns } = req.body;

    if (!data || !Array.isArray(data)) {
      return res.status(400).json({ error: '유효한 데이터를 제공해주세요.' });
    }

    const results = {};

    // 요청된 패턴들을 분석
    if (!patterns || patterns.includes('doubleTop')) {
      results.doubleTop = findDoubleTop(data);
    }

    if (!patterns || patterns.includes('doubleBottom')) {
      results.doubleBottom = findDoubleBottom(data);
    }

    // 모든 패턴을 하나의 배열로 합치고 신뢰도 순으로 정렬
    const allPatterns = [
      ...(results.doubleTop || []),
      ...(results.doubleBottom || [])
    ]
    .sort((a, b) => b.confidence - a.confidence)
    .filter(pattern => pattern.confidence >= 70)  // 신뢰도 70점 이상만
    .slice(0, 5);  // 상위 5개만

    res.json({
      success: true,
      patterns: allPatterns,
      summary: {
        doubleTopCount: (results.doubleTop || []).length,
        doubleBottomCount: (results.doubleBottom || []).length,
        totalCount: allPatterns.length
      }
    });

  } catch (error) {
    console.error('패턴 분석 오류:', error);
    res.status(500).json({ 
      error: '패턴 분석 중 오류가 발생했습니다.',
      details: error.message 
    });
  }
});

module.exports = router;