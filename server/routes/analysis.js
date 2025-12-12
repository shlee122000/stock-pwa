const express = require('express');
const router = express.Router();
const naverFinance = require('../api/naverFinance');
const technical = require('../api/technical');
const generator = require('../api/generator');

// 기술적 분석
router.get('/technical/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const chartData = await naverFinance.getChartData(code, 'day');
    const stockData = await naverFinance.getStockData(code);
    const analysis = technical.analyze(chartData);
    
    res.json({ 
      success: true, 
      data: {
        ...analysis,
        stockName: stockData.name,
        stockCode: code
      }
    });
  } catch (error) {
    console.error('기술적 분석 오류:', error);
    res.json({ success: false, error: error.message });
  }
});

// 매매 신호 생성
router.get('/signal/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const signal = await generator.generate(code);
    res.json({ success: true, data: signal });
  } catch (error) {
    console.error('매매 신호 오류:', error);
    res.json({ success: false, error: error.message });
  }
});

// 매수/매도점 추천
router.get('/recommendation/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const recommendation = await generator.getTradeRecommendation(code);
    res.json({ success: true, data: recommendation });
  } catch (error) {
    console.error('매매점 추천 오류:', error);
    res.json({ success: false, error: error.message });
  }
});

module.exports = router;