/**
 * 기술적 분석 모듈
 */

/**
 * RSI 계산
 */
function calculateRSI(prices, period) {
  if (prices.length < period + 1) return null;
  
  let gains = 0;
  let losses = 0;
  
  for (let i = 1; i <= period; i++) {
    const change = prices[i] - prices[i - 1];
    if (change >= 0) {
      gains += change;
    } else {
      losses -= change;
    }
  }
  
  let avgGain = gains / period;
  let avgLoss = losses / period;
  
  for (let i = period + 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    if (change >= 0) {
      avgGain = (avgGain * (period - 1) + change) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) - change) / period;
    }
  }
  
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

/**
 * 이동평균 계산
 */
function calculateSMA(prices, period) {
  if (prices.length < period) return null;
  const slice = prices.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

/**
 * MACD 계산
 */
function calculateMACD(prices) {
  if (prices.length < 26) return { macd: 0, signal: 0, histogram: 0 };
  
  // EMA 계산 함수
  function ema(data, period) {
    const k = 2 / (period + 1);
    let emaVal = data[0];
    for (let i = 1; i < data.length; i++) {
      emaVal = data[i] * k + emaVal * (1 - k);
    }
    return emaVal;
  }
  
  const ema12 = ema(prices, 12);
  const ema26 = ema(prices, 26);
  const macdLine = ema12 - ema26;
  
  return {
    macd: macdLine,
    signal: macdLine * 0.8,
    histogram: macdLine * 0.2
  };
}

/**
 * 종합 기술적 분석
 */
function analyze(chartData) {
  if (!chartData || chartData.length < 60) {
    throw new Error('분석을 위해 최소 60일 이상의 데이터가 필요합니다.');
  }

  const closes = chartData.map(d => d.close);
  const volumes = chartData.map(d => d.volume);
  
  const currentPrice = closes[closes.length - 1];
  const prevClose = closes[closes.length - 2];
  
  // 지표 계산
  const rsi = calculateRSI(closes, 14);
  const macdData = calculateMACD(closes);
  const ma20 = calculateSMA(closes, 20);
  const ma60 = calculateSMA(closes, 60);
  
  // 평균 거래량
  const avgVolume = calculateSMA(volumes, 20);
  const currentVolume = volumes[volumes.length - 1];
  const volumeRatio = avgVolume > 0 ? currentVolume / avgVolume : 1;

  // 신호 분석
  const signals = [];
  let technicalScore = 50;

  // RSI 분석
  if (rsi !== null) {
    if (rsi < 30) {
      signals.push('RSI 과매도 구간 (매수 신호)');
      technicalScore += 15;
    } else if (rsi > 70) {
      signals.push('RSI 과매수 구간 (매도 신호)');
      technicalScore -= 15;
    } else if (rsi < 40) {
      signals.push('RSI 매수 관심 구간');
      technicalScore += 5;
    } else if (rsi > 60) {
      signals.push('RSI 매도 관심 구간');
      technicalScore -= 5;
    }
  }

  // MACD 분석
  if (macdData.macd > macdData.signal) {
    signals.push('MACD 상승 신호');
    technicalScore += 10;
  } else {
    signals.push('MACD 하락 신호');
    technicalScore -= 10;
  }

  // 이동평균선 분석
  if (ma20 && ma60) {
    if (currentPrice > ma20 && ma20 > ma60) {
      signals.push('정배열 상태 (상승 추세)');
      technicalScore += 10;
    } else if (currentPrice < ma20 && ma20 < ma60) {
      signals.push('역배열 상태 (하락 추세)');
      technicalScore -= 10;
    }

    if (currentPrice > ma20) {
      signals.push('20일 이동평균선 위에서 거래 중');
      technicalScore += 5;
    } else {
      signals.push('20일 이동평균선 아래에서 거래 중');
      technicalScore -= 5;
    }
  }

  // 거래량 분석
  if (volumeRatio > 2) {
    signals.push('거래량 급증 (평균 대비 ' + Math.round(volumeRatio * 100) + '%)');
    if (currentPrice > prevClose) {
      technicalScore += 5;
    } else {
      technicalScore -= 5;
    }
  }

  // 점수 범위 제한
  technicalScore = Math.max(0, Math.min(100, technicalScore));

  // ATR 대략 계산 (간단 버전)
  const atr = currentPrice * 0.02;

  return {
    stockCode: chartData[0].code || '',
    currentPrice: currentPrice,
    change: currentPrice - prevClose,
    changeRate: ((currentPrice - prevClose) / prevClose * 100).toFixed(2),
    rsi: rsi,
    macd: macdData.macd,
    macdSignal: macdData.signal,
    macdHistogram: macdData.histogram,
    ma20: ma20,
    ma60: ma60,
    volume: currentVolume,
    avgVolume: avgVolume,
    volumeRatio: volumeRatio,
    atr: atr,
    technicalScore: technicalScore,
    signals: signals,
    analysisDate: new Date().toISOString()
  };
}

/**
 * 손절/목표가 계산
 */
function calculateRiskLevels(entryPrice, atr, multiplier) {
  multiplier = multiplier || 2;
  atr = atr || entryPrice * 0.02;
  
  const stopLoss = entryPrice - (atr * multiplier);
  const target1 = entryPrice + (atr * 2);
  const target2 = entryPrice + (atr * 3);
  const target3 = entryPrice + (atr * 5);

  return {
    stopLoss: Math.round(stopLoss),
    target1: Math.round(target1),
    target2: Math.round(target2),
    target3: Math.round(target3),
    riskRewardRatio: 2
  };
}

module.exports = {
  calculateRSI: calculateRSI,
  calculateSMA: calculateSMA,
  calculateMACD: calculateMACD,
  analyze: analyze,
  calculateRiskLevels: calculateRiskLevels
};
