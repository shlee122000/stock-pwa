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



// 백테스팅 API
router.post('/backtest', async (req, res) => {
  try {
    const { code, period = '3m', strategy = 'rsi', initialCapital = 10000000 } = req.body;
    
    console.log('백테스팅 시작:', code, period, strategy);
    
    // 1. 차트 데이터 가져오기
    const chartData = await naverFinance.getChartData(code, 'day');
    const stockData = await naverFinance.getStockData(code);
    
    if (!chartData || chartData.length < 50) {
      return res.json({ success: false, error: '데이터가 부족합니다.' });
    }
    
    // 2. 기간에 따라 데이터 필터링 (분석용 60일 + 테스트 기간)
    let dataLength = chartData.length;
    switch(period) {
      case '1m': dataLength = Math.min(82, chartData.length); break;   // 60 + 22
      case '3m': dataLength = Math.min(126, chartData.length); break;  // 60 + 66
      case '6m': dataLength = Math.min(192, chartData.length); break;  // 60 + 132
      case '1y': dataLength = Math.min(312, chartData.length); break;  // 60 + 252
    }
    
    const testData = chartData.slice(-dataLength);
    
    // 3. 백테스팅 실행
    const trades = [];
    let position = null; // { type: 'buy', price, date, quantity }
    let capital = initialCapital;
    let shares = 0;
    
    for (let i = 60; i < testData.length; i++) {
      const currentData = testData.slice(0, i + 1);
      const analysis = technical.analyze(currentData);
      const currentPrice = testData[i].close;
      const currentDate = testData[i].date;
      
      // 전략에 따른 매수/매도 신호
      let buySignal = false;
      let sellSignal = false;
      
      if (strategy === 'rsi') {
        buySignal = analysis.rsi && analysis.rsi < 30;
        sellSignal = analysis.rsi && analysis.rsi > 70;
      } else if (strategy === 'macd') {
        buySignal = analysis.macd && analysis.signal && analysis.macd > analysis.signal && analysis.macdHistogram > 0;
        sellSignal = analysis.macd && analysis.signal && analysis.macd < analysis.signal && analysis.macdHistogram < 0;
      } else if (strategy === 'golden') {
        buySignal = analysis.ma5 && analysis.ma20 && analysis.ma5 > analysis.ma20;
        sellSignal = analysis.ma5 && analysis.ma20 && analysis.ma5 < analysis.ma20;
      } else if (strategy === 'combined') {
        buySignal = (analysis.rsi && analysis.rsi < 35) || 
                    (analysis.macd && analysis.signal && analysis.macd > analysis.signal);
        sellSignal = (analysis.rsi && analysis.rsi > 65) || 
                     (analysis.macd && analysis.signal && analysis.macd < analysis.signal);
      }
      
      // 매수 실행
      if (buySignal && !position && capital > 0) {
        shares = Math.floor(capital / currentPrice);
        if (shares > 0) {
          position = { type: 'buy', price: currentPrice, date: currentDate, quantity: shares };
          capital = capital - (shares * currentPrice);
          trades.push({
            type: 'buy',
            date: currentDate,
            price: currentPrice,
            quantity: shares,
            reason: strategy === 'rsi' ? 'RSI ' + analysis.rsi.toFixed(1) : 
                    strategy === 'macd' ? 'MACD 골든크로스' : 
                    strategy === 'golden' ? '이평선 골든크로스' : '복합 신호'
          });
        }
      }
      
      // 매도 실행
      if (sellSignal && position) {
        const profit = (currentPrice - position.price) * shares;
        capital = capital + (shares * currentPrice);
        trades.push({
          type: 'sell',
          date: currentDate,
          price: currentPrice,
          quantity: shares,
          profit: profit,
          profitRate: ((currentPrice - position.price) / position.price * 100).toFixed(2),
          reason: strategy === 'rsi' ? 'RSI ' + analysis.rsi.toFixed(1) : 
                  strategy === 'macd' ? 'MACD 데드크로스' : 
                  strategy === 'golden' ? '이평선 데드크로스' : '복합 신호'
        });
        position = null;
        shares = 0;
      }
    }
    
    // 4. 마지막 포지션 정리 (현재가 기준)
    const lastPrice = testData[testData.length - 1].close;
    if (position) {
      capital = capital + (shares * lastPrice);
    }
    
    // 5. 결과 계산
    const totalReturn = capital - initialCapital;
    const totalReturnRate = (totalReturn / initialCapital * 100).toFixed(2);
    const winTrades = trades.filter(t => t.type === 'sell' && t.profit > 0).length;
    const loseTrades = trades.filter(t => t.type === 'sell' && t.profit <= 0).length;
    const totalTrades = trades.filter(t => t.type === 'sell').length;
    const winRate = totalTrades > 0 ? (winTrades / totalTrades * 100).toFixed(1) : 0;
    
    // 바이앤홀드 수익률 계산
    const startPrice = testData[0].close;
    const endPrice = testData[testData.length - 1].close;
    const buyHoldReturn = ((endPrice - startPrice) / startPrice * 100).toFixed(2);
    
    console.log('백테스팅 완료 - 수익률:', totalReturnRate + '%');
    
    res.json({
      success: true,
      data: {
        stockName: stockData.name,
        stockCode: code,
        period: period,
        strategy: strategy,
        initialCapital: initialCapital,
        finalCapital: Math.round(capital),
        totalReturn: Math.round(totalReturn),
        totalReturnRate: parseFloat(totalReturnRate),
        buyHoldReturn: parseFloat(buyHoldReturn),
        totalTrades: totalTrades,
        winTrades: winTrades,
        loseTrades: loseTrades,
        winRate: parseFloat(winRate),
        trades: trades,
        startDate: testData[0].date,
        endDate: testData[testData.length - 1].date
      }
    });
    
  } catch (error) {
    console.error('백테스팅 오류:', error);
    res.json({ success: false, error: error.message });
  }
});


module.exports = router;


