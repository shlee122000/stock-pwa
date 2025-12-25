const express = require('express');
const router = express.Router();
const { recommendStocks, optimizePortfolio } = require('../api/optimizer');

/**
 * 포트폴리오 최적화 API
 * POST /api/optimizer/optimize
 */
router.post('/optimize', async (req, res) => {
  try {
    const { market, stockCount, mode, selectedStocks } = req.body;
    
    console.log('최적화 요청:', { market, stockCount, mode, selectedStocks });
    
    // 입력 검증
    if (!market || !stockCount) {
      return res.json({ 
        success: false, 
        message: '시장과 종목 개수를 선택해주세요.' 
      });
    }
    
    if (stockCount < 3 || stockCount > 20) {
      return res.json({ 
        success: false, 
        message: '종목 개수는 3-20개 사이여야 합니다.' 
      });
    }
    
    let stocks;
    
    // 모드에 따라 종목 선택
    if (mode === 'manual' && selectedStocks && selectedStocks.length > 0) {
      // 직접 선택 모드
      stocks = selectedStocks;
      console.log('직접 선택 모드:', stocks.length + '개 종목');
    } else {
      // AI 자동 추천 모드
      stocks = await recommendStocks(market, stockCount);
      console.log('AI 자동 추천:', stocks.length + '개 종목');
    }
    
    if (!stocks || stocks.length === 0) {
      return res.json({ 
        success: false, 
        message: '종목을 찾을 수 없습니다.' 
      });
    }
    
    // 포트폴리오 최적화
    const optimizationResult = await optimizePortfolio(stocks);
    
    res.json({
      success: true,
      data: optimizationResult
    });
    
  } catch (error) {
    console.error('최적화 API 오류:', error);
    res.json({ 
      success: false, 
      message: '최적화 중 오류가 발생했습니다: ' + error.message 
    });
  }
});


/**
 * 종목 추천만 받기 (선택사항)
 * POST /api/optimizer/recommend
 */
router.post('/recommend', async (req, res) => {
  try {
    const { market, stockCount } = req.body;
    
    const stocks = await recommendStocks(market, stockCount);
    
    res.json({
      success: true,
      data: stocks
    });
    
  } catch (error) {
    console.error('추천 API 오류:', error);
    res.json({ 
      success: false, 
      message: '종목 추천 중 오류가 발생했습니다.' 
    });
  }
});

module.exports = router;