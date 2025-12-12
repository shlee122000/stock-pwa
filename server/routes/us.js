const express = require('express');
const router = express.Router();
const usStock = require('../api/usStock');

// 종목 검색
router.get('/search', async (req, res) => {
  try {
    const { keyword } = req.query;
    const results = await usStock.searchStock(keyword);
    res.json({ success: true, data: results });
  } catch (error) {
    console.error('미국 주식 검색 오류:', error);
    res.json({ success: false, error: error.message });
  }
});

// 시세 조회
router.get('/quote/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const quote = await usStock.getQuote(symbol);
    const profile = await usStock.getCompanyProfile(symbol);
    res.json({ success: true, data: { ...quote, ...profile } });
  } catch (error) {
    console.error('미국 주식 시세 오류:', error);
    res.json({ success: false, error: error.message });
  }
});

// 차트 데이터 조회
router.get('/candles/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const to = Math.floor(Date.now() / 1000);
    const from = to - (365 * 24 * 60 * 60); // 1년
    const data = await usStock.getCandles(symbol, 'D', from, to);
    res.json({ success: true, data: data });
  } catch (error) {
    console.error('미국 주식 차트 오류:', error);
    res.json({ success: false, error: error.message });
  }
});


// 미국 주식 기술적 분석
router.get('/analysis/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const to = Math.floor(Date.now() / 1000);
    const from = to - (365 * 24 * 60 * 60);
    const chartData = await usStock.getCandles(symbol, 'D', from, to);
    
    if (!chartData || chartData.length < 60) {
      return res.json({ success: false, error: '차트 데이터가 부족합니다.' });
    }
    
    const closes = chartData.map(d => d.close);
    const highs = chartData.map(d => d.high);
    const lows = chartData.map(d => d.low);
    const currentPrice = closes[closes.length - 1];
    
    // RSI 계산 (14일)
    let gains = 0, losses = 0;
    for (let i = closes.length - 14; i < closes.length; i++) {
      const change = closes[i] - closes[i - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }
    const avgGain = gains / 14;
    const avgLoss = losses / 14;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));
    
    // 이동평균
    const ma5 = closes.slice(-5).reduce((a, b) => a + b, 0) / 5;
    const ma20 = closes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const ma60 = closes.slice(-60).reduce((a, b) => a + b, 0) / 60;
    
    // MACD (간단화)
    const ema12 = closes.slice(-12).reduce((a, b) => a + b, 0) / 12;
    const ema26 = closes.slice(-26).reduce((a, b) => a + b, 0) / 26;
    const macdLine = ema12 - ema26;
    const signalLine = macdLine * 0.8;
    const histogram = macdLine - signalLine;
    
    // ATR 계산
    let trSum = 0;
    for (let i = closes.length - 14; i < closes.length; i++) {
      const tr = Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      );
      trSum += tr;
    }
    const atr = trSum / 14;
    
    // 기술적 점수 계산
    let score = 50;
    if (rsi < 30) score += 20;
    else if (rsi < 40) score += 10;
    else if (rsi > 70) score -= 20;
    else if (rsi > 60) score -= 10;
    
    if (currentPrice > ma20) score += 10;
    if (currentPrice > ma60) score += 10;
    if (ma5 > ma20) score += 10;
    if (histogram > 0) score += 10;
    
    score = Math.max(0, Math.min(100, score));
    
    // 신호 결정
    let signal = 'HOLD';
    if (score >= 80) signal = 'STRONG_BUY';
    else if (score >= 60) signal = 'BUY';
    else if (score <= 20) signal = 'STRONG_SELL';
    else if (score <= 40) signal = 'SELL';
    
    // 목표가/손절가
    const targetPrice = currentPrice + (atr * 2);
    const stopLoss = currentPrice - atr;
    
    res.json({
      success: true,
      data: {
        symbol,
        currentPrice,
        rsi,
        ma5,
        ma20,
        ma60,
        macd: { macd: macdLine, signal: signalLine, histogram },
        atr,
        technicalScore: score,
        signal,
        targetPrice,
        stopLoss
      }
    });
    
  } catch (error) {
    console.error('미국 주식 분석 오류:', error);
    res.json({ success: false, error: error.message });
  }
});

module.exports = router;
