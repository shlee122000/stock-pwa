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


// 시장 스캐너 - 매수/매도 신호 종목 찾기
router.get('/scanner', async (req, res) => {
  try {
    const { market = 'korea', limit = 50 } = req.query;
    
    console.log('시장 스캐너 시작:', market, limit);
    
    // 1. 시가총액 상위 종목 가져오기
    let stocks = [];
    if (market === 'korea') {
      const response = await naverFinance.getMarketCapRanking(0); // 대형주
      stocks = response.slice(0, parseInt(limit));
    }
    
    // 2. 각 종목 분석
    const buySignals = [];
    const sellSignals = [];
    
    for (const stock of stocks) {
      try {
        const chartData = await naverFinance.getChartData(stock.code, 'day');
        if (!chartData || chartData.length < 20) continue;
        
        const analysis = technical.analyze(chartData);
        
        const stockInfo = {
          code: stock.code,
          name: stock.name,
          price: stock.price,
          rsi: analysis.rsi,
          macd: analysis.macd,
          signal: analysis.signal,
          reasons: []
        };
        
        // 매수 신호 체크
        if (analysis.rsi && analysis.rsi < 30) {
          stockInfo.reasons.push('RSI 과매도 (' + analysis.rsi.toFixed(1) + ')');
        }
        if (analysis.macd && analysis.signal && analysis.macd > analysis.signal && analysis.macd < 0) {
          stockInfo.reasons.push('MACD 골든크로스');
        }
        
        // 매도 신호 체크
        let sellReasons = [];
        if (analysis.rsi && analysis.rsi > 70) {
          sellReasons.push('RSI 과매수 (' + analysis.rsi.toFixed(1) + ')');
        }
        if (analysis.macd && analysis.signal && analysis.macd < analysis.signal && analysis.macd > 0) {
          sellReasons.push('MACD 데드크로스');
        }
        
        if (stockInfo.reasons.length > 0) {
          buySignals.push(stockInfo);
        }
        if (sellReasons.length > 0) {
          stockInfo.reasons = sellReasons;
          sellSignals.push({...stockInfo, reasons: sellReasons});
        }
        
      } catch (err) {
        console.log('종목 분석 스킵:', stock.code, err.message);
      }
    }
    
    console.log('스캐너 완료 - 매수:', buySignals.length, '매도:', sellSignals.length);
    
    res.json({
      success: true,
      data: {
        buySignals: buySignals.slice(0, 10),
        sellSignals: sellSignals.slice(0, 10),
        scannedCount: stocks.length,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('시장 스캐너 오류:', error);
    res.json({ success: false, error: error.message });
  }
});



module.exports = router;


