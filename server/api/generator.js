/**
 * 매매 신호 생성 모듈
 */

const technical = require('./technical');
const naverFinance = require('./naverFinance');

/**
 * 기본적 분석 점수
 */
function calculateFundamentalScore(stockData) {
  let score = 50;
  const reasons = [];

  const per = parseFloat(stockData.per);
  if (!isNaN(per) && per > 0) {
    if (per < 10) {
      score += 15;
      reasons.push('PER ' + per + '배로 저평가 구간');
    } else if (per < 20) {
      score += 5;
      reasons.push('PER ' + per + '배로 적정 수준');
    } else if (per < 30) {
      score -= 5;
      reasons.push('PER ' + per + '배로 다소 고평가');
    } else {
      score -= 10;
      reasons.push('PER ' + per + '배로 고평가 구간');
    }
  }

  const pbr = parseFloat(stockData.pbr);
  if (!isNaN(pbr) && pbr > 0) {
    if (pbr < 1) {
      score += 15;
      reasons.push('PBR ' + pbr + '배로 자산가치 대비 저평가');
    } else if (pbr < 2) {
      score += 5;
      reasons.push('PBR ' + pbr + '배로 적정 수준');
    } else {
      score -= 5;
      reasons.push('PBR ' + pbr + '배로 고평가');
    }
  }

  score = Math.max(0, Math.min(100, score));
  return { score: score, reasons: reasons };
}

/**
 * 매매 신호 생성
 */
async function generate(stockCode) {
  try {
    // 종목 정보 조회
    const stockData = await naverFinance.getStockData(stockCode);
    
    // 차트 데이터 조회
    const chartData = await naverFinance.getChartData(stockCode, 'day');
    
    // 기술적 분석
    const technicalAnalysis = technical.analyze(chartData);
    
    // 기본적 분석
    const fundamentalAnalysis = calculateFundamentalScore(stockData);

    // 종합 점수 (기술적 60%, 기본적 40%)
    const compositeScore = 
      technicalAnalysis.technicalScore * 0.6 + 
      fundamentalAnalysis.score * 0.4;

    // 신호 결정
    let signal;
    let confidence;
    
    if (compositeScore >= 75) {
      signal = 'STRONG_BUY';
      confidence = Math.min(95, compositeScore);
    } else if (compositeScore >= 60) {
      signal = 'BUY';
      confidence = compositeScore;
    } else if (compositeScore >= 40) {
      signal = 'HOLD';
      confidence = 100 - Math.abs(compositeScore - 50) * 2;
    } else if (compositeScore >= 25) {
      signal = 'SELL';
      confidence = 100 - compositeScore;
    } else {
      signal = 'STRONG_SELL';
      confidence = Math.min(95, 100 - compositeScore);
    }

    // 손절/목표가
    const riskLevels = technical.calculateRiskLevels(
      technicalAnalysis.currentPrice,
      technicalAnalysis.atr
    );

    // 판단 근거
    const reasons = [];
    reasons.push.apply(reasons, technicalAnalysis.signals.slice(0, 3));
    reasons.push.apply(reasons, fundamentalAnalysis.reasons.slice(0, 2));
    
    if (signal === 'STRONG_BUY' || signal === 'BUY') {
      reasons.push('권장 손절가: ' + riskLevels.stopLoss.toLocaleString() + '원');
      reasons.push('1차 목표가: ' + riskLevels.target1.toLocaleString() + '원');
    }

    return {
      stockCode: stockCode,
      stockName: stockData.name,
      currentPrice: technicalAnalysis.currentPrice,
      signal: signal,
      confidence: Math.round(confidence * 10) / 10,
      technicalScore: Math.round(technicalAnalysis.technicalScore * 10) / 10,
      fundamentalScore: Math.round(fundamentalAnalysis.score * 10) / 10,
      compositeScore: Math.round(compositeScore * 10) / 10,
      stopLoss: riskLevels.stopLoss,
      targetPrice: riskLevels.target1,
      target2: riskLevels.target2,
      target3: riskLevels.target3,
      reasons: reasons,
      generatedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('신호 생성 오류:', error);
    throw new Error('매매 신호 생성 실패: ' + error.message);
  }
}


/**
 * 매수/매도점 추천
 */
async function getTradeRecommendation(stockCode) {
  try {
    const naverFinance = require('../api/naverFinance');
    const { RSI, MACD, BollingerBands, SMA } = require('technicalindicators');
    
    // 차트 데이터 가져오기 (60일)
    const chartData = await naverFinance.getChartData(stockCode, 'day');
    
    if (!chartData || chartData.length < 30) {
      throw new Error('차트 데이터 부족');
    }
    
    const closes = chartData.map(d => d.close);
    const highs = chartData.map(d => d.high);
    const lows = chartData.map(d => d.low);
    const currentPrice = closes[closes.length - 1];
    
    // 이동평균선 계산
    const ma5 = SMA.calculate({ period: 5, values: closes });
    const ma20 = SMA.calculate({ period: 20, values: closes });
    const ma60 = SMA.calculate({ period: 60, values: closes });
    
    // 볼린저 밴드 계산
    const bb = BollingerBands.calculate({
      period: 20,
      values: closes,
      stdDev: 2
    });
    
    // RSI 계산
    const rsiValues = RSI.calculate({ period: 14, values: closes });
    const currentRsi = rsiValues[rsiValues.length - 1];
    
    // 최근 20일 고가/저가
    const recent20High = Math.max(...highs.slice(-20));
    const recent20Low = Math.min(...lows.slice(-20));
    
    // 최근 60일 고가/저가
    const recent60High = Math.max(...highs.slice(-60));
    const recent60Low = Math.min(...lows.slice(-60));
    
    // 볼린저 밴드 현재값
    const currentBB = bb[bb.length - 1];
    
    // === 매수점 계산 ===
    let buyPrice = 0;
    let buyReasons = [];
    
    // 1. 볼린저 밴드 하단 근처
    if (currentBB) {
      buyPrice = Math.round(currentBB.lower);
      buyReasons.push('볼린저밴드 하단: ' + buyPrice.toLocaleString() + '원');
    }
    
    // 2. 20일 저가 근처
    const support20 = Math.round(recent20Low * 0.99);
    buyReasons.push('20일 지지선: ' + support20.toLocaleString() + '원');
    
    // 3. 60일 이동평균선
    if (ma60.length > 0) {
      const ma60Value = Math.round(ma60[ma60.length - 1]);
      buyReasons.push('60일 이평선: ' + ma60Value.toLocaleString() + '원');
    }
    
    // 매수 추천가 (볼린저 하단과 20일 저가 중 높은 값)
    buyPrice = Math.max(buyPrice, support20);
    
    // === 매도점 (목표가) 계산 ===
    let targetPrice = 0;
    let targetReasons = [];
    
    // 1. 볼린저 밴드 상단
    if (currentBB) {
      targetPrice = Math.round(currentBB.upper);
      targetReasons.push('볼린저밴드 상단: ' + targetPrice.toLocaleString() + '원');
    }
    
    // 2. 20일 고가
    const resistance20 = Math.round(recent20High * 1.01);
    targetReasons.push('20일 저항선: ' + resistance20.toLocaleString() + '원');
    
    // 3. 60일 고가
    targetReasons.push('60일 고가: ' + recent60High.toLocaleString() + '원');
    
    // 목표가 (볼린저 상단과 20일 고가 중 낮은 값 - 보수적)
    targetPrice = Math.min(targetPrice || resistance20, resistance20);
    
    // === 손절가 계산 ===
    const stopLossPrice = Math.round(buyPrice * 0.95); // 매수가 대비 -5%
    
    // === 예상 수익률 계산 ===
    const expectedReturn = ((targetPrice - currentPrice) / currentPrice * 100).toFixed(2);
    const riskReturn = ((currentPrice - stopLossPrice) / currentPrice * 100).toFixed(2);
    const riskRewardRatio = (Math.abs(expectedReturn) / Math.abs(riskReturn)).toFixed(2);
    
    // === 매수 타이밍 판단 ===
    let timing = 'WAIT';
    let timingReasons = [];
    
    // RSI 기반
    if (currentRsi < 30) {
      timing = 'BUY';
      timingReasons.push('RSI 과매도 구간 (' + currentRsi.toFixed(1) + ')');
    } else if (currentRsi > 70) {
      timing = 'SELL';
      timingReasons.push('RSI 과매수 구간 (' + currentRsi.toFixed(1) + ')');
    }
    
    // 볼린저밴드 기반
    if (currentBB && currentPrice <= currentBB.lower * 1.02) {
      timing = 'BUY';
      timingReasons.push('볼린저밴드 하단 근접');
    } else if (currentBB && currentPrice >= currentBB.upper * 0.98) {
      timing = 'SELL';
      timingReasons.push('볼린저밴드 상단 근접');
    }
    
    // 이동평균선 배열 (골든크로스/데드크로스)
    if (ma5.length > 1 && ma20.length > 1) {
      const ma5Current = ma5[ma5.length - 1];
      const ma5Prev = ma5[ma5.length - 2];
      const ma20Current = ma20[ma20.length - 1];
      const ma20Prev = ma20[ma20.length - 2];
      
      if (ma5Prev < ma20Prev && ma5Current > ma20Current) {
        timing = 'BUY';
        timingReasons.push('골든크로스 발생');
      } else if (ma5Prev > ma20Prev && ma5Current < ma20Current) {
        timing = 'SELL';
        timingReasons.push('데드크로스 발생');
      }
    }
    
    if (timingReasons.length === 0) {
      timingReasons.push('관망 추천 (명확한 신호 없음)');
    }
    
    return {
      currentPrice: currentPrice,
      buyPrice: buyPrice,
      targetPrice: targetPrice,
      stopLossPrice: stopLossPrice,
      expectedReturn: parseFloat(expectedReturn),
      riskReturn: parseFloat(riskReturn),
      riskRewardRatio: parseFloat(riskRewardRatio),
      timing: timing,
      timingReasons: timingReasons,
      buyReasons: buyReasons,
      targetReasons: targetReasons,
      rsi: currentRsi,
      bollingerBand: currentBB ? {
        upper: Math.round(currentBB.upper),
        middle: Math.round(currentBB.middle),
        lower: Math.round(currentBB.lower)
      } : null
    };
    
  } catch (error) {
    console.error('매수/매도점 추천 오류:', error);
    throw error;
  }
}

module.exports = {
  generate: generate,
  getTradeRecommendation: getTradeRecommendation
};
