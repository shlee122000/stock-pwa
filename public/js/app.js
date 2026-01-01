// ========== 카카오 SDK 초기화 ==========
const KAKAO_JS_KEY = '0b0ac974f6bfe8e8a63ee07356db143c';
const KAKAO_REDIRECT_URI = 'https://stock-pwa.vercel.app/oauth';

// 카카오 SDK 초기화
function initKakao() {
    if (typeof Kakao !== 'undefined' && !Kakao.isInitialized()) {
        Kakao.init(KAKAO_JS_KEY);
        console.log('카카오 SDK 초기화 완료:', Kakao.isInitialized());
    }
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
    initKakao();
    checkKakaoLoginStatus();
});


// API 기본 URL
const API_BASE = '';

// 포트폴리오 최적화 설정 (전역)
var optimizerSettings = {
  stockCount: 10,
  market: 'korea',
  mode: 'auto',
  selectedStocks: [],
  totalInvestment: 1000
};

// 종목코드 찾기 (이름 또는 코드 입력 가능)
async function findStockCode(input) {
  // 이미 6자리 숫자면 그대로 반환
  if (/^\d{6}$/.test(input)) {
    return input;
  }
  
  // 종목명으로 검색
  var result = await apiCall('/api/korea/search?keyword=' + encodeURIComponent(input));
  
  if (result.success && result.data && result.data.length > 0) {
    // 정확히 일치하는 것 찾기
    var exact = result.data.find(function(stock) {
      return stock.name === input;
    });
    
    if (exact) {
      return exact.code;
    }
    
    // 첫 번째 결과 반환
    return result.data[0].code;
  }
  
  return null;
}

// 차트 변수
let stockChart = null;
let usStockChart = null;
let tvStockChart = null;  // TradingView 차트 (한국)
let tvUsStockChart = null;  // TradingView 차트 (미국)

// 지표 표시 설정
var indicatorSettings = {
  ma: true,
  bb: true,
  ichimoku: false,
  volume: true
};

// 지표 토글 함수
function toggleIndicator(indicator) {
  indicatorSettings[indicator] = !indicatorSettings[indicator];
  
  // 버튼 스타일 업데이트
  var btn = document.querySelector('[data-indicator="' + indicator + '"]');
  if (btn) {
    if (indicatorSettings[indicator]) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  }
  
  // 차트 다시 그리기
  var stockCode = document.getElementById('analysis-stock-code').value;
  if (stockCode) {
    drawStockChart(stockCode);
  }
}



// 관심 종목
let watchlist = JSON.parse(localStorage.getItem('watchlist')) || [];
let usWatchlist = JSON.parse(localStorage.getItem('usWatchlist')) || [];

// 미국 주식 선택
let selectedUsStock = null;

// 현재 선택된 한국 종목
let selectedKoreaStock = null;

// 포트폴리오
let portfolio = JSON.parse(localStorage.getItem('portfolio')) || [];

// 알림 목록
let alertList = JSON.parse(localStorage.getItem('alertList')) || [];
let monitorInterval = null;

// 미국 포트폴리오
let usPortfolio = JSON.parse(localStorage.getItem('usPortfolio')) || [];
let usAlertList = JSON.parse(localStorage.getItem('usAlertList')) || [];


// 미국 주식 지표 설정
var usIndicatorSettings = {
  ma: true,
  bb: true,
  ichimoku: false,
  volume: true
};

// 미국 주식 지표 토글 함수
function toggleUsIndicator(indicator) {
  usIndicatorSettings[indicator] = !usIndicatorSettings[indicator];
  
  // 버튼 스타일 업데이트
  var btn = document.querySelector('[data-indicator="us-' + indicator + '"]');
  if (btn) {
    if (usIndicatorSettings[indicator]) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  }
  
  // 차트 다시 그리기
  if (selectedUsStock && selectedUsStock.symbol) {
    drawUsStockChart(selectedUsStock.symbol);
  }
}


// 현재 선택된 시간대
var currentTimeframe = 'daily';

// 시간대 변경 함수
function changeTimeframe(timeframe) {
  currentTimeframe = timeframe;
  
  // 버튼 스타일 업데이트
  document.querySelectorAll('.timeframe-btn').forEach(function(btn) {
    btn.classList.remove('active');
  });
  var activeBtn = document.querySelector('[data-timeframe="' + timeframe + '"]');
  if (activeBtn) {
    activeBtn.classList.add('active');
  }
  
  // 차트 다시 그리기
  var stockCode = document.getElementById('analysis-stock-code').value;
  if (stockCode) {
    drawStockChart(stockCode);
  }
}


// 미국 주식 현재 선택된 시간대
var currentUsTimeframe = 'daily';

function changeUsTimeframe(timeframe) {
  currentUsTimeframe = timeframe;
  
  // 버튼 스타일 업데이트
  document.querySelectorAll('.us-timeframe-btn').forEach(function(btn) {
    btn.classList.remove('active');
  });
  var activeBtn = document.querySelector('[data-us-timeframe="' + timeframe + '"]');
  if (activeBtn) {
    activeBtn.classList.add('active');
  }
  
  // 차트 다시 그리기
  if (selectedUsStock && selectedUsStock.symbol) {
    drawUsStockChart(selectedUsStock.symbol);
  }
}


// 보조 지표 표시 설정
var subIndicatorSettings = {
  rsi: true,
  macd: true,
  stochastic: true,
  atr: true
};

// 보조 지표 토글 함수
function toggleSubIndicator(indicator) {
  subIndicatorSettings[indicator] = !subIndicatorSettings[indicator];
  
  // 버튼 스타일 업데이트
  var btn = document.querySelector('[data-sub-indicator="' + indicator + '"]');
  if (btn) {
    if (subIndicatorSettings[indicator]) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  }
  
  // 해당 차트 카드 표시/숨김
  var cardId = '';
  if (indicator === 'rsi') cardId = 'rsi-chart';
  else if (indicator === 'macd') cardId = 'macd-chart';
  else if (indicator === 'stochastic') cardId = 'stochastic-chart';
  else if (indicator === 'atr') cardId = 'atr-chart';
  
  var chartElement = document.getElementById(cardId);
  if (chartElement) {
    var card = chartElement.closest('.card');
    if (card) {
      card.style.display = subIndicatorSettings[indicator] ? 'block' : 'none';
    }
  }
}


// 미국 주식 보조 지표 표시 설정
var usSubIndicatorSettings = {
  rsi: true,
  macd: true,
  stochastic: true,
  atr: true
};

// 미국 주식 보조 지표 토글 함수
function toggleUsSubIndicator(indicator) {
  usSubIndicatorSettings[indicator] = !usSubIndicatorSettings[indicator];
  
  // 버튼 스타일 업데이트
  var btn = document.querySelector('[data-us-sub-indicator="' + indicator + '"]');
  if (btn) {
    if (usSubIndicatorSettings[indicator]) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  }
  
  // 해당 차트 카드 표시/숨김
  var cardId = '';
  if (indicator === 'rsi') cardId = 'us-rsi-card';
  else if (indicator === 'macd') cardId = 'us-macd-card';
  else if (indicator === 'stochastic') cardId = 'us-stochastic-card';
  else if (indicator === 'atr') cardId = 'us-atr-card';
  
  var card = document.getElementById(cardId);
  if (card) {
    card.style.display = usSubIndicatorSettings[indicator] ? 'block' : 'none';
  }
}



// 일봉 → 주봉 변환
function convertToWeekly(dailyData) {
  var weeklyData = [];
  var currentWeek = null;
  
  dailyData.forEach(function(day) {
    // 날짜 형식 변환 (YYYYMMDD → YYYY-MM-DD)
    var dateStr = day.date;
    if (dateStr.length === 8 && !dateStr.includes('-')) {
      dateStr = dateStr.substring(0, 4) + '-' + dateStr.substring(4, 6) + '-' + dateStr.substring(6, 8);
    }
    
    var date = new Date(dateStr);
    var weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    var weekKey = weekStart.toISOString().split('T')[0];
    
    if (!currentWeek || currentWeek.weekKey !== weekKey) {
      if (currentWeek) {
        weeklyData.push(currentWeek);
      }
      currentWeek = {
        weekKey: weekKey,
        date: day.date,
        open: day.open,
        high: day.high,
        low: day.low,
        close: day.close,
        volume: day.volume || 0
      };
    } else {
      currentWeek.high = Math.max(currentWeek.high, day.high);
      currentWeek.low = Math.min(currentWeek.low, day.low);
      currentWeek.close = day.close;
      currentWeek.date = day.date;
      currentWeek.volume += (day.volume || 0);
    }
  });
  
  if (currentWeek) {
    weeklyData.push(currentWeek);
  }
  
  return weeklyData;
}


// 일봉 → 월봉 변환
function convertToMonthly(dailyData) {
  var monthlyData = [];
  var currentMonth = null;
  
  dailyData.forEach(function(day) {
    var dateStr = day.date;
    var monthKey = dateStr.substring(0, 6);  // YYYYMM
    
    if (!currentMonth || currentMonth.monthKey !== monthKey) {
      if (currentMonth) {
        monthlyData.push(currentMonth);
      }
      currentMonth = {
        monthKey: monthKey,
        date: day.date,
        open: day.open,
        high: day.high,
        low: day.low,
        close: day.close,
        volume: day.volume || 0
      };
    } else {
      currentMonth.high = Math.max(currentMonth.high, day.high);
      currentMonth.low = Math.min(currentMonth.low, day.low);
      currentMonth.close = day.close;
      currentMonth.date = day.date;
      currentMonth.volume += (day.volume || 0);
    }
  });
  
  if (currentMonth) {
    monthlyData.push(currentMonth);
  }
  
  return monthlyData;
}


// ==================== 차트 패턴 인식 ====================
// 한국 주식 패턴 분석
async function handleKoreaPatternAnalysis() {
  try {
    // 현재 차트 데이터 확인
    if (!window.currentChartData || window.currentChartData.length === 0) {
      alert('먼저 종목을 분석하여 차트를 표시하세요.');
      return;
    }
    
    var patternBtn = document.getElementById('analyzePatternBtn');
    var patternResults = document.getElementById('patternResults');
    var patternList = document.getElementById('patternList');
    
    // 버튼 비활성화
    patternBtn.disabled = true;
    patternBtn.textContent = '🔍 분석 중...';
    
    // API 호출
    var result = await apiCall('/api/patterns/analyze', {
      method: 'POST',
      body: JSON.stringify({
        data: window.currentChartData,
        patterns: ['doubleTop', 'doubleBottom']
      })
    }, false);
    
    if (result.success && result.patterns && result.patterns.length > 0) {
      // 결과 표시
      displayPatternResults(result.patterns, patternList);
      patternResults.style.display = 'block';
    } else {
      patternList.innerHTML = '<p style="color:#666;">신뢰도 55점 이상의 패턴이 발견되지 않았습니다.</p>';
      patternResults.style.display = 'block';
    }
    
  } catch (error) {
    console.error('패턴 분석 오류:', error);
    alert('패턴 분석 중 오류가 발생했습니다.');
  } finally {
    // 버튼 다시 활성화
    var patternBtn = document.getElementById('analyzePatternBtn');
    patternBtn.disabled = false;
    patternBtn.textContent = '🔍 패턴 분석 시작';
  }
}

// 미국 주식 패턴 분석
async function handleUsPatternAnalysis() {
  try {
    // 현재 차트 데이터 확인
    if (!window.currentChartData || window.currentChartData.length === 0) {
      alert('먼저 종목을 검색하여 차트를 표시하세요.');
      return;
    }
    
    var patternBtn = document.getElementById('analyzeUsPatternBtn');
    var patternResults = document.getElementById('usPatternResults');
    var patternList = document.getElementById('usPatternList');
    
    // 버튼 비활성화
    patternBtn.disabled = true;
    patternBtn.textContent = '🔍 분석 중...';
    
    // API 호출
    var result = await apiCall('/api/patterns/analyze', {
      method: 'POST',
      body: JSON.stringify({
        data: window.currentChartData,
        patterns: ['doubleTop', 'doubleBottom']
      })
    }, false);
    
    if (result.success && result.patterns && result.patterns.length > 0) {
      // 결과 표시
      displayPatternResults(result.patterns, patternList);
      patternResults.style.display = 'block';
    } else {
      patternList.innerHTML = '<p style="color:#666;">신뢰도 70점 이상의 패턴이 발견되지 않았습니다.</p>';
      patternResults.style.display = 'block';
    }
    
  } catch (error) {
    console.error('미국 패턴 분석 오류:', error);
    alert('패턴 분석 중 오류가 발생했습니다.');
  } finally {
    // 버튼 다시 활성화
    var patternBtn = document.getElementById('analyzeUsPatternBtn');
    patternBtn.disabled = false;
    patternBtn.textContent = '🔍 패턴 분석 시작';
  }
}

// 패턴 결과 표시
function displayPatternResults(patterns, container) {
  // 안전장치 추가
  if (!patterns || !Array.isArray(patterns) || patterns.length === 0) {
    container.innerHTML = '<p style="color:#666;">패턴 데이터를 표시할 수 없습니다.</p>';
    return;
  }
  
  var html = '';
  
  patterns.forEach(function(pattern) {
    var patternName = pattern.type === 'doubleTop' ? '더블탑 (Double Top)' : '더블바텀 (Double Bottom)';
    var patternIcon = pattern.type === 'doubleTop' ? '📉' : '📈';
    var patternColor = pattern.type === 'doubleTop' ? '#ef4444' : '#10b981';
    
    html += '<div style="margin-bottom: 15px; padding: 15px; border: 2px solid ' + patternColor + '; border-radius: 8px; background: white;">';
    html += '<h4 style="margin: 0 0 10px 0; color: ' + patternColor + ';">' + patternIcon + ' ' + patternName + '</h4>';
    
    html += '<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-top: 10px;">';
    html += '<div><strong>신뢰도:</strong> ' + pattern.confidence + '점</div>';
    html += '<div><strong>목표가:</strong> ' + pattern.targetPrice.toLocaleString() + '원</div>';
    
    if (pattern.type === 'doubleTop') {
      html += '<div><strong>고점1:</strong> ' + pattern.peak1Price.toLocaleString() + '원</div>';
      html += '<div><strong>고점2:</strong> ' + pattern.peak2Price.toLocaleString() + '원</div>';
      html += '<div><strong>중간 저점:</strong> ' + pattern.valleyPrice.toLocaleString() + '원</div>';
    } else {
      html += '<div><strong>저점1:</strong> ' + pattern.bottom1Price.toLocaleString() + '원</div>';
      html += '<div><strong>저점2:</strong> ' + pattern.bottom2Price.toLocaleString() + '원</div>';
      html += '<div><strong>중간 고점:</strong> ' + pattern.peakPrice.toLocaleString() + '원</div>';
    }
    
    html += '</div>';
    
    html += '<p style="margin: 10px 0 0 0; padding: 10px; background: #f0f9ff; border-radius: 4px; font-size: 0.9rem;">';
    if (pattern.type === 'doubleTop') {
      html += '💡 <strong>해석:</strong> 상승 후 두 번의 고점을 형성하고 하락하는 패턴입니다. 매도 신호로 해석됩니다.';
    } else {
      html += '💡 <strong>해석:</strong> 하락 후 두 번의 저점을 형성하고 상승하는 패턴입니다. 매수 신호로 해석됩니다.';
    }
    html += '</p>';
    
    html += '</div>';
  });
  
  container.innerHTML = html;
}


// ==================== 분석 메모 ====================
// 메모 저장
function saveMemo(stockCode) {
  var memo = document.getElementById('analysis-memo').value;
  if (!stockCode) {
    stockCode = document.getElementById('analysis-stock-code').value;
  }
  
  if (!stockCode) {
    alert('종목코드를 먼저 입력하세요.');
    return;
  }
  
  var memos = JSON.parse(localStorage.getItem('stockMemos')) || {};
  memos[stockCode] = {
    text: memo,
    date: new Date().toLocaleString('ko-KR')
  };
  localStorage.setItem('stockMemos', JSON.stringify(memos));
  
  document.getElementById('memo-status').innerHTML = 
    '<span style="color:#10b981;">✅ 메모가 저장되었습니다. (' + memos[stockCode].date + ')</span>';
}

// 메모 불러오기
function loadMemo(stockCode) {
  var memos = JSON.parse(localStorage.getItem('stockMemos')) || {};
  var memoArea = document.getElementById('analysis-memo');
  var statusArea = document.getElementById('memo-status');
  
  if (memos[stockCode]) {
    memoArea.value = memos[stockCode].text;
    statusArea.innerHTML = 
      '<span style="color:#3b82f6;">📅 마지막 저장: ' + memos[stockCode].date + '</span>';
  } else {
    memoArea.value = '';
    statusArea.innerHTML = '<span style="color:#999;">저장된 메모가 없습니다.</span>';
  }
}

// 메모 삭제
function deleteMemo(stockCode) {
  if (!stockCode) {
    stockCode = document.getElementById('analysis-stock-code').value;
  }
  
  if (!stockCode) {
    alert('종목코드를 먼저 입력하세요.');
    return;
  }
  
  if (!confirm('이 종목의 메모를 삭제하시겠습니까?')) {
    return;
  }
  
  var memos = JSON.parse(localStorage.getItem('stockMemos')) || {};
  delete memos[stockCode];
  localStorage.setItem('stockMemos', JSON.stringify(memos));
  
  document.getElementById('analysis-memo').value = '';
  document.getElementById('memo-status').innerHTML = 
    '<span style="color:#ef4444;">🗑️ 메모가 삭제되었습니다.</span>';
}


// ==================== 미국 주식 분석 메모 ====================
// 미국 주식 메모 저장
function saveUsMemo(symbol) {
  var memo = document.getElementById('us-analysis-memo').value;
  if (!symbol && selectedUsStock) {
    symbol = selectedUsStock.symbol;
  }
  
  if (!symbol) {
    alert('종목을 먼저 검색하세요.');
    return;
  }
  
  var memos = JSON.parse(localStorage.getItem('usStockMemos')) || {};
  memos[symbol] = {
    text: memo,
    date: new Date().toLocaleString('ko-KR')
  };
  localStorage.setItem('usStockMemos', JSON.stringify(memos));
  
  document.getElementById('us-memo-status').innerHTML = 
    '<span style="color:#10b981;">✅ 메모가 저장되었습니다. (' + memos[symbol].date + ')</span>';
}

// 미국 주식 메모 불러오기
function loadUsMemo(symbol) {
  var memos = JSON.parse(localStorage.getItem('usStockMemos')) || {};
  var memoArea = document.getElementById('us-analysis-memo');
  var statusArea = document.getElementById('us-memo-status');
  var memoCard = document.getElementById('us-memo-card');
  
  if (memoCard) {
    memoCard.style.display = 'block';
  }
  
  if (memos[symbol]) {
    memoArea.value = memos[symbol].text;
    statusArea.innerHTML = 
      '<span style="color:#3b82f6;">📅 마지막 저장: ' + memos[symbol].date + '</span>';
  } else {
    memoArea.value = '';
    statusArea.innerHTML = '<span style="color:#999;">저장된 메모가 없습니다.</span>';
  }
}

// 미국 주식 메모 삭제
function deleteUsMemo(symbol) {
  if (!symbol && selectedUsStock) {
    symbol = selectedUsStock.symbol;
  }
  
  if (!symbol) {
    alert('종목을 먼저 검색하세요.');
    return;
  }
  
  if (!confirm('이 종목의 메모를 삭제하시겠습니까?')) {
    return;
  }
  
  var memos = JSON.parse(localStorage.getItem('usStockMemos')) || {};
  delete memos[symbol];
  localStorage.setItem('usStockMemos', JSON.stringify(memos));
  
  document.getElementById('us-analysis-memo').value = '';
  document.getElementById('us-memo-status').innerHTML = 
    '<span style="color:#ef4444;">🗑️ 메모가 삭제되었습니다.</span>';
}


// 이동평균선 계산 함수
function calculateMA(data, period) {
  var result = [];
  for (var i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push({ time: data[i].time, value: null });
    } else {
      var sum = 0;
      for (var j = i - period + 1; j <= i; j++) {
        sum += data[j].close;
      }
      result.push({ time: data[i].time, value: sum / period });
    }
  }
  return result.filter(function(item) { return item.value !== null; });
}


// RSI 계산 함수
function calculateRSI(data, period) {
  var result = [];
  var gains = [];
  var losses = [];
  
  for (var i = 1; i < data.length; i++) {
    var change = data[i].close - data[i - 1].close;
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? Math.abs(change) : 0);
  }
  
  for (var i = 0; i < data.length; i++) {
    if (i < period) {
      result.push({ time: data[i].time, value: null });
    } else {
      var avgGain = 0;
      var avgLoss = 0;
      
      for (var j = i - period; j < i; j++) {
        avgGain += gains[j] || 0;
        avgLoss += losses[j] || 0;
      }
      avgGain /= period;
      avgLoss /= period;
      
      var rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      var rsi = 100 - (100 / (1 + rs));
      
      result.push({ time: data[i].time, value: rsi });
    }
  }
  
  return result.filter(function(item) { return item.value !== null; });
}

// MACD 계산 함수
function calculateMACD(data, fastPeriod, slowPeriod, signalPeriod) {
  // EMA 계산 함수
  function calcEMA(prices, period) {
    var ema = [];
    var multiplier = 2 / (period + 1);
    
    // 첫 번째 EMA는 SMA로 계산
    var sum = 0;
    for (var i = 0; i < period; i++) {
      sum += prices[i];
    }
    ema[period - 1] = sum / period;
    
    // 이후 EMA 계산
    for (var i = period; i < prices.length; i++) {
      ema[i] = (prices[i] - ema[i - 1]) * multiplier + ema[i - 1];
    }
    
    return ema;
  }
  
  var closes = data.map(function(d) { return d.close; });
  var ema12 = calcEMA(closes, fastPeriod);
  var ema26 = calcEMA(closes, slowPeriod);
  
  // MACD 라인 계산
  var macdLine = [];
  for (var i = 0; i < closes.length; i++) {
    if (ema12[i] !== undefined && ema26[i] !== undefined) {
      macdLine[i] = ema12[i] - ema26[i];
    }
  }
  
  // 시그널 라인 (MACD의 EMA)
  var validMacd = macdLine.filter(function(v) { return v !== undefined; });
  var signalLine = calcEMA(validMacd, signalPeriod);
  
  // 결과 생성
  var result = {
    macd: [],
    signal: [],
    histogram: []
  };
  
  var signalIndex = 0;
  for (var i = 0; i < data.length; i++) {
    if (macdLine[i] !== undefined) {
      var macdValue = macdLine[i];
      var signalValue = signalLine[signalIndex] || macdValue;
      var histValue = macdValue - signalValue;
      
      result.macd.push({ time: data[i].time, value: macdValue });
      result.signal.push({ time: data[i].time, value: signalValue });
      result.histogram.push({ 
        time: data[i].time, 
        value: histValue,
        color: histValue >= 0 ? '#ef4444' : '#3b82f6'
      });
      
      signalIndex++;
    }
  }
  
  return result;
}


// 볼린저 밴드 계산 함수
function calculateBollingerBands(data, period, multiplier) {
  var result = {
    upper: [],
    middle: [],
    lower: []
  };
  
  for (var i = 0; i < data.length; i++) {
    if (i < period - 1) {
      continue;
    }
    
    // 이동평균 계산
    var sum = 0;
    for (var j = i - period + 1; j <= i; j++) {
      sum += data[j].close;
    }
    var ma = sum / period;
    
    // 표준편차 계산
    var squareSum = 0;
    for (var j = i - period + 1; j <= i; j++) {
      squareSum += Math.pow(data[j].close - ma, 2);
    }
    var std = Math.sqrt(squareSum / period);
    
    result.middle.push({ time: data[i].time, value: ma });
    result.upper.push({ time: data[i].time, value: ma + (multiplier * std) });
    result.lower.push({ time: data[i].time, value: ma - (multiplier * std) });
  }
  
  return result;
}


// 일목균형표 계산 함수
function calculateIchimoku(data, tenkanPeriod, kijunPeriod, senkouBPeriod) {
  // 기간 내 최고가/최저가의 중간값 계산
  function midPoint(data, start, period) {
    var high = -Infinity;
    var low = Infinity;
    for (var i = start; i < start + period && i < data.length; i++) {
      if (data[i].high > high) high = data[i].high;
      if (data[i].low < low) low = data[i].low;
    }
    return (high + low) / 2;
  }
  
  var result = {
    tenkan: [],      // 전환선 (9일)
    kijun: [],       // 기준선 (26일)
    senkouA: [],     // 선행스팬1
    senkouB: [],     // 선행스팬2
    chikou: []       // 후행스팬
  };
  
  for (var i = 0; i < data.length; i++) {
    // 전환선 (9일)
    if (i >= tenkanPeriod - 1) {
      var tenkan = midPoint(data, i - tenkanPeriod + 1, tenkanPeriod);
      result.tenkan.push({ time: data[i].time, value: tenkan });
    }
    
    // 기준선 (26일)
    if (i >= kijunPeriod - 1) {
      var kijun = midPoint(data, i - kijunPeriod + 1, kijunPeriod);
      result.kijun.push({ time: data[i].time, value: kijun });
    }
    
    // 선행스팬1, 2 (26일 앞으로 이동)
    if (i >= kijunPeriod - 1 && i + kijunPeriod < data.length) {
      var tenkanVal = midPoint(data, i - tenkanPeriod + 1, tenkanPeriod);
      var kijunVal = midPoint(data, i - kijunPeriod + 1, kijunPeriod);
      var senkouA = (tenkanVal + kijunVal) / 2;
      result.senkouA.push({ time: data[i + kijunPeriod].time, value: senkouA });
    }
    
    if (i >= senkouBPeriod - 1 && i + kijunPeriod < data.length) {
      var senkouB = midPoint(data, i - senkouBPeriod + 1, senkouBPeriod);
      result.senkouB.push({ time: data[i + kijunPeriod].time, value: senkouB });
    }
    
    // 후행스팬 (26일 뒤로 이동)
    if (i >= kijunPeriod) {
      result.chikou.push({ time: data[i - kijunPeriod].time, value: data[i].close });
    }
  }
  
  return result;
}


// 스토캐스틱 계산 함수
function calculateStochastic(data, kPeriod, dPeriod) {
  var result = {
    k: [],
    d: []
  };
  
  var kValues = [];
  
  for (var i = 0; i < data.length; i++) {
    if (i < kPeriod - 1) {
      continue;
    }
    
    // 기간 내 최고가, 최저가 찾기
    var highestHigh = -Infinity;
    var lowestLow = Infinity;
    
    for (var j = i - kPeriod + 1; j <= i; j++) {
      if (data[j].high > highestHigh) highestHigh = data[j].high;
      if (data[j].low < lowestLow) lowestLow = data[j].low;
    }
    
    // %K 계산
    var k = 0;
    if (highestHigh - lowestLow !== 0) {
      k = ((data[i].close - lowestLow) / (highestHigh - lowestLow)) * 100;
    }
    
    kValues.push({ time: data[i].time, value: k });
    result.k.push({ time: data[i].time, value: k });
  }
  
  // %D 계산 (%K의 이동평균)
  for (var i = 0; i < kValues.length; i++) {
    if (i < dPeriod - 1) {
      continue;
    }
    
    var sum = 0;
    for (var j = i - dPeriod + 1; j <= i; j++) {
      sum += kValues[j].value;
    }
    var d = sum / dPeriod;
    
    result.d.push({ time: kValues[i].time, value: d });
  }
  
  return result;
}


// ATR (Average True Range) 계산 함수
function calculateATR(data, period) {
  var result = [];
  var trValues = [];
  
  for (var i = 1; i < data.length; i++) {
    // True Range 계산
    var high = data[i].high;
    var low = data[i].low;
    var prevClose = data[i - 1].close;
    
    var tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    
    trValues.push({ time: data[i].time, value: tr });
  }
  
  // ATR 계산 (True Range의 이동평균)
  for (var i = 0; i < trValues.length; i++) {
    if (i < period - 1) {
      continue;
    }
    
    var sum = 0;
    for (var j = i - period + 1; j <= i; j++) {
      sum += trValues[j].value;
    }
    var atr = sum / period;
    
    result.push({ time: trValues[i].time, value: atr });
  }
  
  return result;
}


// ==================== TradingView 차트 ====================
function createTradingViewChart(containerId, data, isKorean, settings, timeframe) {
  try {
    // 지표 설정 (기본값: indicatorSettings)
    var indicatorOpts = settings || indicatorSettings;  

    // 기존 차트 제거
    var container = document.getElementById(containerId);
    container.innerHTML = '';
    
    // LightweightCharts 확인
    if (typeof LightweightCharts === 'undefined') {
      console.error('TradingView 라이브러리가 로드되지 않았습니다.');
      return null;
    }
    
    window.currentChartData = data;
    
    // 차트 생성
    // 시간대별 캔들 간격 설정
    var barSpacing = 12;  // 기본값 (일봉)
    if (timeframe === 'weekly') {
      barSpacing = 10;  // 주봉
    } else if (timeframe === 'monthly') {
      barSpacing = 4;  // 월봉 (6 → 4로 조정, 캔들 간격 더 좁게)
    }

      var chart = LightweightCharts.createChart(container, {
        width: container.clientWidth,
        height: 350,
        layout: {
        background: { color: '#ffffff' },
        textColor: '#333'
      },
      grid: {
        vertLines: { color: '#f0f0f0' },
        horzLines: { color: '#f0f0f0' }
      },
      crosshair: {
        mode: LightweightCharts.CrosshairMode.Normal
      },
      rightPriceScale: {
        borderColor: '#cccccc'
      },
      timeScale: {
        borderColor: '#cccccc',
        timeVisible: true,
        secondsVisible: false,
        barSpacing: barSpacing  // 추가!
      }
    });
    
    // 캔들스틱 시리즈 추가
    var candlestickSeries = chart.addSeries(LightweightCharts.CandlestickSeries, {
      upColor: '#ef4444',
      downColor: '#3b82f6',
      borderUpColor: '#ef4444',
      borderDownColor: '#3b82f6',
      wickUpColor: '#ef4444',
      wickDownColor: '#3b82f6'
    });
    
    // 데이터 변환 (날짜를 YYYY-MM-DD 형식으로)
    var chartData = data.map(function(item) {
      var dateStr = item.date || item.time;
      var formattedDate = dateStr;
      
      if (dateStr && dateStr.length === 8 && !dateStr.includes('-')) {
        formattedDate = dateStr.substring(0, 4) + '-' + 
                        dateStr.substring(4, 6) + '-' + 
                        dateStr.substring(6, 8);
      }
      
      return {
        time: formattedDate,
        open: parseFloat(item.open || item.close),
        high: parseFloat(item.high || item.close),
        low: parseFloat(item.low || item.close),
        close: parseFloat(item.close)
      };
    });
    
    // 시간순 정렬
    chartData.sort(function(a, b) { return a.time - b.time; });
    
    candlestickSeries.setData(chartData);

    // 이동평균선 (설정에 따라 표시)
    if (indicatorOpts.ma) {
      var ma5Series = chart.addSeries(LightweightCharts.LineSeries, {
        color: '#ef4444',
        lineWidth: 1,
        title: 'MA5',
        priceLineVisible: false,
        lastValueVisible: false
      });
      ma5Series.setData(calculateMA(chartData, 5));

      var ma20Series = chart.addSeries(LightweightCharts.LineSeries, {
        color: '#f59e0b',
        lineWidth: 1,
        title: 'MA20',
        priceLineVisible: false,
        lastValueVisible: false
      });
      ma20Series.setData(calculateMA(chartData, 20));

      var ma60Series = chart.addSeries(LightweightCharts.LineSeries, {
        color: '#10b981',
        lineWidth: 1,
        title: 'MA60',
        priceLineVisible: false,
        lastValueVisible: false
      });
      ma60Series.setData(calculateMA(chartData, 60));
    }

    // 볼린저 밴드 (설정에 따라 표시)
    if (indicatorOpts.bb) {
      var bbData = calculateBollingerBands(chartData, 20, 2);

      var bbUpperSeries = chart.addSeries(LightweightCharts.LineSeries, {
        color: '#9333ea',
        lineWidth: 1,
        lineStyle: 2,
        title: 'BB Upper',
        priceLineVisible: false,
        lastValueVisible: false
      });
      bbUpperSeries.setData(bbData.upper);

      var bbLowerSeries = chart.addSeries(LightweightCharts.LineSeries, {
        color: '#9333ea',
        lineWidth: 1,
        lineStyle: 2,
        title: 'BB Lower',
        priceLineVisible: false,
        lastValueVisible: false
      });
      bbLowerSeries.setData(bbData.lower);
    }

    // 일목균형표 (설정에 따라 표시)
    if (indicatorOpts.ichimoku) {
      var ichimokuData = calculateIchimoku(chartData, 9, 26, 52);

      var tenkanSeries = chart.addSeries(LightweightCharts.LineSeries, {
        color: '#ef4444',
        lineWidth: 1,
        title: '전환선',
        priceLineVisible: false,
        lastValueVisible: false
      });
      tenkanSeries.setData(ichimokuData.tenkan);

      var kijunSeries = chart.addSeries(LightweightCharts.LineSeries, {
        color: '#3b82f6',
        lineWidth: 1,
        title: '기준선',
        priceLineVisible: false,
        lastValueVisible: false
      });
      kijunSeries.setData(ichimokuData.kijun);

      var senkouASeries = chart.addSeries(LightweightCharts.LineSeries, {
        color: '#22c55e',
        lineWidth: 1,
        title: '선행1',
        priceLineVisible: false,
        lastValueVisible: false
      });
      senkouASeries.setData(ichimokuData.senkouA);

      var senkouBSeries = chart.addSeries(LightweightCharts.LineSeries, {
        color: '#ec4899',
        lineWidth: 1,
        title: '선행2',
        priceLineVisible: false,
        lastValueVisible: false
      });
      senkouBSeries.setData(ichimokuData.senkouB);

      var chikouSeries = chart.addSeries(LightweightCharts.LineSeries, {
        color: '#8b5cf6',
        lineWidth: 1,
        title: '후행',
        priceLineVisible: false,
        lastValueVisible: false
      });
      chikouSeries.setData(ichimokuData.chikou);
    }

    // 거래량 차트 (설정에 따라 표시)
    if (indicatorOpts.volume) {
      var volumeSeries = chart.addSeries(LightweightCharts.HistogramSeries, {
        color: '#26a69a',
        priceFormat: {
          type: 'volume'
        },
        priceScaleId: 'volume',
        title: 'Vol'
      });

      chart.priceScale('volume').applyOptions({
        scaleMargins: {
          top: 0.7,
          bottom: 0
        },
        visible: false
      });

      var volumeData = chartData.map(function(item, index) {
        var color = '#3b82f6';
        if (index > 0 && item.close >= chartData[index - 1].close) {
          color = '#ef4444';
        }
        
        var vol = 0;
        if (data[index] && data[index].volume) {
          vol = data[index].volume;
        }
        
        return {
          time: item.time,
          value: vol,
          color: color
        };
      });
      volumeSeries.setData(volumeData);
    }

    // 차트 자동 크기 조절
    chart.timeScale().fitContent();
    
    // 반응형 처리
    var resizeObserver = new ResizeObserver(function() {
      chart.applyOptions({ width: container.clientWidth });
    });
    resizeObserver.observe(container);
    
    chart.candleSeries = candlestickSeries;  // ✅ 올바른 변수명  // 마커 적용을 위해 series 저장
    return chart;
    
  } catch (error) {
    console.error('TradingView 차트 생성 오류:', error);
    return null;
  }
}


// RSI 차트 생성
function createRSIChart(containerId, data) {
  try {
    var container = document.getElementById(containerId);
    if (!container) return null;
    container.innerHTML = '';
    
    if (typeof LightweightCharts === 'undefined') {
      console.error('TradingView 라이브러리가 로드되지 않았습니다.');
      return null;
    }
    
    var chart = LightweightCharts.createChart(container, {
      width: container.clientWidth,
      height: 150,
      layout: {
        background: { color: '#ffffff' },
        textColor: '#333'
      },
      grid: {
        vertLines: { color: '#f0f0f0' },
        horzLines: { color: '#f0f0f0' }
      },
      rightPriceScale: {
        borderColor: '#cccccc',
        scaleMargins: { top: 0.1, bottom: 0.1 }
      },
      timeScale: {
        borderColor: '#cccccc',
        timeVisible: true,
        visible: true
      }
    });
    
    // RSI 라인
    var rsiSeries = chart.addSeries(LightweightCharts.LineSeries, {
      color: '#8b5cf6',
      lineWidth: 2,
      title: 'RSI',
      priceLineVisible: false
    });
    
    var rsiData = calculateRSI(data, 14);
    rsiSeries.setData(rsiData);
    
    // 과매수선 (70)
    var overboughtLine = chart.addSeries(LightweightCharts.LineSeries, {
      color: '#ef4444',
      lineWidth: 1,
      lineStyle: 2,
      title: '70',
      priceLineVisible: false,
      lastValueVisible: false
    });
    overboughtLine.setData(data.map(function(d) { return { time: d.time, value: 70 }; }));
    
    // 과매도선 (30)
    var oversoldLine = chart.addSeries(LightweightCharts.LineSeries, {
      color: '#3b82f6',
      lineWidth: 1,
      lineStyle: 2,
      title: '30',
      priceLineVisible: false,
      lastValueVisible: false
    });
    oversoldLine.setData(data.map(function(d) { return { time: d.time, value: 30 }; }));
    
    chart.timeScale().fitContent();
    
    // 반응형
    var resizeObserver = new ResizeObserver(function() {
      chart.applyOptions({ width: container.clientWidth });
    });
    resizeObserver.observe(container);
    
    return chart;
    
  } catch (error) {
    console.error('RSI 차트 생성 오류:', error);
    return null;
  }
}

// MACD 차트 생성
function createMACDChart(containerId, data) {
  try {
    var container = document.getElementById(containerId);
    if (!container) return null;
    container.innerHTML = '';
    
    if (typeof LightweightCharts === 'undefined') {
      console.error('TradingView 라이브러리가 로드되지 않았습니다.');
      return null;
    }
    
    var chart = LightweightCharts.createChart(container, {
      width: container.clientWidth,
      height: 150,
      layout: {
        background: { color: '#ffffff' },
        textColor: '#333'
      },
      grid: {
        vertLines: { color: '#f0f0f0' },
        horzLines: { color: '#f0f0f0' }
      },
      rightPriceScale: {
        borderColor: '#cccccc',
        scaleMargins: { top: 0.1, bottom: 0.1 }
      },
      timeScale: {
        borderColor: '#cccccc',
        timeVisible: true,
        visible: true
      }
    });
    
    var macdData = calculateMACD(data, 12, 26, 9);
    
    // MACD 히스토그램
    var histogramSeries = chart.addSeries(LightweightCharts.HistogramSeries, {
      title: 'Histogram',
      priceLineVisible: false
    });
    histogramSeries.setData(macdData.histogram);
    
    // MACD 라인
    var macdLineSeries = chart.addSeries(LightweightCharts.LineSeries, {
      color: '#3b82f6',
      lineWidth: 2,
      title: 'MACD',
      priceLineVisible: false
    });
    macdLineSeries.setData(macdData.macd);
    
    // 시그널 라인
    var signalSeries = chart.addSeries(LightweightCharts.LineSeries, {
      color: '#ef4444',
      lineWidth: 2,
      title: 'Signal',
      priceLineVisible: false
    });
    signalSeries.setData(macdData.signal);
    
    chart.timeScale().fitContent();
    
    // 반응형
    var resizeObserver = new ResizeObserver(function() {
      chart.applyOptions({ width: container.clientWidth });
    });
    resizeObserver.observe(container);
    
    return chart;
    
  } catch (error) {
    console.error('MACD 차트 생성 오류:', error);
    return null;
  }
}


// 스토캐스틱 차트 생성
function createStochasticChart(containerId, data) {
  try {
    var container = document.getElementById(containerId);
    if (!container) return null;
    container.innerHTML = '';
    
    if (typeof LightweightCharts === 'undefined') {
      console.error('TradingView 라이브러리가 로드되지 않았습니다.');
      return null;
    }
    
    var chart = LightweightCharts.createChart(container, {
      width: container.clientWidth,
      height: 150,
      layout: {
        background: { color: '#ffffff' },
        textColor: '#333'
      },
      grid: {
        vertLines: { color: '#f0f0f0' },
        horzLines: { color: '#f0f0f0' }
      },
      rightPriceScale: {
        borderColor: '#cccccc',
        scaleMargins: { top: 0.1, bottom: 0.1 }
      },
      timeScale: {
        borderColor: '#cccccc',
        timeVisible: true,
        visible: true
      }
    });
    
    var stochData = calculateStochastic(data, 14, 3);
    
    // %K 라인 (파란색)
    var kSeries = chart.addSeries(LightweightCharts.LineSeries, {
      color: '#3b82f6',
      lineWidth: 2,
      title: '%K',
      priceLineVisible: false
    });
    kSeries.setData(stochData.k);
    
    // %D 라인 (주황색)
    var dSeries = chart.addSeries(LightweightCharts.LineSeries, {
      color: '#f59e0b',
      lineWidth: 2,
      title: '%D',
      priceLineVisible: false
    });
    dSeries.setData(stochData.d);
    
    // 과매수선 (80)
    var overboughtLine = chart.addSeries(LightweightCharts.LineSeries, {
      color: '#ef4444',
      lineWidth: 1,
      lineStyle: 2,
      title: '80',
      priceLineVisible: false,
      lastValueVisible: false
    });
    overboughtLine.setData(data.map(function(d) { return { time: d.time, value: 80 }; }));
    
    // 과매도선 (20)
    var oversoldLine = chart.addSeries(LightweightCharts.LineSeries, {
      color: '#22c55e',
      lineWidth: 1,
      lineStyle: 2,
      title: '20',
      priceLineVisible: false,
      lastValueVisible: false
    });
    oversoldLine.setData(data.map(function(d) { return { time: d.time, value: 20 }; }));
    
    chart.timeScale().fitContent();
    
    // 반응형
    var resizeObserver = new ResizeObserver(function() {
      chart.applyOptions({ width: container.clientWidth });
    });
    resizeObserver.observe(container);
    
    return chart;
    
  } catch (error) {
    console.error('스토캐스틱 차트 생성 오류:', error);
    return null;
  }
}


// ATR 차트 생성
function createATRChart(containerId, data) {
  try {
    var container = document.getElementById(containerId);
    if (!container) return null;
    container.innerHTML = '';
    
    if (typeof LightweightCharts === 'undefined') {
      console.error('TradingView 라이브러리가 로드되지 않았습니다.');
      return null;
    }
    
    var chart = LightweightCharts.createChart(container, {
      width: container.clientWidth,
      height: 150,
      layout: {
        background: { color: '#ffffff' },
        textColor: '#333'
      },
      grid: {
        vertLines: { color: '#f0f0f0' },
        horzLines: { color: '#f0f0f0' }
      },
      rightPriceScale: {
        borderColor: '#cccccc',
        scaleMargins: { top: 0.1, bottom: 0.1 }
      },
      timeScale: {
        borderColor: '#cccccc',
        timeVisible: true,
        visible: true
      }
    });
    
    var atrData = calculateATR(data, 14);
    
    // ATR 라인 (주황색)
    var atrSeries = chart.addSeries(LightweightCharts.LineSeries, {
      color: '#f59e0b',
      lineWidth: 2,
      title: 'ATR',
      priceLineVisible: false
    });
    atrSeries.setData(atrData);
    
    chart.timeScale().fitContent();
    
    // 반응형
    var resizeObserver = new ResizeObserver(function() {
      chart.applyOptions({ width: container.clientWidth });
    });
    resizeObserver.observe(container);
    
    return chart;
    
  } catch (error) {
    console.error('ATR 차트 생성 오류:', error);
    return null;
  }
}



// ==================== 초기화 ====================
document.addEventListener('DOMContentLoaded', function() {
  initTabs(); 
  loadExchangeRate();          // ← 먼저 실행!
  initEventListeners();  // ← 나중에 실행
 
  loadWatchlist();
  loadUsWatchlist();
  loadPortfolio();
  loadDashboard();
  loadAlertList();
  updateAlertStockSelect();
  loadUsPortfolio();
  loadUsAlertList();
  loadAiThemeList();
  loadScannerNotifySettings();
  
  // 브라우저 알림 권한 요청
  requestNotificationPermission();
  
  // 자동 로그인 검증
  verifyToken();
});

// 검색 debounce용 타이머
var searchDebounceTimer = null;


// ==================== 이벤트 리스너 ====================
function initEventListeners() {
  console.log('🔵 initEventListeners 호출됨');

// ===== 한국 종목 검색 =====
  var searchInput = document.getElementById('stock-search-input');
  var searchBtn = document.getElementById('stock-search-btn');
  
  if (!searchInput || !searchBtn) {
    console.error('검색 요소를 찾을 수 없습니다!');
    return;
  }
  
  // 이벤트 등록 (중복되어도 removeEventListener가 처리)
  searchBtn.removeEventListener('click', handleStockSearch);
  searchInput.removeEventListener('input', debounceStockSearch);
  searchInput.removeEventListener('keypress', handleSearchEnter);
  
  searchBtn.addEventListener('click', handleStockSearch);
  searchInput.addEventListener('input', debounceStockSearch);
  searchInput.addEventListener('keypress', handleSearchEnter);
  
  console.log('✅ 검색 이벤트 등록 완료');
  
  

  // 기술적 분석
  document.getElementById('run-analysis-btn').addEventListener('click', handleTechnicalAnalysis);
  document.getElementById('analysis-stock-code').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') handleTechnicalAnalysis();
  });

  // 매매신호 버튼
  document.getElementById('go-signals-btn').addEventListener('click', function() {
    var stockCode = document.getElementById('analysis-stock-code').value.trim();
    if (stockCode) {
      document.getElementById('signal-stock-code').value = stockCode;
      switchTab('signals');
      // 자동으로 신호 생성 실행
      setTimeout(function() {
        document.getElementById('generate-signal-btn').click();
      }, 100);
    } else {
      alert('종목코드를 입력하세요.');
    }
  });

  // 뉴스
  document.getElementById('news-btn').addEventListener('click', handleNews);

  // 매매 신호
  document.getElementById('generate-signal-btn').addEventListener('click', handleGenerateSignal);
  document.getElementById('signal-stock-code').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') handleGenerateSignal();
  });

  // 매매점 추천
  document.getElementById('recommendation-btn').addEventListener('click', handleRecommendation);

  // 관심 종목
  document.getElementById('watchlist-add-btn').addEventListener('click', handleAddWatchlist);
  document.getElementById('watchlist-add-code').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') handleAddWatchlist();
  });

  // 미국 주식
  document.getElementById('us-stock-search-btn').addEventListener('click', handleUsStockSearch);
  document.getElementById('us-stock-input').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') handleUsStockSearch();
  });
  document.getElementById('add-us-watchlist-btn').addEventListener('click', handleAddUsWatchlist);
  
  // 미국 관심종목 직접 추가
  document.getElementById('us-watchlist-add-btn').addEventListener('click', handleAddUsWatchlistDirect);
  document.getElementById('us-watchlist-add-input').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') handleAddUsWatchlistDirect();
  });

  // 미국 주식 분석
  document.getElementById('us-analysis-btn').addEventListener('click', handleUsAnalysis);
  document.getElementById('us-signal-btn').addEventListener('click', handleUsSignal);

  // 미국 AI 기능
  document.getElementById('us-ai-timing-btn').addEventListener('click', analyzeUsAiTiming);
  document.getElementById('us-ai-risk-btn').addEventListener('click', analyzeUsAiRisk);
  document.getElementById('us-ai-pattern-btn').addEventListener('click', analyzeUsAiPattern);
  document.getElementById('us-ai-sentiment-btn').addEventListener('click', analyzeUsAiSentiment);

  // 미국 AI 포트폴리오
  /*
  document.getElementById('us-ai-portfolio-add-btn').addEventListener('click', addUsAiPortfolioStock);
  document.getElementById('us-ai-portfolio-input').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') addUsAiPortfolioStock();
  });
  document.getElementById('us-ai-portfolio-analyze-btn').addEventListener('click', analyzeUsAiPortfolio);
  */

  // 미국 포트폴리오
  document.getElementById('us-portfolio-add-btn').addEventListener('click', handleAddUsPortfolio);
  document.getElementById('us-alert-type').addEventListener('change', handleUsAlertTypeChange);
  document.getElementById('us-set-alert-btn').addEventListener('click', handleSetUsAlert);
  document.getElementById('us-set-all-alert-btn').addEventListener('click', handleSetAllUsAlert);

  document.getElementById('us-start-monitor-btn').addEventListener('click', startUsMonitoring);
  document.getElementById('us-stop-monitor-btn').addEventListener('click', stopUsMonitoring);

  // 미국 종목 찾기
  document.getElementById('load-popular-us-btn').addEventListener('click', loadPopularUsStocks);
  document.getElementById('analyze-us-sector-btn').addEventListener('click', analyzeUsSector);
  document.getElementById('scan-all-us-sectors-btn').addEventListener('click', scanAllUsSectors);


  // 테마
  document.getElementById('load-theme-btn').addEventListener('click', loadThemeList);

  // 포트폴리오
  document.getElementById('portfolio-add-btn').addEventListener('click', handleAddPortfolio);

  // 모바일 메뉴
  document.getElementById('mobile-menu-btn').addEventListener('click', toggleMobileMenu);

  // 매도 알림
  document.getElementById('alert-type').addEventListener('change', handleAlertTypeChange);
  document.getElementById('set-alert-btn').addEventListener('click', handleSetAlert);
  document.getElementById('start-monitor-btn').addEventListener('click', startMonitoring);
  document.getElementById('stop-monitor-btn').addEventListener('click', stopMonitoring);

  document.getElementById('set-all-alert-btn').addEventListener('click', handleSetAllAlert);

  // 대시보드 새로고침
  document.getElementById('refresh-dashboard-btn').addEventListener('click', refreshDashboard);

  // 종목 찾기
  document.getElementById('load-hot-themes-btn').addEventListener('click', loadHotThemes);
  document.getElementById('analyze-theme-btn').addEventListener('click', analyzeSelectedTheme);
  document.getElementById('scan-all-themes-btn').addEventListener('click', scanAllThemes);

  // 수익률 일괄 설정
  document.getElementById('set-all-percent-btn').addEventListener('click', toggleBulkPercentOptions);
  document.getElementById('apply-bulk-percent-btn').addEventListener('click', applyBulkPercentAlert);
  document.getElementById('us-set-all-percent-btn').addEventListener('click', toggleUsBulkPercentOptions);
  document.getElementById('us-apply-bulk-percent-btn').addEventListener('click', applyUsBulkPercentAlert);
  
  // AI 레슨
  document.getElementById('ai-large-cap-btn').addEventListener('click', function() { loadAiByMarketCap('large'); });
  document.getElementById('ai-mid-cap-btn').addEventListener('click', function() { loadAiByMarketCap('mid'); });
  document.getElementById('ai-small-cap-btn').addEventListener('click', function() { loadAiByMarketCap('small'); });
  document.getElementById('ai-theme-analyze-btn').addEventListener('click', loadAiByTheme);
  document.getElementById('ai-analyze-btn').addEventListener('click', aiAnalyzeStock);
  document.getElementById('ai-stock-input').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') aiAnalyzeStock();
  });

  // AI 매매 타이밍
  document.getElementById('ai-timing-btn').addEventListener('click', analyzeAiTiming);
  document.getElementById('ai-timing-input').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') analyzeAiTiming();
  });

  // AI 리스크 분석
  document.getElementById('ai-risk-btn').addEventListener('click', analyzeAiRisk);
  document.getElementById('ai-risk-input').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') analyzeAiRisk();
  });

  // AI 차트 패턴
  document.getElementById('ai-pattern-btn').addEventListener('click', analyzeAiPattern);
  document.getElementById('ai-pattern-input').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') analyzeAiPattern();
  });

 // AI 포트폴리오 추천
  if (document.getElementById('ai-portfolio-add-btn')) {
    document.getElementById('ai-portfolio-add-btn').addEventListener('click', addAiPortfolioStock);
  }
  if (document.getElementById('ai-portfolio-input')) {
    document.getElementById('ai-portfolio-input').addEventListener('keypress', function(e) {
      if (e.key === 'Enter') addAiPortfolioStock();
    });
  }
  document.getElementById('ai-portfolio-analyze-btn').addEventListener('click', analyzeAiPortfolio);

  // AI 뉴스 감성 분석
  document.getElementById('ai-sentiment-btn').addEventListener('click', analyzeAiSentiment);
  document.getElementById('ai-sentiment-input').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') analyzeAiSentiment();
  });

  // 분석 메모 저장 버튼
  document.getElementById('save-memo-btn').addEventListener('click', function() {
    saveMemo();
  });
  
  // 분석 메모 삭제 버튼
  document.getElementById('delete-memo-btn').addEventListener('click', function() {
    deleteMemo();
  });

  // 미국 주식 분석 메모 저장 버튼
  document.getElementById('us-save-memo-btn').addEventListener('click', function() {
    saveUsMemo();
  });
  
  // 미국 주식 분석 메모 삭제 버튼
  document.getElementById('us-delete-memo-btn').addEventListener('click', function() {
    deleteUsMemo();
  });

  // ===== 차트 패턴 분석 (한국 주식) =====
  var analyzePatternBtn = document.getElementById('analyzePatternBtn');
  if (analyzePatternBtn) {
    analyzePatternBtn.addEventListener('click', handleKoreaPatternAnalysis);
  }

  // ===== 차트 패턴 분석 (미국 주식) =====
  var analyzeUsPatternBtn = document.getElementById('analyzeUsPatternBtn');
  if (analyzeUsPatternBtn) {
    analyzeUsPatternBtn.addEventListener('click', handleUsPatternAnalysis);
  }

}


// ==================== 탭 네비게이션 ====================
function initTabs() {
  document.querySelectorAll('.nav-item').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var tabId = this.getAttribute('data-tab');
      
      // 히스토리에 추가 (같은 탭이 아닐 때만)
      if (tabHistory[tabHistory.length - 1] !== tabId) {
        tabHistory.push(tabId);
        if (tabHistory.length > 20) {
          tabHistory.shift();
        }
      }
      
      // 활성 탭 변경
      document.querySelectorAll('.nav-item').forEach(function(b) {
        b.classList.remove('active');
      });
      this.classList.add('active');
      
      // 컨텐츠 변경
      document.querySelectorAll('.tab-content').forEach(function(tab) {
        tab.classList.remove('active');
      });
      document.getElementById('tab-' + tabId).classList.add('active');
      
      // 매매 신호 탭 클릭 시 최신 종목코드로 업데이트
      if (tabId === 'signals' && selectedKoreaStock) {
        document.getElementById('signal-stock-code').value = selectedKoreaStock;
      }
      
      // 모바일 메뉴 닫기
      document.querySelector('.sidebar').classList.remove('open');
    });
  });
}


// 탭 히스토리 관리
var tabHistory = ['dashboard'];

// 탭 전환 함수 (하단 메뉴바용)
function switchTab(tabId) {
  // 히스토리에 추가 (같은 탭이 아닐 때만)
  if (tabHistory[tabHistory.length - 1] !== tabId) {
    tabHistory.push(tabId);
    // 히스토리 최대 20개 유지
    if (tabHistory.length > 20) {
      tabHistory.shift();
    }
  }
  
  // 사이드바 nav-item 활성화 변경
  document.querySelectorAll('.nav-item').forEach(function(btn) {
    btn.classList.remove('active');
    if (btn.getAttribute('data-tab') === tabId) {
      btn.classList.add('active');
    }
  });
  
  // 하단 메뉴바 활성화 변경
  document.querySelectorAll('.bottom-nav-item').forEach(function(btn) {
    btn.classList.remove('active');
  });
  
  // 컨텐츠 변경
  document.querySelectorAll('.tab-content').forEach(function(tab) {
    tab.classList.remove('active');
  });
  document.getElementById('tab-' + tabId).classList.add('active');
  
  // 모바일 사이드바 닫기
  document.querySelector('.sidebar').classList.remove('open');
}

// 뒤로가기 함수
function goBack() {
  if (tabHistory.length > 1) {
    // 현재 탭 제거
    tabHistory.pop();
    // 이전 탭으로 이동
    var prevTab = tabHistory[tabHistory.length - 1];
    
    // 사이드바 nav-item 활성화 변경
    document.querySelectorAll('.nav-item').forEach(function(btn) {
      btn.classList.remove('active');
      if (btn.getAttribute('data-tab') === prevTab) {
        btn.classList.add('active');
      }
    });
    
    // 하단 메뉴바 활성화 변경
    document.querySelectorAll('.bottom-nav-item').forEach(function(btn) {
      btn.classList.remove('active');
    });
    
    // 컨텐츠 변경
    document.querySelectorAll('.tab-content').forEach(function(tab) {
      tab.classList.remove('active');
    });
    document.getElementById('tab-' + prevTab).classList.add('active');
  }
}



// 모바일 메뉴 토글
function toggleMobileMenu() {
  document.querySelector('.sidebar').classList.toggle('open');
}

// ==================== 로딩 ====================
function showLoading() {
  document.getElementById('loading-overlay').style.display = 'flex';
}

function hideLoading() {
  document.getElementById('loading-overlay').style.display = 'none';
}

// ==================== API 호출 ====================
async function apiCall(endpoint, options, useCache = true) {
  // 캐시 타입 결정
  var cacheType = 'default';
  
  if (endpoint.includes('/stock/')) cacheType = 'stock-quote';
  else if (endpoint.includes('/chart/')) cacheType = 'stock-chart';
  else if (endpoint.includes('/analysis/')) cacheType = 'stock-analysis';
  else if (endpoint.includes('/news/')) cacheType = 'news';
  else if (endpoint.includes('/theme')) cacheType = 'theme';
  else if (endpoint.includes('/market-index')) cacheType = 'market-index';
  else if (endpoint.includes('/exchange')) cacheType = 'exchange-rate';
  else if (endpoint.includes('/us/quote/')) cacheType = 'us-quote';
  else if (endpoint.includes('/us/analysis/')) cacheType = 'us-analysis';
  
  // POST 요청은 캐싱하지 않음
  if (options && options.method !== 'GET') {
    useCache = false;
  }
  
  // 캐싱된 API 호출
  if (useCache && typeof cachedApiCall !== 'undefined') {
    return await cachedApiCall(cacheType, endpoint, options);
  }
  
  // 폴백: 일반 API 호출
  try {
    var fetchOptions = {
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    if (options) {
      fetchOptions.method = options.method || 'GET';
      if (options.body) {
        fetchOptions.body = options.body;
      }
      if (options.headers) {
        for (var key in options.headers) {
          fetchOptions.headers[key] = options.headers[key];
        }
      }
    }
    
    const response = await fetch(API_BASE + endpoint, fetchOptions);
    return await response.json();
  } catch (error) {
    console.error('API 오류:', error);
    return { success: false, error: error.message };
  }
}


// ==================== 환율 ====================
async function loadExchangeRate() {
  try {
    var response = await fetch('/api/korea/exchange');
    var result = await response.json();
    if (result.success && result.data) {
      var data = result.data;
      var html = '';
      if (data.usd > 0) {
        html += '<p>USD: <span class="rate-value">' + data.usd.toLocaleString() + '원</span></p>';
      }
      if (data.jpy > 0) {
        html += '<p>JPY: <span class="rate-value">' + data.jpy.toLocaleString() + '원</span></p>';
      }
      if (data.eur > 0) {
        html += '<p>EUR: <span class="rate-value">' + data.eur.toLocaleString() + '원</span></p>';
      }
      document.getElementById('exchange-rate-info').innerHTML = html || '<p>환율 정보 없음</p>';
    }
  } catch (error) {
    console.error('환율 로드 오류:', error);
  }
}

function debounceStockSearch() {
  console.log('🟢 debounce 실행');
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(handleStockSearch, 500);
}

function handleSearchEnter(e) {
  if (e.key === 'Enter') {
    clearTimeout(searchDebounceTimer);
    handleStockSearch();
  }
}


// ==================== 종목 검색 ====================
async function handleStockSearch() {
  console.log('🔴 handleStockSearch 실행');
  
  var keyword = document.getElementById('stock-search-input').value.trim();
  if (!keyword) {
    return;
  }

  showLoading();
  
  try {
    var result = await apiCall('/api/korea/search?keyword=' + encodeURIComponent(keyword));
    console.log('검색 결과:', result);
    
    if (result.success && result.data && result.data.length > 0) {
      displaySearchResults(result.data);
    } else {
      document.getElementById('search-result').innerHTML = '<p>검색 결과가 없습니다.</p>';
    }
  } catch (error) {
    console.error('검색 오류:', error);
  }
  
  hideLoading();
}

function displaySearchResults(results) {
  var container = document.getElementById('search-result');
  
  var html = '<table style="width:100%; table-layout:fixed;">';
  html += '<thead><tr>';
  html += '<th style="width:45%">종목명</th>';
  html += '<th style="width:30%">코드</th>';
  html += '<th style="width:25%; text-align:center;">기능</th>';
  html += '</tr></thead><tbody>';
  
  results.forEach(function(stock) {
    html += '<tr>';
    html += '<td><strong>' + stock.name + '</strong></td>';
    html += '<td>' + stock.code + '</td>';
    html += '<td style="text-align:center;"><button onclick="analyzeStock(\'' + stock.code + '\')">분석</button></td>';
    html += '</tr>';
  });
  
  html += '</tbody></table>';
  container.innerHTML = html;
}

async function handleTechnicalAnalysis() {
  var input = document.getElementById('analysis-stock-code').value.trim();
  if (!input) {
    alert('종목코드 또는 종목명을 입력하세요.');
    return;
  }

  showLoading();
  
  try {
    // 종목코드 찾기
    var stockCode = await findStockCode(input);
    
    if (!stockCode) {
      alert('종목을 찾을 수 없습니다: ' + input);
      hideLoading();
      return;
    }

    // 선택된 종목 저장
    selectedKoreaStock = stockCode;
    
    // 매매 신호 입력창에도 자동 입력
    document.getElementById('signal-stock-code').value = stockCode;
    
    // 매매 신호 결과 초기화
    document.getElementById('signal-result').innerHTML = '';
    document.getElementById('signal-recommendation-result').innerHTML = '';
    
    var result = await apiCall('/api/analysis/technical/' + stockCode);
    console.log('분석 결과:', result);
    
    if (result.success && result.data) {
      displayAnalysisResult(result.data);
      await drawStockChart(stockCode);
    } else {
      document.getElementById('analysis-result').innerHTML = '<p class="error">분석 실패: ' + (result.error || '') + '</p>';
    }
  } catch (error) {
    console.error('분석 오류:', error);
  }
  
  hideLoading();
}


function displayAnalysisResult(data) {
  var container = document.getElementById('analysis-result');
  
  var html = '<div class="card">';
  html += '<h3>' + (data.stockName || '') + ' (' + (data.stockCode || '') + ')</h3>';
  html += '<div class="indicators-grid">';
  html += '<div class="indicator-card"><div class="label">현재가</div><div class="value">' + (data.currentPrice ? data.currentPrice.toLocaleString() + '원' : '--') + '</div></div>';
  html += '<div class="indicator-card"><div class="label">RSI (14)</div><div class="value">' + (data.rsi ? data.rsi.toFixed(1) : '--') + '</div></div>';
  html += '<div class="indicator-card"><div class="label">MACD</div><div class="value">' + (data.macd ? data.macd.toFixed(2) : '--') + '</div></div>';
  html += '<div class="indicator-card"><div class="label">기술적 점수</div><div class="value">' + (data.technicalScore ? data.technicalScore.toFixed(0) + '점' : '--') + '</div></div>';
  html += '</div>';
  
  if (data.signals && data.signals.length > 0) {
    html += '<div style="margin-top:20px;"><h4>📋 분석 신호</h4><ul>';
    data.signals.forEach(function(signal) {
      html += '<li>' + signal + '</li>';
    });
    html += '</ul></div>';
  }
  
  html += '</div>';
  container.innerHTML = html;
}


// 차트 그리기 (TradingView)
async function drawStockChart(stockCode) {
  try {
    var result = await apiCall('/api/korea/chart/' + stockCode);
    
    if (!result.success || !result.data || result.data.length === 0) {
      return;
    }
    
    // 시간대에 따라 데이터 개수 조정
    var dataCount = 200;
    if (currentTimeframe === 'weekly') {
      dataCount = 2000;
    } else if (currentTimeframe === 'monthly') {
      dataCount = 5000;
    }

    var rawData = result.data.slice(-dataCount);

    // 주봉/월봉 변환
    if (currentTimeframe === 'weekly') {
      rawData = convertToWeekly(rawData);
    } else if (currentTimeframe === 'monthly') {
      rawData = convertToMonthly(rawData);
    }


    // 날짜 형식 변환 (RSI/MACD 등에 전달할 데이터)
    var formattedData = rawData.map(function(item) {
      var dateStr = item.date || item.time;
      var formattedDate = dateStr;
      
      if (dateStr && dateStr.length === 8 && !dateStr.includes('-')) {
        formattedDate = dateStr.substring(0, 4) + '-' + 
                        dateStr.substring(4, 6) + '-' + 
                        dateStr.substring(6, 8);
      }
      
      return {
        time: formattedDate,
        open: parseFloat(item.open || item.close),
        high: parseFloat(item.high || item.close),
        low: parseFloat(item.low || item.close),
        close: parseFloat(item.close),
        volume: item.volume || 0
      };
    });

    
    // 날짜 형식 변환 (YYYYMMDD → YYYY-MM-DD)
    var chartData = rawData.map(function(item) {
      var dateStr = item.date || item.time;
      var formattedDate = dateStr;
      
      if (dateStr && dateStr.length === 8 && !dateStr.includes('-')) {
        formattedDate = dateStr.substring(0, 4) + '-' + 
                        dateStr.substring(4, 6) + '-' + 
                        dateStr.substring(6, 8);
      }
      
      return {
        time: formattedDate,
        open: parseFloat(item.open || item.close),
        high: parseFloat(item.high || item.close),
        low: parseFloat(item.low || item.close),
        close: parseFloat(item.close),
        volume: item.volume || 0
      };
    });
    
    // 기존 Chart.js 차트 제거
    if (stockChart) {
      stockChart.destroy();
      stockChart = null;
    }
    
    // 기존 TradingView 차트 제거
    if (tvStockChart) {
      tvStockChart.remove();
      tvStockChart = null;
    }
    
    // TradingView 차트 생성 (한국 주식)
    tvStockChart = createTradingViewChart('stock-chart', chartData, true, indicatorSettings, currentTimeframe);

    console.log('차트 생성 완료!');
    
    // RSI 차트 생성
    createRSIChart('rsi-chart', formattedData);

    // MACD 차트 생성
    createMACDChart('macd-chart', formattedData);

    // 스토캐스틱 차트 생성
    createStochasticChart('stochastic-chart', formattedData);

    // ATR 차트 생성
    createATRChart('atr-chart', formattedData);

    // 저장된 메모 불러오기
    loadMemo(stockCode);
    
  } catch (error) {
    console.error('차트 오류:', error);
  }
}




// 종목 분석 (검색 결과에서 호출)
function analyzeStock(stockCode) {
  document.querySelectorAll('.tab-content').forEach(function(tab) {
    tab.classList.remove('active');
  });
  document.getElementById('tab-analysis').classList.add('active');
  
  document.querySelectorAll('.nav-item').forEach(function(nav) {
    nav.classList.remove('active');
    if (nav.getAttribute('data-tab') === 'analysis') {
      nav.classList.add('active');
    }
  });
  
  document.getElementById('analysis-stock-code').value = stockCode;
  handleTechnicalAnalysis();
}

// ==================== 뉴스 ====================
async function handleNews() {
  var stockCode = document.getElementById('analysis-stock-code').value.trim();
  if (!stockCode) {
    alert('종목코드를 입력하세요.');
    return;
  }

  showLoading();
  
  try {
    var result = await apiCall('/api/korea/news/' + stockCode);
    console.log('뉴스 결과:', result);
    
    if (result.success && result.data && result.data.length > 0) {
      displayNews(result.data);
      document.getElementById('news-card').style.display = 'block';
    } else {
      document.getElementById('news-result').innerHTML = '<p>관련 뉴스가 없습니다.</p>';
      document.getElementById('news-card').style.display = 'block';
    }
  } catch (error) {
    console.error('뉴스 오류:', error);
  }
  
  hideLoading();
}

function displayNews(news) {
  var container = document.getElementById('news-result');
  var html = '<ul style="list-style:none; padding:0;">';
  
  news.forEach(function(item) {
    html += '<li style="padding:12px 0; border-bottom:1px solid #eee;">';
    html += '<a href="' + item.link + '" target="_blank" style="color:#1e40af; font-weight:500;">' + item.title + '</a>';
    html += '<div style="margin-top:5px; font-size:0.85rem; color:#666;">' + item.source;
    if (item.date) html += ' · ' + item.date;
    html += '</div></li>';
  });
  
  html += '</ul>';
  container.innerHTML = html;
}



async function handleGenerateSignal() {
  var input = document.getElementById('signal-stock-code').value.trim();
  
  // 입력이 없으면 이전 분석 종목 사용
  if (!input && selectedKoreaStock) {
    input = selectedKoreaStock;
    document.getElementById('signal-stock-code').value = selectedKoreaStock;
  }
  
  if (!input) {
    alert('종목코드 또는 종목명을 입력하세요.');
    return;
  }

  showLoading();
  
  try {
    var stockCode = await findStockCode(input);
    
    if (!stockCode) {
      alert('종목을 찾을 수 없습니다: ' + input);
      hideLoading();
      return;
    }
    
    var result = await apiCall('/api/analysis/signal/' + stockCode);
    console.log('신호 결과:', result);
    
    if (result.success && result.data) {
      displaySignalResult(result.data);
    } else {
      document.getElementById('signal-result').innerHTML = '<p class="error">신호 생성 실패</p>';
    }
  } catch (error) {
    console.error('신호 오류:', error);
  }
  
  hideLoading();
}




function displaySignalResult(data) {
  var container = document.getElementById('signal-result');
  
  var signalText = {
    'STRONG_BUY': '🔥 강력 매수',
    'BUY': '📈 매수',
    'HOLD': '⏸️ 보유',
    'SELL': '📉 매도',
    'STRONG_SELL': '⚠️ 강력 매도'
  };
  
  var signalClass = (data.signal === 'BUY' || data.signal === 'STRONG_BUY') ? 'positive' : 
                    (data.signal === 'SELL' || data.signal === 'STRONG_SELL') ? 'negative' : '';

  var html = '<div class="card" style="text-align:center;">';
  html += '<h3>' + (data.stockName || '') + ' (' + (data.stockCode || '') + ')</h3>';
  html += '<div style="font-size:2rem; margin:20px 0;" class="' + signalClass + '">' + (signalText[data.signal] || data.signal) + '</div>';
  html += '<p>신뢰도: <strong>' + (data.confidence || 0) + '%</strong></p>';
  html += '</div>';
  
  html += '<div class="indicators-grid">';
  html += '<div class="indicator-card"><div class="label">현재가</div><div class="value">' + (data.currentPrice ? data.currentPrice.toLocaleString() + '원' : '--') + '</div></div>';
  html += '<div class="indicator-card"><div class="label">기술적 점수</div><div class="value">' + (data.technicalScore || '--') + '</div></div>';
  html += '<div class="indicator-card"><div class="label">기본적 점수</div><div class="value">' + (data.fundamentalScore || '--') + '</div></div>';
  html += '<div class="indicator-card"><div class="label">종합 점수</div><div class="value">' + (data.compositeScore || '--') + '</div></div>';
  html += '<div class="indicator-card" style="background:#dcfce7;"><div class="label">🎯 목표가</div><div class="value" style="color:#166534;">' + (data.targetPrice ? data.targetPrice.toLocaleString() + '원' : '--') + '</div></div>';
  html += '<div class="indicator-card" style="background:#fee2e2;"><div class="label">🛑 손절가</div><div class="value" style="color:#991b1b;">' + (data.stopLoss ? data.stopLoss.toLocaleString() + '원' : '--') + '</div></div>';
  html += '</div>';
  
  // 예상 수익률/리스크/손익비 계산
  if (data.currentPrice && data.targetPrice && data.stopLoss) {
    var expectedReturn = ((data.targetPrice - data.currentPrice) / data.currentPrice * 100).toFixed(2);
    var risk = ((data.currentPrice - data.stopLoss) / data.currentPrice * 100).toFixed(2);
    var riskReward = Math.abs(risk) > 0 ? (Math.abs(expectedReturn) / Math.abs(risk)).toFixed(2) : '--';
    
    html += '<div class="indicators-grid" style="margin-top:15px;">';
    html += '<div class="indicator-card"><div class="label">예상 수익률</div><div class="value ' + (expectedReturn >= 0 ? 'positive' : 'negative') + '">' + (expectedReturn >= 0 ? '+' : '') + expectedReturn + '%</div></div>';
    html += '<div class="indicator-card"><div class="label">리스크</div><div class="value negative">-' + Math.abs(risk) + '%</div></div>';
    html += '<div class="indicator-card"><div class="label">손익비</div><div class="value">' + riskReward + ' : 1</div></div>';
    html += '</div>';
  }
  
  if (data.reasons && data.reasons.length > 0) {
    html += '<div class="card" style="margin-top:20px;"><h4>📋 판단 근거</h4><ul>';
    data.reasons.forEach(function(reason) {
      html += '<li>' + reason + '</li>';
    });
    html += '</ul></div>';
  }
  
  // 설명 추가
  html += '<div class="card" style="margin-top:20px; background:#f8fafc;">';
  html += '<h4>📌 용어 설명</h4>';
  html += '<ul style="margin:10px 0; padding-left:20px; line-height:1.8;">';
  html += '<li><strong>기술적 점수</strong>: RSI, MACD, 이동평균선 등 차트 지표 기반 점수</li>';
  html += '<li><strong>기본적 점수</strong>: PER, PBR, ROE 등 재무 지표 기반 점수</li>';
  html += '<li><strong>종합 점수</strong>: 기술적 + 기본적 점수의 가중 평균</li>';
  html += '<li><strong>목표가</strong>: 기술적 분석 기반 예상 상승 목표</li>';
  html += '<li><strong>손절가</strong>: 손실 제한을 위한 매도 기준</li>';
  html += '<li><strong>예상 수익률</strong>: 현재가 → 목표가 도달 시 수익률</li>';
  html += '<li><strong>리스크</strong>: 현재가 → 손절가 도달 시 손실률</li>';
  html += '<li><strong>손익비</strong>: 예상수익률 ÷ 리스크 (2:1 이상 권장)</li>';
  html += '</ul>';
  html += '</div>';
  
  container.innerHTML = html;
}



// ==================== 매매점 추천 ====================
async function handleRecommendation() {
  var input = document.getElementById('signal-stock-code').value.trim();
  if (!input) {
    alert('종목코드 또는 종목명을 입력하세요.');
    return;
  }

  showLoading();
  
  try {
    // 종목코드 찾기
    var stockCode = await findStockCode(input);
    
    if (!stockCode) {
      alert('종목을 찾을 수 없습니다: ' + input);
      hideLoading();
      return;
    }
    
    var result = await apiCall('/api/analysis/recommendation/' + stockCode);
    console.log('매매점 추천:', result);
    
    if (result.success && result.data) {
      displayRecommendation(result.data, stockCode);
    } else {
      document.getElementById('signal-recommendation-result').innerHTML = '<p class="error">추천 데이터를 가져올 수 없습니다.</p>';
    }
  } catch (error) {
    console.error('매매점 추천 오류:', error);
  }
  
  hideLoading();
}



function displayRecommendation(data, stockCode) {
  var container = document.getElementById('signal-recommendation-result');
  
  var timingClass = data.timing === 'BUY' ? 'positive' : (data.timing === 'SELL' ? 'negative' : '');
  var timingIcon = data.timing === 'BUY' ? '🟢' : (data.timing === 'SELL' ? '🔴' : '🟡');
  
  var html = '<div class="card">';
  html += '<h3>💰 매수/매도점 추천 (' + stockCode + ')</h3>';
  
  html += '<div style="text-align:center; padding:20px; background:#f8fafc; border-radius:8px; margin:20px 0;">';
  html += '<p style="color:#666;">현재 타이밍</p>';
  html += '<p style="font-size:2rem; font-weight:bold;" class="' + timingClass + '">' + timingIcon + ' ' + data.timing + '</p>';
  html += '<p style="color:#666;">' + (data.timingReasons ? data.timingReasons.join(', ') : '') + '</p>';
  html += '</div>';
  
  html += '<div class="indicators-grid">';
  html += '<div class="indicator-card"><div class="label">현재가</div><div class="value">' + data.currentPrice.toLocaleString() + '원</div></div>';
  html += '<div class="indicator-card" style="background:#dcfce7;"><div class="label">📈 매수 추천가</div><div class="value" style="color:#166534;">' + data.buyPrice.toLocaleString() + '원</div></div>';
  html += '<div class="indicator-card" style="background:#dbeafe;"><div class="label">🎯 목표가</div><div class="value" style="color:#1e40af;">' + data.targetPrice.toLocaleString() + '원</div></div>';
  html += '<div class="indicator-card" style="background:#fee2e2;"><div class="label">🛑 손절가</div><div class="value" style="color:#991b1b;">' + data.stopLossPrice.toLocaleString() + '원</div></div>';
  html += '</div>';
  
  html += '<div class="indicators-grid" style="margin-top:15px;">';
  var returnClass = data.expectedReturn >= 0 ? 'positive' : 'negative';
  html += '<div class="indicator-card"><div class="label">예상 수익률</div><div class="value ' + returnClass + '">' + (data.expectedReturn >= 0 ? '+' : '') + data.expectedReturn + '%</div></div>';
  html += '<div class="indicator-card"><div class="label">리스크</div><div class="value negative">-' + data.riskReturn + '%</div></div>';
  html += '<div class="indicator-card"><div class="label">손익비</div><div class="value">' + data.riskRewardRatio + ' : 1</div></div>';
  html += '</div>';
  
  html += '</div>';
  
  container.innerHTML = html;
}



// ==================== 관심 종목 ====================
async function handleAddWatchlist() {
  var input = document.getElementById('watchlist-add-code').value.trim();
  if (!input) {
    alert('종목코드 또는 종목명을 입력하세요.');
    return;
  }
  
  // 로그인 확인
  var token = localStorage.getItem('authToken');
  if (!token) {
    alert('로그인이 필요합니다.');
    openAuthModal();
    return;
  }
  
  showLoading();
  
  try {
    // 종목코드 찾기 (코드 또는 이름으로)
    var stockCode = await findStockCode(input);
    
    if (!stockCode) {
      alert('종목을 찾을 수 없습니다: ' + input);
      hideLoading();
      return;
    }
    
    // 종목 정보 조회
    var result = await apiCall('/api/korea/stock/' + stockCode);
    
    if (result.success && result.data && result.data.name) {
      // 서버에 추가
      var addResult = await apiCall('/api/watchlist/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token
        },
        body: JSON.stringify({
          stockCode: stockCode,
          stockName: result.data.name
        })
      });
      
      if (addResult.success) {
        document.getElementById('watchlist-add-code').value = '';
        loadWatchlist();
        alert(result.data.name + ' 추가되었습니다!');
      } else {
        alert(addResult.message || '추가 실패');
      }
    } else {
      alert('종목 정보를 가져올 수 없습니다: ' + input);
    }
  } catch (error) {
    console.error('관심 종목 추가 오류:', error);
    alert('오류가 발생했습니다.');
  }
  
  hideLoading();
}



async function loadWatchlist() {
  var container = document.getElementById('watchlist-container');
  
  // 로그인 확인
  var token = localStorage.getItem('authToken');
  if (!token) {
    container.innerHTML = '<p>로그인하면 관심종목을 저장할 수 있습니다.</p>';
    return;
  }
  
  try {
    // 서버에서 관심종목 조회
    var result = await fetch(API_BASE + '/api/watchlist', {
      headers: {
        'Authorization': token
      }
    }).then(function(res) { return res.json(); });
    
    if (!result.success || !result.data || result.data.length === 0) {
      container.innerHTML = '<p>관심 종목이 없습니다.</p>';
      return;
    }
    
    var watchlistData = result.data;
    var html = '<table><thead><tr><th>종목명</th><th>코드</th><th>현재가</th><th>등락</th><th>기능</th></tr></thead><tbody>';
    
    for (var i = 0; i < watchlistData.length; i++) {
      var item = watchlistData[i];
      var stockResult = await apiCall('/api/korea/stock/' + item.stock_code);
      var data = stockResult.success ? stockResult.data : null;
      
      var price = data ? data.price.toLocaleString() + '원' : '--';
      var change = data ? data.change : 0;
      var changeClass = change >= 0 ? 'positive' : 'negative';
      var changeText = data ? (change >= 0 ? '+' : '') + change.toLocaleString() : '--';
      
      html += '<tr>';
      html += '<td><strong>' + (item.stock_name || item.stock_code) + '</strong></td>';
      html += '<td>' + item.stock_code + '</td>';
      html += '<td>' + price + '</td>';
      html += '<td class="' + changeClass + '">' + changeText + '</td>';
      html += '<td>';
      html += '<button onclick="analyzeStock(\'' + item.stock_code + '\')">분석</button> ';
      html += '<button class="btn-danger" onclick="removeFromWatchlist(\'' + item.stock_code + '\')">삭제</button>';
      html += '</td>';
      html += '</tr>';
    }
    
    html += '</tbody></table>';
    container.innerHTML = html;
  } catch (error) {
    console.error('관심종목 로드 오류:', error);
    container.innerHTML = '<p>관심종목을 불러올 수 없습니다.</p>';
  }
}



async function removeFromWatchlist(code) {
  var token = localStorage.getItem('authToken');
  if (!token) {
    alert('로그인이 필요합니다.');
    return;
  }
  
  try {
    var result = await apiCall('/api/watchlist/remove', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token
      },
      body: JSON.stringify({ stockCode: code })
    });
    
    if (result.success) {
      loadWatchlist();
    } else {
      alert(result.message || '삭제 실패');
    }
  } catch (error) {
    console.error('관심종목 삭제 오류:', error);
    alert('오류가 발생했습니다.');
  }
}



// ==================== 미국 주식 ====================
async function handleUsStockSearch() {
  var keyword = document.getElementById('us-stock-input').value.trim();
  if (!keyword) {
    alert('검색어를 입력하세요.');
    return;
  }

  showLoading();
  
  try {
    var result = await apiCall('/api/us/search?keyword=' + encodeURIComponent(keyword));
    console.log('미국 주식 검색:', result);
    
    if (result.success && result.data && result.data.length > 0) {
      displayUsSearchResults(result.data);
    } else {
      document.getElementById('us-search-results').innerHTML = '<p>검색 결과가 없습니다.</p>';
    }
  } catch (error) {
    console.error('미국 주식 검색 오류:', error);
  }
  
  hideLoading();
}

function displayUsSearchResults(results) {
  var container = document.getElementById('us-search-results');
  var html = '';
  
  results.forEach(function(stock) {
    html += '<div style="padding:10px; border-bottom:1px solid #eee; cursor:pointer;" onclick="selectUsStock(\'' + stock.symbol + '\')">';
    html += '<strong>' + stock.symbol + '</strong> <span style="color:#666;">' + stock.name + '</span>';
    html += '</div>';
  });
  
  container.innerHTML = html;
}

async function selectUsStock(symbol) {
  showLoading();
  
  try {
    var result = await apiCall('/api/us/quote/' + symbol);
    
    if (result.success && result.data) {
      displayUsStockInfo(result.data);
      selectedUsStock = { symbol: symbol, name: result.data.name || symbol };
      document.getElementById('us-watchlist-btn-area').style.display = 'block';
    }
    
    await drawUsStockChart(symbol);
  } catch (error) {
    console.error('미국 주식 조회 오류:', error);
  }
  
  hideLoading();
}

function displayUsStockInfo(data) {
  var container = document.getElementById('us-stock-result');
  var changeClass = data.change >= 0 ? 'positive' : 'negative';
  var changeSign = data.change >= 0 ? '+' : '';
  
  var html = '<div class="card"><h3>' + data.name + ' (' + data.symbol + ')</h3>';
  html += '<div class="indicators-grid">';
  html += '<div class="indicator-card"><div class="label">현재가</div><div class="value">$' + data.price.toFixed(2) + '</div></div>';
  html += '<div class="indicator-card"><div class="label">등락</div><div class="value ' + changeClass + '">' + changeSign + data.change.toFixed(2) + ' (' + changeSign + data.changePercent.toFixed(2) + '%)</div></div>';
  html += '<div class="indicator-card"><div class="label">고가</div><div class="value">$' + data.high.toFixed(2) + '</div></div>';
  html += '<div class="indicator-card"><div class="label">저가</div><div class="value">$' + data.low.toFixed(2) + '</div></div>';
  html += '</div></div>';
  
  container.innerHTML = html;
}

// 미국 주식 차트 그리기 (TradingView)
async function drawUsStockChart(symbol) {
  try {
    var result = await apiCall('/api/us/candles/' + symbol);
    
    if (!result.success || !result.data || result.data.length === 0) {
      document.getElementById('us-chart-card').style.display = 'none';
      return;
    }
    
    if (!result.success || !result.data || result.data.length === 0) {
      document.getElementById('us-chart-card').style.display = 'none';
      return;
    }
    
    document.getElementById('us-chart-card').style.display = 'block';
    
    // 시간대에 따라 데이터 개수 조정
    var dataCount = 200;
    if (currentUsTimeframe === 'weekly') {
      dataCount = 2000;
    } else if (currentUsTimeframe === 'monthly') {
      dataCount = 3000;
    }

    var rawData = result.data.slice(-dataCount);
    
    // 주봉/월봉 변환
    if (currentUsTimeframe === 'weekly') {
      rawData = convertToWeekly(rawData);
    } else if (currentUsTimeframe === 'monthly') {
      rawData = convertToMonthly(rawData);
    }


    // 날짜 형식 변환 (RSI/MACD 등에 전달할 데이터)
    var formattedData = rawData.map(function(item) {
      var dateStr = item.date || item.time;
      var formattedDate = dateStr;
      
      if (dateStr && dateStr.length === 8 && !dateStr.includes('-')) {
        formattedDate = dateStr.substring(0, 4) + '-' + 
                        dateStr.substring(4, 6) + '-' + 
                        dateStr.substring(6, 8);
      }
      
      return {
        time: formattedDate,
        open: parseFloat(item.open || item.close),
        high: parseFloat(item.high || item.close),
        low: parseFloat(item.low || item.close),
        close: parseFloat(item.close),
        volume: item.volume || 0
      };
    });

    window.currentChartData = chartData;  // 전역 변수에 저장

    
    // 날짜 형식 변환
    var chartData = rawData.map(function(item) {
      var dateStr = item.date || item.time;
      var formattedDate = dateStr;
      
      if (dateStr && dateStr.length === 8 && !dateStr.includes('-')) {
        formattedDate = dateStr.substring(0, 4) + '-' + 
                        dateStr.substring(4, 6) + '-' + 
                        dateStr.substring(6, 8);
      }
      
      return {
        time: formattedDate,
        open: parseFloat(item.open || item.close),
        high: parseFloat(item.high || item.close),
        low: parseFloat(item.low || item.close),
        close: parseFloat(item.close),
        volume: item.volume || 0
      };
    });

    
    
    window.currentUsChartData = formattedData;
    // 기존 Chart.js 차트 제거
    if (usStockChart) {
      usStockChart.destroy();
      usStockChart = null;
    }
    
    // 기존 TradingView 차트 제거
    if (tvUsStockChart) {
      try {
        tvUsStockChart.remove();
      } catch (e) {
        console.log('차트 제거 중 에러 (무시):', e.message);
      }
      tvUsStockChart = null;
    }

    // TradingView 차트 생성
    tvUsStockChart = createTradingViewChart('us-stock-chart', chartData, false, usIndicatorSettings, currentUsTimeframe);

    // RSI 카드 표시 및 차트 생성
    // 보조 지표 선택 카드 표시
    document.getElementById('us-sub-indicator-card').style.display = 'block';
    createRSIChart('us-rsi-chart', formattedData);

    // MACD 카드 표시 및 차트 생성
    document.getElementById('us-macd-card').style.display = 'block';
    createMACDChart('us-macd-chart', formattedData);


    // 스토캐스틱 카드 표시 및 차트 생성
    document.getElementById('us-stochastic-card').style.display = 'block';
    createStochasticChart('us-stochastic-chart', formattedData);


    // ATR 카드 표시 및 차트 생성
    document.getElementById('us-atr-card').style.display = 'block';
    createATRChart('us-atr-chart', formattedData);


    // 저장된 메모 불러오기
    loadUsMemo(symbol);


  } catch (error) {
    console.error('미국 주식 차트 오류:', error);
  }
}


function handleAddUsWatchlist() {
  if (!selectedUsStock) {
    alert('먼저 종목을 선택하세요.');
    return;
  }
  
  if (usWatchlist.find(function(item) { return item.symbol === selectedUsStock.symbol; })) {
    alert('이미 관심 종목에 있습니다.');
    return;
  }
  
  usWatchlist.push({
    symbol: selectedUsStock.symbol,
    name: selectedUsStock.name,
    addedAt: new Date().toISOString()
  });
  
  localStorage.setItem('usWatchlist', JSON.stringify(usWatchlist));
  alert(selectedUsStock.symbol + ' 추가되었습니다!');
  loadUsWatchlist();
  
  selectedUsStock = null;
  document.getElementById('us-watchlist-btn-area').style.display = 'none';
}


// 미국 관심종목 직접 추가 (입력창에서)
async function handleAddUsWatchlistDirect() {
  var symbol = document.getElementById('us-watchlist-add-input').value.trim().toUpperCase();
  
  if (!symbol) {
    alert('심볼을 입력하세요.');
    return;
  }
  
  // 중복 체크
  if (usWatchlist.find(function(item) { return item.symbol === symbol; })) {
    alert('이미 관심 종목에 있습니다.');
    return;
  }
  
  // 종목 정보 조회
  showLoading();
  try {
    var result = await apiCall('/api/us/quote/' + symbol);
    
    if (result.success && result.data) {
      usWatchlist.push({
        symbol: symbol,
        name: result.data.name || symbol,
        addedAt: new Date().toISOString()
      });
      
      localStorage.setItem('usWatchlist', JSON.stringify(usWatchlist));
      alert(symbol + ' 추가되었습니다!');
      
      // 입력창 초기화
      document.getElementById('us-watchlist-add-input').value = '';
      
      // 목록 새로고침
      loadUsWatchlist();
    } else {
      alert('종목을 찾을 수 없습니다. 심볼을 확인하세요.');
    }
  } catch (error) {
    console.error('미국 관심종목 추가 오류:', error);
    alert('오류가 발생했습니다.');
  }
  hideLoading();
}


async function loadUsWatchlist() {
  var container = document.getElementById('us-watchlist-container');
  
  if (usWatchlist.length === 0) {
    container.innerHTML = '<p>관심 종목이 없습니다.</p>';
    return;
  }
  
  var html = '<table><thead><tr><th>종목명</th><th>심볼</th><th>현재가</th><th>등락</th><th>기능</th></tr></thead><tbody>';
  
  for (var i = 0; i < usWatchlist.length; i++) {
    var item = usWatchlist[i];
    var result = await apiCall('/api/us/quote/' + item.symbol);
    var data = result.success ? result.data : null;
    
    var price = data ? '$' + data.price.toFixed(2) : '--';
    var change = data ? data.change : 0;
    var changePercent = data ? data.changePercent : 0;
    var changeClass = change >= 0 ? 'positive' : 'negative';
    var changeText = data ? (change >= 0 ? '+' : '') + change.toFixed(2) + ' (' + (changePercent >= 0 ? '+' : '') + changePercent.toFixed(2) + '%)' : '--';
    
    html += '<tr>';
    html += '<td><strong>' + item.name + '</strong></td>';
    html += '<td>' + item.symbol + '</td>';
    html += '<td>' + price + '</td>';
    html += '<td class="' + changeClass + '">' + changeText + '</td>';
    html += '<td>';
    html += '<button onclick="showUsStockChart(\'' + item.symbol + '\')">차트</button> ';
    html += '<button class="btn-danger" onclick="removeFromUsWatchlist(\'' + item.symbol + '\')">삭제</button>';
    html += '</td>';
    html += '</tr>';
  }
  
  html += '</tbody></table>';
  container.innerHTML = html;
}

// 미국 주식 차트 표시
async function showUsStockChart(symbol) {
  // 미국 주식 탭으로 이동
  document.querySelectorAll('.tab-content').forEach(function(tab) {
    tab.classList.remove('active');
  });
  document.getElementById('tab-us-stock').classList.add('active');
  
  document.querySelectorAll('.nav-item').forEach(function(nav) {
    nav.classList.remove('active');
    if (nav.getAttribute('data-tab') === 'us-stock') {
      nav.classList.add('active');
    }
  });
  
  // 차트 로드
  await selectUsStock(symbol);
}



function removeFromUsWatchlist(symbol) {
  usWatchlist = usWatchlist.filter(function(item) { return item.symbol !== symbol; });
  localStorage.setItem('usWatchlist', JSON.stringify(usWatchlist));
  loadUsWatchlist();
}

// ==================== 테마 분석 ====================
async function loadThemeList() {
  showLoading();
  
  try {
    var result = await apiCall('/api/korea/themes');
    console.log('테마 목록:', result);
    
    if (result.success && result.data && result.data.length > 0) {
      displayThemeList(result.data);
    } else {
      document.getElementById('theme-list-container').innerHTML = '<p>테마 목록을 불러올 수 없습니다.</p>';
    }
  } catch (error) {
    console.error('테마 목록 오류:', error);
  }
  
  hideLoading();
}

function displayThemeList(themes) {
  var container = document.getElementById('theme-list-container');
  var html = '<table class="table-fit"><thead><tr><th>테마명</th><th>등락률</th><th>분석</th></tr></thead><tbody>';
  
  themes.forEach(function(theme) {
    var changeClass = theme.changeRate && theme.changeRate.includes('-') ? 'negative' : 'positive';
    html += '<tr style="cursor:pointer;" onclick="selectTheme(\'' + theme.code + '\', \'' + theme.name + '\')">';
    html += '<td><strong>' + theme.name + '</strong></td>';
    html += '<td class="' + changeClass + '">' + (theme.changeRate || '0.00%') + '</td>';
    html += '<td><button onclick="event.stopPropagation(); analyzeTheme(\'' + theme.code + '\', \'' + theme.name + '\')">분석</button></td>';
    html += '</tr>';
  });
  
  html += '</tbody></table>';
  container.innerHTML = html;
}

async function selectTheme(themeCode, themeName) {
  showLoading();
  
  try {
    var result = await apiCall('/api/korea/theme/' + themeCode);
    
    if (result.success && result.data && result.data.length > 0) {
      document.getElementById('selected-theme-name').textContent = themeName;
      displayThemeStocks(result.data);
      document.getElementById('theme-stocks-card').style.display = 'block';
    }
  } catch (error) {
    console.error('테마 종목 오류:', error);
  }
  
  hideLoading();
}


function displayThemeStocks(stocks) {
  var container = document.getElementById('theme-stocks-container');
  
  var html = '<table class="table-fit"><thead><tr>';
  html += '<th>종목명</th>';
  html += '<th class="hide-mobile">코드</th>';
  html += '<th>현재가</th>';
  html += '<th>등락</th>';
  html += '<th>기능</th>';
  html += '</tr></thead><tbody>';
  
  stocks.forEach(function(stock) {
    var changeClass = stock.changeType === 'up' ? 'positive' : 'negative';
    html += '<tr>';
    html += '<td><strong>' + stock.name + '</strong></td>';
    html += '<td class="hide-mobile">' + stock.code + '</td>';
    html += '<td>' + (stock.price > 0 ? stock.price.toLocaleString() + '원' : '--') + '</td>';
    var changeText = stock.change || '--';
    // 앞의 - 기호 제거
    if (changeText.startsWith('-') && !changeText.match(/^-[\d]/)) {
      changeText = changeText.substring(1);
    }
    html += '<td class="' + changeClass + '">' + changeText + '</td>';
    html += '<td><button onclick="analyzeStock(\'' + stock.code + '\')">분석</button></td>';
    html += '</tr>';
  });
  
  html += '</tbody></table>';
  container.innerHTML = html;
}

async function analyzeTheme(themeCode, themeName) {
  showLoading();
  
  try {
    var result = await apiCall('/api/korea/theme/' + themeCode);
    
    if (!result.success || !result.data || result.data.length === 0) {
      alert('테마 종목을 불러올 수 없습니다.');
      hideLoading();
      return;
    }
    
    var stocks = result.data;
    var analyzedStocks = [];
    var limit = Math.min(stocks.length, 10);
    
    for (var i = 0; i < limit; i++) {
      try {
        var analysisResult = await apiCall('/api/analysis/technical/' + stocks[i].code);
        
        if (analysisResult.success && analysisResult.data) {
          var data = analysisResult.data;
          var score = (data.technicalScore || 0) * 0.5 + (data.fundamentalScore || 0) * 0.5;
          if (data.rsi && data.rsi >= 30 && data.rsi <= 70) score += 10;
          
          analyzedStocks.push({
            code: stocks[i].code,
            name: stocks[i].name,
            score: Math.round(score),
            rsi: data.rsi || 0,
            signal: data.signal || 'HOLD'
          });
        }
      } catch (err) {
        console.log('종목 분석 실패:', stocks[i].code);
      }
    }
    
    analyzedStocks.sort(function(a, b) { return b.score - a.score; });
    displayThemeAnalysis(themeName, analyzedStocks);
    
  } catch (error) {
    console.error('테마 분석 오류:', error);
  }
  
  hideLoading();
}



function displayThemeAnalysis(themeName, stocks) {
  document.getElementById('theme-analysis-card').style.display = 'block';
  var container = document.getElementById('theme-analysis-result');
  
  var html = '<p><strong>' + themeName + '</strong> 테마 상위 종목</p>';
  html += '<div style="overflow-x:auto; -webkit-overflow-scrolling:touch;">';
  html += '<table style="min-width:500px;"><thead><tr>';
  html += '<th>순위</th>';
  html += '<th>종목명</th>';
  html += '<th>점수</th>';
  html += '<th>RSI</th>';
  html += '<th>신호</th>';
  html += '<th>기능</th>';
  html += '</tr></thead><tbody>';
  
  stocks.forEach(function(stock, index) {
    var signalClass = stock.signal === 'BUY' ? 'positive' : (stock.signal === 'SELL' ? 'negative' : '');
    var medal = index === 0 ? '🥇' : (index === 1 ? '🥈' : (index === 2 ? '🥉' : (index + 1)));
    
    html += '<tr>';
    html += '<td>' + medal + '</td>';
    html += '<td><strong>' + stock.name + '</strong></td>';
    html += '<td style="color:#3b82f6; font-weight:bold;">' + stock.score + '점</td>';
    html += '<td>' + stock.rsi.toFixed(1) + '</td>';
    html += '<td class="' + signalClass + '">' + stock.signal + '</td>';
    html += '<td><button onclick="analyzeStock(\'' + stock.code + '\')">분석</button></td>';
    html += '</tr>';
  });
  
  html += '</tbody></table>';
  html += '</div>';
  container.innerHTML = html;
}


// ==================== 포트폴리오 ====================
async function handleAddPortfolio() {
  var input = document.getElementById('portfolio-code').value.trim();
  var qty = parseInt(document.getElementById('portfolio-qty').value);
  var price = parseInt(document.getElementById('portfolio-price').value);
  
  if (!input || !qty || !price) {
    alert('모든 항목을 입력하세요.');
    return;
  }
  
  // 로그인 확인
  var token = localStorage.getItem('authToken');
  if (!token) {
    alert('로그인이 필요합니다.');
    openAuthModal();
    return;
  }
  
  showLoading();
  
  try {
    // 종목코드 찾기
    var stockCode = await findStockCode(input);
    
    if (!stockCode) {
      alert('종목을 찾을 수 없습니다: ' + input);
      hideLoading();
      return;
    }
    
    // 종목명 조회
    var stockResult = await apiCall('/api/korea/stock/' + stockCode);
    var stockName = stockResult.success && stockResult.data ? stockResult.data.name : stockCode;
    
    // 서버에 추가
    var addResult = await apiCall('/api/portfolio/add', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token
      },
      body: JSON.stringify({
        stockCode: stockCode,
        stockName: stockName,
        quantity: qty,
        buyPrice: price
      })
    });
    
    if (addResult.success) {
      document.getElementById('portfolio-code').value = '';
      document.getElementById('portfolio-qty').value = '';
      document.getElementById('portfolio-price').value = '';
      
      loadPortfolio();
      updateAlertStockSelect();
      alert('포트폴리오에 추가되었습니다!');
    } else {
      alert(addResult.message || '추가 실패');
    }
  } catch (error) {
    console.error('포트폴리오 추가 오류:', error);
    alert('오류가 발생했습니다.');
  }
  
  hideLoading();
}




async function loadPortfolio() {
  var container = document.getElementById('portfolio-list');
  var summaryContainer = document.getElementById('portfolio-summary');
  
  // 로그인 확인
  var token = localStorage.getItem('authToken');
  if (!token) {
    container.innerHTML = '<p>로그인하면 포트폴리오를 저장할 수 있습니다.</p>';
    summaryContainer.innerHTML = '<p>--</p>';
    return;
  }
  
  try {
    // 서버에서 포트폴리오 조회
    var result = await fetch(API_BASE + '/api/portfolio', {
      headers: {
        'Authorization': token
      }
    }).then(function(res) { return res.json(); });
    
    if (!result.success || !result.data || result.data.length === 0) {
      container.innerHTML = '<p>등록된 주식이 없습니다.</p>';
      summaryContainer.innerHTML = '<p>--</p>';
      return;
    }
    
    var portfolioData = result.data;
    
    // 전역 portfolio 변수 업데이트 (알림 드롭다운용)
    portfolio = portfolioData.map(function(item) {
      return {
        code: item.stock_code,
        name: item.stock_name || item.stock_code,
        qty: item.quantity,
        price: item.buy_price
      };
    });
    
    var html = '<table><thead><tr><th>종목</th><th>수량</th><th>매수가</th><th>현재가</th><th>평가금</th><th>수익</th><th>기능</th></tr></thead><tbody>';
    
    var totalInvest = 0;
    var totalValue = 0;
    
    for (var i = 0; i < portfolioData.length; i++) {
      var item = portfolioData[i];
      var stockResult = await apiCall('/api/korea/stock/' + item.stock_code);
      var data = stockResult.success ? stockResult.data : null;
      
      var currentPrice = data ? data.price : 0;
      var investAmt = item.quantity * item.buy_price;
      var valueAmt = item.quantity * currentPrice;
      var profit = valueAmt - investAmt;
      var profitRate = investAmt > 0 ? ((profit / investAmt) * 100).toFixed(2) : 0;
      var profitClass = profit >= 0 ? 'positive' : 'negative';
      
      totalInvest += investAmt;
      totalValue += valueAmt;
      
      html += '<tr>';
      html += '<td><strong>' + (item.stock_name || item.stock_code) + '</strong></td>';
      html += '<td>' + item.quantity + '주</td>';
      html += '<td>' + Number(item.buy_price).toLocaleString() + '원</td>';
      html += '<td>' + (currentPrice > 0 ? currentPrice.toLocaleString() + '원' : '--') + '</td>';
      html += '<td>' + valueAmt.toLocaleString() + '원</td>';
      html += '<td class="' + profitClass + '">' + (profit >= 0 ? '+' : '') + profit.toLocaleString() + '원 (' + (profit >= 0 ? '+' : '') + profitRate + '%)</td>';
      html += '<td><button class="btn-danger" onclick="removeFromPortfolio(' + item.id + ')">삭제</button></td>';
      html += '</tr>';
    }
    
    html += '</tbody></table>';
    container.innerHTML = html;
    
    // 총 평가
    var totalProfit = totalValue - totalInvest;
    var totalProfitRate = totalInvest > 0 ? ((totalProfit / totalInvest) * 100).toFixed(2) : 0;
    var totalClass = totalProfit >= 0 ? 'positive' : 'negative';
    
    var summaryHtml = '<div class="indicators-grid">';
    summaryHtml += '<div class="indicator-card"><div class="label">총 투자금</div><div class="value">' + totalInvest.toLocaleString() + '원</div></div>';
    summaryHtml += '<div class="indicator-card"><div class="label">총 평가금</div><div class="value">' + totalValue.toLocaleString() + '원</div></div>';
    summaryHtml += '<div class="indicator-card"><div class="label">총 수익</div><div class="value ' + totalClass + '">' + (totalProfit >= 0 ? '+' : '') + totalProfit.toLocaleString() + '원</div></div>';
    summaryHtml += '<div class="indicator-card"><div class="label">수익률</div><div class="value ' + totalClass + '">' + (totalProfit >= 0 ? '+' : '') + totalProfitRate + '%</div></div>';
    summaryHtml += '</div>';
    summaryContainer.innerHTML = summaryHtml;
    
    // 알림 드롭다운 업데이트
    updateAlertStockSelect();
  } catch (error) {
    console.error('포트폴리오 로드 오류:', error);
    container.innerHTML = '<p>포트폴리오를 불러올 수 없습니다.</p>';
  }
}



async function removeFromPortfolio(id) {
  var token = localStorage.getItem('authToken');
  if (!token) {
    alert('로그인이 필요합니다.');
    return;
  }
  
  try {
    var result = await apiCall('/api/portfolio/remove', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token
      },
      body: JSON.stringify({ id: id })
    });
    
    if (result.success) {
      loadPortfolio();
    } else {
      alert(result.message || '삭제 실패');
    }
  } catch (error) {
    console.error('포트폴리오 삭제 오류:', error);
    alert('오류가 발생했습니다.');
  }
}


// ==================== 대시보드 (최적화 버전) ====================
async function loadDashboard() {
  // ========== 1단계: 초기 데이터 병렬 로딩 ==========
  try {
    // 4개 API를 동시에 호출 (병렬 처리)
    var [marketResult, kospiResult, kosdaqResult, newsResult] = await Promise.all([
      apiCall('/api/korea/market-index'),
      apiCall('/api/korea/market-cap/0'),
      apiCall('/api/korea/market-cap/1'),
      apiCall('/api/korea/news/' + encodeURIComponent('증시 주식시장'))
    ]);

    // ========== 시장 정보 표시 ==========
    if (marketResult.success && marketResult.data) {
      var data = marketResult.data;
      var marketHtml = '<div class="indicators-grid">';
      
      var kospiClass = data.kospi.change && data.kospi.change.includes('-') ? 'negative' : 'positive';
      var kosdaqClass = data.kosdaq.change && data.kosdaq.change.includes('-') ? 'negative' : 'positive';
      
      marketHtml += '<div class="indicator-card">';
      marketHtml += '<div class="label">KOSPI</div>';
      marketHtml += '<div class="value">' + data.kospi.value + '</div>';
      if (data.kospi.change && data.kospi.change !== '--') {
        marketHtml += '<div class="' + kospiClass + '">' + data.kospi.change + '</div>';
      }
      marketHtml += '</div>';
      
      marketHtml += '<div class="indicator-card">';
      marketHtml += '<div class="label">KOSDAQ</div>';
      marketHtml += '<div class="value">' + data.kosdaq.value + '</div>';
      if (data.kosdaq.change && data.kosdaq.change !== '--') {
        marketHtml += '<div class="' + kosdaqClass + '">' + data.kosdaq.change + '</div>';
      }
      marketHtml += '</div>';
      
      marketHtml += '</div>';
      document.getElementById('market-summary').innerHTML = marketHtml;
    } else {
      document.getElementById('market-summary').innerHTML = '<p>시장 정보를 불러올 수 없습니다.</p>';
    }

    // ========== 주요 뉴스 표시 ==========
    if (newsResult.success && newsResult.data && newsResult.data.length > 0) {
      var newsHtml = '<ul style="list-style:none; padding:0; margin:0;">';
      
      newsResult.data.slice(0, 5).forEach(function(item) {
        newsHtml += '<li style="padding:8px 0; border-bottom:1px solid #eee;">';
        newsHtml += '<a href="' + item.link + '" target="_blank" style="color:#1e40af; text-decoration:none;">';
        newsHtml += item.title;
        newsHtml += '</a>';
        newsHtml += '</li>';
      });
      
      newsHtml += '</ul>';
      document.getElementById('main-news').innerHTML = newsHtml;
    } else {
      document.getElementById('main-news').innerHTML = '<p>뉴스를 불러올 수 없습니다.</p>';
    }

  } catch (error) {
    console.error('초기 데이터 로딩 오류:', error);
    document.getElementById('market-summary').innerHTML = '<p>시장 정보를 불러올 수 없습니다.</p>';
    document.getElementById('main-news').innerHTML = '<p>뉴스를 불러올 수 없습니다.</p>';
  }

  // ========== 2단계: 추천 종목 분석 (기존 방식 유지) ==========
  try {
    document.getElementById('recommended-stocks').innerHTML = '<p>🤖 AI 분석 중...</p>';
    
    var allStocks = [];
    if (kospiResult.success && kospiResult.data) {
      allStocks = allStocks.concat(kospiResult.data);
    }
    if (kosdaqResult.success && kosdaqResult.data) {
      allStocks = allStocks.concat(kosdaqResult.data);
    }
    
    if (allStocks.length > 0) {
      // 시가총액별 분류
      var largeStocks = allStocks.filter(function(s) { return s.marketCap >= 100000; }).slice(0, 5);
      var midStocks = allStocks.filter(function(s) { return s.marketCap >= 10000 && s.marketCap < 100000; }).slice(0, 5);
      var smallStocks = allStocks.filter(function(s) { return s.marketCap < 10000; }).slice(0, 5);
      
      // 각 카테고리별 분석
      async function analyzeCategory(stocks) {
        var analyzed = [];
        for (var i = 0; i < stocks.length; i++) {
          try {
            var techResult = await apiCall('/api/analysis/technical/' + stocks[i].code);
            if (techResult.success) {
              var stockData = {
                code: stocks[i].code,
                name: stocks[i].name,
                price: stocks[i].price,
                marketCap: stocks[i].marketCap,
                techScore: techResult.data.technicalScore || 0,
                volumeRatio: techResult.data.volumeRatio || 0,
                currentPrice: techResult.data.currentPrice || 0,
                ma20: techResult.data.ma20 || 0,
                ma60: techResult.data.ma60 || 0,
                changeRate: techResult.data.changeRate || 0
              };
              var scoreResult = calculateNewScore(stockData);
              stockData.newScore = scoreResult.totalScaled;
              analyzed.push(stockData);
            }
          } catch (e) {
            console.log('분석 오류:', stocks[i].name);
          }
        }
        analyzed.sort(function(a, b) { return b.newScore - a.newScore; });
        return analyzed.slice(0, 2);
      }
      
      document.getElementById('recommended-stocks').innerHTML = '<p>🤖 대형주 분석 중...</p>';
      var topLarge = await analyzeCategory(largeStocks);
      
      document.getElementById('recommended-stocks').innerHTML = '<p>🤖 중형주 분석 중...</p>';
      var topMid = await analyzeCategory(midStocks);
      
      document.getElementById('recommended-stocks').innerHTML = '<p>🤖 소형주 분석 중...</p>';
      var topSmall = await analyzeCategory(smallStocks);
      
      // 결과 표시
      var topHtml = '';
      
      // 대형주 TOP 2
      topHtml += '<div style="margin-bottom:10px;"><strong>🏢 대형주</strong></div>';
      topLarge.forEach(function(stock, index) {
        var medal = index === 0 ? '🥇' : '🥈';
        topHtml += '<div style="padding:6px 0; border-bottom:1px solid #eee; cursor:pointer;" onclick="analyzeStock(\'' + stock.code + '\')">';
        topHtml += '<span style="margin-right:8px;">' + medal + '</span>';
        topHtml += '<strong>' + stock.name + '</strong>';
        topHtml += '<span style="color:#3b82f6; margin-left:10px; font-weight:bold;">' + stock.newScore + '점</span>';
        topHtml += '</div>';
      });
      
      // 중형주 TOP 2
      topHtml += '<div style="margin:10px 0 10px 0;"><strong>🏠 중형주</strong></div>';
      topMid.forEach(function(stock, index) {
        var medal = index === 0 ? '🥇' : '🥈';
        topHtml += '<div style="padding:6px 0; border-bottom:1px solid #eee; cursor:pointer;" onclick="analyzeStock(\'' + stock.code + '\')">';
        topHtml += '<span style="margin-right:8px;">' + medal + '</span>';
        topHtml += '<strong>' + stock.name + '</strong>';
        topHtml += '<span style="color:#3b82f6; margin-left:10px; font-weight:bold;">' + stock.newScore + '점</span>';
        topHtml += '</div>';
      });
      
      // 소형주 TOP 2
      topHtml += '<div style="margin:10px 0 10px 0;"><strong>🏪 소형주</strong></div>';
      topSmall.forEach(function(stock, index) {
        var medal = index === 0 ? '🥇' : '🥈';
        topHtml += '<div style="padding:6px 0; border-bottom:1px solid #eee; cursor:pointer;" onclick="analyzeStock(\'' + stock.code + '\')">';
        topHtml += '<span style="margin-right:8px;">' + medal + '</span>';
        topHtml += '<strong>' + stock.name + '</strong>';
        topHtml += '<span style="color:#3b82f6; margin-left:10px; font-weight:bold;">' + stock.newScore + '점</span>';
        topHtml += '</div>';
      });
      
      topHtml += '<p style="font-size:0.8rem; color:#999; margin-top:10px;">※ AI 종합 점수 기준 (시가총액별 TOP 2)</p>';
      document.getElementById('recommended-stocks').innerHTML = topHtml;
    } else {
      document.getElementById('recommended-stocks').innerHTML = '<p>데이터를 불러올 수 없습니다.</p>';
    }
  } catch (error) {
    console.error('추천종목 오류:', error);
    document.getElementById('recommended-stocks').innerHTML = '<p>데이터를 불러올 수 없습니다.</p>';
  }

  // ========== 3단계: 나머지 정보 로딩 ==========
  // 포트폴리오 요약
  loadDashboardPortfolio();

  // 알림 현황
  loadDashboardAlerts();

  // 환율 정보
  loadDashboardExchange();
  
  // 성능 모니터링 업데이트
  setTimeout(updatePerformanceMonitor, 1000);
}



// 대시보드 강제 새로고침 (캐시 무시)
function refreshDashboard() {
  // 캐시 클리어
  if (typeof cacheManager !== 'undefined') {
    const cleared = cacheManager.clear();
    console.log('🔄 캐시 클리어:', cleared + '개 항목 삭제');
  }
  
  // 대시보드 다시 로드
  loadDashboard();
  
  // 사용자 피드백
  showLoading();
  setTimeout(function() {
    hideLoading();
    alert('✅ 최신 데이터로 새로고침 완료!');
  }, 1000);
}


// 성능 모니터링 패널 토글
function togglePerformancePanel() {
  var panel = document.getElementById('performance-panel');
  var toggle = document.getElementById('performance-toggle');
  
  if (panel.style.display === 'none') {
    panel.style.display = 'block';
    toggle.textContent = '▼';
  } else {
    panel.style.display = 'none';
    toggle.textContent = '▶';
  }
}

// 성능 모니터링 데이터 업데이트
function updatePerformanceMonitor() {
  if (typeof cacheManager === 'undefined') return;
  
  // 요소가 존재하는지 확인
  var hitRateEl = document.getElementById('perf-hit-rate');
  if (!hitRateEl) return;
  
  var stats = cacheManager.getStats();
  
  document.getElementById('perf-hit-rate').textContent = stats.hitRate;
  document.getElementById('perf-cache-size').textContent = stats.size;
  document.getElementById('perf-api-calls').textContent = stats.misses;
  document.getElementById('perf-memory').textContent = stats.memory;
}

// 주기적으로 성능 모니터링 업데이트 (5초마다)
setInterval(updatePerformanceMonitor, 5000);


// ==================== 매도 알림 ====================
function handleAlertTypeChange() {
  var type = document.getElementById('alert-type').value;
  
  if (type === 'percent') {
    document.getElementById('percent-options').style.display = 'block';
    document.getElementById('price-options').style.display = 'none';
  } else if (type === 'price') {
    document.getElementById('percent-options').style.display = 'none';
    document.getElementById('price-options').style.display = 'block';
  } else {
    document.getElementById('percent-options').style.display = 'none';
    document.getElementById('price-options').style.display = 'none';
  }
}

function updateAlertStockSelect() {
  var select = document.getElementById('alert-stock-select');
  select.innerHTML = '<option value="">-- 보유 종목 선택 --</option>';
  
  portfolio.forEach(function(item) {
    var option = document.createElement('option');
    option.value = item.code;
    option.textContent = (item.name || item.code) + ' (' + item.code + ')';
    select.appendChild(option);
  });
}

async function handleSetAlert() {
  var stockCode = document.getElementById('alert-stock-select').value;
  var alertType = document.getElementById('alert-type').value;
  
  if (!stockCode) {
    alert('종목을 선택하세요.');
    return;
  }
  
  // 포트폴리오에서 종목 정보 찾기
  var stockInfo = portfolio.find(function(item) {
    return item.code === stockCode;
  });
  
  if (!stockInfo) {
    alert('보유 종목을 찾을 수 없습니다.');
    return;
  }
  
  showLoading();
  
  try {
    // 현재가 조회
    var result = await apiCall('/api/korea/stock/' + stockCode);
    var currentPrice = result.success ? result.data.price : 0;
    var stockName = result.success ? result.data.name : stockCode;
    
    var alertData = {
      code: stockCode,
      name: stockName,
      buyPrice: stockInfo.price,
      qty: stockInfo.qty,
      currentPrice: currentPrice,
      type: alertType,
      targets: [],
      addedAt: new Date().toISOString(),
      triggered: []
    };
    
    if (alertType === 'percent') {
      // 수익률 기준
      var checkboxes = document.querySelectorAll('#percent-options input:checked');
      checkboxes.forEach(function(cb) {
        var percent = parseFloat(cb.value);
        var targetPrice = Math.round(stockInfo.price * (1 + percent / 100));
        alertData.targets.push({
          percent: percent,
          price: targetPrice,
          type: percent > 0 ? 'profit' : 'loss'
        });
      });
      
      if (alertData.targets.length === 0) {
        alert('알림 조건을 선택하세요.');
        hideLoading();
        return;
      }
    } else if (alertType === 'price') {
      // 가격 기준
      var targetPrice = parseFloat(document.getElementById('alert-target-price').value);
      var stopPrice = parseFloat(document.getElementById('alert-stop-price').value);
      
      if (targetPrice) {
        alertData.targets.push({
          percent: ((targetPrice - stockInfo.price) / stockInfo.price * 100).toFixed(1),
          price: targetPrice,
          type: 'profit'
        });
      }
      if (stopPrice) {
        alertData.targets.push({
          percent: ((stopPrice - stockInfo.price) / stockInfo.price * 100).toFixed(1),
          price: stopPrice,
          type: 'loss'
        });
      }
      
      if (alertData.targets.length === 0) {
        alert('목표가 또는 손절가를 입력하세요.');
        hideLoading();
        return;
      }
    } else if (alertType === 'auto') {
      // 기술적 분석 자동
      var analysisResult = await apiCall('/api/analysis/recommendation/' + stockCode);
      console.log('기술적 분석 결과:', analysisResult);
      
      if (analysisResult.success && analysisResult.data) {
        var data = analysisResult.data;
        var targetP = data.targetPrice || 0;
        var stopP = data.stopLoss || data.stopLossPrice || 0;
        
        if (targetP > 0) {
          var profitPercent = ((targetP - stockInfo.price) / stockInfo.price * 100).toFixed(1);
          alertData.targets.push({
            percent: profitPercent,
            price: Math.round(targetP),
            type: 'profit'
          });
        }
        if (stopP > 0) {
          var lossPercent = ((stopP - stockInfo.price) / stockInfo.price * 100).toFixed(1);
          alertData.targets.push({
            percent: lossPercent,
            price: Math.round(stopP),
            type: 'loss'
          });
        }
        
        if (alertData.targets.length === 0) {
          alert('기술적 분석에서 목표가/손절가를 계산할 수 없습니다.');
          hideLoading();
          return;
        }
      } else {
        alert('기술적 분석 데이터를 가져올 수 없습니다.');
        hideLoading();
        return;
      }
    }


    
    // 기존 알림 확인 및 업데이트
    var existingIndex = alertList.findIndex(function(item) {
      return item.code === stockCode;
    });
    
    if (existingIndex >= 0) {
      alertList[existingIndex] = alertData;
    } else {
      alertList.push(alertData);
    }
    
    localStorage.setItem('alertList', JSON.stringify(alertList));
    loadAlertList();
    
    alert('알림이 설정되었습니다!');
    
  } catch (error) {
    console.error('알림 설정 오류:', error);
  }
  
  hideLoading();
}


function loadAlertList() {
  var container = document.getElementById('alert-list-container');
  
  if (alertList.length === 0) {
    container.innerHTML = '<p>설정된 알림이 없습니다.</p>';
    return;
  }
  
  var html = '<table><thead><tr><th>종목</th><th>매수가</th><th>현재가</th><th>알림 조건</th><th>기술적 신호</th><th>상태</th><th>기능</th></tr></thead><tbody>';
  
  alertList.forEach(function(item, index) {
    var targetsHtml = '';
    if (item.targets && item.targets.length > 0) {
      targetsHtml = item.targets.map(function(t) {
        var icon = t.type === 'profit' ? '🎯' : '🛑';
        var className = t.type === 'profit' ? 'positive' : 'negative';
        var priceStr = t.price ? t.price.toLocaleString() : '--';
        var percentStr = t.percent ? ((t.percent > 0 ? '+' : '') + t.percent + '%') : '';
        return '<span class="' + className + '">' + icon + ' ' + priceStr + '원 (' + percentStr + ')</span>';
      }).join('<br>');
    } else {
      targetsHtml = '--';
    }
    
    // 기술적 신호 표시
    var techHtml = '--';
    if (item.techSignals && item.techSignals.length > 0) {
      techHtml = '<span class="negative">' + item.techSignals.join('<br>') + '</span>';
    } else {
      techHtml = '<span class="positive">✅ 정상</span>';
    }
    
    var statusHtml = '';
    if (item.triggered && item.triggered.length > 0) {
      statusHtml = '<span class="positive">🔔 알림 발생!</span>';
    } else {
      statusHtml = '<span>⏳ 대기중</span>';
    }
    
    var buyPriceStr = item.buyPrice ? item.buyPrice.toLocaleString() : '--';
    var currentPriceStr = item.currentPrice ? item.currentPrice.toLocaleString() : '--';
    
    html += '<tr>';
    html += '<td><strong>' + (item.name || item.code) + '</strong><br><small>' + item.code + '</small></td>';
    html += '<td>' + buyPriceStr + '원</td>';
    html += '<td>' + currentPriceStr + '원</td>';
    html += '<td>' + targetsHtml + '</td>';
    html += '<td>' + techHtml + '</td>';
    html += '<td>' + statusHtml + '</td>';
    html += '<td><button class="btn-danger" onclick="removeAlert(' + index + ')">삭제</button></td>';
    html += '</tr>';
  });
  
  html += '</tbody></table>';
  container.innerHTML = html;
}




function removeAlert(index) {
  if (confirm('이 알림을 삭제하시겠습니까?')) {
    alertList.splice(index, 1);
    localStorage.setItem('alertList', JSON.stringify(alertList));
    loadAlertList();
  }
}


function startMonitoring() {
  if (alertList.length === 0) {
    alert('설정된 알림이 없습니다.');
    return;
  }
  
  var intervalMinutes = parseInt(document.getElementById('monitor-interval').value);
  
  document.getElementById('start-monitor-btn').style.display = 'none';
  document.getElementById('stop-monitor-btn').style.display = 'inline-block';
  document.getElementById('monitor-status').textContent = '모니터링 중... (' + intervalMinutes + '분 간격)';
  
  // 즉시 한 번 체크
  checkAlerts();
  
  // 선택한 간격으로 체크
  monitorInterval = setInterval(checkAlerts, intervalMinutes * 60 * 1000);
}


function stopMonitoring() {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
  }
  
  document.getElementById('start-monitor-btn').style.display = 'inline-block';
  document.getElementById('stop-monitor-btn').style.display = 'none';
  document.getElementById('monitor-status').textContent = '모니터링 중지됨';
}

async function checkAlerts() {
  var now = new Date().toLocaleTimeString();
  document.getElementById('monitor-status').textContent = '마지막 체크: ' + now;
  
  for (var i = 0; i < alertList.length; i++) {
    var item = alertList[i];
    
    try {
      // 현재가 조회
      var result = await apiCall('/api/korea/stock/' + item.code);
      
      if (result.success) {
        var currentPrice = result.data.price;
        alertList[i].currentPrice = currentPrice;
        
        // 1. 가격 목표 체크
        item.targets.forEach(function(target) {
          var triggered = false;
          
          if (target.type === 'profit' && currentPrice >= target.price) {
            triggered = true;
          } else if (target.type === 'loss' && currentPrice <= target.price) {
            triggered = true;
          }
          
          if (triggered && !item.triggered.includes(target.price)) {
            alertList[i].triggered.push(target.price);
            
            // 새 팝업 알림 표시
            showNotification({
              title: target.type === 'profit' ? '목표가 도달!' : '손절가 도달!',
              stockName: item.name + ' (' + item.code + ')',
              message: '현재가: ' + currentPrice.toLocaleString() + '원 (설정: ' + target.price.toLocaleString() + '원)',
              type: target.type === 'profit' ? 'profit' : 'loss'
            });
          }
        });
      }
      
      // 2. 기술적 분석 체크
      var techResult = await apiCall('/api/analysis/technical/' + item.code);
      
      if (techResult.success && techResult.data) {
        var tech = techResult.data;
        var techSignals = [];
        
        // RSI 과매수 체크
        if (tech.rsi && tech.rsi >= 70) {
          techSignals.push('RSI 과매수 (' + tech.rsi.toFixed(1) + ')');
        }
        
        // MACD 하락 전환 체크
        if (tech.macdHistogram && tech.macdHistogram < 0) {
          techSignals.push('MACD 하락 전환');
        }
        
        // 이동평균선 하향 돌파 체크
        if (tech.currentPrice && tech.ma20 && tech.currentPrice < tech.ma20) {
          techSignals.push('20일선 하향 돌파');
        }
        
        // 기술적 점수 낮음
        if (tech.technicalScore && tech.technicalScore <= 30) {
          techSignals.push('기술점수 낮음 (' + tech.technicalScore + '점)');
        }
        
        alertList[i].techSignals = techSignals;
        
        // 기술적 매도 신호가 있으면 알림
        if (techSignals.length > 0 && !alertList[i].techAlerted) {
          // 새 팝업 알림 표시
          showNotification({
            title: '기술적 매도 신호!',
            stockName: item.name + ' (' + item.code + ')',
            message: techSignals.join(' / '),
            type: 'loss'
          });
          
          alertList[i].techAlerted = true;
        }
        
        // 기술적 신호가 해제되면 다시 알림 가능하도록
        if (techSignals.length === 0) {
          alertList[i].techAlerted = false;
        }
      }
      
    } catch (error) {
      console.error('알림 체크 오류:', error);
    }
  }
  
  localStorage.setItem('alertList', JSON.stringify(alertList));
  loadAlertList();
}


async function handleSetAllAlert() {
  if (portfolio.length === 0) {
    alert('등록된 보유 종목이 없습니다.');
    return;
  }
  
  if (!confirm('전체 보유종목(' + portfolio.length + '개)에 기술적 분석 기반 알림을 설정하시겠습니까?')) {
    return;
  }
  
  showLoading();
  
  var successCount = 0;
  var failCount = 0;
  
  for (var i = 0; i < portfolio.length; i++) {
    var stockInfo = portfolio[i];
    
    try {
      // 현재가 조회
      var result = await apiCall('/api/korea/stock/' + stockInfo.code);
      var currentPrice = result.success ? result.data.price : 0;
      var stockName = result.success ? result.data.name : stockInfo.code;
      
      // 기술적 분석
      var analysisResult = await apiCall('/api/analysis/recommendation/' + stockInfo.code);
      
      if (analysisResult.success && analysisResult.data) {
        var data = analysisResult.data;
        var targetP = data.targetPrice || 0;
        var stopP = data.stopLoss || data.stopLossPrice || 0;
        
        var alertData = {
          code: stockInfo.code,
          name: stockName,
          buyPrice: stockInfo.price,
          qty: stockInfo.qty,
          currentPrice: currentPrice,
          type: 'auto',
          targets: [],
          addedAt: new Date().toISOString(),
          triggered: []
        };
        
        if (targetP > 0) {
          alertData.targets.push({
            percent: ((targetP - stockInfo.price) / stockInfo.price * 100).toFixed(1),
            price: Math.round(targetP),
            type: 'profit'
          });
        }
        if (stopP > 0) {
          alertData.targets.push({
            percent: ((stopP - stockInfo.price) / stockInfo.price * 100).toFixed(1),
            price: Math.round(stopP),
            type: 'loss'
          });
        }
        
        if (alertData.targets.length > 0) {
          // 기존 알림 확인 및 업데이트
          var existingIndex = alertList.findIndex(function(item) {
            return item.code === stockInfo.code;
          });
          
          if (existingIndex >= 0) {
            alertList[existingIndex] = alertData;
          } else {
            alertList.push(alertData);
          }
          
          successCount++;
        } else {
          failCount++;
        }
      } else {
        failCount++;
      }
    } catch (error) {
      console.error('알림 설정 오류:', stockInfo.code, error);
      failCount++;
    }
  }
  
  localStorage.setItem('alertList', JSON.stringify(alertList));
  loadAlertList();
  
  hideLoading();
  
  alert('일괄 설정 완료!\n\n성공: ' + successCount + '개\n실패: ' + failCount + '개');
}


// ==================== 종목 찾기 ====================
async function loadHotThemes() {
  showLoading();
  
  try {
    var result = await apiCall('/api/korea/themes');
    
    if (result.success && result.data && result.data.length > 0) {
      var themes = result.data.slice(0, 10); // TOP 10
      
      var html = '<table><thead><tr><th>순위</th><th>테마명</th><th>등락률</th><th>기능</th></tr></thead><tbody>';
      
      themes.forEach(function(theme, index) {
        var changeClass = theme.changeRate && theme.changeRate.includes('-') ? 'negative' : 'positive';
        var medal = index === 0 ? '🥇' : (index === 1 ? '🥈' : (index === 2 ? '🥉' : (index + 1)));
        
        html += '<tr>';
        html += '<td>' + medal + '</td>';
        html += '<td><strong>' + theme.name + '</strong></td>';
        html += '<td class="' + changeClass + '">' + (theme.changeRate || '0.00%') + '</td>';
        html += '<td><button onclick="analyzeThemeById(\'' + theme.code + '\', \'' + encodeURIComponent(theme.name) + '\')">종목 분석</button></td>';
        html += '</tr>';
      });
      
      html += '</tbody></table>';
      document.getElementById('hot-themes-container').innerHTML = html;
      
      // 테마 선택 드롭다운도 업데이트
      var select = document.getElementById('theme-select-for-analysis');
      select.innerHTML = '<option value="">-- 테마 선택 --</option>';
      result.data.forEach(function(theme) {
        var option = document.createElement('option');
        option.value = theme.code + '|' + theme.name;
        option.textContent = theme.name + ' (' + (theme.changeRate || '0%') + ')';
        select.appendChild(option);
      });
      
    } else {
      document.getElementById('hot-themes-container').innerHTML = '<p>테마 데이터를 불러올 수 없습니다.</p>';
    }
  } catch (error) {
    console.error('Hot 테마 로드 오류:', error);
  }
  
  hideLoading();
}

async function analyzeThemeById(themeCode, themeName) {
  themeName = decodeURIComponent(themeName);
  showLoading();
  
  try {
    var result = await apiCall('/api/korea/theme/' + themeCode);
    
    if (!result.success || !result.data || result.data.length === 0) {
      alert('테마 종목을 불러올 수 없습니다.');
      hideLoading();
      return;
    }
    
    var stocks = result.data;
    var analyzedStocks = [];
    var limit = Math.min(stocks.length, 10);
    
    for (var i = 0; i < limit; i++) {
      try {
        var analysisResult = await apiCall('/api/analysis/technical/' + stocks[i].code);
        
        if (analysisResult.success && analysisResult.data) {
          var data = analysisResult.data;
          
          analyzedStocks.push({
            code: stocks[i].code,
            name: stocks[i].name,
            price: data.currentPrice || stocks[i].price || 0,
            score: data.technicalScore || 0,
            rsi: data.rsi || 0,
            macd: data.macd || 0,
            signal: getSignalFromScore(data.technicalScore)
          });
        }
      } catch (err) {
        console.log('종목 분석 실패:', stocks[i].code);
      }
    }
    
    // 점수 순으로 정렬
    analyzedStocks.sort(function(a, b) { return b.score - a.score; });
    
    displayThemeRecommendation(themeName, analyzedStocks.slice(0, 5));
    
  } catch (error) {
    console.error('테마 분석 오류:', error);
  }
  
  hideLoading();
}

async function analyzeSelectedTheme() {
  var selectValue = document.getElementById('theme-select-for-analysis').value;
  
  if (!selectValue) {
    alert('테마를 선택하세요.');
    return;
  }
  
  var parts = selectValue.split('|');
  var themeCode = parts[0];
  var themeName = parts[1];
  
  await analyzeThemeById(themeCode, themeName);
}

function displayThemeRecommendation(themeName, stocks) {
  var container = document.getElementById('theme-recommendation-container');
  
  if (stocks.length === 0) {
    container.innerHTML = '<p>분석 결과가 없습니다.</p>';
    return;
  }
  
  var html = '<h4>📈 ' + themeName + ' - 추천 종목 TOP ' + stocks.length + '</h4>';
  html += '<table><thead><tr><th>순위</th><th>종목명</th><th>현재가</th><th>기술적 점수</th><th>RSI</th><th>신호</th><th>기능</th></tr></thead><tbody>';
  
  stocks.forEach(function(stock, index) {
    var medal = index === 0 ? '🥇' : (index === 1 ? '🥈' : (index === 2 ? '🥉' : (index + 1)));
    var signalClass = stock.signal === 'BUY' || stock.signal === 'STRONG_BUY' ? 'positive' : 
                      (stock.signal === 'SELL' || stock.signal === 'STRONG_SELL' ? 'negative' : '');
    var signalText = {
      'STRONG_BUY': '🔥 강력매수',
      'BUY': '📈 매수',
      'HOLD': '⏸️ 보유',
      'SELL': '📉 매도',
      'STRONG_SELL': '⚠️ 강력매도'
    };
    
    html += '<tr>';
    html += '<td>' + medal + '</td>';
    html += '<td><strong>' + stock.name + '</strong><br><small>' + stock.code + '</small></td>';
    html += '<td>' + (stock.price > 0 ? stock.price.toLocaleString() + '원' : '--') + '</td>';
    html += '<td style="color:#3b82f6; font-weight:bold;">' + stock.score + '점</td>';
    html += '<td>' + (stock.rsi > 0 ? stock.rsi.toFixed(1) : '--') + '</td>';
    html += '<td class="' + signalClass + '">' + (signalText[stock.signal] || stock.signal) + '</td>';
    html += '<td><button onclick="analyzeStock(\'' + stock.code + '\')">상세분석</button></td>';
    html += '</tr>';
  });
  
  html += '</tbody></table>';
  container.innerHTML = html;
}

function getSignalFromScore(score) {
  if (score >= 80) return 'STRONG_BUY';
  if (score >= 60) return 'BUY';
  if (score >= 40) return 'HOLD';
  if (score >= 20) return 'SELL';
  return 'STRONG_SELL';
}

async function scanAllThemes() {
  if (!confirm('전체 테마 스캔은 시간이 오래 걸릴 수 있습니다. 진행하시겠습니까?')) {
    return;
  }
  
  showLoading();
  
  var container = document.getElementById('scan-result-container');
  container.innerHTML = '<p>스캔 중... 잠시 기다려주세요.</p>';
  
  try {
    var themesResult = await apiCall('/api/korea/themes');
    
    if (!themesResult.success || !themesResult.data) {
      container.innerHTML = '<p>테마 목록을 불러올 수 없습니다.</p>';
      hideLoading();
      return;
    }
    
    var allRecommendations = [];
    var themes = themesResult.data.slice(0, 10); // 상위 10개 테마만
    
    for (var t = 0; t < themes.length; t++) {
      var theme = themes[t];
      
      container.innerHTML = '<p>스캔 중... (' + (t + 1) + '/' + themes.length + ') ' + theme.name + '</p>';
      
      try {
        var stocksResult = await apiCall('/api/korea/theme/' + theme.code);
        
        if (stocksResult.success && stocksResult.data) {
          var stocks = stocksResult.data.slice(0, 5); // 테마당 5개 종목
          
          for (var s = 0; s < stocks.length; s++) {
            try {
              var analysisResult = await apiCall('/api/analysis/technical/' + stocks[s].code);
              
              if (analysisResult.success && analysisResult.data) {
                var data = analysisResult.data;
                
                // 매수 적합 조건: 점수 60 이상, RSI 30~70
                if (data.technicalScore >= 60 && data.rsi >= 30 && data.rsi <= 70) {
                  allRecommendations.push({
                    theme: theme.name,
                    code: stocks[s].code,
                    name: stocks[s].name,
                    price: data.currentPrice || 0,
                    score: data.technicalScore,
                    rsi: data.rsi,
                    signal: getSignalFromScore(data.technicalScore)
                  });
                }
              }
            } catch (err) {
              // 개별 종목 오류 무시
            }
          }
        }
      } catch (err) {
        // 테마 오류 무시
      }
    }
    
    // 점수 순 정렬
    allRecommendations.sort(function(a, b) { return b.score - a.score; });
    
    // 상위 20개만 표시
    displayScanResults(allRecommendations.slice(0, 20));
    
  } catch (error) {
    console.error('전체 스캔 오류:', error);
    container.innerHTML = '<p>스캔 중 오류가 발생했습니다.</p>';
  }
  
  hideLoading();
}

function displayScanResults(stocks) {
  var container = document.getElementById('scan-result-container');
  
  if (stocks.length === 0) {
    container.innerHTML = '<p>매수 적합 조건(점수 60↑, RSI 30~70)을 만족하는 종목이 없습니다.</p>';
    return;
  }
  
  var html = '<h4>⭐ 매수 추천 종목 TOP ' + stocks.length + '</h4>';
  html += '<p style="color:#666; font-size:0.9rem;">조건: 기술적 점수 60점 이상, RSI 30~70 (과매수/과매도 아님)</p>';
  html += '<table><thead><tr><th>순위</th><th>테마</th><th>종목명</th><th>현재가</th><th>점수</th><th>RSI</th><th>신호</th><th>기능</th></tr></thead><tbody>';
  
  stocks.forEach(function(stock, index) {
    var medal = index === 0 ? '🥇' : (index === 1 ? '🥈' : (index === 2 ? '🥉' : (index + 1)));
    var signalClass = stock.signal === 'BUY' || stock.signal === 'STRONG_BUY' ? 'positive' : '';
    var signalText = {
      'STRONG_BUY': '🔥 강력매수',
      'BUY': '📈 매수',
      'HOLD': '⏸️ 보유'
    };
    
    html += '<tr>';
    html += '<td>' + medal + '</td>';
    html += '<td><small>' + stock.theme + '</small></td>';
    html += '<td><strong>' + stock.name + '</strong><br><small>' + stock.code + '</small></td>';
    html += '<td>' + (stock.price > 0 ? stock.price.toLocaleString() + '원' : '--') + '</td>';
    html += '<td style="color:#3b82f6; font-weight:bold;">' + stock.score + '점</td>';
    html += '<td>' + stock.rsi.toFixed(1) + '</td>';
    html += '<td class="' + signalClass + '">' + (signalText[stock.signal] || stock.signal) + '</td>';
    html += '<td><button onclick="analyzeStock(\'' + stock.code + '\')">상세</button></td>';
    html += '</tr>';
  });
  
  html += '</tbody></table>';
  container.innerHTML = html;
}


// ==================== 미국 주식 분석 ====================
async function handleUsAnalysis() {
  if (!selectedUsStock) {
    alert('먼저 종목을 선택하세요.');
    return;
  }
  
  showLoading();
  
  try {
    var result = await apiCall('/api/us/analysis/' + selectedUsStock.symbol);
    console.log('미국 분석 결과:', result);
    
    if (result.success && result.data) {
      await displayUsAnalysis(result.data);
    } else {
      document.getElementById('us-analysis-result').innerHTML = '<p class="error">분석 실패: ' + (result.error || '데이터 없음') + '</p>';
    }
  } catch (error) {
    console.error('미국 분석 오류:', error);
  }
  
  hideLoading();
}


async function displayUsAnalysis(data) {
  var container = document.getElementById('us-analysis-result');
  
  // 시가총액, 섹터 조회
  var marketCap = 0;
  var industry = '';
  try {
    var quoteResult = await apiCall('/api/us/quote/' + data.symbol);
    if (quoteResult.success && quoteResult.data) {
      marketCap = quoteResult.data.marketCap || 0;
      industry = quoteResult.data.industry || '';
    }
  } catch (e) {
    console.log('시가총액 조회 실패:', e);
  }
  
  // 거래량 비율 계산을 위해 캔들 데이터 조회
  var volumeRatio = 1;
  try {
    var candleResult = await apiCall('/api/us/candles/' + data.symbol);
    if (candleResult.success && candleResult.data && candleResult.data.length >= 20) {
      var candles = candleResult.data;
      var todayVolume = candles[candles.length - 1].volume || 0;
      
      // 최근 20일 평균 거래량
      var avgVolume = 0;
      for (var i = candles.length - 21; i < candles.length - 1; i++) {
        if (i >= 0) avgVolume += candles[i].volume || 0;
      }
      avgVolume = avgVolume / 20;
      
      volumeRatio = avgVolume > 0 ? todayVolume / avgVolume : 1;
    }
  } catch (e) {
    console.log('거래량 조회 실패:', e);
  }
  
  // 뉴스 데이터 조회
  var newsData = null;
  try {
    var newsResult = await apiCall('/api/korea/news/' + encodeURIComponent(data.symbol + ' stock'));
    if (newsResult.success && newsResult.data && newsResult.data.length > 0) {
      var newsList = newsResult.data;
      var today = new Date().toISOString().split('T')[0];
      var hasToday = false;
      var hasRecent = false;
      
      newsList.forEach(function(news) {
        var newsDate = news.date || '';
        if (newsDate.includes(today) || newsDate.includes('시간 전') || newsDate.includes('분 전')) {
          hasToday = true;
        }
        if (newsDate.includes('1일 전') || newsDate.includes('어제') || newsDate.includes('yesterday')) {
          hasRecent = true;
        }
      });
      
      newsData = {
        count: newsList.length,
        hasToday: hasToday,
        hasRecent: hasRecent || hasToday
      };
    }
  } catch (e) {
    console.log('뉴스 조회 실패:', e);
  }
  
  // 새 점수 계산
  var newScore = calculateUsNewScore({
    techScore: data.technicalScore || 0,
    marketCap: marketCap,
    industry: industry,
    volumeRatio: volumeRatio,
    currentPrice: data.currentPrice || 0,
    ma20: data.ma20 || 0,
    ma60: data.ma60 || 0,
    changeRate: data.changePercent || 0,
    newsData: newsData
  });
  
  // 신호 결정
  var signalType = newScore.totalScaled >= 70 ? 'BUY' : newScore.totalScaled >= 50 ? 'HOLD' : 'SELL';
  var signalClass = signalType === 'BUY' ? 'positive' : signalType === 'SELL' ? 'negative' : '';
  var signalText = {
    'BUY': '📈 매수',
    'HOLD': '⏸️ 보유',
    'SELL': '📉 매도'
  };
  
  var html = '<div class="card">';
  html += '<h3>🤖 AI 분석 결과: ' + data.symbol + '</h3>';
  
  // 종합 신호
  html += '<div style="text-align:center; padding:20px; background:#f8fafc; border-radius:8px; margin:15px 0;">';
  html += '<p style="color:#666; margin-bottom:10px;">AI 종합 판단</p>';
  html += '<p style="font-size:2rem; font-weight:bold;" class="' + signalClass + '">' + signalText[signalType] + '</p>';
  html += '<p style="color:#666;">종합 점수: <strong style="color:#3b82f6; font-size:1.5rem;">' + newScore.totalScaled + '점</strong></p>';
  html += '<p style="color:#999; font-size:0.85rem;">(기존 기술적 점수: ' + (data.technicalScore || 0).toFixed(0) + '점)</p>';
  html += '</div>';
  
  // 섹터 정보 표시
  if (industry) {
    html += '<div style="text-align:center; padding:10px; background:#fef3c7; border-radius:8px; margin:10px 0;">';
    html += '<span style="color:#92400e;">🏷️ 섹터: <strong>' + industry + '</strong></span>';
    html += '</div>';
  }
  
  // 점수 상세
  html += getUsScoreBreakdown(newScore);
  
  // 지표 카드
  html += '<div class="indicators-grid" style="margin-top:15px;">';
  html += '<div class="indicator-card"><div class="label">현재가</div><div class="value">$' + (data.currentPrice ? data.currentPrice.toFixed(2) : '--') + '</div></div>';
  html += '<div class="indicator-card"><div class="label">시가총액</div><div class="value">$' + (marketCap > 0 ? (marketCap / 1000).toFixed(0) + 'B' : '--') + '</div></div>';
  html += '<div class="indicator-card"><div class="label">RSI (14)</div><div class="value">' + (data.rsi ? data.rsi.toFixed(1) : '--') + '</div></div>';
  html += '<div class="indicator-card"><div class="label">거래량비</div><div class="value">' + volumeRatio.toFixed(1) + '배</div></div>';
  html += '</div>';
  
  // 이동평균선
  html += '<div class="indicators-grid" style="margin-top:15px;">';
  html += '<div class="indicator-card"><div class="label">MA5</div><div class="value">$' + (data.ma5 ? data.ma5.toFixed(2) : '--') + '</div></div>';
  html += '<div class="indicator-card"><div class="label">MA20</div><div class="value">$' + (data.ma20 ? data.ma20.toFixed(2) : '--') + '</div></div>';
  html += '<div class="indicator-card"><div class="label">MA60</div><div class="value">$' + (data.ma60 ? data.ma60.toFixed(2) : '--') + '</div></div>';
  html += '</div>';
  
  html += '</div>';
  container.innerHTML = html;
}


async function handleUsSignal() {
  if (!selectedUsStock) {
    alert('먼저 종목을 선택하세요.');
    return;
  }
  
  showLoading();
  
  try {
    var result = await apiCall('/api/us/analysis/' + selectedUsStock.symbol);
    console.log('미국 신호 결과:', result);
    
    if (result.success && result.data) {
      displayUsSignal(result.data);
    } else {
      document.getElementById('us-analysis-result').innerHTML = '<p class="error">신호 생성 실패</p>';
    }
  } catch (error) {
    console.error('미국 신호 오류:', error);
  }
  
  hideLoading();
}

function displayUsSignal(data) {
  var container = document.getElementById('us-analysis-result');
  
  var signalText = {
    'STRONG_BUY': '🔥 강력 매수',
    'BUY': '📈 매수',
    'HOLD': '⏸️ 보유',
    'SELL': '📉 매도',
    'STRONG_SELL': '⚠️ 강력 매도'
  };
  
  var signalClass = (data.signal === 'BUY' || data.signal === 'STRONG_BUY') ? 'positive' : 
                    (data.signal === 'SELL' || data.signal === 'STRONG_SELL') ? 'negative' : '';
  
  var html = '<div class="card" style="text-align:center;">';
  html += '<h3>🚦 ' + data.symbol + ' 매매 신호</h3>';
  html += '<div style="font-size:2rem; margin:20px 0;" class="' + signalClass + '">' + (signalText[data.signal] || data.signal) + '</div>';
  html += '<p>기술적 점수: <strong>' + data.technicalScore.toFixed(0) + '점</strong></p>';
  html += '</div>';
  
  html += '<div class="indicators-grid">';
  html += '<div class="indicator-card"><div class="label">현재가</div><div class="value">$' + data.currentPrice.toFixed(2) + '</div></div>';
  html += '<div class="indicator-card" style="background:#dcfce7;"><div class="label">🎯 목표가</div><div class="value" style="color:#166534;">$' + data.targetPrice.toFixed(2) + '</div></div>';
  html += '<div class="indicator-card" style="background:#fee2e2;"><div class="label">🛑 손절가</div><div class="value" style="color:#991b1b;">$' + data.stopLoss.toFixed(2) + '</div></div>';
  html += '</div>';
  
  // 예상 수익률/리스크
  var expectedReturn = ((data.targetPrice - data.currentPrice) / data.currentPrice * 100).toFixed(2);
  var risk = ((data.currentPrice - data.stopLoss) / data.currentPrice * 100).toFixed(2);
  var riskReward = (Math.abs(expectedReturn) / Math.abs(risk)).toFixed(2);
  
  html += '<div class="indicators-grid" style="margin-top:15px;">';
  html += '<div class="indicator-card"><div class="label">예상 수익률</div><div class="value positive">+' + expectedReturn + '%</div></div>';
  html += '<div class="indicator-card"><div class="label">리스크</div><div class="value negative">-' + risk + '%</div></div>';
  html += '<div class="indicator-card"><div class="label">손익비</div><div class="value">' + riskReward + ' : 1</div></div>';
  html += '</div>';
  
  // 설명 추가
  html += '<div class="card" style="margin-top:20px; background:#f8fafc;">';
  html += '<h4>📌 용어 설명</h4>';
  html += '<ul style="margin:10px 0; padding-left:20px; line-height:1.8;">';
  html += '<li><strong>목표가</strong>: 기술적 분석 기반 예상 상승 목표 (현재가 + ATR×2)</li>';
  html += '<li><strong>손절가</strong>: 손실 제한을 위한 매도 기준 (현재가 - ATR)</li>';
  html += '<li><strong>예상 수익률</strong>: 현재가 → 목표가 도달 시 수익률</li>';
  html += '<li><strong>리스크</strong>: 현재가 → 손절가 도달 시 손실률</li>';
  html += '<li><strong>손익비</strong>: 예상수익률 ÷ 리스크 (2:1 이상 권장)</li>';
  html += '</ul>';
  html += '<p style="color:#666; font-size:0.85rem;">※ ATR(Average True Range): 14일간 평균 변동폭</p>';
  html += '</div>';
  
  container.innerHTML = html;
}



// ==================== 미국 포트폴리오 ====================
async function handleAddUsPortfolio() {
  var symbol = document.getElementById('us-portfolio-symbol').value.trim().toUpperCase();
  var qty = parseInt(document.getElementById('us-portfolio-qty').value);
  var price = parseFloat(document.getElementById('us-portfolio-price').value);
  
  if (!symbol || !qty || !price) {
    alert('모든 항목을 입력하세요.');
    return;
  }
  
  showLoading();
  
  try {
    var result = await apiCall('/api/us/quote/' + symbol);
    
    if (result.success && result.data) {
      usPortfolio.push({
        symbol: symbol,
        name: result.data.name || symbol,
        qty: qty,
        price: price,
        addedAt: new Date().toISOString()
      });
      
      localStorage.setItem('usPortfolio', JSON.stringify(usPortfolio));
      
      document.getElementById('us-portfolio-symbol').value = '';
      document.getElementById('us-portfolio-qty').value = '';
      document.getElementById('us-portfolio-price').value = '';
      
      loadUsPortfolio();
      updateUsAlertStockSelect();
      alert(symbol + ' 추가되었습니다!');
    } else {
      alert('종목을 찾을 수 없습니다: ' + symbol);
    }
  } catch (error) {
    console.error('미국 포트폴리오 추가 오류:', error);
  }
  
  hideLoading();
}

async function loadUsPortfolio() {
  var container = document.getElementById('us-portfolio-list');
  var summaryContainer = document.getElementById('us-portfolio-summary');
  
  if (usPortfolio.length === 0) {
    container.innerHTML = '<p>등록된 미국 주식이 없습니다.</p>';
    summaryContainer.innerHTML = '<p>--</p>';
    updateUsAlertStockSelect();
    return;
  }
  
  var html = '<table><thead><tr><th>종목</th><th>수량</th><th>매수가</th><th>현재가</th><th>평가금</th><th>수익</th><th>기능</th></tr></thead><tbody>';
  
  var totalInvest = 0;
  var totalValue = 0;
  
  for (var i = 0; i < usPortfolio.length; i++) {
    var item = usPortfolio[i];
    var result = await apiCall('/api/us/quote/' + item.symbol);
    var data = result.success ? result.data : null;
    
    var currentPrice = data ? data.price : 0;
    var investAmt = item.qty * item.price;
    var valueAmt = item.qty * currentPrice;
    var profit = valueAmt - investAmt;
    var profitRate = investAmt > 0 ? ((profit / investAmt) * 100).toFixed(2) : 0;
    var profitClass = profit >= 0 ? 'positive' : 'negative';
    
    totalInvest += investAmt;
    totalValue += valueAmt;
    
    html += '<tr>';
    html += '<td><strong>' + (item.name || item.symbol) + '</strong><br><small>' + item.symbol + '</small></td>';
    html += '<td>' + item.qty + '주</td>';
    html += '<td>$' + item.price.toFixed(2) + '</td>';
    html += '<td>' + (currentPrice > 0 ? '$' + currentPrice.toFixed(2) : '--') + '</td>';
    html += '<td>$' + valueAmt.toFixed(2) + '</td>';
    html += '<td class="' + profitClass + '">' + (profit >= 0 ? '+' : '') + '$' + profit.toFixed(2) + ' (' + (profit >= 0 ? '+' : '') + profitRate + '%)</td>';
    html += '<td><button class="btn-danger" onclick="removeFromUsPortfolio(' + i + ')">삭제</button></td>';
    html += '</tr>';
  }
  
  html += '</tbody></table>';
  container.innerHTML = html;
  
  // 총 평가
  var totalProfit = totalValue - totalInvest;
  var totalProfitRate = totalInvest > 0 ? ((totalProfit / totalInvest) * 100).toFixed(2) : 0;
  var totalClass = totalProfit >= 0 ? 'positive' : 'negative';
  
  var summaryHtml = '<div class="indicators-grid">';
  summaryHtml += '<div class="indicator-card"><div class="label">총 투자금</div><div class="value">$' + totalInvest.toFixed(2) + '</div></div>';
  summaryHtml += '<div class="indicator-card"><div class="label">총 평가금</div><div class="value">$' + totalValue.toFixed(2) + '</div></div>';
  summaryHtml += '<div class="indicator-card"><div class="label">총 수익</div><div class="value ' + totalClass + '">' + (totalProfit >= 0 ? '+' : '') + '$' + totalProfit.toFixed(2) + '</div></div>';
  summaryHtml += '<div class="indicator-card"><div class="label">수익률</div><div class="value ' + totalClass + '">' + (totalProfit >= 0 ? '+' : '') + totalProfitRate + '%</div></div>';
  summaryHtml += '</div>';
  summaryContainer.innerHTML = summaryHtml;
  
  updateUsAlertStockSelect();
}

function removeFromUsPortfolio(index) {
  if (confirm('이 종목을 삭제하시겠습니까?')) {
    usPortfolio.splice(index, 1);
    localStorage.setItem('usPortfolio', JSON.stringify(usPortfolio));
    loadUsPortfolio();
  }
}

function updateUsAlertStockSelect() {
  var select = document.getElementById('us-alert-stock-select');
  select.innerHTML = '<option value="">-- 보유 종목 선택 --</option>';
  
  usPortfolio.forEach(function(item) {
    var option = document.createElement('option');
    option.value = item.symbol;
    option.textContent = item.symbol + ' (' + (item.name || item.symbol) + ')';
    select.appendChild(option);
  });
}

function handleUsAlertTypeChange() {
  var type = document.getElementById('us-alert-type').value;
  
  if (type === 'percent') {
    document.getElementById('us-percent-options').style.display = 'block';
    document.getElementById('us-price-options').style.display = 'none';
  } else if (type === 'price') {
    document.getElementById('us-percent-options').style.display = 'none';
    document.getElementById('us-price-options').style.display = 'block';
  } else {
    document.getElementById('us-percent-options').style.display = 'none';
    document.getElementById('us-price-options').style.display = 'none';
  }
}

async function handleSetUsAlert() {
  var symbol = document.getElementById('us-alert-stock-select').value;
  var alertType = document.getElementById('us-alert-type').value;
  
  if (!symbol) {
    alert('종목을 선택하세요.');
    return;
  }
  
  var stockInfo = usPortfolio.find(function(item) {
    return item.symbol === symbol;
  });
  
  if (!stockInfo) {
    alert('보유 종목을 찾을 수 없습니다.');
    return;
  }
  
  showLoading();
  
  try {
    var result = await apiCall('/api/us/quote/' + symbol);
    var currentPrice = result.success ? result.data.price : 0;
    
    var alertData = {
      symbol: symbol,
      name: stockInfo.name || symbol,
      buyPrice: stockInfo.price,
      qty: stockInfo.qty,
      currentPrice: currentPrice,
      type: alertType,
      targets: [],
      addedAt: new Date().toISOString(),
      triggered: []
    };
    
    if (alertType === 'percent') {
      var checkboxes = document.querySelectorAll('#us-percent-options input:checked');
      checkboxes.forEach(function(cb) {
        var percent = parseFloat(cb.value);
        var targetPrice = stockInfo.price * (1 + percent / 100);
        alertData.targets.push({
          percent: percent,
          price: targetPrice,
          type: percent > 0 ? 'profit' : 'loss'
        });
      });
      
      if (alertData.targets.length === 0) {
        alert('알림 조건을 선택하세요.');
        hideLoading();
        return;
      }
    } else if (alertType === 'price') {
      var targetPrice = parseFloat(document.getElementById('us-alert-target-price').value);
      var stopPrice = parseFloat(document.getElementById('us-alert-stop-price').value);
      
      if (targetPrice) {
        alertData.targets.push({
          percent: ((targetPrice - stockInfo.price) / stockInfo.price * 100).toFixed(1),
          price: targetPrice,
          type: 'profit'
        });
      }
      if (stopPrice) {
        alertData.targets.push({
          percent: ((stopPrice - stockInfo.price) / stockInfo.price * 100).toFixed(1),
          price: stopPrice,
          type: 'loss'
        });
      }
      
      if (alertData.targets.length === 0) {
        alert('목표가 또는 손절가를 입력하세요.');
        hideLoading();
        return;
      }
    } else if (alertType === 'auto') {
      var analysisResult = await apiCall('/api/us/analysis/' + symbol);
      
      if (analysisResult.success && analysisResult.data) {
        var data = analysisResult.data;
        
        if (data.targetPrice > 0) {
          alertData.targets.push({
            percent: ((data.targetPrice - stockInfo.price) / stockInfo.price * 100).toFixed(1),
            price: data.targetPrice,
            type: 'profit'
          });
        }
        if (data.stopLoss > 0) {
          alertData.targets.push({
            percent: ((data.stopLoss - stockInfo.price) / stockInfo.price * 100).toFixed(1),
            price: data.stopLoss,
            type: 'loss'
          });
        }
        
        if (alertData.targets.length === 0) {
          alert('기술적 분석에서 목표가/손절가를 계산할 수 없습니다.');
          hideLoading();
          return;
        }
      } else {
        alert('기술적 분석 데이터를 가져올 수 없습니다.');
        hideLoading();
        return;
      }
    }
    
    var existingIndex = usAlertList.findIndex(function(item) {
      return item.symbol === symbol;
    });
    
    if (existingIndex >= 0) {
      usAlertList[existingIndex] = alertData;
    } else {
      usAlertList.push(alertData);
    }
    
    localStorage.setItem('usAlertList', JSON.stringify(usAlertList));
    loadUsAlertList();
    
    alert('알림이 설정되었습니다!');
    
  } catch (error) {
    console.error('미국 알림 설정 오류:', error);
  }
  
  hideLoading();
}

async function handleSetAllUsAlert() {
  if (usPortfolio.length === 0) {
    alert('등록된 보유 종목이 없습니다.');
    return;
  }
  
  if (!confirm('전체 미국 보유종목(' + usPortfolio.length + '개)에 기술적 분석 기반 알림을 설정하시겠습니까?')) {
    return;
  }
  
  showLoading();
  
  var successCount = 0;
  var failCount = 0;
  
  for (var i = 0; i < usPortfolio.length; i++) {
    var stockInfo = usPortfolio[i];
    
    try {
      var result = await apiCall('/api/us/quote/' + stockInfo.symbol);
      var currentPrice = result.success ? result.data.price : 0;
      
      var analysisResult = await apiCall('/api/us/analysis/' + stockInfo.symbol);
      
      if (analysisResult.success && analysisResult.data) {
        var data = analysisResult.data;
        
        var alertData = {
          symbol: stockInfo.symbol,
          name: stockInfo.name || stockInfo.symbol,
          buyPrice: stockInfo.price,
          qty: stockInfo.qty,
          currentPrice: currentPrice,
          type: 'auto',
          targets: [],
          addedAt: new Date().toISOString(),
          triggered: []
        };
        
        if (data.targetPrice > 0) {
          alertData.targets.push({
            percent: ((data.targetPrice - stockInfo.price) / stockInfo.price * 100).toFixed(1),
            price: data.targetPrice,
            type: 'profit'
          });
        }
        if (data.stopLoss > 0) {
          alertData.targets.push({
            percent: ((data.stopLoss - stockInfo.price) / stockInfo.price * 100).toFixed(1),
            price: data.stopLoss,
            type: 'loss'
          });
        }
        
        if (alertData.targets.length > 0) {
          var existingIndex = usAlertList.findIndex(function(item) {
            return item.symbol === stockInfo.symbol;
          });
          
          if (existingIndex >= 0) {
            usAlertList[existingIndex] = alertData;
          } else {
            usAlertList.push(alertData);
          }
          
          successCount++;
        } else {
          failCount++;
        }
      } else {
        failCount++;
      }
    } catch (error) {
      console.error('미국 알림 설정 오류:', stockInfo.symbol, error);
      failCount++;
    }
  }
  
  localStorage.setItem('usAlertList', JSON.stringify(usAlertList));
  loadUsAlertList();
  
  hideLoading();
  
  alert('일괄 설정 완료!\n\n성공: ' + successCount + '개\n실패: ' + failCount + '개');
}

function loadUsAlertList() {
  var container = document.getElementById('us-alert-list-container');
  
  if (usAlertList.length === 0) {
    container.innerHTML = '<p>설정된 알림이 없습니다.</p>';
    return;
  }
  
  var html = '<table><thead><tr><th>종목</th><th>매수가</th><th>현재가</th><th>알림 조건</th><th>상태</th><th>기능</th></tr></thead><tbody>';
  
  usAlertList.forEach(function(item, index) {
    var targetsHtml = '';
    if (item.targets && item.targets.length > 0) {
      targetsHtml = item.targets.map(function(t) {
        var icon = t.type === 'profit' ? '🎯' : '🛑';
        var className = t.type === 'profit' ? 'positive' : 'negative';
        var priceStr = t.price ? '$' + t.price.toFixed(2) : '--';
        var percentStr = t.percent ? ((t.percent > 0 ? '+' : '') + t.percent + '%') : '';
        return '<span class="' + className + '">' + icon + ' ' + priceStr + ' (' + percentStr + ')</span>';
      }).join('<br>');
    } else {
      targetsHtml = '--';
    }
    
    var statusHtml = '';
    if (item.triggered && item.triggered.length > 0) {
      statusHtml = '<span class="positive">🔔 알림 발생!</span>';
    } else {
      statusHtml = '<span>⏳ 대기중</span>';
    }
    
    var buyPriceStr = item.buyPrice ? '$' + item.buyPrice.toFixed(2) : '--';
    var currentPriceStr = item.currentPrice ? '$' + item.currentPrice.toFixed(2) : '--';
    
    html += '<tr>';
    html += '<td><strong>' + (item.name || item.symbol) + '</strong><br><small>' + item.symbol + '</small></td>';
    html += '<td>' + buyPriceStr + '</td>';
    html += '<td>' + currentPriceStr + '</td>';
    html += '<td>' + targetsHtml + '</td>';
    html += '<td>' + statusHtml + '</td>';
    html += '<td><button class="btn-danger" onclick="removeUsAlert(' + index + ')">삭제</button></td>';
    html += '</tr>';
  });
  
  html += '</tbody></table>';
  container.innerHTML = html;
}

function removeUsAlert(index) {
  if (confirm('이 알림을 삭제하시겠습니까?')) {
    usAlertList.splice(index, 1);
    localStorage.setItem('usAlertList', JSON.stringify(usAlertList));
    loadUsAlertList();
  }
}



// 미국 주식 모니터링
let usMonitorInterval = null;

function startUsMonitoring() {
  if (usAlertList.length === 0) {
    alert('설정된 알림이 없습니다.');
    return;
  }
  
  var intervalMinutes = parseInt(document.getElementById('us-monitor-interval').value);
  
  document.getElementById('us-start-monitor-btn').style.display = 'none';
  document.getElementById('us-stop-monitor-btn').style.display = 'inline-block';
  document.getElementById('us-monitor-status').textContent = '모니터링 중... (' + intervalMinutes + '분 간격)';
  
  checkUsAlerts();
  
  usMonitorInterval = setInterval(checkUsAlerts, intervalMinutes * 60 * 1000);
}

function stopUsMonitoring() {
  if (usMonitorInterval) {
    clearInterval(usMonitorInterval);
    usMonitorInterval = null;
  }
  
  document.getElementById('us-start-monitor-btn').style.display = 'inline-block';
  document.getElementById('us-stop-monitor-btn').style.display = 'none';
  document.getElementById('us-monitor-status').textContent = '모니터링 중지됨';
}

async function checkUsAlerts() {
  var now = new Date().toLocaleTimeString();
  document.getElementById('us-monitor-status').textContent = '마지막 체크: ' + now;
  
  for (var i = 0; i < usAlertList.length; i++) {
    var item = usAlertList[i];
    
    try {
      var result = await apiCall('/api/us/quote/' + item.symbol);
      
      if (result.success) {
        var currentPrice = result.data.price;
        usAlertList[i].currentPrice = currentPrice;
        
        item.targets.forEach(function(target) {
          var triggered = false;
          
          if (target.type === 'profit' && currentPrice >= target.price) {
            triggered = true;
          } else if (target.type === 'loss' && currentPrice <= target.price) {
            triggered = true;
          }
          
          if (triggered && !item.triggered.includes(target.price)) {
            usAlertList[i].triggered.push(target.price);
            
            var message = item.name + ' (' + item.symbol + ')\n';
            message += target.type === 'profit' ? '🎯 목표가 도달!' : '🛑 손절가 도달!';
            message += '\n현재가: $' + currentPrice.toFixed(2);
            message += '\n설정가: $' + target.price.toFixed(2);
            
            alert(message);
            
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('미국 주식 알림', { body: message });
            }
          }
        });
      }
    } catch (error) {
      console.error('미국 알림 체크 오류:', error);
    }
  }
  
  localStorage.setItem('usAlertList', JSON.stringify(usAlertList));
  loadUsAlertList();
}



// ==================== 수익률 일괄 설정 ====================
function toggleBulkPercentOptions() {
  var options = document.getElementById('bulk-percent-options');
  options.style.display = options.style.display === 'none' ? 'block' : 'none';
}

function toggleUsBulkPercentOptions() {
  var options = document.getElementById('us-bulk-percent-options');
  options.style.display = options.style.display === 'none' ? 'block' : 'none';
}

async function applyBulkPercentAlert() {
  var checkboxes = document.querySelectorAll('.bulk-percent:checked');
  
  if (checkboxes.length === 0) {
    alert('수익률을 선택하세요.');
    return;
  }
  
  if (portfolio.length === 0) {
    alert('등록된 보유 종목이 없습니다.');
    return;
  }
  
  var percentages = [];
  checkboxes.forEach(function(cb) {
    percentages.push(parseFloat(cb.value));
  });
  
  if (!confirm('전체 보유종목(' + portfolio.length + '개)에 수익률 알림(' + percentages.join('%, ') + '%)을 설정하시겠습니까?')) {
    return;
  }
  
  showLoading();
  
  var successCount = 0;
  var failCount = 0;
  
  for (var i = 0; i < portfolio.length; i++) {
    var stockInfo = portfolio[i];
    
    try {
      var result = await apiCall('/api/korea/stock/' + stockInfo.code);
      var currentPrice = result.success ? result.data.price : 0;
      var stockName = result.success ? result.data.name : stockInfo.code;
      
      var alertData = {
        code: stockInfo.code,
        name: stockName,
        buyPrice: stockInfo.price,
        qty: stockInfo.qty,
        currentPrice: currentPrice,
        type: 'percent',
        targets: [],
        addedAt: new Date().toISOString(),
        triggered: []
      };
      
      percentages.forEach(function(percent) {
        var targetPrice = Math.round(stockInfo.price * (1 + percent / 100));
        alertData.targets.push({
          percent: percent,
          price: targetPrice,
          type: percent > 0 ? 'profit' : 'loss'
        });
      });
      
      var existingIndex = alertList.findIndex(function(item) {
        return item.code === stockInfo.code;
      });
      
      if (existingIndex >= 0) {
        alertList[existingIndex] = alertData;
      } else {
        alertList.push(alertData);
      }
      
      successCount++;
    } catch (error) {
      console.error('알림 설정 오류:', stockInfo.code, error);
      failCount++;
    }
  }
  
  localStorage.setItem('alertList', JSON.stringify(alertList));
  loadAlertList();
  document.getElementById('bulk-percent-options').style.display = 'none';
  
  hideLoading();
  
  alert('일괄 설정 완료!\n\n성공: ' + successCount + '개\n실패: ' + failCount + '개');
}

async function applyUsBulkPercentAlert() {
  var checkboxes = document.querySelectorAll('.us-bulk-percent:checked');
  
  if (checkboxes.length === 0) {
    alert('수익률을 선택하세요.');
    return;
  }
  
  if (usPortfolio.length === 0) {
    alert('등록된 보유 종목이 없습니다.');
    return;
  }
  
  var percentages = [];
  checkboxes.forEach(function(cb) {
    percentages.push(parseFloat(cb.value));
  });
  
  if (!confirm('전체 미국 보유종목(' + usPortfolio.length + '개)에 수익률 알림(' + percentages.join('%, ') + '%)을 설정하시겠습니까?')) {
    return;
  }
  
  showLoading();
  
  var successCount = 0;
  var failCount = 0;
  
  for (var i = 0; i < usPortfolio.length; i++) {
    var stockInfo = usPortfolio[i];
    
    try {
      var result = await apiCall('/api/us/quote/' + stockInfo.symbol);
      var currentPrice = result.success ? result.data.price : 0;
      
      var alertData = {
        symbol: stockInfo.symbol,
        name: stockInfo.name || stockInfo.symbol,
        buyPrice: stockInfo.price,
        qty: stockInfo.qty,
        currentPrice: currentPrice,
        type: 'percent',
        targets: [],
        addedAt: new Date().toISOString(),
        triggered: []
      };
      
      percentages.forEach(function(percent) {
        var targetPrice = stockInfo.price * (1 + percent / 100);
        alertData.targets.push({
          percent: percent,
          price: targetPrice,
          type: percent > 0 ? 'profit' : 'loss'
        });
      });
      
      var existingIndex = usAlertList.findIndex(function(item) {
        return item.symbol === stockInfo.symbol;
      });
      
      if (existingIndex >= 0) {
        usAlertList[existingIndex] = alertData;
      } else {
        usAlertList.push(alertData);
      }
      
      successCount++;
    } catch (error) {
      console.error('미국 알림 설정 오류:', stockInfo.symbol, error);
      failCount++;
    }
  }
  
  localStorage.setItem('usAlertList', JSON.stringify(usAlertList));
  loadUsAlertList();
  document.getElementById('us-bulk-percent-options').style.display = 'none';
  
  hideLoading();
  
  alert('일괄 설정 완료!\n\n성공: ' + successCount + '개\n실패: ' + failCount + '개');
}


// ==================== 미국 종목 찾기 ====================
var usSectorStocks = {
  tech: ['AAPL', 'MSFT', 'GOOGL', 'META', 'NVDA', 'AMD', 'INTC', 'CRM', 'ADBE', 'ORCL'],
  healthcare: ['JNJ', 'UNH', 'PFE', 'ABBV', 'MRK', 'TMO', 'ABT', 'DHR', 'BMY', 'AMGN'],
  finance: ['JPM', 'BAC', 'WFC', 'GS', 'MS', 'C', 'BLK', 'SCHW', 'AXP', 'V'],
  consumer: ['AMZN', 'TSLA', 'HD', 'MCD', 'NKE', 'SBUX', 'TGT', 'COST', 'WMT', 'DIS'],
  energy: ['XOM', 'CVX', 'COP', 'SLB', 'EOG', 'MPC', 'PSX', 'VLO', 'OXY', 'HAL'],
  industrial: ['CAT', 'DE', 'BA', 'HON', 'UPS', 'GE', 'MMM', 'LMT', 'RTX', 'UNP']
};

var usSectorNames = {
  tech: '🖥️ 기술',
  healthcare: '🏥 헬스케어',
  finance: '🏦 금융',
  consumer: '🛒 소비재',
  energy: '⚡ 에너지',
  industrial: '🏭 산업재'
};

async function loadPopularUsStocks() {
  showLoading();
  
  var popularStocks = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA', 'META', 'JPM', 'V', 'JNJ'];
  var analyzedStocks = [];
  
  var container = document.getElementById('popular-us-container');
  container.innerHTML = '<p>분석 중... 잠시 기다려주세요.</p>';
  
  for (var i = 0; i < popularStocks.length; i++) {
    var symbol = popularStocks[i];
    
    try {
      container.innerHTML = '<p>분석 중... (' + (i + 1) + '/' + popularStocks.length + ') ' + symbol + '</p>';
      
      var quoteResult = await apiCall('/api/us/quote/' + symbol);
      var analysisResult = await apiCall('/api/us/analysis/' + symbol);
      
      if (analysisResult.success && analysisResult.data) {
        var data = analysisResult.data;
        analyzedStocks.push({
          symbol: symbol,
          name: quoteResult.success ? quoteResult.data.name : symbol,
          price: data.currentPrice,
          score: data.technicalScore,
          rsi: data.rsi,
          signal: data.signal
        });
      }
    } catch (err) {
      console.log('종목 분석 실패:', symbol);
    }
  }
  
  analyzedStocks.sort(function(a, b) { return b.score - a.score; });
  displayUsStockResults(container, '인기 종목', analyzedStocks);
  
  hideLoading();
}

async function analyzeUsSector() {
  var sector = document.getElementById('us-sector-select').value;
  
  if (!sector) {
    alert('섹터를 선택하세요.');
    return;
  }
  
  showLoading();
  
  var stocks = usSectorStocks[sector];
  var analyzedStocks = [];
  
  var container = document.getElementById('us-sector-result-container');
  container.innerHTML = '<p>분석 중... 잠시 기다려주세요.</p>';
  
  for (var i = 0; i < stocks.length; i++) {
    var symbol = stocks[i];
    
    try {
      container.innerHTML = '<p>분석 중... (' + (i + 1) + '/' + stocks.length + ') ' + symbol + '</p>';
      
      var quoteResult = await apiCall('/api/us/quote/' + symbol);
      var analysisResult = await apiCall('/api/us/analysis/' + symbol);
      
      if (analysisResult.success && analysisResult.data) {
        var data = analysisResult.data;
        analyzedStocks.push({
          symbol: symbol,
          name: quoteResult.success ? quoteResult.data.name : symbol,
          price: data.currentPrice,
          score: data.technicalScore,
          rsi: data.rsi,
          signal: data.signal
        });
      }
    } catch (err) {
      console.log('종목 분석 실패:', symbol);
    }
  }
  
  analyzedStocks.sort(function(a, b) { return b.score - a.score; });
  displayUsStockResults(container, usSectorNames[sector], analyzedStocks);
  
  hideLoading();
}

async function scanAllUsSectors() {
  if (!confirm('전체 섹터 스캔은 시간이 오래 걸릴 수 있습니다. 진행하시겠습니까?')) {
    return;
  }
  
  showLoading();
  
  var container = document.getElementById('us-scan-result-container');
  container.innerHTML = '<p>스캔 중... 잠시 기다려주세요.</p>';
  
  var allRecommendations = [];
  var sectors = Object.keys(usSectorStocks);
  
  for (var s = 0; s < sectors.length; s++) {
    var sector = sectors[s];
    var stocks = usSectorStocks[sector].slice(0, 5);
    
    container.innerHTML = '<p>스캔 중... (' + (s + 1) + '/' + sectors.length + ') ' + usSectorNames[sector] + '</p>';
    
    for (var i = 0; i < stocks.length; i++) {
      var symbol = stocks[i];
      
      try {
        var quoteResult = await apiCall('/api/us/quote/' + symbol);
        var analysisResult = await apiCall('/api/us/analysis/' + symbol);
        
        if (analysisResult.success && analysisResult.data) {
          var data = analysisResult.data;
          
          if (data.technicalScore >= 60 && data.rsi >= 30 && data.rsi <= 70) {
            allRecommendations.push({
              sector: usSectorNames[sector],
              symbol: symbol,
              name: quoteResult.success ? quoteResult.data.name : symbol,
              price: data.currentPrice,
              score: data.technicalScore,
              rsi: data.rsi,
              signal: data.signal
            });
          }
        }
      } catch (err) {
        console.log('종목 분석 실패:', symbol);
      }
    }
  }
  
  allRecommendations.sort(function(a, b) { return b.score - a.score; });
  displayUsScanResults(allRecommendations.slice(0, 20));
  
  hideLoading();
}

function displayUsStockResults(container, title, stocks) {
  if (stocks.length === 0) {
    container.innerHTML = '<p>분석 결과가 없습니다.</p>';
    return;
  }
  
  var signalText = {
    'STRONG_BUY': '🔥 강력매수',
    'BUY': '📈 매수',
    'HOLD': '⏸️ 보유',
    'SELL': '📉 매도',
    'STRONG_SELL': '⚠️ 강력매도'
  };
  
  var html = '<h4>📈 ' + title + ' - TOP ' + stocks.length + '</h4>';
  html += '<table><thead><tr><th>순위</th><th>종목</th><th>현재가</th><th>점수</th><th>RSI</th><th>신호</th><th>기능</th></tr></thead><tbody>';
  
  stocks.forEach(function(stock, index) {
    var medal = index === 0 ? '🥇' : (index === 1 ? '🥈' : (index === 2 ? '🥉' : (index + 1)));
    var signalClass = (stock.signal === 'BUY' || stock.signal === 'STRONG_BUY') ? 'positive' : 
                      (stock.signal === 'SELL' || stock.signal === 'STRONG_SELL') ? 'negative' : '';
    
    html += '<tr>';
    html += '<td>' + medal + '</td>';
    html += '<td><strong>' + (stock.name || stock.symbol) + '</strong><br><small>' + stock.symbol + '</small></td>';
    html += '<td>$' + (stock.price ? stock.price.toFixed(2) : '--') + '</td>';
    html += '<td style="color:#3b82f6; font-weight:bold;">' + stock.score + '점</td>';
    html += '<td>' + (stock.rsi ? stock.rsi.toFixed(1) : '--') + '</td>';
    html += '<td class="' + signalClass + '">' + (signalText[stock.signal] || stock.signal) + '</td>';
    html += '<td><button onclick="goToUsStock(\'' + stock.symbol + '\')">상세</button></td>';
    html += '</tr>';
  });
  
  html += '</tbody></table>';
  container.innerHTML = html;
}

function displayUsScanResults(stocks) {
  var container = document.getElementById('us-scan-result-container');
  
  if (stocks.length === 0) {
    container.innerHTML = '<p>매수 적합 조건(점수 60↑, RSI 30~70)을 만족하는 종목이 없습니다.</p>';
    return;
  }
  
  var signalText = {
    'STRONG_BUY': '🔥 강력매수',
    'BUY': '📈 매수',
    'HOLD': '⏸️ 보유'
  };
  
  var html = '<h4>⭐ 매수 추천 종목 TOP ' + stocks.length + '</h4>';
  html += '<p style="color:#666; font-size:0.9rem;">조건: 기술적 점수 60점 이상, RSI 30~70</p>';
  html += '<table><thead><tr><th>순위</th><th>섹터</th><th>종목</th><th>현재가</th><th>점수</th><th>RSI</th><th>신호</th><th>기능</th></tr></thead><tbody>';
  
  stocks.forEach(function(stock, index) {
    var medal = index === 0 ? '🥇' : (index === 1 ? '🥈' : (index === 2 ? '🥉' : (index + 1)));
    var signalClass = (stock.signal === 'BUY' || stock.signal === 'STRONG_BUY') ? 'positive' : '';
    
    html += '<tr>';
    html += '<td>' + medal + '</td>';
    html += '<td><small>' + stock.sector + '</small></td>';
    html += '<td><strong>' + (stock.name || stock.symbol) + '</strong><br><small>' + stock.symbol + '</small></td>';
    html += '<td>$' + (stock.price ? stock.price.toFixed(2) : '--') + '</td>';
    html += '<td style="color:#3b82f6; font-weight:bold;">' + stock.score + '점</td>';
    html += '<td>' + stock.rsi.toFixed(1) + '</td>';
    html += '<td class="' + signalClass + '">' + (signalText[stock.signal] || stock.signal) + '</td>';
    html += '<td><button onclick="goToUsStock(\'' + stock.symbol + '\')">상세</button></td>';
    html += '</tr>';
  });
  
  html += '</tbody></table>';
  container.innerHTML = html;
}

function goToUsStock(symbol) {
  // 미국 주식 탭으로 이동
  document.querySelectorAll('.tab-content').forEach(function(tab) {
    tab.classList.remove('active');
  });
  document.getElementById('tab-us-stock').classList.add('active');
  
  document.querySelectorAll('.nav-item').forEach(function(nav) {
    nav.classList.remove('active');
    if (nav.getAttribute('data-tab') === 'us-stock') {
      nav.classList.add('active');
    }
  });
  
  // 종목 검색
  document.getElementById('us-stock-input').value = symbol;
  selectUsStock(symbol);
}

// 브라우저 알림 권한 요청
if ('Notification' in window && Notification.permission === 'default') {
  Notification.requestPermission();
}


// 대시보드 포트폴리오 요약
async function loadDashboardPortfolio() {
  var container = document.getElementById('dashboard-portfolio-summary');
  
  var krTotal = { invest: 0, value: 0, count: 0 };
  var usTotal = { invest: 0, value: 0, count: 0 };
  
  // 한국 주식 계산
  if (portfolio && portfolio.length > 0) {
    krTotal.count = portfolio.length;
    for (var i = 0; i < portfolio.length; i++) {
      var item = portfolio[i];
      krTotal.invest += item.price * item.qty;
      
      try {
        var result = await apiCall('/api/korea/stock/' + item.code);
        if (result.success && result.data) {
          krTotal.value += result.data.price * item.qty;
        }
      } catch (e) {
        krTotal.value += item.price * item.qty;
      }
    }
  }
  
  // 미국 주식 계산
  if (usPortfolio && usPortfolio.length > 0) {
    usTotal.count = usPortfolio.length;
    for (var i = 0; i < usPortfolio.length; i++) {
      var item = usPortfolio[i];
      usTotal.invest += item.price * item.qty;
      
      try {
        var result = await apiCall('/api/us/quote/' + item.symbol);
        if (result.success && result.data) {
          usTotal.value += result.data.price * item.qty;
        }
      } catch (e) {
        usTotal.value += item.price * item.qty;
      }
    }
  }
  
  // 수익률 계산
  var krProfit = krTotal.value - krTotal.invest;
  var krRate = krTotal.invest > 0 ? ((krProfit / krTotal.invest) * 100).toFixed(2) : 0;
  var krClass = krProfit >= 0 ? 'positive' : 'negative';
  
  var usProfit = usTotal.value - usTotal.invest;
  var usRate = usTotal.invest > 0 ? ((usProfit / usTotal.invest) * 100).toFixed(2) : 0;
  var usClass = usProfit >= 0 ? 'positive' : 'negative';
  
  // 전체 합계 (USD는 환율 적용)
  var exchangeRate = 1400; // 기본값
  try {
    var exResult = await apiCall('/api/korea/exchange');
    if (exResult.success && exResult.data && exResult.data.usd) {
      exchangeRate = parseFloat(exResult.data.usd.replace(/,/g, ''));
    }
  } catch (e) {}
  
  var totalInvestKRW = krTotal.invest + (usTotal.invest * exchangeRate);
  var totalValueKRW = krTotal.value + (usTotal.value * exchangeRate);
  var totalProfit = totalValueKRW - totalInvestKRW;
  var totalRate = totalInvestKRW > 0 ? ((totalProfit / totalInvestKRW) * 100).toFixed(2) : 0;
  var totalClass = totalProfit >= 0 ? 'positive' : 'negative';
  
  var html = '<div class="indicators-grid">';
  
  // 한국 주식
  html += '<div class="indicator-card">';
  html += '<div class="label">🇰🇷 한국 주식 (' + krTotal.count + '종목)</div>';
  html += '<div class="value">' + krTotal.value.toLocaleString() + '원</div>';
  html += '<div class="' + krClass + '">' + (krProfit >= 0 ? '+' : '') + krProfit.toLocaleString() + '원 (' + (krProfit >= 0 ? '+' : '') + krRate + '%)</div>';
  html += '</div>';
  
  // 미국 주식
  html += '<div class="indicator-card">';
  html += '<div class="label">🇺🇸 미국 주식 (' + usTotal.count + '종목)</div>';
  html += '<div class="value">$' + usTotal.value.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) + '</div>';
  html += '<div class="' + usClass + '">' + (usProfit >= 0 ? '+' : '') + '$' + usProfit.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) + ' (' + (usProfit >= 0 ? '+' : '') + usRate + '%)</div>';
  html += '</div>';
  
  // 전체 합계
  html += '<div class="indicator-card" style="background:#f0f9ff;">';
  html += '<div class="label">📊 전체 합계 (원화 환산)</div>';
  html += '<div class="value">' + Math.round(totalValueKRW).toLocaleString() + '원</div>';
  html += '<div class="' + totalClass + '">' + (totalProfit >= 0 ? '+' : '') + Math.round(totalProfit).toLocaleString() + '원 (' + (totalProfit >= 0 ? '+' : '') + totalRate + '%)</div>';
  html += '</div>';
  
  html += '</div>';
  
  if (krTotal.count === 0 && usTotal.count === 0) {
    html = '<p style="color:#666;">등록된 포트폴리오가 없습니다. <a href="#" onclick="document.querySelector(\'[data-tab=portfolio]\').click()">포트폴리오 등록하기</a></p>';
  }
  
  container.innerHTML = html;
}


// 대시보드 알림 현황
function loadDashboardAlerts() {
  var container = document.getElementById('dashboard-alert-summary');
  
  var krAlertCount = alertList ? alertList.length : 0;
  var usAlertCount = usAlertList ? usAlertList.length : 0;
  var totalAlerts = krAlertCount + usAlertCount;
  
  // 발동된 알림 수
  var krTriggered = 0;
  var usTriggered = 0;
  
  if (alertList) {
    alertList.forEach(function(item) {
      if (item.triggered && item.triggered.length > 0) krTriggered++;
    });
  }
  
  if (usAlertList) {
    usAlertList.forEach(function(item) {
      if (item.triggered && item.triggered.length > 0) usTriggered++;
    });
  }
  
  var totalTriggered = krTriggered + usTriggered;
  
  // 모니터링 상태
  var krMonitoring = monitorInterval ? true : false;
  var usMonitoring = usMonitorInterval ? true : false;
  
  var html = '<div class="indicators-grid">';
  
  // 한국 주식 알림
  html += '<div class="indicator-card">';
  html += '<div class="label">🇰🇷 한국 주식 알림</div>';
  html += '<div class="value">' + krAlertCount + '개</div>';
  if (krTriggered > 0) {
    html += '<div class="positive">🔔 ' + krTriggered + '개 발동!</div>';
  }
  if (krMonitoring) {
    html += '<div style="color:#22c55e;">● 모니터링 중</div>';
  } else {
    html += '<div style="color:#9ca3af;">○ 모니터링 꺼짐</div>';
  }
  html += '</div>';
  
  // 미국 주식 알림
  html += '<div class="indicator-card">';
  html += '<div class="label">🇺🇸 미국 주식 알림</div>';
  html += '<div class="value">' + usAlertCount + '개</div>';
  if (usTriggered > 0) {
    html += '<div class="positive">🔔 ' + usTriggered + '개 발동!</div>';
  }
  if (usMonitoring) {
    html += '<div style="color:#22c55e;">● 모니터링 중</div>';
  } else {
    html += '<div style="color:#9ca3af;">○ 모니터링 꺼짐</div>';
  }
  html += '</div>';
  
  // 전체 요약
  html += '<div class="indicator-card" style="background:#fef3c7;">';
  html += '<div class="label">📊 전체 알림 현황</div>';
  html += '<div class="value">' + totalAlerts + '개 설정됨</div>';
  if (totalTriggered > 0) {
    html += '<div class="positive">🔔 ' + totalTriggered + '개 발동!</div>';
  } else {
    html += '<div style="color:#666;">⏳ 대기중</div>';
  }
  html += '</div>';
  
  html += '</div>';
  
  if (totalAlerts === 0) {
    html = '<p style="color:#666;">설정된 알림이 없습니다. <a href="#" onclick="document.querySelector(\'[data-tab=portfolio]\').click()">알림 설정하기</a></p>';
  }
  
  container.innerHTML = html;
}


// 대시보드 환율 정보
async function loadDashboardExchange() {
  var container = document.getElementById('dashboard-exchange-rate');
  if (!container) return;
  
  try {
    var result = await apiCall('/api/korea/exchange');
    
    if (result.success && result.data) {
      var data = result.data;
      
      var html = '<div class="indicators-grid">';
      
      html += '<div class="indicator-card">';
      html += '<div class="label">🇺🇸 USD</div>';
      html += '<div class="value" style="color:#3b82f6;">' + (data.usd || '--') + '원</div>';
      html += '</div>';
      
      html += '<div class="indicator-card">';
      html += '<div class="label">🇯🇵 JPY (100)</div>';
      html += '<div class="value" style="color:#ef4444;">' + (data.jpy || '--') + '원</div>';
      html += '</div>';
      
      html += '<div class="indicator-card">';
      html += '<div class="label">🇪🇺 EUR</div>';
      html += '<div class="value" style="color:#22c55e;">' + (data.eur || '--') + '원</div>';
      html += '</div>';
      
      html += '</div>';
      
      container.innerHTML = html;
    }
  } catch (error) {
    console.error('환율 조회 오류:', error);
  }
}


// ==================== AI 원포인트 레슨 ====================

// 시가총액별 분석
async function loadAiByMarketCap(capType) {
  showLoading();
  
  var container = document.getElementById('ai-cap-result-container');
  container.innerHTML = '<p>🤖 AI가 ' + getCapTypeName(capType) + ' 종목을 분석 중입니다...</p>';
  
  // 버튼 활성화 상태 변경
  document.getElementById('ai-large-cap-btn').className = capType === 'large' ? 'btn-primary' : 'btn-secondary';
  document.getElementById('ai-mid-cap-btn').className = capType === 'mid' ? 'btn-primary' : 'btn-secondary';
  document.getElementById('ai-small-cap-btn').className = capType === 'small' ? 'btn-primary' : 'btn-secondary';
  
  try {
    // KOSPI + KOSDAQ 시가총액 데이터 조회
    var kospiResult = await apiCall('/api/korea/market-cap/0');
    var kosdaqResult = await apiCall('/api/korea/market-cap/1');
    
    var allStocks = [];
    
    if (kospiResult.success && kospiResult.data) {
      allStocks = allStocks.concat(kospiResult.data);
    }
    
    if (kosdaqResult.success && kosdaqResult.data) {
      allStocks = allStocks.concat(kosdaqResult.data);
    }
    
    if (allStocks.length === 0) {
      container.innerHTML = '<p>데이터를 불러올 수 없습니다.</p>';
      hideLoading();
      return;
    }
    
    // 시가총액 기준으로 필터링
    var filteredStocks = filterByMarketCap(allStocks, capType);
    
    if (filteredStocks.length === 0) {
      container.innerHTML = '<p>해당 조건의 종목이 없습니다.</p>';
      hideLoading();
      return;
    }
    
    // 상위 20개만 기술적 분석
    var candidates = filteredStocks.slice(0, 20);
    var analyzedStocks = [];
    
    for (var i = 0; i < candidates.length; i++) {
      var stock = candidates[i];
      
      container.innerHTML = '<p>🤖 분석 중... (' + (i + 1) + '/' + candidates.length + ') ' + stock.name + '</p>';
      
      try {
        var analysisResult = await apiCall('/api/analysis/technical/' + stock.code);
        
        if (analysisResult.success && analysisResult.data) {
          var data = analysisResult.data;
          
          analyzedStocks.push({
            code: stock.code,
            name: stock.name,
            price: stock.price,
            marketCap: stock.marketCap,
            marketCapText: stock.marketCapText,
            techScore: data.technicalScore || 0,
            rsi: data.rsi || 0,
            macd: data.macd || 0
          });
        }
      } catch (err) {
        console.log('분석 오류:', stock.name, err);
      }
    }
    
    // 기술적 점수 순 정렬
    analyzedStocks.sort(function(a, b) { return b.techScore - a.techScore; });
    
    // 결과 표시
    displayAiCapResult(analyzedStocks, capType);
    
  } catch (error) {
    console.error('시가총액별 분석 오류:', error);
    container.innerHTML = '<p>분석 중 오류가 발생했습니다.</p>';
  }
  
  hideLoading();
}



// 시가총액 필터링
function filterByMarketCap(stocks, capType) {
  return stocks.filter(function(stock) {
    var cap = stock.marketCap;
    
    if (capType === 'large') {
      return cap >= 100000; // 10조 이상 (100,000억)
    } else if (capType === 'mid') {
      return cap >= 10000 && cap < 100000; // 1조 ~ 10조
    } else {
      return cap < 10000; // 1조 미만
    }
  });
}

// 시가총액 구분 이름
function getCapTypeName(capType) {
  if (capType === 'large') return '대형주';
  if (capType === 'mid') return '중형주';
  return '소형주';
}



// 시가총액별 결과 표시
function displayAiCapResult(stocks, capType) {
  var container = document.getElementById('ai-cap-result-container');
  
  if (stocks.length === 0) {
    container.innerHTML = '<p>분석 결과가 없습니다.</p>';
    return;
  }
  
  var html = '<h4>📈 ' + getCapTypeName(capType) + ' TOP ' + stocks.length + '</h4>';
  html += '<table class="table-fit"><thead><tr>';
  html += '<th>순위</th>';
  html += '<th>종목명</th>';
  html += '<th>현재가</th>';
  html += '<th class="hide-mobile">시가총액</th>';
  html += '<th><span class="hide-mobile">기술적 </span>점수</th>';
  html += '<th class="hide-mobile">RSI</th>';
  html += '<th>신호</th>';
  html += '<th>기능</th>';
  html += '</tr></thead><tbody>';
  
  stocks.forEach(function(stock, index) {
    var medal = index === 0 ? '🥇' : (index === 1 ? '🥈' : (index === 2 ? '🥉' : (index + 1)));
    var signal = getSignalFromScore(stock.techScore);
    var signalClass = (signal === 'BUY' || signal === 'STRONG_BUY') ? 'positive' : 
                      (signal === 'SELL' || signal === 'STRONG_SELL') ? 'negative' : '';
    var signalText = {
      'STRONG_BUY': '🔥 강력매수',
      'BUY': '📈 매수',
      'HOLD': '⏸️ 보유',
      'SELL': '📉 매도',
      'STRONG_SELL': '⚠️ 강력매도'
    };
    
    html += '<tr>';
    html += '<td>' + medal + '</td>';
    html += '<td><strong>' + stock.name + '</strong><br><small>' + stock.code + '</small></td>';
    html += '<td>' + stock.price.toLocaleString() + '원</td>';
    html += '<td class="hide-mobile">' + stock.marketCapText + '</td>';
    html += '<td style="color:#3b82f6; font-weight:bold;">' + stock.techScore + '점</td>';
    html += '<td class="hide-mobile">' + (stock.rsi > 0 ? stock.rsi.toFixed(1) : '--') + '</td>';
    html += '<td class="' + signalClass + '">' + (signalText[signal] || signal) + '</td>';
    html += '<td><button onclick="analyzeStock(\'' + stock.code + '\')">분석</button></td>';
    html += '</tr>';
  });
  
  html += '</tbody></table>';
  container.innerHTML = html;
}


// 테마 목록 로드
async function loadAiThemeList() {
  try {
    var result = await apiCall('/api/korea/themes');
    
    if (result.success && result.data) {
      var select = document.getElementById('ai-theme-select');
      select.innerHTML = '<option value="">테마 선택...</option>';
      
      result.data.forEach(function(theme) {
        var option = document.createElement('option');
        option.value = theme.code;
        option.textContent = theme.name + ' (' + theme.changeRate + ')';
        option.setAttribute('data-change', theme.changeRate.replace('%', ''));
        select.appendChild(option);
      });
    }
  } catch (error) {
    console.error('테마 목록 로드 오류:', error);
  }
}


// 테마별 TOP 분석
async function loadAiByTheme() {
  var select = document.getElementById('ai-theme-select');
  var selectedOption = select.options[select.selectedIndex];
  var themeCode = select.value;
  
  if (!themeCode) {
    alert('테마를 선택하세요.');
    return;
  }
  
  var themeName = selectedOption.text.split(' (')[0];
  var themeChangeRate = selectedOption.getAttribute('data-change') || '0';
  
  showLoading();
  
  var container = document.getElementById('ai-theme-result-container');
  container.innerHTML = '<p>🤖 ' + themeName + ' 테마 분석 중...</p>';
  
  try {
    // 테마 종목 조회
    var result = await apiCall('/api/korea/theme/' + themeCode);
    
    if (!result.success || !result.data || result.data.length === 0) {
      container.innerHTML = '<p>테마 종목을 찾을 수 없습니다.</p>';
      hideLoading();
      return;
    }
    
    var stocks = result.data.slice(0, 10);
    var analyzedStocks = [];
    
    // 각 종목 분석
    for (var i = 0; i < stocks.length; i++) {
      var stock = stocks[i];
      container.innerHTML = '<p>🤖 분석 중... (' + (i + 1) + '/' + stocks.length + ') ' + stock.name + '</p>';
      
      try {
        var techResult = await apiCall('/api/analysis/technical/' + stock.code);
        
        if (techResult.success) {
          analyzedStocks.push({
            code: stock.code,
            name: stock.name,
            price: stock.price || techResult.data.currentPrice,
            techScore: techResult.data.technicalScore || 0,
            volumeRatio: techResult.data.volumeRatio || 0,
            currentPrice: techResult.data.currentPrice || 0,
            ma20: techResult.data.ma20 || 0,
            ma60: techResult.data.ma60 || 0,
            changeRate: techResult.data.changeRate || 0,
            themeChangeRate: parseFloat(themeChangeRate) || 0,
            themeRank: i + 1
          });
        }
      } catch (e) {
        console.error('분석 오류:', stock.name, e);
      }
    }
    
    // 새 점수로 정렬
    analyzedStocks.forEach(function(stock) {
      var scoreResult = calculateNewScore(stock);
      stock.newScore = scoreResult.totalScaled;
      stock.scoreDetail = scoreResult;
    });
    
    analyzedStocks.sort(function(a, b) {
      return b.newScore - a.newScore;
    });
    
    displayAiThemeResult(analyzedStocks, themeName, themeChangeRate);
    
  } catch (error) {
    console.error('테마 분석 오류:', error);
    container.innerHTML = '<p>분석 중 오류가 발생했습니다.</p>';
  }
  
  hideLoading();
}



// 테마별 TOP 결과 표시
function displayAiThemeResult(stocks, themeName, themeChangeRate) {
  var container = document.getElementById('ai-theme-result-container');
  
  var html = '<div class="card">';
  html += '<h3>🏷️ ' + themeName + ' TOP 10 <span style="color:#3b82f6;">(테마 등락률: ' + themeChangeRate + '%)</span></h3>';
  html += '<table class="stock-table"><thead><tr>';
  html += '<th>순위</th><th>종목명</th><th>현재가</th><th>종합점수</th><th>기술</th><th>거래량</th><th>테마</th><th>상세</th>';
  html += '</tr></thead><tbody>';
  
  stocks.forEach(function(stock, index) {
    var medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : (index + 1);
    var detail = stock.scoreDetail || {};
    
    html += '<tr>';
    html += '<td>' + medal + '</td>';
    html += '<td><strong>' + stock.name + '</strong></td>';
    html += '<td>' + (stock.price ? stock.price.toLocaleString() + '원' : '--') + '</td>';
    html += '<td><strong style="color:#3b82f6; font-size:1.1rem;">' + stock.newScore + '점</strong></td>';
    html += '<td>' + (detail.technical || 0) + '/25</td>';
    html += '<td>' + (detail.volume || 0) + '/25</td>';
    html += '<td>' + (detail.theme || 0) + '/20</td>';
    html += '<td><button onclick="aiAnalyzeStockByCode(\'' + stock.code + '\')" class="btn-small">분석</button></td>';
    html += '</tr>';
  });
  
  html += '</tbody></table></div>';
  container.innerHTML = html;
}


// AI 직접 검색 분석
async function aiAnalyzeStock() {
  var input = document.getElementById('ai-stock-input').value.trim();
  
  if (!input) {
    alert('종목명 또는 종목코드를 입력하세요.');
    return;
  }
  
  showLoading();
  
  var container = document.getElementById('ai-direct-search-result');
  container.innerHTML = '<p>🤖 AI가 분석 중입니다...</p>';
  
  try {
    // 종목코드 찾기
    var stockCode = await findStockCode(input);
    
    if (!stockCode) {
      container.innerHTML = '<p>종목을 찾을 수 없습니다: ' + input + '</p>';
      hideLoading();
      return;
    }
    
    // 기본 정보 조회
    var stockResult = await apiCall('/api/korea/stock/' + stockCode);
    var stockName = stockResult.success ? stockResult.data.name : stockCode;
    var stockPrice = stockResult.success ? stockResult.data.price : 0;
    
    // 기술적 분석
    var techResult = await apiCall('/api/analysis/technical/' + stockCode);
    
    // 매매 신호
    var signalResult = await apiCall('/api/analysis/signal/' + stockCode);
    
    // 시가총액 조회
    container.innerHTML = '<p>🤖 시가총액 조회 중...</p>';
    var marketCap = 0;
    var capResult = await apiCall('/api/korea/market-cap/0');
    if (capResult.success && capResult.data) {
      var found = capResult.data.find(function(s) { return s.code === stockCode; });
      if (found) {
        marketCap = found.marketCap;
      } else {
        var capResult2 = await apiCall('/api/korea/market-cap/1');
        if (capResult2.success && capResult2.data) {
          var found2 = capResult2.data.find(function(s) { return s.code === stockCode; });
          if (found2) {
            marketCap = found2.marketCap;
          }
        }
      }
    }
    
    // 테마 정보 찾기
    container.innerHTML = '<p>🤖 테마 정보 검색 중...</p>';
    var themeInfo = await findStockTheme(stockCode);
    
    // 뉴스 정보 조회
    container.innerHTML = '<p>🤖 뉴스 정보 검색 중...</p>';
    var newsInfo = null;
    try {
      var newsResult = await apiCall('/api/korea/news/' + encodeURIComponent(stockName));
      if (newsResult.success && newsResult.data) {
        var newsList = newsResult.data;
        var today = new Date();
        var todayStr = (today.getMonth() + 1) + '/' + today.getDate();
        var yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        var yesterdayStr = (yesterday.getMonth() + 1) + '/' + yesterday.getDate();
        
        var hasToday = newsList.some(function(n) { return n.date === todayStr; });
        var hasYesterday = newsList.some(function(n) { return n.date === yesterdayStr; });
        
        newsInfo = {
          newsCount: newsList.length,
          hasToday: hasToday,
          hasYesterday: hasYesterday
        };
      }
    } catch (e) {
      console.error('뉴스 조회 오류:', e);
    }
    
    // 결과 표시
    displayAiDetailResult({
      code: stockCode,
      name: stockName,
      price: stockPrice,
      marketCap: marketCap,
      techScore: techResult.success ? techResult.data.technicalScore : 0,
      technical: techResult.success ? techResult.data : null,
      signal: signalResult.success ? signalResult.data : null,
      themeChangeRate: themeInfo ? themeInfo.changeRate : undefined,
      themeRank: themeInfo ? themeInfo.rank : undefined,
      themeName: themeInfo ? themeInfo.name : null,
      newsCount: newsInfo ? newsInfo.newsCount : 0,
      hasToday: newsInfo ? newsInfo.hasToday : false,
      hasYesterday: newsInfo ? newsInfo.hasYesterday : false
    });
    
  } catch (error) {
    console.error('AI 분석 오류:', error);
    container.innerHTML = '<p>분석 중 오류가 발생했습니다.</p>';
  }
  
  hideLoading();
}


// AI 종목코드로 직접 분석 (테마 정보 포함 가능)
async function aiAnalyzeStockByCode(stockCode, themeInfo) {
  showLoading();
  
  var container = document.getElementById('ai-direct-search-result');
  container.innerHTML = '<p>🤖 AI가 분석 중입니다...</p>';
  
  try {
    // 기본 정보 조회
    var stockResult = await apiCall('/api/korea/stock/' + stockCode);
    var stockName = stockResult.success ? stockResult.data.name : stockCode;
    var stockPrice = stockResult.success ? stockResult.data.price : 0;
    
    // 기술적 분석
    var techResult = await apiCall('/api/analysis/technical/' + stockCode);
    
    // 매매 신호
    var signalResult = await apiCall('/api/analysis/signal/' + stockCode);
    
    // 시가총액 조회
    container.innerHTML = '<p>🤖 시가총액 조회 중...</p>';
    var marketCap = 0;
    var capResult = await apiCall('/api/korea/market-cap/0');
    if (capResult.success && capResult.data) {
      var found = capResult.data.find(function(s) { return s.code === stockCode; });
      if (found) {
        marketCap = found.marketCap;
      } else {
        var capResult2 = await apiCall('/api/korea/market-cap/1');
        if (capResult2.success && capResult2.data) {
          var found2 = capResult2.data.find(function(s) { return s.code === stockCode; });
          if (found2) {
            marketCap = found2.marketCap;
          }
        }
      }
    }
    
    // 테마 정보 (전달받았으면 사용, 아니면 검색)
    var finalThemeInfo = themeInfo;
    if (!finalThemeInfo) {
      container.innerHTML = '<p>🤖 테마 정보 검색 중...</p>';
      finalThemeInfo = await findStockTheme(stockCode);
    }
    
    // 뉴스 정보 조회
    container.innerHTML = '<p>🤖 뉴스 정보 검색 중...</p>';
    var newsInfo = null;
    try {
      var newsResult = await apiCall('/api/korea/news/' + encodeURIComponent(stockName));
      if (newsResult.success && newsResult.data) {
        var newsList = newsResult.data;
        var today = new Date();
        var todayStr = (today.getMonth() + 1) + '/' + today.getDate();
        var yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        var yesterdayStr = (yesterday.getMonth() + 1) + '/' + yesterday.getDate();
        
        var hasToday = newsList.some(function(n) { return n.date === todayStr; });
        var hasYesterday = newsList.some(function(n) { return n.date === yesterdayStr; });
        
        newsInfo = {
          newsCount: newsList.length,
          hasToday: hasToday,
          hasYesterday: hasYesterday
        };
      }
    } catch (e) {
      console.error('뉴스 조회 오류:', e);
    }
    
    // 결과 표시
    displayAiDetailResult({
      code: stockCode,
      name: stockName,
      price: stockPrice,
      marketCap: marketCap,
      techScore: techResult.success ? techResult.data.technicalScore : 0,
      technical: techResult.success ? techResult.data : null,
      signal: signalResult.success ? signalResult.data : null,
      themeChangeRate: finalThemeInfo ? finalThemeInfo.changeRate : undefined,
      themeRank: finalThemeInfo ? finalThemeInfo.rank : undefined,
      themeName: finalThemeInfo ? finalThemeInfo.name : null,
      newsCount: newsInfo ? newsInfo.newsCount : 0,
      hasToday: newsInfo ? newsInfo.hasToday : false,
      hasYesterday: newsInfo ? newsInfo.hasYesterday : false
    });
    
  } catch (error) {
    console.error('AI 분석 오류:', error);
    container.innerHTML = '<p>분석 중 오류가 발생했습니다.</p>';
  }
  
  hideLoading();
}


// 종목이 속한 테마 찾기
async function findStockTheme(stockCode) {
  try {
    var themesResult = await apiCall('/api/korea/themes');
    
    if (!themesResult.success || !themesResult.data) {
      return null;
    }
    
    var themes = themesResult.data;
    
    // 상위 50개 테마만 검색 (속도 최적화)
    var searchCount = Math.min(themes.length, 50);
    
    for (var i = 0; i < searchCount; i++) {
      var theme = themes[i];
      
      try {
        var themeStocks = await apiCall('/api/korea/theme/' + theme.code);
        
        if (themeStocks.success && themeStocks.data) {
          for (var j = 0; j < themeStocks.data.length; j++) {
            if (themeStocks.data[j].code === stockCode) {
              return {
                code: theme.code,
                name: theme.name,
                changeRate: parseFloat(theme.changeRate.replace('%', '')) || 0,
                rank: j + 1
              };
            }
          }
        }
      } catch (e) {
        // 개별 테마 오류 무시
      }
    }
    
    return null;
  } catch (error) {
    console.error('테마 검색 오류:', error);
    return null;
  }
}




// AI 상세 분석 결과 표시
function displayAiDetailResult(data) {
  var container = document.getElementById('ai-direct-search-result');
  
  var tech = data.technical || {};
  var signal = data.signal || {};
  
  // 새 점수 계산 (거래량/모멘텀 + 테마 데이터 추가)
  var newScore = calculateNewScore({
    techScore: data.techScore || 0,
    marketCap: data.marketCap || 0,
    volumeRatio: tech.volumeRatio || 0,
    currentPrice: tech.currentPrice || data.price || 0,
    ma20: tech.ma20 || 0,
    ma60: tech.ma60 || 0,
    changeRate: tech.changeRate || 0,
    themeChangeRate: data.themeChangeRate,
    themeRank: data.themeRank,
    newsCount: data.newsCount,
    hasToday: data.hasToday,
    hasYesterday: data.hasYesterday
  });
  
  var signalType = signal.signal || getSignalFromScore(newScore.totalScaled);
  var signalClass = (signalType === 'BUY' || signalType === 'STRONG_BUY') ? 'positive' : 
                    (signalType === 'SELL' || signalType === 'STRONG_SELL') ? 'negative' : '';
  
  var signalText = {
    'STRONG_BUY': '🔥 강력 매수',
    'BUY': '📈 매수',
    'HOLD': '⏸️ 보유',
    'SELL': '📉 매도',
    'STRONG_SELL': '⚠️ 강력 매도'
  };
  
  var html = '<div class="card">';
  html += '<h3>🤖 AI 분석 결과: ' + data.name + ' (' + data.code + ')</h3>';
  
  // 종합 신호
  html += '<div style="text-align:center; padding:20px; background:#f8fafc; border-radius:8px; margin:15px 0;">';
  html += '<p style="color:#666; margin-bottom:10px;">AI 종합 판단</p>';
  html += '<p style="font-size:2rem; font-weight:bold;" class="' + signalClass + '">' + (signalText[signalType] || signalType) + '</p>';
  html += '<p style="color:#666;">종합 점수: <strong style="color:#3b82f6; font-size:1.5rem;">' + newScore.totalScaled + '점</strong></p>';
  html += '<p style="color:#999; font-size:0.85rem;">(기존 기술적 점수: ' + (data.techScore || 0) + '점)</p>';
  html += '</div>';
  

  // 테마 정보 표시
  if (data.themeName) {
    html += '<div style="text-align:center; padding:10px; background:#fef3c7; border-radius:8px; margin:10px 0;">';
    html += '<span style="color:#92400e;">🏷️ 소속 테마: <strong>' + data.themeName + '</strong> (등락률: ' + (data.themeChangeRate || 0) + '%, 순위: ' + (data.themeRank || '-') + '위)</span>';
    html += '</div>';
  }
  
  // 점수 상세
  html += getScoreBreakdown(newScore);
  html += getEnhancedAIAnalysisHTML(data, data.name);
  
  // 지표 카드
  html += '<div class="indicators-grid" style="margin-top:15px;">';
  html += '<div class="indicator-card"><div class="label">현재가</div><div class="value">' + (data.price > 0 ? data.price.toLocaleString() + '원' : '--') + '</div></div>';
  html += '<div class="indicator-card"><div class="label">시가총액</div><div class="value">' + (data.marketCap > 0 ? data.marketCap.toLocaleString() + '억' : '--') + '</div></div>';
  html += '<div class="indicator-card"><div class="label">RSI (14)</div><div class="value">' + (tech.rsi ? tech.rsi.toFixed(1) : '--') + '</div></div>';
  html += '<div class="indicator-card"><div class="label">MACD</div><div class="value">' + (tech.macd ? tech.macd.toFixed(2) : '--') + '</div></div>';
  html += '</div>';
  
  // 목표가/손절가
  if (signal.targetPrice || signal.stopLoss) {
    html += '<div class="indicators-grid" style="margin-top:15px;">';
    html += '<div class="indicator-card" style="background:#dcfce7;"><div class="label">🎯 목표가</div><div class="value" style="color:#166534;">' + (signal.targetPrice ? signal.targetPrice.toLocaleString() + '원' : '--') + '</div></div>';
    html += '<div class="indicator-card" style="background:#fee2e2;"><div class="label">🛑 손절가</div><div class="value" style="color:#991b1b;">' + (signal.stopLoss ? signal.stopLoss.toLocaleString() + '원' : '--') + '</div></div>';
    html += '</div>';
  }
  
  // 판단 근거
  if (signal.reasons && signal.reasons.length > 0) {
    html += '<div style="margin-top:20px; padding:15px; background:#f0f9ff; border-radius:8px;">';
    html += '<h4>📋 판단 근거</h4><ul>';
    signal.reasons.forEach(function(reason) {
      html += '<li>' + reason + '</li>';
    });
    html += '</ul></div>';
  }
  
  // 분석 신호
  if (tech.signals && tech.signals.length > 0) {
    html += '<div style="margin-top:15px; padding:15px; background:#fef3c7; border-radius:8px;">';
    html += '<h4>📊 기술적 신호</h4><ul>';
    tech.signals.forEach(function(sig) {
      html += '<li>' + sig + '</li>';
    });
    html += '</ul></div>';
  }
  
  html += '</div>';
  container.innerHTML = html;
}


// ========== Phase 5: AI 고도화 ==========

// 기술적 지표 상세 분석
function analyzeIndicators(data) {
    var analysis = {
        rsiScore: 0,
        rsiStatus: '',
        macdScore: 0,
        macdStatus: '',
        maScore: 0,
        maStatus: '',
        bollingerScore: 0,
        bollingerStatus: '',
        totalTechScore: 0,
        signalStrength: 0,  // -2 ~ +2 (강한매도 ~ 강한매수)
        signals: []
    };
    
    // 1. RSI 분석 (0-25점)
    var rsi = data.rsi || 50;
    if (rsi <= 30) {
        analysis.rsiScore = 25;
        analysis.rsiStatus = '과매도 (매수 기회)';
        analysis.signalStrength += 2;
        analysis.signals.push('🟢 RSI 과매도 구간');
    } else if (rsi <= 40) {
        analysis.rsiScore = 20;
        analysis.rsiStatus = '저점 접근';
        analysis.signalStrength += 1;
        analysis.signals.push('🟡 RSI 저점 접근');
    } else if (rsi <= 60) {
        analysis.rsiScore = 15;
        analysis.rsiStatus = '중립';
        analysis.signals.push('⚪ RSI 중립 구간');
    } else if (rsi <= 70) {
        analysis.rsiScore = 10;
        analysis.rsiStatus = '고점 접근';
        analysis.signalStrength -= 1;
        analysis.signals.push('🟡 RSI 고점 접근');
    } else {
        analysis.rsiScore = 5;
        analysis.rsiStatus = '과매수 (매도 고려)';
        analysis.signalStrength -= 2;
        analysis.signals.push('🔴 RSI 과매수 구간');
    }
    
    // 2. MACD 분석 (0-25점)
    var macd = data.macd || 0;
    var macdSignal = data.macdSignal || 0;
    var macdHist = macd - macdSignal;
    
    if (macdHist > 0 && macd > 0) {
        analysis.macdScore = 25;
        analysis.macdStatus = '강한 상승 추세';
        analysis.signalStrength += 1;
        analysis.signals.push('🟢 MACD 강한 상승');
    } else if (macdHist > 0) {
        analysis.macdScore = 20;
        analysis.macdStatus = '상승 전환';
        analysis.signalStrength += 0.5;
        analysis.signals.push('🟡 MACD 상승 전환');
    } else if (macdHist < 0 && macd < 0) {
        analysis.macdScore = 5;
        analysis.macdStatus = '강한 하락 추세';
        analysis.signalStrength -= 1;
        analysis.signals.push('🔴 MACD 강한 하락');
    } else if (macdHist < 0) {
        analysis.macdScore = 10;
        analysis.macdStatus = '하락 전환';
        analysis.signalStrength -= 0.5;
        analysis.signals.push('🟡 MACD 하락 전환');
    } else {
        analysis.macdScore = 15;
        analysis.macdStatus = '중립';
    }
    
    // 3. 이동평균선 분석 (0-25점)
    var price = data.currentPrice || data.close || 0;
    var ma5 = data.ma5 || 0;
    var ma20 = data.ma20 || 0;
    var ma60 = data.ma60 || 0;
    
    if (price > ma5 && ma5 > ma20 && ma20 > ma60) {
        analysis.maScore = 25;
        analysis.maStatus = '완벽한 정배열';
        analysis.signalStrength += 1;
        analysis.signals.push('🟢 이평선 정배열');
    } else if (price > ma20 && ma20 > ma60) {
        analysis.maScore = 20;
        analysis.maStatus = '상승 추세';
        analysis.signalStrength += 0.5;
    } else if (price > ma60) {
        analysis.maScore = 15;
        analysis.maStatus = '중기 지지';
    } else if (price < ma5 && ma5 < ma20 && ma20 < ma60) {
        analysis.maScore = 5;
        analysis.maStatus = '완벽한 역배열';
        analysis.signalStrength -= 1;
        analysis.signals.push('🔴 이평선 역배열');
    } else {
        analysis.maScore = 10;
        analysis.maStatus = '혼조';
    }
    
    // 4. 볼린저밴드 분석 (0-25점)
    var upper = data.bollingerUpper || 0;
    var lower = data.bollingerLower || 0;
    var middle = data.bollingerMiddle || data.ma20 || 0;
    
    if (upper > 0 && lower > 0 && price > 0) {
        var position = (price - lower) / (upper - lower) * 100;
        
        if (position <= 20) {
            analysis.bollingerScore = 25;
            analysis.bollingerStatus = '하단 터치 (반등 기대)';
            analysis.signalStrength += 1;
            analysis.signals.push('🟢 볼린저 하단');
        } else if (position <= 40) {
            analysis.bollingerScore = 20;
            analysis.bollingerStatus = '하단 접근';
        } else if (position <= 60) {
            analysis.bollingerScore = 15;
            analysis.bollingerStatus = '중심선 부근';
        } else if (position <= 80) {
            analysis.bollingerScore = 10;
            analysis.bollingerStatus = '상단 접근';
        } else {
            analysis.bollingerScore = 5;
            analysis.bollingerStatus = '상단 터치 (조정 가능)';
            analysis.signalStrength -= 1;
            analysis.signals.push('🔴 볼린저 상단');
        }
    } else {
        analysis.bollingerScore = 12;
        analysis.bollingerStatus = '데이터 없음';
    }
    
    // 총 기술 점수 (100점 만점)
    analysis.totalTechScore = analysis.rsiScore + analysis.macdScore + analysis.maScore + analysis.bollingerScore;
    
    return analysis;
}


// AI 상세 분석 결과 HTML 생성
function getEnhancedAIAnalysisHTML(data, stockName) {
    var analysis = analyzeIndicators(data);
    var aiComment = generateAIComment(analysis, stockName);
    var prediction = predictPrice(data);
    var strength = aiComment.strength;
    
    var html = '';
    
    // 1. 신호 강도 표시
    html += '<div style="background:linear-gradient(135deg, ' + strength.color + '22, ' + strength.color + '11); padding:15px; border-radius:12px; margin:15px 0; border-left:4px solid ' + strength.color + ';">';
    html += '<div style="font-size:1.3rem; font-weight:bold; color:' + strength.color + ';">' + strength.text + '</div>';
    html += '<div style="margin-top:8px; color:#374151;">' + aiComment.comments[0] + '</div>';
    html += '</div>';
    
    // 2. 기술 지표 상세
    html += '<div style="background:#f8fafc; padding:15px; border-radius:12px; margin:15px 0;">';
    html += '<h4 style="margin:0 0 12px 0; color:#1e293b;">📊 기술 지표 분석</h4>';
    html += '<table style="width:100%; font-size:0.9rem;">';
    
    // RSI
    html += '<tr><td style="padding:8px 0;">RSI (14)</td>';
    html += '<td style="text-align:center;"><strong>' + (data.rsi ? data.rsi.toFixed(1) : '--') + '</strong></td>';
    html += '<td style="text-align:right; color:' + (analysis.rsiScore >= 20 ? '#16a34a' : analysis.rsiScore <= 10 ? '#ef4444' : '#6b7280') + ';">' + analysis.rsiStatus + '</td></tr>';
    
    // MACD
    html += '<tr><td style="padding:8px 0;">MACD</td>';
    html += '<td style="text-align:center;"><strong>' + (data.macd ? data.macd.toFixed(2) : '--') + '</strong></td>';
    html += '<td style="text-align:right; color:' + (analysis.macdScore >= 20 ? '#16a34a' : analysis.macdScore <= 10 ? '#ef4444' : '#6b7280') + ';">' + analysis.macdStatus + '</td></tr>';
    
    // 이동평균
    html += '<tr><td style="padding:8px 0;">이동평균</td>';
    html += '<td style="text-align:center;">--</td>';
    html += '<td style="text-align:right; color:' + (analysis.maScore >= 20 ? '#16a34a' : analysis.maScore <= 10 ? '#ef4444' : '#6b7280') + ';">' + analysis.maStatus + '</td></tr>';
    
    // 볼린저
    html += '<tr><td style="padding:8px 0;">볼린저밴드</td>';
    html += '<td style="text-align:center;">--</td>';
    html += '<td style="text-align:right; color:' + (analysis.bollingerScore >= 20 ? '#16a34a' : analysis.bollingerScore <= 10 ? '#ef4444' : '#6b7280') + ';">' + analysis.bollingerStatus + '</td></tr>';
    
    html += '</table>';
    html += '<div style="margin-top:10px; text-align:right; font-weight:bold; color:#3b82f6;">기술 점수: ' + analysis.totalTechScore + ' / 100점</div>';
    html += '</div>';
    
    // 3. AI 신호 목록
    if (analysis.signals.length > 0) {
        html += '<div style="background:#fefce8; padding:12px; border-radius:8px; margin:15px 0;">';
        html += '<strong>🎯 주요 신호:</strong><br>';
        analysis.signals.forEach(function(signal) {
            html += '<span style="display:inline-block; margin:4px 8px 4px 0; padding:4px 8px; background:#fff; border-radius:4px; font-size:0.85rem;">' + signal + '</span>';
        });
        html += '</div>';
    }
    
    // 4. AI 가격 예측
    var price = data.currentPrice || data.close || data.price || 0;
    html += '<div style="background:#f0fdf4; padding:15px; border-radius:12px; margin:15px 0;">';
    html += '<h4 style="margin:0 0 12px 0; color:#166534;">🔮 AI 가격 예측</h4>';
    html += '<table style="width:100%; font-size:0.9rem;">';
    
    // 단기 예측
    html += '<tr><td style="padding:8px 0;"><strong>단기 (1주)</strong></td>';
    html += '<td style="text-align:right;">' + prediction.shortTerm.min.toLocaleString() + ' ~ ' + prediction.shortTerm.max.toLocaleString() + '원</td>';
    html += '<td style="text-align:right; width:60px; color:' + (prediction.shortTerm.direction === '상승' ? '#16a34a' : prediction.shortTerm.direction === '하락' ? '#ef4444' : '#6b7280') + ';">' + prediction.shortTerm.direction + '</td></tr>';
    
    // 중기 예측
    html += '<tr><td style="padding:8px 0;"><strong>중기 (1개월)</strong></td>';
    html += '<td style="text-align:right;">' + prediction.midTerm.min.toLocaleString() + ' ~ ' + prediction.midTerm.max.toLocaleString() + '원</td>';
    html += '<td style="text-align:right; width:60px; color:' + (prediction.midTerm.direction === '상승' ? '#16a34a' : prediction.midTerm.direction === '하락' ? '#ef4444' : '#6b7280') + ';">' + prediction.midTerm.direction + '</td></tr>';
    
    html += '</table>';
    html += '<p style="margin:10px 0 0 0; font-size:0.8rem; color:#6b7280;">※ ATR 기반 예측으로 참고용입니다.</p>';
    html += '</div>';
    
    // 5. AI 코멘트
    if (aiComment.comments.length > 1) {
        html += '<div style="background:#eff6ff; padding:12px; border-radius:8px; margin:15px 0;">';
        html += '<strong>💡 AI 분석 코멘트:</strong><ul style="margin:8px 0 0 0; padding-left:20px;">';
        for (var i = 1; i < aiComment.comments.length; i++) {
            html += '<li style="margin:4px 0;">' + aiComment.comments[i] + '</li>';
        }
        html += '</ul></div>';
    }
    
    return html;
}


// 신호 강도 해석
function getSignalStrengthText(strength) {
    if (strength >= 3) return { text: '🟢🟢 강한 매수', color: '#16a34a', level: 5 };
    if (strength >= 1.5) return { text: '🟢 매수', color: '#22c55e', level: 4 };
    if (strength >= 0.5) return { text: '🟡 약한 매수', color: '#84cc16', level: 3 };
    if (strength >= -0.5) return { text: '⚪ 중립', color: '#6b7280', level: 2 };
    if (strength >= -1.5) return { text: '🟡 약한 매도', color: '#f59e0b', level: 2 };
    if (strength >= -3) return { text: '🔴 매도', color: '#ef4444', level: 1 };
    return { text: '🔴🔴 강한 매도', color: '#dc2626', level: 0 };
}

// AI 투자 코멘트 생성
function generateAIComment(analysis, stockName) {
    var comments = [];
    var strength = getSignalStrengthText(analysis.signalStrength);
    
    // 메인 코멘트
    if (analysis.signalStrength >= 2) {
        comments.push(stockName + '은(는) 현재 <strong style="color:#16a34a">매수 적기</strong>로 판단됩니다.');
    } else if (analysis.signalStrength >= 0.5) {
        comments.push(stockName + '은(는) <strong style="color:#22c55e">긍정적인 흐름</strong>을 보이고 있습니다.');
    } else if (analysis.signalStrength >= -0.5) {
        comments.push(stockName + '은(는) 현재 <strong style="color:#6b7280">관망</strong>이 필요합니다.');
    } else if (analysis.signalStrength >= -2) {
        comments.push(stockName + '은(는) <strong style="color:#f59e0b">주의</strong>가 필요한 구간입니다.');
    } else {
        comments.push(stockName + '은(는) <strong style="color:#ef4444">매도 고려</strong>가 필요합니다.');
    }
    
    // 상세 코멘트
    if (analysis.rsiStatus.includes('과매도')) {
        comments.push('RSI가 과매도 구간으로 반등 가능성이 높습니다.');
    } else if (analysis.rsiStatus.includes('과매수')) {
        comments.push('RSI가 과매수 구간으로 단기 조정 가능성이 있습니다.');
    }
    
    if (analysis.maStatus === '완벽한 정배열') {
        comments.push('이동평균선이 완벽한 정배열로 상승 추세가 강합니다.');
    } else if (analysis.maStatus === '완벽한 역배열') {
        comments.push('이동평균선이 역배열로 하락 추세입니다.');
    }
    
    return {
        strength: strength,
        comments: comments,
        signals: analysis.signals
    };
}

// AI 가격 예측
function predictPrice(data) {
    var price = data.currentPrice || data.close || 0;
    var atr = data.atr || price * 0.02;
    var rsi = data.rsi || 50;
    var ma20 = data.ma20 || price;
    var ma60 = data.ma60 || price;
    
    var prediction = {
        shortTerm: { min: 0, max: 0, direction: '' },  // 1주일
        midTerm: { min: 0, max: 0, direction: '' }     // 1개월
    };
    
    // 추세 강도 계산
    var trendStrength = 0;
    if (price > ma20) trendStrength += 1;
    if (price > ma60) trendStrength += 1;
    if (ma20 > ma60) trendStrength += 1;
    if (rsi < 50) trendStrength -= 0.5;
    if (rsi > 70) trendStrength -= 1;
    if (rsi < 30) trendStrength += 1;
    
    // 단기 예측 (1주일)
    var shortMultiplier = trendStrength > 0 ? 1.5 : (trendStrength < 0 ? -1 : 0.5);
    prediction.shortTerm.min = Math.round(price - atr * 1.5);
    prediction.shortTerm.max = Math.round(price + atr * 2 * Math.max(0.5, shortMultiplier));
    prediction.shortTerm.direction = trendStrength > 1 ? '상승' : (trendStrength < -1 ? '하락' : '보합');
    
    // 중기 예측 (1개월)
    var midMultiplier = trendStrength > 0 ? 2 : (trendStrength < 0 ? -1.5 : 1);
    prediction.midTerm.min = Math.round(price - atr * 3);
    prediction.midTerm.max = Math.round(price + atr * 4 * Math.max(0.5, midMultiplier));
    prediction.midTerm.direction = trendStrength > 0.5 ? '상승' : (trendStrength < -0.5 ? '하락' : '보합');
    
    return prediction;
}


// ==================== 새 점수 체계 ====================

// 종합 점수 계산 (100점 만점)
function calculateNewScore(stock) {
  var score = {
    technical: 0,      // 기술적 분석 (25점)
    volume: 0,         // 거래량/모멘텀 (25점)
    theme: 0,          // 테마 인기도 (20점)
    marketCap: 0,      // 시가총액 가산 (15점)
    news: 0,           // 뉴스/관심도 (15점)
    total: 0,
    hasTheme: false,
    hasNews: false
  };
  
  // 1. 기술적 분석 점수 (25점 만점)
  var techScore = stock.techScore || 0;
  score.technical = Math.round((techScore / 100) * 25);
  
  // 2. 시가총액 가산점 (15점 만점)
  var marketCap = stock.marketCap || 0;
  if (marketCap >= 100000) {
    score.marketCap = 15;
  } else if (marketCap >= 50000) {
    score.marketCap = 12;
  } else if (marketCap >= 10000) {
    score.marketCap = 9;
  } else if (marketCap >= 5000) {
    score.marketCap = 6;
  } else {
    score.marketCap = 3;
  }
  
  // 3. 거래량/모멘텀 점수 (25점 만점)
  var volumeScore = 0;
  var momentumScore = 0;
  var changeScore = 0;
  
  // 3-1. 거래량 비율 (10점)
  var volumeRatio = stock.volumeRatio || 0;
  if (volumeRatio >= 3.0) {
    volumeScore = 10;
  } else if (volumeRatio >= 2.0) {
    volumeScore = 8;
  } else if (volumeRatio >= 1.5) {
    volumeScore = 7;
  } else if (volumeRatio >= 1.2) {
    volumeScore = 6;
  } else if (volumeRatio >= 1.0) {
    volumeScore = 4;
  } else if (volumeRatio >= 0.8) {
    volumeScore = 2;
  } else {
    volumeScore = 0;
  }
  
  // 3-2. 가격 모멘텀 (10점)
  var price = stock.currentPrice || 0;
  var ma20 = stock.ma20 || 0;
  var ma60 = stock.ma60 || 0;
  
  if (price > 0 && ma20 > 0 && ma60 > 0) {
    if (price > ma20 && ma20 > ma60) {
      momentumScore = 10;
    } else if (price > ma20 && price > ma60) {
      momentumScore = 8;
    } else if (price > ma20 || price > ma60) {
      momentumScore = 5;
    } else if (price > ma60) {
      momentumScore = 3;
    } else {
      momentumScore = 0;
    }
  }
  
  // 3-3. 등락률 (5점)
  var changeRate = parseFloat(stock.changeRate) || 0;
  if (changeRate >= 5) {
    changeScore = 5;
  } else if (changeRate >= 3) {
    changeScore = 4;
  } else if (changeRate >= 1) {
    changeScore = 3;
  } else if (changeRate >= 0) {
    changeScore = 2;
  } else if (changeRate >= -2) {
    changeScore = 1;
  } else {
    changeScore = 0;
  }
  
  score.volume = volumeScore + momentumScore + changeScore;
  
  // 4. 테마 인기도 (20점)
  var themeChangeScore = 0;
  var themeRankScore = 0;
  
  if (stock.themeChangeRate !== undefined) {
    score.hasTheme = true;
    
    var themeChange = parseFloat(stock.themeChangeRate) || 0;
    if (themeChange >= 5) {
      themeChangeScore = 10;
    } else if (themeChange >= 3) {
      themeChangeScore = 8;
    } else if (themeChange >= 2) {
      themeChangeScore = 6;
    } else if (themeChange >= 1) {
      themeChangeScore = 4;
    } else if (themeChange >= 0) {
      themeChangeScore = 2;
    } else {
      themeChangeScore = 0;
    }
    
    var rank = stock.themeRank || 99;
    if (rank <= 1) {
      themeRankScore = 10;
    } else if (rank <= 3) {
      themeRankScore = 8;
    } else if (rank <= 5) {
      themeRankScore = 6;
    } else if (rank <= 10) {
      themeRankScore = 4;
    } else {
      themeRankScore = 2;
    }
    
    score.theme = themeChangeScore + themeRankScore;
  }
  
  // 5. 뉴스/관심도 (15점)
  var newsCountScore = 0;
  var newsRecentScore = 0;
  
  if (stock.newsCount !== undefined) {
    score.hasNews = true;
    
    // 5-1. 뉴스 개수 (10점)
    var newsCount = stock.newsCount || 0;
    if (newsCount >= 10) {
      newsCountScore = 10;
    } else if (newsCount >= 7) {
      newsCountScore = 8;
    } else if (newsCount >= 5) {
      newsCountScore = 6;
    } else if (newsCount >= 3) {
      newsCountScore = 4;
    } else if (newsCount >= 1) {
      newsCountScore = 2;
    } else {
      newsCountScore = 0;
    }
    
    // 5-2. 뉴스 최신성 (5점)
    if (stock.hasToday) {
      newsRecentScore = 5;
    } else if (stock.hasYesterday) {
      newsRecentScore = 3;
    } else {
      newsRecentScore = 0;
    }
    
    score.news = newsCountScore + newsRecentScore;
  }
  
  // 총점 계산
  score.total = score.technical + score.marketCap + score.volume + score.theme + score.news;
  
  // 100점 만점으로 환산
  var maxScore = 65;  // 기본: 기술(25) + 시총(15) + 거래량(25)
  if (score.hasTheme) maxScore += 20;
  if (score.hasNews) maxScore += 15;
  
  score.maxScore = maxScore;
  score.totalScaled = Math.round((score.total / maxScore) * 100);
  
  // 상세 저장
  score.volumeDetail = {
    volumeScore: volumeScore,
    momentumScore: momentumScore,
    changeScore: changeScore
  };
  score.themeDetail = {
    themeChangeScore: themeChangeScore,
    themeRankScore: themeRankScore
  };
  score.newsDetail = {
    newsCountScore: newsCountScore,
    newsRecentScore: newsRecentScore
  };
  
  return score;
}


// 미국 주식 종합 점수 계산 (100점 만점)
function calculateUsNewScore(stock) {
  var score = {
    technical: 0,      // 기술적 분석 (25점)
    volume: 0,         // 거래량/모멘텀 (25점)
    sector: 0,         // 섹터 인기도 (20점)
    marketCap: 0,      // 시가총액 가산 (15점)
    news: 0,           // 뉴스/관심도 (15점)
    total: 0,
    hasSector: false,
    hasNews: false
  };
  
  // 1. 기술적 분석 점수 (25점 만점)
  var techScore = stock.techScore || 0;
  score.technical = Math.round((techScore / 100) * 25);
  
  // 2. 시가총액 가산점 (15점 만점)
  // API에서 백만 달러 단위로 옴 (예: 4,108,269 = 4.1조 달러)
  var marketCap = stock.marketCap || 0;
  if (marketCap >= 1000000) {
    // 메가캡 (1조 달러 이상): 애플, MS 등
    score.marketCap = 15;
  } else if (marketCap >= 200000) {
    // 대형주 (2000억 달러 이상)
    score.marketCap = 13;
  } else if (marketCap >= 50000) {
    // 준대형주 (500억~2000억 달러)
    score.marketCap = 11;
  } else if (marketCap >= 10000) {
    // 중형주 (100억~500억 달러)
    score.marketCap = 9;
  } else if (marketCap >= 2000) {
    // 준중형주 (20억~100억 달러)
    score.marketCap = 6;
  } else {
    // 소형주 (20억 달러 미만)
    score.marketCap = 3;
  }
  
  // 3. 거래량/모멘텀 점수 (25점 만점)
  var volumeScore = 0;
  var momentumScore = 0;
  var changeScore = 0;
  
  // 3-1. 거래량 비율 (10점)
  var volumeRatio = stock.volumeRatio || 0;
  if (volumeRatio >= 3.0) {
    volumeScore = 10;
  } else if (volumeRatio >= 2.0) {
    volumeScore = 8;
  } else if (volumeRatio >= 1.5) {
    volumeScore = 7;
  } else if (volumeRatio >= 1.2) {
    volumeScore = 6;
  } else if (volumeRatio >= 1.0) {
    volumeScore = 4;
  } else if (volumeRatio >= 0.8) {
    volumeScore = 2;
  } else {
    volumeScore = 0;
  }
  
  // 3-2. 가격 모멘텀 (10점)
  var price = stock.currentPrice || 0;
  var ma20 = stock.ma20 || 0;
  var ma60 = stock.ma60 || 0;
  
  if (price > 0 && ma20 > 0 && ma60 > 0) {
    if (price > ma20 && ma20 > ma60) {
      momentumScore = 10;
    } else if (price > ma20 && price > ma60) {
      momentumScore = 8;
    } else if (price > ma20 || price > ma60) {
      momentumScore = 5;
    } else if (price > ma60) {
      momentumScore = 3;
    } else {
      momentumScore = 0;
    }
  }
  
  // 3-3. 등락률 (5점)
  var changeRate = parseFloat(stock.changeRate) || 0;
  if (changeRate >= 5) {
    changeScore = 5;
  } else if (changeRate >= 3) {
    changeScore = 4;
  } else if (changeRate >= 1) {
    changeScore = 3;
  } else if (changeRate >= 0) {
    changeScore = 2;
  } else if (changeRate >= -2) {
    changeScore = 1;
  } else {
    changeScore = 0;
  }
  
  score.volume = volumeScore + momentumScore + changeScore;
  
  // 4. 섹터 인기도 (20점 만점) - 섹터 있으면 기본 점수
  var industry = stock.industry || '';
  if (industry) {
    score.hasSector = true;
    // 섹터별 기본 점수 (나중에 등락률 API 추가 시 개선)
    score.sector = 10; // 기본 10점
  }
  
  // 5. 뉴스/관심도 점수 (15점 만점)
  var newsCountScore = 0;
  var newsRecentScore = 0;
  
  if (stock.newsData) {
    score.hasNews = true;
    
    // 5-1. 뉴스 개수 (10점)
    var newsCount = stock.newsData.count || 0;
    if (newsCount >= 10) {
      newsCountScore = 10;
    } else if (newsCount >= 7) {
      newsCountScore = 8;
    } else if (newsCount >= 5) {
      newsCountScore = 6;
    } else if (newsCount >= 3) {
      newsCountScore = 4;
    } else if (newsCount >= 1) {
      newsCountScore = 2;
    } else {
      newsCountScore = 0;
    }
    
    // 5-2. 뉴스 최신성 (5점)
    if (stock.newsData.hasToday) {
      newsRecentScore = 5;
    } else if (stock.newsData.hasRecent) {
      newsRecentScore = 3;
    } else {
      newsRecentScore = 0;
    }
    
    score.news = newsCountScore + newsRecentScore;
  }
  
  // 상세 저장
  score.volumeDetail = {
    volumeScore: volumeScore,
    momentumScore: momentumScore,
    changeScore: changeScore
  };
  
  score.newsDetail = {
    newsCountScore: newsCountScore,
    newsRecentScore: newsRecentScore
  };
  
  score.industry = industry;
  
  // 총점 계산
  score.total = score.technical + score.marketCap + score.volume + score.sector + score.news;
  
  // 100점 만점으로 환산
  var maxScore = 65; // 기본: 기술(25) + 시총(15) + 거래량(25)
  if (score.hasSector) maxScore += 20;
  if (score.hasNews) maxScore += 15;
  
  score.maxScore = maxScore;
  score.totalScaled = Math.round((score.total / maxScore) * 100);
  
  return score;
}

// 미국 주식 점수 상세 표시
function getUsScoreBreakdown(scoreObj) {
  var volDetail = scoreObj.volumeDetail || {};
  var newsDetail = scoreObj.newsDetail || {};
  
  var html = '<div style="margin-top:10px;">';
  html += '<button onclick="toggleUsScoreDetail()" style="width:100%; padding:10px; background:#e0f2fe; border:1px solid #7dd3fc; border-radius:8px; cursor:pointer; font-weight:bold;">';
  html += '📊 점수 상세 보기 ▼';
  html += '</button>';
  
  html += '<div id="us-score-detail-content" style="display:none; padding:10px; background:#f0f9ff; border-radius:0 0 8px 8px; border:1px solid #7dd3fc; border-top:none;">';
  html += '<table style="width:100%; font-size:0.9rem;">';
  html += '<tr><td>기술적 분석</td><td style="text-align:right;"><strong>' + scoreObj.technical + '</strong> / 25점</td></tr>';
  html += '<tr><td>시가총액 가산</td><td style="text-align:right;"><strong>' + scoreObj.marketCap + '</strong> / 15점</td></tr>';
  html += '<tr><td>거래량/모멘텀</td><td style="text-align:right;"><strong>' + scoreObj.volume + '</strong> / 25점</td></tr>';
  
  if (volDetail.volumeScore !== undefined) {
    html += '<tr style="color:#666; font-size:0.85rem;"><td style="padding-left:20px;">└ 거래량 비율</td><td style="text-align:right;">' + volDetail.volumeScore + ' / 10점</td></tr>';
    html += '<tr style="color:#666; font-size:0.85rem;"><td style="padding-left:20px;">└ 가격 모멘텀</td><td style="text-align:right;">' + volDetail.momentumScore + ' / 10점</td></tr>';
    html += '<tr style="color:#666; font-size:0.85rem;"><td style="padding-left:20px;">└ 등락률</td><td style="text-align:right;">' + volDetail.changeScore + ' / 5점</td></tr>';
  }
  
  // 섹터 인기도
  if (scoreObj.hasSector) {
    html += '<tr><td>섹터 인기도</td><td style="text-align:right;"><strong>' + scoreObj.sector + '</strong> / 20점</td></tr>';
    html += '<tr style="color:#666; font-size:0.85rem;"><td style="padding-left:20px;">└ 섹터: ' + scoreObj.industry + '</td><td style="text-align:right;">(기본 10점)</td></tr>';
  } else {
    html += '<tr><td>섹터 인기도</td><td style="text-align:right; color:#999;">-- / 20점</td></tr>';
  }
  
  // 뉴스/관심도
  if (scoreObj.hasNews) {
    html += '<tr><td>뉴스/관심도</td><td style="text-align:right;"><strong>' + scoreObj.news + '</strong> / 15점</td></tr>';
    if (newsDetail.newsCountScore !== undefined) {
      html += '<tr style="color:#666; font-size:0.85rem;"><td style="padding-left:20px;">└ 뉴스 개수</td><td style="text-align:right;">' + newsDetail.newsCountScore + ' / 10점</td></tr>';
      html += '<tr style="color:#666; font-size:0.85rem;"><td style="padding-left:20px;">└ 뉴스 최신성</td><td style="text-align:right;">' + newsDetail.newsRecentScore + ' / 5점</td></tr>';
    }
  } else {
    html += '<tr><td>뉴스/관심도</td><td style="text-align:right; color:#999;">-- / 15점</td></tr>';
  }
  
  html += '<tr style="border-top:1px solid #ddd;"><td><strong>현재 합계</strong></td><td style="text-align:right;"><strong>' + scoreObj.total + '</strong> / ' + scoreObj.maxScore + '점</td></tr>';
  html += '<tr><td><strong>환산 점수</strong></td><td style="text-align:right; color:#3b82f6;"><strong>' + scoreObj.totalScaled + '</strong> / 100점</td></tr>';
  html += '</table>';
  html += '</div>';
  html += '</div>';
  return html;
}



// 미국 주식 점수 상세 접기/펼치기
function toggleUsScoreDetail() {
  var content = document.getElementById('us-score-detail-content');
  var btn = content.previousElementSibling;
  
  if (content.style.display === 'none') {
    content.style.display = 'block';
    btn.innerHTML = '📊 점수 상세 접기 ▲';
  } else {
    content.style.display = 'none';
    btn.innerHTML = '📊 점수 상세 보기 ▼';
  }
}



// 점수 상세 표시용 텍스트
function getScoreBreakdown(scoreObj) {
  var volDetail = scoreObj.volumeDetail || {};
  var themeDetail = scoreObj.themeDetail || {};
  var newsDetail = scoreObj.newsDetail || {};
  
  var html = '<div style="margin-top:10px;">';
  html += '<button onclick="toggleScoreDetail()" style="width:100%; padding:10px; background:#e0f2fe; border:1px solid #7dd3fc; border-radius:8px; cursor:pointer; font-weight:bold;">';
  html += '📊 점수 상세 보기 ▼';
  html += '</button>';
  
  html += '<div id="score-detail-content" style="display:none; padding:10px; background:#f0f9ff; border-radius:0 0 8px 8px; border:1px solid #7dd3fc; border-top:none;">';
  html += '<table style="width:100%; font-size:0.9rem;">';
  html += '<tr><td>기술적 분석</td><td style="text-align:right;"><strong>' + scoreObj.technical + '</strong> / 25점</td></tr>';
  html += '<tr><td>시가총액 가산</td><td style="text-align:right;"><strong>' + scoreObj.marketCap + '</strong> / 15점</td></tr>';
  html += '<tr><td>거래량/모멘텀</td><td style="text-align:right;"><strong>' + scoreObj.volume + '</strong> / 25점</td></tr>';
  
  // 거래량 상세
  if (volDetail.volumeScore !== undefined) {
    html += '<tr style="color:#666; font-size:0.85rem;"><td style="padding-left:20px;">└ 거래량 비율</td><td style="text-align:right;">' + volDetail.volumeScore + ' / 10점</td></tr>';
    html += '<tr style="color:#666; font-size:0.85rem;"><td style="padding-left:20px;">└ 가격 모멘텀</td><td style="text-align:right;">' + volDetail.momentumScore + ' / 10점</td></tr>';
    html += '<tr style="color:#666; font-size:0.85rem;"><td style="padding-left:20px;">└ 등락률</td><td style="text-align:right;">' + volDetail.changeScore + ' / 5점</td></tr>';
  }
  
  // 테마 인기도
  if (scoreObj.hasTheme) {
    html += '<tr><td>테마 인기도</td><td style="text-align:right;"><strong>' + scoreObj.theme + '</strong> / 20점</td></tr>';
    html += '<tr style="color:#666; font-size:0.85rem;"><td style="padding-left:20px;">└ 테마 등락률</td><td style="text-align:right;">' + themeDetail.themeChangeScore + ' / 10점</td></tr>';
    html += '<tr style="color:#666; font-size:0.85rem;"><td style="padding-left:20px;">└ 테마 내 순위</td><td style="text-align:right;">' + themeDetail.themeRankScore + ' / 10점</td></tr>';
  } else {
    html += '<tr><td>테마 인기도</td><td style="text-align:right; color:#999;">-- / 20점 (미적용)</td></tr>';
  }
  
  // 뉴스/관심도
  if (scoreObj.hasNews) {
    html += '<tr><td>뉴스/관심도</td><td style="text-align:right;"><strong>' + scoreObj.news + '</strong> / 15점</td></tr>';
    html += '<tr style="color:#666; font-size:0.85rem;"><td style="padding-left:20px;">└ 뉴스 개수</td><td style="text-align:right;">' + newsDetail.newsCountScore + ' / 10점</td></tr>';
    html += '<tr style="color:#666; font-size:0.85rem;"><td style="padding-left:20px;">└ 뉴스 최신성</td><td style="text-align:right;">' + newsDetail.newsRecentScore + ' / 5점</td></tr>';
  } else {
    html += '<tr><td>뉴스/관심도</td><td style="text-align:right; color:#999;">-- / 15점 (미적용)</td></tr>';
  }
  
  html += '<tr style="border-top:1px solid #ddd;"><td><strong>현재 합계</strong></td><td style="text-align:right;"><strong>' + scoreObj.total + '</strong> / ' + scoreObj.maxScore + '점</td></tr>';
  html += '<tr><td><strong>환산 점수</strong></td><td style="text-align:right; color:#3b82f6;"><strong>' + scoreObj.totalScaled + '</strong> / 100점</td></tr>';
  html += '</table>';
  html += '</div>';
  html += '</div>';
  return html;
}

// 점수 상세 접기/펼치기
function toggleScoreDetail() {
  var content = document.getElementById('score-detail-content');
  var btn = content.previousElementSibling;
  
  if (content.style.display === 'none') {
    content.style.display = 'block';
    btn.innerHTML = '📊 점수 상세 접기 ▲';
  } else {
    content.style.display = 'none';
    btn.innerHTML = '📊 점수 상세 보기 ▼';
  }
}


// ==================== AI 매매 타이밍 ====================
async function analyzeAiTiming() {
  var input = document.getElementById('ai-timing-input').value.trim();
  
  if (!input) {
    alert('종목명 또는 종목코드를 입력하세요.');
    return;
  }
  
  showLoading();
  
  var container = document.getElementById('ai-timing-result');
  container.innerHTML = '<p>🤖 매매 타이밍 분석 중...</p>';
  
  try {
    // 종목코드 찾기
    var stockCode = await findStockCode(input);
    
    if (!stockCode) {
      container.innerHTML = '<p>종목을 찾을 수 없습니다: ' + input + '</p>';
      hideLoading();
      return;
    }
    
    // 기술적 분석 데이터 조회
    var techResult = await apiCall('/api/analysis/technical/' + stockCode);
    var stockResult = await apiCall('/api/korea/stock/' + stockCode);
    
    if (!techResult.success) {
      container.innerHTML = '<p>분석 데이터를 가져올 수 없습니다.</p>';
      hideLoading();
      return;
    }
    
    var tech = techResult.data;
    var stock = stockResult.success ? stockResult.data : {};
    
    // 매매 타이밍 신호 분석
    var signals = analyzeTimingSignals(tech);
    
    // 결과 표시
    displayTimingResult(stock.name || stockCode, stockCode, tech, signals);
    
  } catch (error) {
    console.error('매매 타이밍 분석 오류:', error);
    container.innerHTML = '<p>분석 중 오류가 발생했습니다.</p>';
  }
  
  hideLoading();
}

// 타이밍 신호 분석
function analyzeTimingSignals(tech) {
  var buySignals = [];
  var sellSignals = [];
  var score = 0;
  
  // 1. RSI 분석
  var rsi = tech.rsi || 50;
  if (rsi < 30) {
    buySignals.push('RSI 과매도 구간 (' + rsi.toFixed(1) + ')');
    score += 2;
  } else if (rsi < 40) {
    buySignals.push('RSI 매수 유리 구간 (' + rsi.toFixed(1) + ')');
    score += 1;
  } else if (rsi > 70) {
    sellSignals.push('RSI 과매수 구간 (' + rsi.toFixed(1) + ')');
    score -= 2;
  } else if (rsi > 60) {
    sellSignals.push('RSI 매도 고려 구간 (' + rsi.toFixed(1) + ')');
    score -= 1;
  }
  
  // 2. MACD 분석
  var macd = tech.macd || 0;
  var macdSignal = tech.macdSignal || 0;
  var macdHist = tech.macdHistogram || 0;
  
  if (macd > macdSignal && macdHist > 0) {
    buySignals.push('MACD 골든크로스 상태');
    score += 2;
  } else if (macd < macdSignal && macdHist < 0) {
    sellSignals.push('MACD 데드크로스 상태');
    score -= 2;
  }
  
  if (macdHist > 0 && tech.prevMacdHist !== undefined && macdHist > tech.prevMacdHist) {
    buySignals.push('MACD 히스토그램 상승 중');
    score += 1;
  } else if (macdHist < 0 && tech.prevMacdHist !== undefined && macdHist < tech.prevMacdHist) {
    sellSignals.push('MACD 히스토그램 하락 중');
    score -= 1;
  }
  
  // 3. 이동평균선 분석
  var price = tech.currentPrice || 0;
  var ma20 = tech.ma20 || 0;
  var ma60 = tech.ma60 || 0;
  
  if (price > ma20 && ma20 > ma60) {
    buySignals.push('정배열 (상승추세)');
    score += 2;
  } else if (price < ma20 && ma20 < ma60) {
    sellSignals.push('역배열 (하락추세)');
    score -= 2;
  }
  
  if (price > ma20 && price > ma60) {
    buySignals.push('주가가 이동평균선 위');
    score += 1;
  } else if (price < ma20 && price < ma60) {
    sellSignals.push('주가가 이동평균선 아래');
    score -= 1;
  }
  
  // 4. 거래량 분석
  var volumeRatio = tech.volumeRatio || 1;
  if (volumeRatio >= 2.0) {
    buySignals.push('거래량 급증 (' + volumeRatio.toFixed(1) + '배)');
    score += 1;
  } else if (volumeRatio >= 1.5) {
    buySignals.push('거래량 증가 (' + volumeRatio.toFixed(1) + '배)');
    score += 0.5;
  }
  
  // 5. 등락률 분석
  var changeRate = parseFloat(tech.changeRate) || 0;
  if (changeRate >= 3) {
    buySignals.push('강한 상승세 (+' + changeRate.toFixed(1) + '%)');
    score += 1;
  } else if (changeRate <= -3) {
    sellSignals.push('강한 하락세 (' + changeRate.toFixed(1) + '%)');
    score -= 1;
  }
  
  // 종합 판단
  var recommendation = '';
  var recClass = '';
  
  if (score >= 5) {
    recommendation = '🟢 강력 매수';
    recClass = 'positive';
  } else if (score >= 2) {
    recommendation = '🔵 매수 고려';
    recClass = 'positive';
  } else if (score <= -5) {
    recommendation = '🔴 강력 매도';
    recClass = 'negative';
  } else if (score <= -2) {
    recommendation = '🟠 매도 고려';
    recClass = 'negative';
  } else {
    recommendation = '⚪ 관망';
    recClass = '';
  }
  
  return {
    buySignals: buySignals,
    sellSignals: sellSignals,
    score: score,
    recommendation: recommendation,
    recClass: recClass
  };
}

// 타이밍 결과 표시
function displayTimingResult(stockName, stockCode, tech, signals) {
  var container = document.getElementById('ai-timing-result');
  
  var html = '<div class="card">';
  html += '<h3>⏰ ' + stockName + ' (' + stockCode + ') 매매 타이밍</h3>';
  
  // 종합 판단
  html += '<div style="text-align:center; padding:20px; background:#f8fafc; border-radius:8px; margin:15px 0;">';
  html += '<p style="color:#666; margin-bottom:10px;">AI 타이밍 판단</p>';
  html += '<p style="font-size:2rem; font-weight:bold;" class="' + signals.recClass + '">' + signals.recommendation + '</p>';
  html += '<p style="color:#666;">타이밍 점수: <strong style="font-size:1.3rem;">' + signals.score.toFixed(1) + '점</strong></p>';
  html += '</div>';
  
  // 현재 지표
  html += '<div class="indicators-grid" style="margin-top:15px;">';
  html += '<div class="indicator-card"><div class="label">현재가</div><div class="value">' + (tech.currentPrice ? tech.currentPrice.toLocaleString() + '원' : '--') + '</div></div>';
  html += '<div class="indicator-card"><div class="label">RSI</div><div class="value">' + (tech.rsi ? tech.rsi.toFixed(1) : '--') + '</div></div>';
  html += '<div class="indicator-card"><div class="label">MACD</div><div class="value">' + (tech.macd ? tech.macd.toFixed(2) : '--') + '</div></div>';
  html += '<div class="indicator-card"><div class="label">거래량비</div><div class="value">' + (tech.volumeRatio ? tech.volumeRatio.toFixed(1) + '배' : '--') + '</div></div>';
  html += '</div>';
  
  // 매수 신호
  if (signals.buySignals.length > 0) {
    html += '<div style="margin-top:15px; padding:15px; background:#dcfce7; border-radius:8px;">';
    html += '<h4 style="color:#166534;">📈 매수 신호</h4><ul style="margin:10px 0 0 20px;">';
    signals.buySignals.forEach(function(s) {
      html += '<li style="color:#166534;">' + s + '</li>';
    });
    html += '</ul></div>';
  }
  
  // 매도 신호
  if (signals.sellSignals.length > 0) {
    html += '<div style="margin-top:15px; padding:15px; background:#fee2e2; border-radius:8px;">';
    html += '<h4 style="color:#991b1b;">📉 매도 신호</h4><ul style="margin:10px 0 0 20px;">';
    signals.sellSignals.forEach(function(s) {
      html += '<li style="color:#991b1b;">' + s + '</li>';
    });
    html += '</ul></div>';
  }
  
  // 신호 없음
  if (signals.buySignals.length === 0 && signals.sellSignals.length === 0) {
    html += '<div style="margin-top:15px; padding:15px; background:#f3f4f6; border-radius:8px;">';
    html += '<p style="color:#666; text-align:center;">현재 뚜렷한 매매 신호가 없습니다. 관망을 추천합니다.</p>';
    html += '</div>';
  }
  
  // 접히는 설명 패널 추가
  html += '<div style="margin-top:15px;">';
  html += '<button onclick="toggleTimingGuide()" style="width:100%; padding:12px; background:#e0f2fe; border:1px solid #7dd3fc; border-radius:8px; cursor:pointer; font-weight:bold; text-align:left; display:flex; justify-content:space-between; align-items:center;">';
  html += '<span>📖 매매 타이밍 해석 가이드</span>';
  html += '<span id="timingGuideToggle">▼</span>';
  html += '</button>';
  html += '<div id="timingGuideContent" style="display:none; padding:15px; background:#f0f9ff; border-radius:0 0 8px 8px; border:1px solid #7dd3fc; border-top:none; margin-top:-1px;">';
  
  // RSI 설명
  html += '<div style="margin-bottom:15px; padding:10px; background:white; border-radius:6px;">';
  html += '<h4 style="margin:0 0 10px 0; color:#3b82f6;">📊 RSI (Relative Strength Index)</h4>';
  html += '<ul style="margin:5px 0; padding-left:20px; line-height:1.8; font-size:0.9rem;">';
  html += '<li><strong>의미:</strong> 과매수/과매도 판단 지표 (0~100)</li>';
  html += '<li><strong>70 이상:</strong> 과매수 구간 → 조정 가능성 (매도 고려)</li>';
  html += '<li><strong>30 이하:</strong> 과매도 구간 → 반등 가능성 (매수 고려)</li>';
  html += '<li><strong>50 근처:</strong> 중립 구간 → 관망</li>';
  html += '<li><strong>활용:</strong> 다른 지표와 함께 종합 판단</li>';
  html += '</ul>';
  html += '</div>';
  
  // MACD 설명
  html += '<div style="margin-bottom:15px; padding:10px; background:white; border-radius:6px;">';
  html += '<h4 style="margin:0 0 10px 0; color:#3b82f6;">📈 MACD (Moving Average Convergence Divergence)</h4>';
  html += '<ul style="margin:5px 0; padding-left:20px; line-height:1.8; font-size:0.9rem;">';
  html += '<li><strong>의미:</strong> 추세의 방향과 강도를 파악하는 지표</li>';
  html += '<li><strong>골든크로스:</strong> MACD선이 시그널선을 상향 돌파 → 매수 신호</li>';
  html += '<li><strong>데드크로스:</strong> MACD선이 시그널선을 하향 돌파 → 매도 신호</li>';
  html += '<li><strong>0선 돌파:</strong> 상승 추세 전환 신호</li>';
  html += '<li><strong>히스토그램:</strong> 양수 확대 시 상승 강화, 음수 확대 시 하락 강화</li>';
  html += '</ul>';
  html += '</div>';
  
  // 거래량 설명
  html += '<div style="margin-bottom:15px; padding:10px; background:white; border-radius:6px;">';
  html += '<h4 style="margin:0 0 10px 0; color:#3b82f6;">📊 거래량</h4>';
  html += '<ul style="margin:5px 0; padding-left:20px; line-height:1.8; font-size:0.9rem;">';
  html += '<li><strong>의미:</strong> 매매 활동의 활발함을 나타냄</li>';
  html += '<li><strong>거래량 증가 + 상승:</strong> 강한 매수세 → 상승 지속 가능성</li>';
  html += '<li><strong>거래량 증가 + 하락:</strong> 강한 매도세 → 추가 하락 주의</li>';
  html += '<li><strong>거래량 감소:</strong> 관심 부족 → 추세 전환 가능성</li>';
  html += '<li><strong>거래량비 2배 이상:</strong> 평소보다 활발한 매매</li>';
  html += '</ul>';
  html += '</div>';
  
  // 타이밍 점수 설명
  html += '<div style="margin-bottom:15px; padding:10px; background:white; border-radius:6px;">';
  html += '<h4 style="margin:0 0 10px 0; color:#3b82f6;">🎯 타이밍 점수란?</h4>';
  html += '<ul style="margin:5px 0; padding-left:20px; line-height:1.8; font-size:0.9rem;">';
  html += '<li><strong>70점 이상:</strong> 강한 매수 타이밍 (적극 매수 고려)</li>';
  html += '<li><strong>30점 이하:</strong> 강한 매도 타이밍 (손절/익절 고려)</li>';
  html += '<li><strong>40-60점:</strong> 중립 구간 (관망 추천)</li>';
  html += '<li><strong>계산 방식:</strong> RSI, MACD, 이동평균선, 거래량 등을 종합 분석</li>';
  html += '<li><strong>주의:</strong> 100% 정확한 예측은 불가능, 참고 자료로 활용</li>';
  html += '</ul>';
  html += '</div>';
  
  // 신호 해석 방법
  html += '<div style="padding:10px; background:white; border-radius:6px;">';
  html += '<h4 style="margin:0 0 10px 0; color:#3b82f6;">🔍 매수/매도 신호 해석</h4>';
  html += '<ul style="margin:5px 0; padding-left:20px; line-height:1.8; font-size:0.9rem;">';
  html += '<li><strong>복수 매수 신호:</strong> 신뢰도 증가 (2개 이상 시 강한 매수)</li>';
  html += '<li><strong>복수 매도 신호:</strong> 위험도 증가 (2개 이상 시 강한 매도)</li>';
  html += '<li><strong>혼재 신호:</strong> 방향성 불확실 (추가 관찰 필요)</li>';
  html += '<li><strong>신호 없음:</strong> 중립 구간 (급하지 않다면 관망)</li>';
  html += '</ul>';
  html += '</div>';
  
  // 중요 안내
  html += '<div style="margin-top:15px; padding:10px; background:#fef3c7; border-radius:6px; border-left:4px solid #f59e0b;">';
  html += '<p style="margin:0; font-size:0.85rem; color:#92400e; line-height:1.6;">';
  html += '<strong>⚠️ 투자 유의사항:</strong><br>';
  html += '• 매매 타이밍은 참고 자료일 뿐, 100% 정확하지 않습니다<br>';
  html += '• 시장 상황, 뉴스, 재무제표 등을 함께 고려하세요<br>';
  html += '• 분할 매수/매도로 리스크를 분산하세요<br>';
  html += '• 손절가를 반드시 설정하여 큰 손실을 방지하세요';
  html += '</p>';
  html += '</div>';
  
  html += '</div>';
  html += '</div>';
  
  html += '</div>';
  container.innerHTML = html;
}

// 매매 타이밍 가이드 토글 함수
function toggleTimingGuide() {
  var content = document.getElementById('timingGuideContent');
  var toggle = document.getElementById('timingGuideToggle');
  
  if (content.style.display === 'none') {
    content.style.display = 'block';
    toggle.textContent = '▲';
  } else {
    content.style.display = 'none';
    toggle.textContent = '▼';
  }
}

// ==================== AI 리스크 분석 ====================
async function analyzeAiRisk() {
  var input = document.getElementById('ai-risk-input').value.trim();
  
  if (!input) {
    alert('종목명 또는 종목코드를 입력하세요.');
    return;
  }
  
  showLoading();
  
  var container = document.getElementById('ai-risk-result');
  container.innerHTML = '<p>🤖 리스크 분석 중...</p>';
  
  try {
    // 종목코드 찾기
    var stockCode = await findStockCode(input);
    
    if (!stockCode) {
      container.innerHTML = '<p>종목을 찾을 수 없습니다: ' + input + '</p>';
      hideLoading();
      return;
    }
    
    // 기술적 분석 데이터 조회
    var techResult = await apiCall('/api/analysis/technical/' + stockCode);
    var stockResult = await apiCall('/api/korea/stock/' + stockCode);
    
    if (!techResult.success) {
      container.innerHTML = '<p>분석 데이터를 가져올 수 없습니다.</p>';
      hideLoading();
      return;
    }
    
    var tech = techResult.data;
    var stock = stockResult.success ? stockResult.data : {};
    
    // 리스크 계산
    var risk = calculateRisk(tech);
    
    // 결과 표시
    displayRiskResult(stock.name || stockCode, stockCode, tech, risk);
    
  } catch (error) {
    console.error('리스크 분석 오류:', error);
    container.innerHTML = '<p>분석 중 오류가 발생했습니다.</p>';
  }
  
  hideLoading();
}

// 리스크 계산
function calculateRisk(tech) {
  var price = tech.currentPrice || 0;
  var atr = tech.atr || 0;
  
  // ATR 기반 변동성 계산
  var volatilityPercent = price > 0 ? (atr / price * 100) : 0;
  
  // VaR (Value at Risk) 계산 - 95% 신뢰도
  // 일일 VaR = 현재가 × 변동성 × 1.65 (95% 신뢰구간)
  var dailyVaR = price * (volatilityPercent / 100) * 1.65;
  var dailyVaRPercent = volatilityPercent * 1.65;
  
  // 주간 VaR (5거래일)
  var weeklyVaRPercent = dailyVaRPercent * Math.sqrt(5);
  var weeklyVaR = price * (weeklyVaRPercent / 100);
  
  // 손절가 계산 (ATR 2배 기준)
  var stopLoss = price - (atr * 2);
  var stopLossPercent = price > 0 ? ((price - stopLoss) / price * 100) : 0;
  
  // 목표가 계산 (ATR 3배 기준, 리스크:리워드 = 1:1.5)
  var targetPrice = price + (atr * 3);
  var targetPercent = price > 0 ? ((targetPrice - price) / price * 100) : 0;
  
  // 리스크 등급
  var riskLevel = '';
  var riskClass = '';
  
  if (volatilityPercent >= 5) {
    riskLevel = '🔴 매우 높음';
    riskClass = 'negative';
  } else if (volatilityPercent >= 3) {
    riskLevel = '🟠 높음';
    riskClass = 'negative';
  } else if (volatilityPercent >= 2) {
    riskLevel = '🟡 보통';
    riskClass = '';
  } else {
    riskLevel = '🟢 낮음';
    riskClass = 'positive';
  }
  
  return {
    volatilityPercent: volatilityPercent,
    dailyVaR: dailyVaR,
    dailyVaRPercent: dailyVaRPercent,
    weeklyVaR: weeklyVaR,
    weeklyVaRPercent: weeklyVaRPercent,
    stopLoss: stopLoss,
    stopLossPercent: stopLossPercent,
    targetPrice: targetPrice,
    targetPercent: targetPercent,
    riskLevel: riskLevel,
    riskClass: riskClass,
    atr: atr
  };
}

// 리스크 결과 표시
function displayRiskResult(stockName, stockCode, tech, risk) {
  var container = document.getElementById('ai-risk-result');
  
  var html = '<div class="card">';
  html += '<h3>⚠️ ' + stockName + ' (' + stockCode + ') 리스크 분석</h3>';
  
  // 리스크 등급
  html += '<div style="text-align:center; padding:20px; background:#f8fafc; border-radius:8px; margin:15px 0;">';
  html += '<p style="color:#666; margin-bottom:10px;">리스크 등급</p>';
  html += '<p style="font-size:2rem; font-weight:bold;" class="' + risk.riskClass + '">' + risk.riskLevel + '</p>';
  html += '<p style="color:#666;">일일 변동성: <strong>' + risk.volatilityPercent.toFixed(2) + '%</strong></p>';
  html += '</div>';
  
  // VaR 정보
  html += '<div class="indicators-grid" style="margin-top:15px;">';
  html += '<div class="indicator-card"><div class="label">현재가</div><div class="value">' + tech.currentPrice.toLocaleString() + '원</div></div>';
  html += '<div class="indicator-card"><div class="label">ATR (변동폭)</div><div class="value">' + Math.round(risk.atr).toLocaleString() + '원</div></div>';
  html += '<div class="indicator-card"><div class="label">일일 VaR (95%)</div><div class="value negative">-' + risk.dailyVaRPercent.toFixed(1) + '%</div></div>';
  html += '<div class="indicator-card"><div class="label">주간 VaR (95%)</div><div class="value negative">-' + risk.weeklyVaRPercent.toFixed(1) + '%</div></div>';
  html += '</div>';
  
  // 손절가/목표가
  html += '<div class="indicators-grid" style="margin-top:15px;">';
  html += '<div class="indicator-card" style="background:#fee2e2;"><div class="label">🛑 권장 손절가</div><div class="value" style="color:#991b1b;">' + Math.round(risk.stopLoss).toLocaleString() + '원<br><small>(-' + risk.stopLossPercent.toFixed(1) + '%)</small></div></div>';
  html += '<div class="indicator-card" style="background:#dcfce7;"><div class="label">🎯 권장 목표가</div><div class="value" style="color:#166534;">' + Math.round(risk.targetPrice).toLocaleString() + '원<br><small>(+' + risk.targetPercent.toFixed(1) + '%)</small></div></div>';
  html += '</div>';
  
  // 투자금액별 예상 손실
  html += '<div style="margin-top:15px; padding:15px; background:#f0f9ff; border-radius:8px;">';
  html += '<h4>💰 투자금액별 일일 최대 예상 손실 (95% 신뢰도)</h4>';
  html += '<table style="width:100%; margin-top:10px; font-size:0.9rem;">';
  html += '<tr><td>100만원 투자 시</td><td style="text-align:right; color:#991b1b;"><strong>-' + Math.round(1000000 * risk.dailyVaRPercent / 100).toLocaleString() + '원</strong></td></tr>';
  html += '<tr><td>500만원 투자 시</td><td style="text-align:right; color:#991b1b;"><strong>-' + Math.round(5000000 * risk.dailyVaRPercent / 100).toLocaleString() + '원</strong></td></tr>';
  html += '<tr><td>1000만원 투자 시</td><td style="text-align:right; color:#991b1b;"><strong>-' + Math.round(10000000 * risk.dailyVaRPercent / 100).toLocaleString() + '원</strong></td></tr>';
  html += '</table>';
  html += '</div>';
  
  // 접히는 설명 패널 추가
  html += '<div style="margin-top:15px;">';
  html += '<button onclick="toggleRiskGuide()" style="width:100%; padding:12px; background:#e0f2fe; border:1px solid #7dd3fc; border-radius:8px; cursor:pointer; font-weight:bold; text-align:left; display:flex; justify-content:space-between; align-items:center;">';
  html += '<span>📖 리스크 분석 해석 가이드</span>';
  html += '<span id="riskGuideToggle">▼</span>';
  html += '</button>';
  html += '<div id="riskGuideContent" style="display:none; padding:15px; background:#f0f9ff; border-radius:0 0 8px 8px; border:1px solid #7dd3fc; border-top:none; margin-top:-1px;">';
  
  // VaR 설명
  html += '<div style="margin-bottom:15px; padding:10px; background:white; border-radius:6px;">';
  html += '<h4 style="margin:0 0 10px 0; color:#dc2626;">📊 VaR (Value at Risk)</h4>';
  html += '<ul style="margin:5px 0; padding-left:20px; line-height:1.8; font-size:0.9rem;">';
  html += '<li><strong>의미:</strong> 특정 기간 동안 발생할 수 있는 최대 손실 금액 (통계적 예측)</li>';
  html += '<li><strong>95% 신뢰도:</strong> 100일 중 95일은 이 손실 범위 안에 있다는 의미</li>';
  html += '<li><strong>일일 VaR -3%:</strong> 하루에 3% 이상 손실이 날 확률은 5% (20일 중 1일)</li>';
  html += '<li><strong>주간 VaR -7%:</strong> 일주일에 7% 이상 손실이 날 확률은 5%</li>';
  html += '<li><strong>활용:</strong> 투자 금액 결정 시 감당 가능한 손실 범위 파악</li>';
  html += '</ul>';
  html += '</div>';
  
  // ATR 설명
  html += '<div style="margin-bottom:15px; padding:10px; background:white; border-radius:6px;">';
  html += '<h4 style="margin:0 0 10px 0; color:#ea580c;">📈 ATR (Average True Range)</h4>';
  html += '<ul style="margin:5px 0; padding-left:20px; line-height:1.8; font-size:0.9rem;">';
  html += '<li><strong>의미:</strong> 일정 기간(보통 14일) 동안의 평균 가격 변동폭</li>';
  html += '<li><strong>ATR 1,000원:</strong> 하루에 평균 1,000원 정도 움직인다는 의미</li>';
  html += '<li><strong>높은 ATR:</strong> 변동성 큼 → 리스크 크지만 수익 기회도 큼</li>';
  html += '<li><strong>낮은 ATR:</strong> 변동성 작음 → 안정적이지만 수익률도 제한적</li>';
  html += '<li><strong>활용:</strong> 손절가/목표가 설정, 포지션 크기 결정</li>';
  html += '</ul>';
  html += '</div>';
  
  // 리스크 등급 설명
  html += '<div style="margin-bottom:15px; padding:10px; background:white; border-radius:6px;">';
  html += '<h4 style="margin:0 0 10px 0; color:#3b82f6;">⚠️ 리스크 등급</h4>';
  html += '<ul style="margin:5px 0; padding-left:20px; line-height:1.8; font-size:0.9rem;">';
  html += '<li><strong>높음 (일일 변동성 3% 이상):</strong> 하루에 큰 등락 가능 → 단기 트레이딩, 소액 투자</li>';
  html += '<li><strong>보통 (1.5~3%):</strong> 적당한 변동성 → 중기 투자 적합</li>';
  html += '<li><strong>낮음 (1.5% 미만):</strong> 안정적 → 장기 투자, 대량 투자 가능</li>';
  html += '<li><strong>초보자:</strong> 낮음~보통 등급 종목부터 시작 권장</li>';
  html += '</ul>';
  html += '</div>';
  
  // 손절가/목표가 설명
  html += '<div style="margin-bottom:15px; padding:10px; background:white; border-radius:6px;">';
  html += '<h4 style="margin:0 0 10px 0; color:#16a34a;">🎯 손절가 & 목표가</h4>';
  html += '<ul style="margin:5px 0; padding-left:20px; line-height:1.8; font-size:0.9rem;">';
  html += '<li><strong>손절가 (Stop Loss):</strong> 이 가격까지 떨어지면 무조건 매도하여 큰 손실 방지</li>';
  html += '<li><strong>계산법:</strong> 현재가 - (ATR × 2) → 평균 변동폭의 2배 하락 시</li>';
  html += '<li><strong>목표가 (Target Price):</strong> 이 가격까지 오르면 익절 고려</strong></li>';
  html += '<li><strong>계산법:</strong> 현재가 + (ATR × 3) → 평균 변동폭의 3배 상승 시</li>';
  html += '<li><strong>리스크:리워드 비율:</strong> 1:1.5 (손실 2만큼 감수하면 이익 3 기대)</li>';
  html += '<li><strong>필수:</strong> 매수 즉시 손절가 주문 설정 습관화</li>';
  html += '</ul>';
  html += '</div>';
  
  // 투자 전략
  html += '<div style="padding:10px; background:white; border-radius:6px;">';
  html += '<h4 style="margin:0 0 10px 0; color:#7c3aed;">💡 리스크별 투자 전략</h4>';
  html += '<ul style="margin:5px 0; padding-left:20px; line-height:1.8; font-size:0.9rem;">';
  html += '<li><strong>고위험 종목:</strong> 투자 비중 5~10%, 단기 매매, 타이트한 손절</li>';
  html += '<li><strong>중위험 종목:</strong> 투자 비중 15~25%, 중기 보유, 적정 손절</li>';
  html += '<li><strong>저위험 종목:</strong> 투자 비중 30% 이상 가능, 장기 보유</li>';
  html += '<li><strong>분산 투자:</strong> 서로 다른 리스크 등급 종목을 조합</li>';
  html += '<li><strong>포지션 크기:</strong> VaR를 보고 총 자산 대비 감당 가능한 금액만 투자</li>';
  html += '</ul>';
  html += '</div>';
  
  // 중요 안내
  html += '<div style="margin-top:15px; padding:10px; background:#fef3c7; border-radius:6px; border-left:4px solid #f59e0b;">';
  html += '<p style="margin:0; font-size:0.85rem; color:#92400e; line-height:1.6;">';
  html += '<strong>⚠️ 리스크 관리 원칙:</strong><br>';
  html += '• VaR는 과거 데이터 기반 예측이며, 실제 손실은 더 클 수 있습니다<br>';
  html += '• 한 종목에 전체 자산의 20% 이상 투자하지 마세요<br>';
  html += '• 손절가는 반드시 설정하고, 감정에 흔들리지 말고 지키세요<br>';
  html += '• 감당할 수 없는 손실 금액이라면 투자 금액을 줄이세요';
  html += '</p>';
  html += '</div>';
  
  html += '</div>';
  html += '</div>';
  
  html += '</div>';
  container.innerHTML = html;
}

// 리스크 가이드 토글 함수
function toggleRiskGuide() {
  var content = document.getElementById('riskGuideContent');
  var toggle = document.getElementById('riskGuideToggle');
  
  if (content.style.display === 'none') {
    content.style.display = 'block';
    toggle.textContent = '▲';
  } else {
    content.style.display = 'none';
    toggle.textContent = '▼';
  }
}

// ==================== AI 차트 패턴 ====================
async function analyzeAiPattern() {
  var input = document.getElementById('ai-pattern-input').value.trim();
  
  if (!input) {
    alert('종목명 또는 종목코드를 입력하세요.');
    return;
  }
  
  showLoading();
  
  var container = document.getElementById('ai-pattern-result');
  container.innerHTML = '<p>🤖 차트 패턴 분석 중...</p>';
  
  try {
    // 종목코드 찾기
    var stockCode = await findStockCode(input);
    
    if (!stockCode) {
      container.innerHTML = '<p>종목을 찾을 수 없습니다: ' + input + '</p>';
      hideLoading();
      return;
    }
    
    // 차트 데이터 조회
    var chartResult = await apiCall('/api/korea/chart/' + stockCode);
    var stockResult = await apiCall('/api/korea/stock/' + stockCode);
    var techResult = await apiCall('/api/analysis/technical/' + stockCode);
    
    if (!chartResult.success || !chartResult.data || chartResult.data.length < 20) {
      container.innerHTML = '<p>차트 데이터가 부족합니다.</p>';
      hideLoading();
      return;
    }
    
    var stock = stockResult.success ? stockResult.data : {};
    var tech = techResult.success ? techResult.data : {};
    
    // 패턴 분석
    var patterns = detectChartPatterns(chartResult.data);
    
    // 결과 표시
    displayPatternResult(stock.name || stockCode, stockCode, tech, patterns);
    
  } catch (error) {
    console.error('차트 패턴 분석 오류:', error);
    container.innerHTML = '<p>분석 중 오류가 발생했습니다.</p>';
  }
  
  hideLoading();
}



// 차트 패턴 감지
function detectChartPatterns(chartData) {
  var patterns = [];
  var data = chartData.slice(-60); // 최근 60일
  
  if (data.length < 20) {
    return patterns;
  }
  
  var closes = data.map(function(d) { return d.close; });
  var highs = data.map(function(d) { return d.high; });
  var lows = data.map(function(d) { return d.low; });
  
  var recent = closes.slice(-20);
  var recentHighs = highs.slice(-20);
  var recentLows = lows.slice(-20);
  
  var maxPrice = Math.max.apply(null, recent);
  var minPrice = Math.min.apply(null, recent);
  var currentPrice = closes[closes.length - 1];
  var avgPrice = recent.reduce(function(a, b) { return a + b; }, 0) / recent.length;
  
  // 1. 추세 분석
  var trend = analyzeTrend(closes);
  patterns.push({
    name: trend.name,
    type: trend.type,
    description: trend.description,
    reliability: trend.reliability
  });
  
  // 2. 쌍바닥 (Double Bottom) 감지
  var doubleBottom = detectDoubleBottom(recentLows, currentPrice);
  if (doubleBottom.detected) {
    patterns.push({
      name: '📈 쌍바닥 (Double Bottom)',
      type: 'bullish',
      description: '두 번의 저점이 비슷한 수준에서 형성되어 상승 반전 가능성',
      reliability: doubleBottom.reliability
    });
  }
  
  // 3. 쌍봉 (Double Top) 감지
  var doubleTop = detectDoubleTop(recentHighs, currentPrice);
  if (doubleTop.detected) {
    patterns.push({
      name: '📉 쌍봉 (Double Top)',
      type: 'bearish',
      description: '두 번의 고점이 비슷한 수준에서 형성되어 하락 반전 가능성',
      reliability: doubleTop.reliability
    });
  }
  
  // 4. 삼각수렴 (Triangle) 감지
  var triangle = detectTriangle(recentHighs, recentLows);
  if (triangle.detected) {
    patterns.push({
      name: '🔺 삼각수렴 (Triangle)',
      type: 'neutral',
      description: '고점과 저점이 수렴 중, 곧 방향성 결정 예상',
      reliability: triangle.reliability
    });
  }
  
  // 5. 박스권 (Range) 감지
  var range = detectRange(recent, maxPrice, minPrice);
  if (range.detected) {
    patterns.push({
      name: '📦 박스권 (Range)',
      type: 'neutral',
      description: '일정 범위 내에서 횡보 중 (' + Math.round(minPrice).toLocaleString() + ' ~ ' + Math.round(maxPrice).toLocaleString() + ')',
      reliability: range.reliability
    });
  }
  
  // 6. 지지선/저항선 분석
  var support = Math.min.apply(null, recentLows);
  var resistance = Math.max.apply(null, recentHighs);
  
  patterns.push({
    name: '📊 지지/저항선',
    type: 'info',
    description: '지지선: ' + Math.round(support).toLocaleString() + '원 / 저항선: ' + Math.round(resistance).toLocaleString() + '원',
    reliability: '참고'
  });
  
  return patterns;
}

// 추세 분석
function analyzeTrend(closes) {
  var recent10 = closes.slice(-10);
  var recent30 = closes.slice(-30);
  
  var avg10 = recent10.reduce(function(a, b) { return a + b; }, 0) / recent10.length;
  var avg30 = recent30.reduce(function(a, b) { return a + b; }, 0) / recent30.length;
  
  var current = closes[closes.length - 1];
  var change10 = (current - recent10[0]) / recent10[0] * 100;
  
  if (current > avg10 && avg10 > avg30 && change10 > 5) {
    return {
      name: '📈 강한 상승 추세',
      type: 'bullish',
      description: '단기/중기 이동평균 위에서 거래 중, 상승 모멘텀 지속',
      reliability: '높음'
    };
  } else if (current > avg10 && current > avg30) {
    return {
      name: '📈 상승 추세',
      type: 'bullish',
      description: '이동평균선 위에서 거래 중',
      reliability: '보통'
    };
  } else if (current < avg10 && avg10 < avg30 && change10 < -5) {
    return {
      name: '📉 강한 하락 추세',
      type: 'bearish',
      description: '단기/중기 이동평균 아래에서 거래 중, 하락 모멘텀 지속',
      reliability: '높음'
    };
  } else if (current < avg10 && current < avg30) {
    return {
      name: '📉 하락 추세',
      type: 'bearish',
      description: '이동평균선 아래에서 거래 중',
      reliability: '보통'
    };
  } else {
    return {
      name: '➡️ 횡보/조정',
      type: 'neutral',
      description: '뚜렷한 추세 없이 횡보 또는 조정 중',
      reliability: '보통'
    };
  }
}

// 쌍바닥 감지
function detectDoubleBottom(lows, currentPrice) {
  if (lows.length < 10) return { detected: false };
  
  var minIdx1 = -1, minIdx2 = -1;
  var minVal = Infinity;
  
  // 첫 번째 저점 찾기
  for (var i = 0; i < lows.length - 5; i++) {
    if (lows[i] < minVal) {
      minVal = lows[i];
      minIdx1 = i;
    }
  }
  
  // 두 번째 저점 찾기 (첫 번째와 5일 이상 떨어진)
  minVal = Infinity;
  for (var j = minIdx1 + 5; j < lows.length; j++) {
    if (lows[j] < minVal) {
      minVal = lows[j];
      minIdx2 = j;
    }
  }
  
  if (minIdx1 === -1 || minIdx2 === -1) return { detected: false };
  
  var diff = Math.abs(lows[minIdx1] - lows[minIdx2]) / lows[minIdx1] * 100;
  
  // 두 저점이 3% 이내로 비슷하고, 현재가가 저점보다 높으면
  if (diff < 3 && currentPrice > lows[minIdx1] * 1.02) {
    return { detected: true, reliability: diff < 1.5 ? '높음' : '보통' };
  }
  
  return { detected: false };
}

// 쌍봉 감지
function detectDoubleTop(highs, currentPrice) {
  if (highs.length < 10) return { detected: false };
  
  var maxIdx1 = -1, maxIdx2 = -1;
  var maxVal = 0;
  
  // 첫 번째 고점 찾기
  for (var i = 0; i < highs.length - 5; i++) {
    if (highs[i] > maxVal) {
      maxVal = highs[i];
      maxIdx1 = i;
    }
  }
  
  // 두 번째 고점 찾기
  maxVal = 0;
  for (var j = maxIdx1 + 5; j < highs.length; j++) {
    if (highs[j] > maxVal) {
      maxVal = highs[j];
      maxIdx2 = j;
    }
  }
  
  if (maxIdx1 === -1 || maxIdx2 === -1) return { detected: false };
  
  var diff = Math.abs(highs[maxIdx1] - highs[maxIdx2]) / highs[maxIdx1] * 100;
  
  // 두 고점이 3% 이내로 비슷하고, 현재가가 고점보다 낮으면
  if (diff < 3 && currentPrice < highs[maxIdx1] * 0.98) {
    return { detected: true, reliability: diff < 1.5 ? '높음' : '보통' };
  }
  
  return { detected: false };
}

// 삼각수렴 감지
function detectTriangle(highs, lows) {
  if (highs.length < 10) return { detected: false };
  
  var highTrend = (highs[highs.length - 1] - highs[0]) / highs.length;
  var lowTrend = (lows[lows.length - 1] - lows[0]) / lows.length;
  
  // 고점은 하락, 저점은 상승하면 수렴
  if (highTrend < 0 && lowTrend > 0) {
    var range = highs[highs.length - 1] - lows[lows.length - 1];
    var initialRange = highs[0] - lows[0];
    
    if (range < initialRange * 0.7) {
      return { detected: true, reliability: '보통' };
    }
  }
  
  return { detected: false };
}

// 박스권 감지
function detectRange(closes, maxPrice, minPrice) {
  var range = (maxPrice - minPrice) / minPrice * 100;
  
  // 변동폭이 10% 이내면 박스권
  if (range < 10) {
    return { detected: true, reliability: range < 5 ? '높음' : '보통' };
  }
  
  return { detected: false };
}

// 패턴 결과 표시
function displayPatternResult(stockName, stockCode, tech, patterns) {
  var container = document.getElementById('ai-pattern-result');
  
  var html = '<div class="card">';
  html += '<h3>📈 ' + stockName + ' (' + stockCode + ') 차트 패턴</h3>';
  
  // 현재가 정보
  html += '<div class="indicators-grid" style="margin:15px 0;">';
  html += '<div class="indicator-card"><div class="label">현재가</div><div class="value">' + (tech.currentPrice ? tech.currentPrice.toLocaleString() + '원' : '--') + '</div></div>';
  html += '<div class="indicator-card"><div class="label">등락률</div><div class="value ' + (parseFloat(tech.changeRate) >= 0 ? 'positive' : 'negative') + '">' + (tech.changeRate || 0) + '%</div></div>';
  html += '</div>';
  
  // 감지된 패턴들
  html += '<div style="margin-top:15px;">';
  
  patterns.forEach(function(pattern) {
    var bgColor = '#f8fafc';
    var borderColor = '#e2e8f0';
    
    if (pattern.type === 'bullish') {
      bgColor = '#dcfce7';
      borderColor = '#86efac';
    } else if (pattern.type === 'bearish') {
      bgColor = '#fee2e2';
      borderColor = '#fca5a5';
    } else if (pattern.type === 'info') {
      bgColor = '#e0f2fe';
      borderColor = '#7dd3fc';
    }
    
    html += '<div style="padding:15px; background:' + bgColor + '; border:1px solid ' + borderColor + '; border-radius:8px; margin-bottom:10px;">';
    html += '<div style="display:flex; justify-content:space-between; align-items:center;">';
    html += '<strong>' + pattern.name + '</strong>';
    html += '<span style="font-size:0.85rem; color:#666;">신뢰도: ' + pattern.reliability + '</span>';
    html += '</div>';
    html += '<p style="color:#666; margin-top:8px; font-size:0.9rem;">' + pattern.description + '</p>';
    html += '</div>';
  });
  
  html += '</div>';
  
  // 접히는 설명 패널 추가
  html += '<div style="margin-top:15px;">';
  html += '<button onclick="toggleChartPatternGuide()" style="width:100%; padding:12px; background:#e0f2fe; border:1px solid #7dd3fc; border-radius:8px; cursor:pointer; font-weight:bold; text-align:left; display:flex; justify-content:space-between; align-items:center;">';
  html += '<span>📖 차트 패턴 해석 가이드</span>';
  html += '<span id="chartPatternGuideToggle">▼</span>';
  html += '</button>';
  html += '<div id="chartPatternGuideContent" style="display:none; padding:15px; background:#f0f9ff; border-radius:0 0 8px 8px; border:1px solid #7dd3fc; border-top:none; margin-top:-1px;">';
  
  // 반전 패턴
  html += '<div style="margin-bottom:15px; padding:10px; background:white; border-radius:6px;">';
  html += '<h4 style="margin:0 0 10px 0; color:#16a34a;">📈 상승 반전 패턴</h4>';
  html += '<ul style="margin:5px 0; padding-left:20px; line-height:1.8; font-size:0.9rem;">';
  html += '<li><strong>더블바텀 (쌍바닥, W형):</strong> 두 번 저점 확인 후 반등 → 강력한 매수 신호</li>';
  html += '<li><strong>역헤드앤숄더:</strong> 머리-어깨-머리 형태의 바닥 → 큰 상승 기대</li>';
  html += '<li><strong>상승 삼각수렴:</strong> 고점은 수평, 저점은 상승 → 위로 돌파 시 매수</li>';
  html += '<li><strong>컵앤핸들:</strong> U자 바닥 + 작은 조정 → 장기 상승 신호</li>';
  html += '<li><strong>공통 전략:</strong> 네크라인(저항선) 돌파 확인 후 매수</li>';
  html += '</ul>';
  html += '</div>';
  
  html += '<div style="margin-bottom:15px; padding:10px; background:white; border-radius:6px;">';
  html += '<h4 style="margin:0 0 10px 0; color:#dc2626;">📉 하락 반전 패턴</h4>';
  html += '<ul style="margin:5px 0; padding-left:20px; line-height:1.8; font-size:0.9rem;">';
  html += '<li><strong>더블탑 (쌍봉, M형):</strong> 두 번 고점 실패 후 하락 → 강력한 매도 신호</li>';
  html += '<li><strong>헤드앤숄더:</strong> 어깨-머리-어깨 형태의 천장 → 큰 하락 경고</li>';
  html += '<li><strong>하락 삼각수렴:</strong> 저점은 수평, 고점은 하락 → 아래로 이탈 시 매도</li>';
  html += '<li><strong>라운딩탑:</strong> 반원형 천장 → 서서히 하락</li>';
  html += '<li><strong>공통 전략:</strong> 네크라인(지지선) 이탈 시 손절 또는 공매도</li>';
  html += '</ul>';
  html += '</div>';
  
  // 지속 패턴
  html += '<div style="margin-bottom:15px; padding:10px; background:white; border-radius:6px;">';
  html += '<h4 style="margin:0 0 10px 0; color:#3b82f6;">➡️ 추세 지속 패턴</h4>';
  html += '<ul style="margin:5px 0; padding-left:20px; line-height:1.8; font-size:0.9rem;">';
  html += '<li><strong>상승/하락 깃발:</strong> 급등/급락 후 짧은 조정 → 기존 방향 재개</li>';
  html += '<li><strong>대칭 삼각수렴:</strong> 고점 하락 + 저점 상승 → 돌파 방향으로 큰 움직임</li>';
  html += '<li><strong>박스권 (횡보):</strong> 일정 범위 반복 → 지지선 매수, 저항선 매도</li>';
  html += '<li><strong>상승 채널:</strong> 평행한 상승 추세선 → 추세 유지 시 분할 매수</li>';
  html += '<li><strong>활용:</strong> 패턴 이탈 시 큰 가격 변동 발생</li>';
  html += '</ul>';
  html += '</div>';
  
  // 신뢰도 설명
  html += '<div style="margin-bottom:15px; padding:10px; background:white; border-radius:6px;">';
  html += '<h4 style="margin:0 0 10px 0; color:#7c3aed;">🎯 신뢰도 점수</h4>';
  html += '<ul style="margin:5px 0; padding-left:20px; line-height:1.8; font-size:0.9rem;">';
  html += '<li><strong>높음:</strong> 패턴이 명확하고 전형적 → 높은 확률로 예측 방향 진행</li>';
  html += '<li><strong>보통:</strong> 패턴이 형성 중이거나 일부 조건 미충족 → 참고용</li>';
  html += '<li><strong>낮음:</strong> 패턴이 불완전하거나 다른 신호와 상충 → 신중히 판단</li>';
  html += '<li><strong>거래량 확인:</strong> 패턴 돌파 시 거래량 급증하면 신뢰도 UP</li>';
  html += '</ul>';
  html += '</div>';
  
  // 목표가 계산
  html += '<div style="margin-bottom:15px; padding:10px; background:white; border-radius:6px;">';
  html += '<h4 style="margin:0 0 10px 0; color:#ea580c;">📊 목표가 계산법</h4>';
  html += '<ul style="margin:5px 0; padding-left:20px; line-height:1.8; font-size:0.9rem;">';
  html += '<li><strong>더블탑/바텀:</strong> 목표가 = 네크라인 ± 패턴 높이</li>';
  html += '<li><strong>헤드앤숄더:</strong> 목표가 = 네크라인 ± (머리 - 네크라인)</li>';
  html += '<li><strong>삼각수렴:</strong> 목표가 = 돌파점 ± 삼각형 밑변 길이</li>';
  html += '<li><strong>박스권:</strong> 목표가 = 돌파점 ± 박스 높이</li>';
  html += '<li><strong>예시:</strong> 더블바텀에서 고점 110,000원, 저점 90,000원 → 돌파 후 목표가 130,000원</li>';
  html += '</ul>';
  html += '</div>';
  
  // 패턴 활용 전략
  html += '<div style="padding:10px; background:white; border-radius:6px;">';
  html += '<h4 style="margin:0 0 10px 0; color:#0891b2;">💡 패턴 활용 전략</h4>';
  html += '<ul style="margin:5px 0; padding-left:20px; line-height:1.8; font-size:0.9rem;">';
  html += '<li><strong>진입 타이밍:</strong> 패턴 완성 + 네크라인 돌파 + 거래량 증가 시</li>';
  html += '<li><strong>손절가 설정:</strong> 반전 패턴의 경우 패턴 반대쪽 끝</li>';
  html += '<li><strong>분할 매수/매도:</strong> 돌파 시 1/3, 중간 지점 1/3, 목표가 근처 1/3</li>';
  html += '<li><strong>여러 지표 확인:</strong> RSI, MACD, 이동평균선과 함께 종합 판단</li>';
  html += '<li><strong>가짜 돌파 주의:</strong> 돌파 후 다시 패턴 내부로 회귀 시 손절</li>';
  html += '</ul>';
  html += '</div>';
  
  // 중요 안내
  html += '<div style="margin-top:15px; padding:10px; background:#fef3c7; border-radius:6px; border-left:4px solid #f59e0b;">';
  html += '<p style="margin:0; font-size:0.85rem; color:#92400e; line-height:1.6;">';
  html += '<strong>⚠️ 차트 패턴 주의사항:</strong><br>';
  html += '• 패턴은 과거 가격 움직임 기반 예측이며, 항상 맞는 것은 아닙니다<br>';
  html += '• 패턴 형성 중에는 매매하지 말고, 완성 및 돌파 확인 후 진입하세요<br>';
  html += '• 뉴스, 실적 발표 등 펀더멘털 변화가 패턴을 무효화할 수 있습니다<br>';
  html += '• 단기 차트보다 장기 차트의 패턴이 더 신뢰도가 높습니다';
  html += '</p>';
  html += '</div>';
  
  html += '</div>';
  html += '</div>';
  
  html += '</div>';
  container.innerHTML = html;
}

// 차트 패턴 가이드 토글 함수
function toggleChartPatternGuide() {
  var content = document.getElementById('chartPatternGuideContent');
  var toggle = document.getElementById('chartPatternGuideToggle');
  
  if (content.style.display === 'none') {
    content.style.display = 'block';
    toggle.textContent = '▲';
  } else {
    content.style.display = 'none';
    toggle.textContent = '▼';
  }
}

// ==================== AI 포트폴리오 추천 ====================
var aiPortfolioStocks = [];

// 포트폴리오에 종목 추가
async function addAiPortfolioStock() {
  var input = document.getElementById('ai-portfolio-input').value.trim();
  
  if (!input) {
    alert('종목명 또는 종목코드를 입력하세요.');
    return;
  }
  
  showLoading();
  
  try {
    // 종목코드 찾기
    var stockCode = await findStockCode(input);
    
    if (!stockCode) {
      alert('종목을 찾을 수 없습니다: ' + input);
      hideLoading();
      return;
    }
    
    // 중복 확인
    if (aiPortfolioStocks.find(function(s) { return s.code === stockCode; })) {
      alert('이미 추가된 종목입니다.');
      hideLoading();
      return;
    }
    
    // 종목 정보 조회
    var stockResult = await apiCall('/api/korea/stock/' + stockCode);
    var techResult = await apiCall('/api/analysis/technical/' + stockCode);
    
    if (!stockResult.success) {
      alert('종목 정보를 가져올 수 없습니다.');
      hideLoading();
      return;
    }
    
    var tech = techResult.success ? techResult.data : {};
    
    aiPortfolioStocks.push({
      code: stockCode,
      name: stockResult.data.name,
      price: stockResult.data.price,
      atr: tech.atr || 0,
      volatility: tech.currentPrice > 0 ? (tech.atr / tech.currentPrice * 100) : 0,
      techScore: tech.technicalScore || 0
    });
    
    document.getElementById('ai-portfolio-input').value = '';
    displayAiPortfolioList();
    
  } catch (error) {
    console.error('종목 추가 오류:', error);
    alert('오류가 발생했습니다.');
  }
  
  hideLoading();
}

// 포트폴리오에서 종목 제거
function removeAiPortfolioStock(code) {
  aiPortfolioStocks = aiPortfolioStocks.filter(function(s) { return s.code !== code; });
  displayAiPortfolioList();
  document.getElementById('ai-portfolio-result').innerHTML = '';
}

// 포트폴리오 종목 목록 표시
function displayAiPortfolioList() {
  var container = document.getElementById('ai-portfolio-list');
  
  if (aiPortfolioStocks.length === 0) {
    container.innerHTML = '<p style="color:#999;">추가된 종목이 없습니다. 종목을 추가하세요.</p>';
    return;
  }
  
  var html = '<div style="display:flex; flex-wrap:wrap; gap:10px;">';
  
  aiPortfolioStocks.forEach(function(stock) {
    html += '<div style="padding:8px 12px; background:#e0f2fe; border-radius:20px; display:flex; align-items:center; gap:8px;">';
    html += '<span><strong>' + stock.name + '</strong> (' + stock.code + ')</span>';
    html += '<button onclick="removeAiPortfolioStock(\'' + stock.code + '\')" style="background:none; border:none; color:#ef4444; cursor:pointer; font-size:1.2rem;">×</button>';
    html += '</div>';
  });
  
  html += '</div>';
  html += '<p style="color:#666; font-size:0.85rem; margin-top:10px;">총 ' + aiPortfolioStocks.length + '개 종목</p>';
  
  container.innerHTML = html;
}

// 포트폴리오 최적 비중 분석
async function analyzeAiPortfolio() {
  if (aiPortfolioStocks.length < 2) {
    alert('최소 2개 이상의 종목을 추가하세요.');
    return;
  }
  
  var totalAmount = parseInt(document.getElementById('ai-portfolio-amount').value) || 1000;
  
  showLoading();
  
  var container = document.getElementById('ai-portfolio-result');
  container.innerHTML = '<p>🤖 포트폴리오 분석 중...</p>';
  
  try {
    // 최적 비중 계산
    var weights = calculateOptimalWeights(aiPortfolioStocks);
    
    // 결과 표시
    displayAiPortfolioResult(weights, totalAmount);
    
  } catch (error) {
    console.error('포트폴리오 분석 오류:', error);
    container.innerHTML = '<p>분석 중 오류가 발생했습니다.</p>';
  }
  
  hideLoading();
}

// 최적 비중 계산 (역변동성 가중 방식)
function calculateOptimalWeights(stocks) {
  // 변동성의 역수로 비중 계산 (변동성 낮을수록 비중 높음)
  var totalInverseVol = 0;
  
  stocks.forEach(function(stock) {
    var vol = stock.volatility || 1;
    if (vol < 0.5) vol = 0.5; // 최소 변동성
    stock.inverseVol = 1 / vol;
    totalInverseVol += stock.inverseVol;
  });
  
  // 기본 비중 계산 (역변동성 기준)
  var result = stocks.map(function(stock) {
    var baseWeight = (stock.inverseVol / totalInverseVol) * 100;
    
    // 기술적 점수로 가중치 조정 (±20%)
    var techAdjust = ((stock.techScore - 50) / 50) * 20;
    var adjustedWeight = baseWeight + (baseWeight * techAdjust / 100);
    
    return {
      code: stock.code,
      name: stock.name,
      price: stock.price,
      volatility: stock.volatility,
      techScore: stock.techScore,
      baseWeight: baseWeight,
      adjustedWeight: adjustedWeight
    };
  });
  
  // 비중 합계를 100%로 정규화
  var totalWeight = result.reduce(function(sum, s) { return sum + s.adjustedWeight; }, 0);
  result.forEach(function(s) {
    s.finalWeight = (s.adjustedWeight / totalWeight) * 100;
  });
  
  // 비중 순으로 정렬
  result.sort(function(a, b) { return b.finalWeight - a.finalWeight; });
  
  // 포트폴리오 전체 지표 계산
  var portfolioVolatility = 0;
  var portfolioScore = 0;
  result.forEach(function(s) {
    portfolioVolatility += s.volatility * s.finalWeight / 100;
    portfolioScore += s.techScore * s.finalWeight / 100;
  });
  
  return {
    stocks: result,
    portfolioVolatility: portfolioVolatility,
    portfolioScore: portfolioScore
  };
}

// 포트폴리오 결과 표시
function displayAiPortfolioResult(weights, totalAmount) {
  var container = document.getElementById('ai-portfolio-result');
  
  var html = '<div class="card">';
  html += '<h3>💼 AI 포트폴리오 추천 결과</h3>';
  
  // 포트폴리오 요약
  html += '<div style="text-align:center; padding:20px; background:#f8fafc; border-radius:8px; margin:15px 0;">';
  html += '<p style="color:#666; margin-bottom:10px;">포트폴리오 요약</p>';
  html += '<div class="indicators-grid">';
  html += '<div class="indicator-card"><div class="label">총 투자금액</div><div class="value">' + totalAmount.toLocaleString() + '만원</div></div>';
  html += '<div class="indicator-card"><div class="label">종목 수</div><div class="value">' + weights.stocks.length + '개</div></div>';
  html += '<div class="indicator-card"><div class="label">평균 변동성</div><div class="value">' + weights.portfolioVolatility.toFixed(2) + '%</div></div>';
  html += '<div class="indicator-card"><div class="label">평균 기술점수</div><div class="value">' + weights.portfolioScore.toFixed(0) + '점</div></div>';
  html += '</div>';
  html += '</div>';
  
  // 종목별 비중
  html += '<div style="margin-top:15px;">';
  html += '<h4>📊 종목별 최적 비중</h4>';
  html += '<table style="width:100%; margin-top:10px; border-collapse:collapse;">';
  html += '<thead><tr style="background:#f1f5f9;">';
  html += '<th style="padding:10px; text-align:left;">종목명</th>';
  html += '<th style="padding:10px; text-align:right;">비중</th>';
  html += '<th style="padding:10px; text-align:right;">투자금액</th>';
  html += '<th style="padding:10px; text-align:right;">예상 주수</th>';
  html += '<th style="padding:10px; text-align:right;">변동성</th>';
  html += '<th style="padding:10px; text-align:right;">기술점수</th>';
  html += '</tr></thead><tbody>';
  
  weights.stocks.forEach(function(stock, index) {
    var investAmount = totalAmount * stock.finalWeight / 100;
    var shares = Math.floor(investAmount * 10000 / stock.price);
    
    var bgColor = index % 2 === 0 ? '#ffffff' : '#f8fafc';
    
    html += '<tr style="background:' + bgColor + ';">';
    html += '<td style="padding:10px;"><strong>' + stock.name + '</strong><br><small style="color:#666;">' + stock.code + '</small></td>';
    html += '<td style="padding:10px; text-align:right;"><strong style="color:#3b82f6;">' + stock.finalWeight.toFixed(1) + '%</strong></td>';
    html += '<td style="padding:10px; text-align:right;">' + investAmount.toFixed(0) + '만원</td>';
    html += '<td style="padding:10px; text-align:right;">' + shares.toLocaleString() + '주</td>';
    html += '<td style="padding:10px; text-align:right;">' + stock.volatility.toFixed(2) + '%</td>';
    html += '<td style="padding:10px; text-align:right;">' + stock.techScore.toFixed(0) + '점</td>';
    html += '</tr>';
  });
  
  html += '</tbody></table>';
  html += '</div>';
  
  // 비중 시각화 (막대그래프)
  html += '<div style="margin-top:20px;">';
  html += '<h4>📈 비중 시각화</h4>';
  html += '<div style="margin-top:10px;">';
  
  weights.stocks.forEach(function(stock) {
    var barWidth = stock.finalWeight;
    var barColor = stock.techScore >= 70 ? '#22c55e' : stock.techScore >= 50 ? '#3b82f6' : '#f59e0b';
    
    html += '<div style="margin-bottom:8px;">';
    html += '<div style="display:flex; justify-content:space-between; margin-bottom:3px;">';
    html += '<span>' + stock.name + '</span>';
    html += '<span><strong>' + stock.finalWeight.toFixed(1) + '%</strong></span>';
    html += '</div>';
    html += '<div style="background:#e2e8f0; border-radius:4px; height:20px;">';
    html += '<div style="background:' + barColor + '; width:' + barWidth + '%; height:100%; border-radius:4px;"></div>';
    html += '</div>';
    html += '</div>';
  });
  
  html += '</div>';
  html += '</div>';
  
  // 접히는 설명 패널 추가
  html += '<div style="margin-top:15px;">';
  html += '<button onclick="togglePortfolioGuide()" style="width:100%; padding:12px; background:#e0f2fe; border:1px solid #7dd3fc; border-radius:8px; cursor:pointer; font-weight:bold; text-align:left; display:flex; justify-content:space-between; align-items:center;">';
  html += '<span>📖 포트폴리오 구성 가이드</span>';
  html += '<span id="portfolioGuideToggle">▼</span>';
  html += '</button>';
  html += '<div id="portfolioGuideContent" style="display:none; padding:15px; background:#f0f9ff; border-radius:0 0 8px 8px; border:1px solid #7dd3fc; border-top:none; margin-top:-1px;">';
  
  // 분산투자 개념
  html += '<div style="margin-bottom:15px; padding:10px; background:white; border-radius:6px;">';
  html += '<h4 style="margin:0 0 10px 0; color:#3b82f6;">💼 포트폴리오 분산투자란?</h4>';
  html += '<ul style="margin:5px 0; padding-left:20px; line-height:1.8; font-size:0.9rem;">';
  html += '<li><strong>개념:</strong> "계란을 한 바구니에 담지 마라" → 여러 종목에 투자하여 리스크 분산</li>';
  html += '<li><strong>원리:</strong> 한 종목이 하락해도 다른 종목이 상승하면 손실 완화</li>';
  html += '<li><strong>효과:</strong> 개별 종목 리스크는 높아도 포트폴리오 전체는 안정적</li>';
  html += '<li><strong>권장:</strong> 최소 5~10개 종목, 다양한 산업/섹터 조합</li>';
  html += '<li><strong>주의:</strong> 과도한 분산(30개 이상)은 관리 어려움 + 수익률 희석</li>';
  html += '</ul>';
  html += '</div>';
  
  // 비중 계산 방식
  html += '<div style="margin-bottom:15px; padding:10px; background:white; border-radius:6px;">';
  html += '<h4 style="margin:0 0 10px 0; color:#7c3aed;">⚖️ 최적 비중 계산 방식</h4>';
  html += '<ul style="margin:5px 0; padding-left:20px; line-height:1.8; font-size:0.9rem;">';
  html += '<li><strong>역변동성 가중:</strong> 변동성이 낮은 종목에 더 많은 비중 → 안정성 확보</li>';
  html += '<li><strong>예시:</strong> 변동성 1% 종목은 30%, 변동성 3% 종목은 10% 배분</li>';
  html += '<li><strong>기술점수 조정:</strong> RSI, MACD 등 기술적 지표가 좋은 종목에 가산점</li>';
  html += '<li><strong>균형 유지:</strong> 한 종목이 40% 이상 차지하지 않도록 제한</li>';
  html += '<li><strong>결과:</strong> 리스크는 낮추고, 수익 잠재력은 유지</li>';
  html += '</ul>';
  html += '</div>';
  
  // 상관관계
  html += '<div style="margin-bottom:15px; padding:10px; background:white; border-radius:6px;">';
  html += '<h4 style="margin:0 0 10px 0; color:#16a34a;">🔗 상관관계 (Correlation)</h4>';
  html += '<ul style="margin:5px 0; padding-left:20px; line-height:1.8; font-size:0.9rem;">';
  html += '<li><strong>의미:</strong> 두 종목의 가격이 함께 움직이는 정도 (-1 ~ +1)</li>';
  html += '<li><strong>높은 상관(+0.7~+1):</strong> 같이 오르고 내림 → 분산효과 낮음</li>';
  html += '<li><strong>낮은 상관(-0.3~+0.3):</strong> 독립적 움직임 → 분산효과 높음</li>';
  html += '<li><strong>역상관(-1~-0.7):</strong> 반대로 움직임 → 최고의 분산효과</li>';
  html += '<li><strong>예시:</strong> 반도체 + 조선 (낮은 상관), 삼성전자 + SK하이닉스 (높은 상관)</li>';
  html += '<li><strong>전략:</strong> 상관관계가 낮은 종목들을 조합하면 리스크 대폭 감소</li>';
  html += '</ul>';
  html += '</div>';
  
  // 리밸런싱
  html += '<div style="margin-bottom:15px; padding:10px; background:white; border-radius:6px;">';
  html += '<h4 style="margin:0 0 10px 0; color:#ea580c;">🔄 리밸런싱 (Rebalancing)</h4>';
  html += '<ul style="margin:5px 0; padding-left:20px; line-height:1.8; font-size:0.9rem;">';
  html += '<li><strong>의미:</strong> 시간이 지나 비중이 변한 포트폴리오를 원래 비중으로 재조정</li>';
  html += '<li><strong>필요성:</strong> A종목 20% → 35% 상승 시, 리스크 과다 노출</li>';
  html += '<li><strong>방법:</strong> 비중 높아진 종목 일부 매도 → 비중 낮아진 종목 매수</li>';
  html += '<li><strong>주기:</strong> 분기별(3개월) 또는 반기별(6개월) 점검 권장</li>';
  html += '<li><strong>기준:</strong> 초기 비중 대비 ±5%p 이상 차이 나면 조정</li>';
  html += '<li><strong>효과:</strong> 고점 매도 + 저점 매수 효과, 리스크 일정하게 유지</li>';
  html += '</ul>';
  html += '</div>';
  
  // 포트폴리오 평가 지표
  html += '<div style="margin-bottom:15px; padding:10px; background:white; border-radius:6px;">';
  html += '<h4 style="margin:0 0 10px 0; color:#dc2626;">📊 포트폴리오 평가 지표</h4>';
  html += '<ul style="margin:5px 0; padding-left:20px; line-height:1.8; font-size:0.9rem;">';
  html += '<li><strong>평균 변동성:</strong> 포트폴리오 전체의 가격 변동 정도 → 낮을수록 안정적</li>';
  html += '<li><strong>평균 기술점수:</strong> 각 종목의 기술적 분석 점수 평균 → 높을수록 좋은 타이밍</li>';
  html += '<li><strong>샤프 비율:</strong> (수익률 - 무위험수익률) ÷ 변동성 → 높을수록 효율적</li>';
  html += '<li><strong>최대낙폭(MDD):</strong> 고점 대비 최대 하락률 → 낮을수록 안전</li>';
  html += '<li><strong>목표:</strong> 변동성은 낮추고, 기술점수는 높이기</li>';
  html += '</ul>';
  html += '</div>';
  
  // 투자 전략
  html += '<div style="padding:10px; background:white; border-radius:6px;">';
  html += '<h4 style="margin:0 0 10px 0; color:#0891b2;">💡 포트폴리오 투자 전략</h4>';
  html += '<ul style="margin:5px 0; padding-left:20px; line-height:1.8; font-size:0.9rem;">';
  html += '<li><strong>초기 구성:</strong> 추천 비중대로 분할 매수 (한번에 올인 금지)</li>';
  html += '<li><strong>섹터 분산:</strong> IT, 금융, 소비재, 에너지 등 다양한 산업 포함</li>';
  html += '<li><strong>대형주 + 중소형주:</strong> 대형주 60~70% (안정성) + 중소형주 30~40% (성장성)</li>';
  html += '<li><strong>정기 점검:</strong> 월 1회 수익률 확인, 분기 1회 리밸런싱</li>';
  html += '<li><strong>손절 기준:</strong> 개별 종목 -20% 또는 포트폴리오 전체 -15% 시 재검토</li>';
  html += '<li><strong>장기 관점:</strong> 최소 6개월~1년 보유 전제, 단기 변동에 흔들리지 않기</li>';
  html += '</ul>';
  html += '</div>';
  
  // 중요 안내
  html += '<div style="margin-top:15px; padding:10px; background:#fef3c7; border-radius:6px; border-left:4px solid #f59e0b;">';
  html += '<p style="margin:0; font-size:0.85rem; color:#92400e; line-height:1.6;">';
  html += '<strong>⚠️ 포트폴리오 투자 유의사항:</strong><br>';
  html += '• AI 추천 비중은 과거 데이터 기반이며, 미래 수익을 보장하지 않습니다<br>';
  html += '• 개인의 투자 성향, 목표 수익률, 위험 감수 능력에 따라 조정하세요<br>';
  html += '• 추천 비중은 참고용이며, 시장 상황 변화 시 유연하게 대응하세요<br>';
  html += '• 분산투자도 시장 전체 하락 시 손실을 막지는 못합니다';
  html += '</p>';
  html += '</div>';
  
  html += '</div>';
  html += '</div>';
  
  html += '</div>';
  container.innerHTML = html;
}

// 포트폴리오 가이드 토글 함수
function togglePortfolioGuide() {
  var content = document.getElementById('portfolioGuideContent');
  var toggle = document.getElementById('portfolioGuideToggle');
  
  if (content.style.display === 'none') {
    content.style.display = 'block';
    toggle.textContent = '▲';
  } else {
    content.style.display = 'none';
    toggle.textContent = '▼';
  }
}


// ==================== 차트 패턴 가이드 토글 ====================
// 한국 주식 패턴 가이드
function togglePatternGuide() {
  var content = document.getElementById('patternGuideContent');
  var toggle = document.getElementById('patternGuideToggle');
  
  if (content.style.display === 'none') {
    content.style.display = 'block';
    toggle.textContent = '▲';
  } else {
    content.style.display = 'none';
    toggle.textContent = '▼';
  }
}

// 미국 주식 패턴 가이드
function toggleUsPatternGuide() {
  var content = document.getElementById('usPatternGuideContent');
  var toggle = document.getElementById('usPatternGuideToggle');
  
  if (content.style.display === 'none') {
    content.style.display = 'block';
    toggle.textContent = '▲';
  } else {
    content.style.display = 'none';
    toggle.textContent = '▼';
  }
}


// RSI 가이드 토글 함수
function toggleRsiGuide() {
  var content = document.getElementById('rsiGuideContent');
  var toggle = document.getElementById('rsiGuideToggle');
  
  if (content.style.display === 'none') {
    content.style.display = 'block';
    toggle.textContent = '▲';
  } else {
    content.style.display = 'none';
    toggle.textContent = '▼';
  }
}


// MACD 가이드 토글 함수
function toggleMacdGuide() {
  var content = document.getElementById('macdGuideContent');
  var toggle = document.getElementById('macdGuideToggle');
  
  if (content.style.display === 'none') {
    content.style.display = 'block';
    toggle.textContent = '▲';
  } else {
    content.style.display = 'none';
    toggle.textContent = '▼';
  }
}


// 스토캐스틱 가이드 토글 함수
function toggleStochasticGuide() {
  var content = document.getElementById('stochasticGuideContent');
  var toggle = document.getElementById('stochasticGuideToggle');
  
  if (content.style.display === 'none') {
    content.style.display = 'block';
    toggle.textContent = '▲';
  } else {
    content.style.display = 'none';
    toggle.textContent = '▼';
  }
}


// ATR 가이드 토글 함수
function toggleAtrGuide() {
  var content = document.getElementById('atrGuideContent');
  var toggle = document.getElementById('atrGuideToggle');
  
  if (content.style.display === 'none') {
    content.style.display = 'block';
    toggle.textContent = '▲';
  } else {
    content.style.display = 'none';
    toggle.textContent = '▼';
  }
}


// 미국 RSI 가이드 토글 함수
function toggleUsRsiGuide() {
  var content = document.getElementById('usRsiGuideContent');
  var toggle = document.getElementById('usRsiGuideToggle');
  
  if (content.style.display === 'none') {
    content.style.display = 'block';
    toggle.textContent = '▲';
  } else {
    content.style.display = 'none';
    toggle.textContent = '▼';
  }
}


// 미국 MACD 가이드 토글 함수
function toggleUsMacdGuide() {
  var content = document.getElementById('usMacdGuideContent');
  var toggle = document.getElementById('usMacdGuideToggle');
  
  if (content.style.display === 'none') {
    content.style.display = 'block';
    toggle.textContent = '▲';
  } else {
    content.style.display = 'none';
    toggle.textContent = '▼';
  }
}


// 미국 스토캐스틱 가이드 토글 함수
function toggleUsStochasticGuide() {
  var content = document.getElementById('usStochasticGuideContent');
  var toggle = document.getElementById('usStochasticGuideToggle');
  
  if (content.style.display === 'none') {
    content.style.display = 'block';
    toggle.textContent = '▲';
  } else {
    content.style.display = 'none';
    toggle.textContent = '▼';
  }
}


// 미국 ATR 가이드 토글 함수
function toggleUsAtrGuide() {
  var content = document.getElementById('usAtrGuideContent');
  var toggle = document.getElementById('usAtrGuideToggle');
  
  if (content.style.display === 'none') {
    content.style.display = 'block';
    toggle.textContent = '▲';
  } else {
    content.style.display = 'none';
    toggle.textContent = '▼';
  }
}


// ==================== AI 뉴스 감성 분석 ====================
async function analyzeAiSentiment() {
  var input = document.getElementById('ai-sentiment-input').value.trim();
  
  if (!input) {
    alert('종목명 또는 종목코드를 입력하세요.');
    return;
  }
  
  showLoading();
  
  var container = document.getElementById('ai-sentiment-result');
  container.innerHTML = '<p>🤖 뉴스 감성 분석 중...</p>';
  
  try {
    // 종목코드 찾기
    var stockCode = await findStockCode(input);
    
    if (!stockCode) {
      container.innerHTML = '<p>종목을 찾을 수 없습니다: ' + input + '</p>';
      hideLoading();
      return;
    }
    
    // 종목 정보 조회
    var stockResult = await apiCall('/api/korea/stock/' + stockCode);
    var stockName = stockResult.success ? stockResult.data.name : input;
    
    // 뉴스 조회
    var newsResult = await apiCall('/api/korea/news/' + encodeURIComponent(stockName));
    
    if (!newsResult.success || !newsResult.data || newsResult.data.length === 0) {
      container.innerHTML = '<p>뉴스를 찾을 수 없습니다.</p>';
      hideLoading();
      return;
    }
    
    // 감성 분석
    var sentiment = analyzeSentiment(newsResult.data);
    
    // 결과 표시
    displaySentimentResult(stockName, stockCode, newsResult.data, sentiment);
    
  } catch (error) {
    console.error('뉴스 감성 분석 오류:', error);
    container.innerHTML = '<p>분석 중 오류가 발생했습니다.</p>';
  }
  
  hideLoading();
}

// 감성 분석
function analyzeSentiment(newsList) {
  // 긍정/부정 키워드 정의
  var positiveKeywords = [
    '상승', '급등', '신고가', '호재', '성장', '증가', '흑자', '개선', '돌파', '강세',
    '회복', '반등', '최고', '상향', '호실적', '수주', '계약', '투자', '확대', '기대',
    '성공', '혁신', '긍정', '추천', '매수', '목표가', '상승세', '호조', '낙관', '기록',
    '돌풍', '대박', '수혜', '특수', '급증', '흥행', '히트', '인기', '품절', '완판'
  ];
  
  var negativeKeywords = [
    '하락', '급락', '폭락', '악재', '감소', '적자', '손실', '하향', '부진', '약세',
    '우려', '리스크', '위기', '경고', '매도', '하한가', '실패', '철회', '취소', '지연',
    '소송', '제재', '처벌', '비판', '논란', '충격', '붕괴', '침체', '불황', '파산',
    '조사', '수사', '압수수색', '횡령', '배임', '사기', '부실', '결함', '리콜', '퇴출'
  ];
  
  var results = [];
  var positiveCount = 0;
  var negativeCount = 0;
  var neutralCount = 0;
  
  newsList.forEach(function(news) {
    var title = news.title || '';
    var score = 0;
    var matchedPositive = [];
    var matchedNegative = [];
    
    // 긍정 키워드 검색
    positiveKeywords.forEach(function(keyword) {
      if (title.includes(keyword)) {
        score += 1;
        matchedPositive.push(keyword);
      }
    });
    
    // 부정 키워드 검색
    negativeKeywords.forEach(function(keyword) {
      if (title.includes(keyword)) {
        score -= 1;
        matchedNegative.push(keyword);
      }
    });
    
    // 감성 판정
    var sentiment = 'neutral';
    if (score > 0) {
      sentiment = 'positive';
      positiveCount++;
    } else if (score < 0) {
      sentiment = 'negative';
      negativeCount++;
    } else {
      neutralCount++;
    }
    
    results.push({
      title: title,
      date: news.date || '',
      source: news.source || '',
      sentiment: sentiment,
      score: score,
      matchedPositive: matchedPositive,
      matchedNegative: matchedNegative
    });
  });
  
  // 전체 감성 점수 계산
  var totalScore = positiveCount - negativeCount;
  var totalNews = newsList.length;
  
  var overallSentiment = '';
  var sentimentClass = '';
  
  if (totalScore >= 3) {
    overallSentiment = '🟢 매우 긍정적';
    sentimentClass = 'positive';
  } else if (totalScore >= 1) {
    overallSentiment = '🔵 긍정적';
    sentimentClass = 'positive';
  } else if (totalScore <= -3) {
    overallSentiment = '🔴 매우 부정적';
    sentimentClass = 'negative';
  } else if (totalScore <= -1) {
    overallSentiment = '🟠 부정적';
    sentimentClass = 'negative';
  } else {
    overallSentiment = '⚪ 중립';
    sentimentClass = '';
  }
  
  return {
    results: results,
    positiveCount: positiveCount,
    negativeCount: negativeCount,
    neutralCount: neutralCount,
    totalScore: totalScore,
    overallSentiment: overallSentiment,
    sentimentClass: sentimentClass,
    positivePercent: totalNews > 0 ? (positiveCount / totalNews * 100) : 0,
    negativePercent: totalNews > 0 ? (negativeCount / totalNews * 100) : 0,
    neutralPercent: totalNews > 0 ? (neutralCount / totalNews * 100) : 0
  };
}

// 감성 분석 결과 표시
function displaySentimentResult(stockName, stockCode, newsList, sentiment) {
  var container = document.getElementById('ai-sentiment-result');
  
  var html = '<div class="card">';
  html += '<h3>📰 ' + stockName + ' (' + stockCode + ') 뉴스 감성 분석</h3>';
  
  // 종합 감성
  html += '<div style="text-align:center; padding:20px; background:#f8fafc; border-radius:8px; margin:15px 0;">';
  html += '<p style="color:#666; margin-bottom:10px;">종합 뉴스 감성</p>';
  html += '<p style="font-size:2rem; font-weight:bold;" class="' + sentiment.sentimentClass + '">' + sentiment.overallSentiment + '</p>';
  html += '<p style="color:#666;">분석 뉴스: <strong>' + newsList.length + '개</strong></p>';
  html += '</div>';
  
  // 감성 비율
  html += '<div class="indicators-grid" style="margin-top:15px;">';
  html += '<div class="indicator-card" style="background:#dcfce7;"><div class="label">긍정</div><div class="value" style="color:#166534;">' + sentiment.positiveCount + '개 (' + sentiment.positivePercent.toFixed(0) + '%)</div></div>';
  html += '<div class="indicator-card" style="background:#f3f4f6;"><div class="label">중립</div><div class="value" style="color:#666;">' + sentiment.neutralCount + '개 (' + sentiment.neutralPercent.toFixed(0) + '%)</div></div>';
  html += '<div class="indicator-card" style="background:#fee2e2;"><div class="label">부정</div><div class="value" style="color:#991b1b;">' + sentiment.negativeCount + '개 (' + sentiment.negativePercent.toFixed(0) + '%)</div></div>';
  html += '</div>';
  
  // 감성 바 그래프
  html += '<div style="margin-top:15px; background:#e2e8f0; border-radius:8px; height:30px; display:flex; overflow:hidden;">';
  if (sentiment.positivePercent > 0) {
    html += '<div style="background:#22c55e; width:' + sentiment.positivePercent + '%; display:flex; align-items:center; justify-content:center; color:white; font-size:0.8rem;">' + (sentiment.positivePercent >= 15 ? sentiment.positivePercent.toFixed(0) + '%' : '') + '</div>';
  }
  if (sentiment.neutralPercent > 0) {
    html += '<div style="background:#9ca3af; width:' + sentiment.neutralPercent + '%; display:flex; align-items:center; justify-content:center; color:white; font-size:0.8rem;">' + (sentiment.neutralPercent >= 15 ? sentiment.neutralPercent.toFixed(0) + '%' : '') + '</div>';
  }
  if (sentiment.negativePercent > 0) {
    html += '<div style="background:#ef4444; width:' + sentiment.negativePercent + '%; display:flex; align-items:center; justify-content:center; color:white; font-size:0.8rem;">' + (sentiment.negativePercent >= 15 ? sentiment.negativePercent.toFixed(0) + '%' : '') + '</div>';
  }
  html += '</div>';
  
  // 뉴스 목록
  html += '<div style="margin-top:20px;">';
  html += '<h4>📋 뉴스별 감성 분석</h4>';
  html += '<div style="max-height:400px; overflow-y:auto; margin-top:10px;">';
  
  sentiment.results.forEach(function(news) {
    var bgColor = '#f8fafc';
    var borderColor = '#e2e8f0';
    var icon = '⚪';
    
    if (news.sentiment === 'positive') {
      bgColor = '#dcfce7';
      borderColor = '#86efac';
      icon = '🟢';
    } else if (news.sentiment === 'negative') {
      bgColor = '#fee2e2';
      borderColor = '#fca5a5';
      icon = '🔴';
    }
    
    html += '<div style="padding:12px; background:' + bgColor + '; border:1px solid ' + borderColor + '; border-radius:8px; margin-bottom:8px;">';
    html += '<div style="display:flex; gap:10px;">';
    html += '<span style="font-size:1.2rem;">' + icon + '</span>';
    html += '<div style="flex:1;">';
    html += '<p style="margin:0; font-size:0.95rem;">' + news.title + '</p>';
    html += '<p style="margin:5px 0 0; font-size:0.8rem; color:#666;">' + news.source + ' | ' + news.date + '</p>';
    
    // 감지된 키워드 표시
    if (news.matchedPositive.length > 0 || news.matchedNegative.length > 0) {
      html += '<p style="margin:5px 0 0; font-size:0.8rem;">';
      if (news.matchedPositive.length > 0) {
        html += '<span style="color:#166534;">긍정: ' + news.matchedPositive.join(', ') + '</span> ';
      }
      if (news.matchedNegative.length > 0) {
        html += '<span style="color:#991b1b;">부정: ' + news.matchedNegative.join(', ') + '</span>';
      }
      html += '</p>';
    }
    
    html += '</div>';
    html += '</div>';
    html += '</div>';
  });
  
  html += '</div>';
  html += '</div>';
  
  // 투자 참고 사항
  html += '<div style="margin-top:15px; padding:15px; background:#fef3c7; border-radius:8px;">';
  html += '<h4>⚠️ 투자 참고 사항</h4>';
  html += '<ul style="margin:10px 0 0 20px; color:#666; font-size:0.9rem;">';
  html += '<li>뉴스 감성은 키워드 기반 분석으로 100% 정확하지 않을 수 있습니다</li>';
  html += '<li>긍정적 뉴스가 많아도 이미 주가에 반영되었을 수 있습니다</li>';
  html += '<li>뉴스 감성은 참고 지표로만 활용하세요</li>';
  html += '</ul>';
  html += '</div>';
  
  html += '</div>';
  container.innerHTML = html;
}


// ==================== 미국 AI 매매 타이밍 ====================
async function analyzeUsAiTiming() {
  var input = document.getElementById('us-ai-input').value.trim().toUpperCase();
  
  if (!input) {
    alert('심볼을 입력하세요. (예: AAPL)');
    return;
  }
  
  showLoading();
  
  var container = document.getElementById('us-ai-result');
  container.innerHTML = '<p>🤖 매매 타이밍 분석 중...</p>';
  
  try {
    // 기술적 분석 데이터 조회
    var techResult = await apiCall('/api/us/analysis/' + input);
    
    if (!techResult.success) {
      container.innerHTML = '<p>분석 데이터를 가져올 수 없습니다: ' + input + '</p>';
      hideLoading();
      return;
    }
    
    var tech = techResult.data;
    
    // 매매 타이밍 신호 분석
    var signals = analyzeUsTimingSignals(tech);
    
    // 결과 표시
    displayUsTimingResult(input, tech, signals);
    
  } catch (error) {
    console.error('미국 매매 타이밍 분석 오류:', error);
    container.innerHTML = '<p>분석 중 오류가 발생했습니다.</p>';
  }
  
  hideLoading();
}

// 미국 타이밍 신호 분석
function analyzeUsTimingSignals(tech) {
  var buySignals = [];
  var sellSignals = [];
  var score = 0;
  
  // 1. RSI 분석
  var rsi = tech.rsi || 50;
  if (rsi < 30) {
    buySignals.push('RSI 과매도 구간 (' + rsi.toFixed(1) + ')');
    score += 2;
  } else if (rsi < 40) {
    buySignals.push('RSI 매수 유리 구간 (' + rsi.toFixed(1) + ')');
    score += 1;
  } else if (rsi > 70) {
    sellSignals.push('RSI 과매수 구간 (' + rsi.toFixed(1) + ')');
    score -= 2;
  } else if (rsi > 60) {
    sellSignals.push('RSI 매도 고려 구간 (' + rsi.toFixed(1) + ')');
    score -= 1;
  }
  
  // 2. MACD 분석
  var macd = tech.macd ? tech.macd.macd : 0;
  var macdSignal = tech.macd ? tech.macd.signal : 0;
  var macdHist = tech.macd ? tech.macd.histogram : 0;
  
  if (macd > macdSignal && macdHist > 0) {
    buySignals.push('MACD 골든크로스 상태');
    score += 2;
  } else if (macd < macdSignal && macdHist < 0) {
    sellSignals.push('MACD 데드크로스 상태');
    score -= 2;
  }
  
  // 3. 이동평균선 분석
  var price = tech.currentPrice || 0;
  var ma20 = tech.ma20 || 0;
  var ma60 = tech.ma60 || 0;
  
  if (price > ma20 && ma20 > ma60) {
    buySignals.push('정배열 (상승추세)');
    score += 2;
  } else if (price < ma20 && ma20 < ma60) {
    sellSignals.push('역배열 (하락추세)');
    score -= 2;
  }
  
  if (price > ma20 && price > ma60) {
    buySignals.push('주가가 이동평균선 위');
    score += 1;
  } else if (price < ma20 && price < ma60) {
    sellSignals.push('주가가 이동평균선 아래');
    score -= 1;
  }
  
  // 4. 기존 신호 활용
  if (tech.signal === 'STRONG_BUY') {
    buySignals.push('기술적 강력 매수 신호');
    score += 2;
  } else if (tech.signal === 'BUY') {
    buySignals.push('기술적 매수 신호');
    score += 1;
  } else if (tech.signal === 'STRONG_SELL') {
    sellSignals.push('기술적 강력 매도 신호');
    score -= 2;
  } else if (tech.signal === 'SELL') {
    sellSignals.push('기술적 매도 신호');
    score -= 1;
  }
  
  // 종합 판단
  var recommendation = '';
  var recClass = '';
  
  if (score >= 5) {
    recommendation = '🟢 강력 매수';
    recClass = 'positive';
  } else if (score >= 2) {
    recommendation = '🔵 매수 고려';
    recClass = 'positive';
  } else if (score <= -5) {
    recommendation = '🔴 강력 매도';
    recClass = 'negative';
  } else if (score <= -2) {
    recommendation = '🟠 매도 고려';
    recClass = 'negative';
  } else {
    recommendation = '⚪ 관망';
    recClass = '';
  }
  
  return {
    buySignals: buySignals,
    sellSignals: sellSignals,
    score: score,
    recommendation: recommendation,
    recClass: recClass
  };
}


// 미국 타이밍 결과 표시
function displayUsTimingResult(symbol, tech, signals) {
  var container = document.getElementById('us-ai-result');
  
  var html = '<div class="card">';
  html += '<h3>⏰ ' + symbol + ' 매매 타이밍</h3>';
  
  // 종합 판단
  html += '<div style="text-align:center; padding:20px; background:#f8fafc; border-radius:8px; margin:15px 0;">';
  html += '<p style="color:#666; margin-bottom:10px;">AI 타이밍 판단</p>';
  html += '<p style="font-size:2rem; font-weight:bold;" class="' + signals.recClass + '">' + signals.recommendation + '</p>';
  html += '<p style="color:#666;">타이밍 점수: <strong style="font-size:1.3rem;">' + signals.score.toFixed(1) + '점</strong></p>';
  html += '</div>';
  
  // 현재 지표
  html += '<div class="indicators-grid" style="margin-top:15px;">';
  html += '<div class="indicator-card"><div class="label">현재가</div><div class="value">$' + (tech.currentPrice ? tech.currentPrice.toFixed(2) : '--') + '</div></div>';
  html += '<div class="indicator-card"><div class="label">RSI</div><div class="value">' + (tech.rsi ? tech.rsi.toFixed(1) : '--') + '</div></div>';
  html += '<div class="indicator-card"><div class="label">MACD</div><div class="value">' + (tech.macd ? tech.macd.macd.toFixed(2) : '--') + '</div></div>';
  html += '<div class="indicator-card"><div class="label">기술점수</div><div class="value">' + (tech.technicalScore || 0) + '점</div></div>';
  html += '</div>';
  
  // 매수 신호
  if (signals.buySignals.length > 0) {
    html += '<div style="margin-top:15px; padding:15px; background:#dcfce7; border-radius:8px;">';
    html += '<h4 style="color:#166534;">📈 매수 신호</h4><ul style="margin:10px 0 0 20px;">';
    signals.buySignals.forEach(function(s) {
      html += '<li style="color:#166534;">' + s + '</li>';
    });
    html += '</ul></div>';
  }
  
  // 매도 신호
  if (signals.sellSignals.length > 0) {
    html += '<div style="margin-top:15px; padding:15px; background:#fee2e2; border-radius:8px;">';
    html += '<h4 style="color:#991b1b;">📉 매도 신호</h4><ul style="margin:10px 0 0 20px;">';
    signals.sellSignals.forEach(function(s) {
      html += '<li style="color:#991b1b;">' + s + '</li>';
    });
    html += '</ul></div>';
  }
  
  // 접히는 설명 패널 추가
  html += '<div style="margin-top:15px;">';
  html += '<button onclick="toggleUsTimingGuide()" style="width:100%; padding:12px; background:#e0f2fe; border:1px solid #7dd3fc; border-radius:8px; cursor:pointer; font-weight:bold; text-align:left; display:flex; justify-content:space-between; align-items:center;">';
  html += '<span>📖 매매 타이밍 해석 가이드</span>';
  html += '<span id="usTimingGuideToggle">▼</span>';
  html += '</button>';
  html += '<div id="usTimingGuideContent" style="display:none; padding:15px; background:#f0f9ff; border-radius:0 0 8px 8px; border:1px solid #7dd3fc; border-top:none; margin-top:-1px;">';
  
  // RSI 설명
  html += '<div style="margin-bottom:15px; padding:10px; background:white; border-radius:6px;">';
  html += '<h4 style="margin:0 0 10px 0; color:#3b82f6;">📊 RSI (Relative Strength Index)</h4>';
  html += '<ul style="margin:5px 0; padding-left:20px; line-height:1.8; font-size:0.9rem;">';
  html += '<li><strong>의미:</strong> 과매수/과매도 판단 지표 (0~100)</li>';
  html += '<li><strong>70 이상:</strong> 과매수 구간 → 조정 가능성 (매도 고려)</li>';
  html += '<li><strong>30 이하:</strong> 과매도 구간 → 반등 가능성 (매수 고려)</li>';
  html += '<li><strong>50 근처:</strong> 중립 구간 → 관망</li>';
  html += '<li><strong>활용:</strong> 다른 지표와 함께 종합 판단</li>';
  html += '</ul>';
  html += '</div>';
  
  // MACD 설명
  html += '<div style="margin-bottom:15px; padding:10px; background:white; border-radius:6px;">';
  html += '<h4 style="margin:0 0 10px 0; color:#3b82f6;">📈 MACD (Moving Average Convergence Divergence)</h4>';
  html += '<ul style="margin:5px 0; padding-left:20px; line-height:1.8; font-size:0.9rem;">';
  html += '<li><strong>의미:</strong> 추세의 방향과 강도를 파악하는 지표</li>';
  html += '<li><strong>골든크로스:</strong> MACD선이 시그널선을 상향 돌파 → 매수 신호</li>';
  html += '<li><strong>데드크로스:</strong> MACD선이 시그널선을 하향 돌파 → 매도 신호</li>';
  html += '<li><strong>0선 돌파:</strong> 상승 추세 전환 신호</li>';
  html += '<li><strong>히스토그램:</strong> 양수 확대 시 상승 강화, 음수 확대 시 하락 강화</li>';
  html += '</ul>';
  html += '</div>';
  
  // 거래량 설명
  html += '<div style="margin-bottom:15px; padding:10px; background:white; border-radius:6px;">';
  html += '<h4 style="margin:0 0 10px 0; color:#3b82f6;">📊 거래량 (Volume)</h4>';
  html += '<ul style="margin:5px 0; padding-left:20px; line-height:1.8; font-size:0.9rem;">';
  html += '<li><strong>의미:</strong> 매매 활동의 활발함을 나타냄</li>';
  html += '<li><strong>거래량 증가 + 상승:</strong> 강한 매수세 → 상승 지속 가능성</li>';
  html += '<li><strong>거래량 증가 + 하락:</strong> 강한 매도세 → 추가 하락 주의</li>';
  html += '<li><strong>거래량 감소:</strong> 관심 부족 → 추세 전환 가능성</li>';
  html += '<li><strong>평균 거래량 대비 2배 이상:</strong> 평소보다 활발한 매매</li>';
  html += '</ul>';
  html += '</div>';
  
  // 타이밍 점수 설명
  html += '<div style="margin-bottom:15px; padding:10px; background:white; border-radius:6px;">';
  html += '<h4 style="margin:0 0 10px 0; color:#3b82f6;">🎯 타이밍 점수란?</h4>';
  html += '<ul style="margin:5px 0; padding-left:20px; line-height:1.8; font-size:0.9rem;">';
  html += '<li><strong>70점 이상:</strong> 강한 매수 타이밍 (적극 매수 고려)</li>';
  html += '<li><strong>30점 이하:</strong> 강한 매도 타이밍 (손절/익절 고려)</li>';
  html += '<li><strong>40-60점:</strong> 중립 구간 (관망 추천)</li>';
  html += '<li><strong>계산 방식:</strong> RSI, MACD, 이동평균선, 거래량 등을 종합 분석</li>';
  html += '<li><strong>주의:</strong> 100% 정확한 예측은 불가능, 참고 자료로 활용</li>';
  html += '</ul>';
  html += '</div>';
  
  // 신호 해석 방법
  html += '<div style="padding:10px; background:white; border-radius:6px;">';
  html += '<h4 style="margin:0 0 10px 0; color:#3b82f6;">🔍 매수/매도 신호 해석</h4>';
  html += '<ul style="margin:5px 0; padding-left:20px; line-height:1.8; font-size:0.9rem;">';
  html += '<li><strong>복수 매수 신호:</strong> 신뢰도 증가 (2개 이상 시 강한 매수)</li>';
  html += '<li><strong>복수 매도 신호:</strong> 위험도 증가 (2개 이상 시 강한 매도)</li>';
  html += '<li><strong>혼재 신호:</strong> 방향성 불확실 (추가 관찰 필요)</li>';
  html += '<li><strong>신호 없음:</strong> 중립 구간 (급하지 않다면 관망)</li>';
  html += '</ul>';
  html += '</div>';
  
  // 중요 안내
  html += '<div style="margin-top:15px; padding:10px; background:#fef3c7; border-radius:6px; border-left:4px solid #f59e0b;">';
  html += '<p style="margin:0; font-size:0.85rem; color:#92400e; line-height:1.6;">';
  html += '<strong>⚠️ 투자 유의사항:</strong><br>';
  html += '• 매매 타이밍은 참고 자료일 뿐, 100% 정확하지 않습니다<br>';
  html += '• 시장 상황, 뉴스, 재무제표 등을 함께 고려하세요<br>';
  html += '• 분할 매수/매도로 리스크를 분산하세요<br>';
  html += '• 손절가를 반드시 설정하여 큰 손실을 방지하세요';
  html += '</p>';
  html += '</div>';
  
  html += '</div>';
  html += '</div>';
  
  html += '</div>';
  container.innerHTML = html;
}

// 미국 매매 타이밍 가이드 토글 함수
function toggleUsTimingGuide() {
  var content = document.getElementById('usTimingGuideContent');
  var toggle = document.getElementById('usTimingGuideToggle');
  
  if (content.style.display === 'none') {
    content.style.display = 'block';
    toggle.textContent = '▲';
  } else {
    content.style.display = 'none';
    toggle.textContent = '▼';
  }
}

// ==================== 미국 AI 리스크 분석 ====================
async function analyzeUsAiRisk() {
  var input = document.getElementById('us-ai-input').value.trim().toUpperCase();
  
  if (!input) {
    alert('심볼을 입력하세요. (예: AAPL)');
    return;
  }
  
  showLoading();
  
  var container = document.getElementById('us-ai-result');
  container.innerHTML = '<p>🤖 리스크 분석 중...</p>';
  
  try {
    var techResult = await apiCall('/api/us/analysis/' + input);
    
    if (!techResult.success) {
      container.innerHTML = '<p>분석 데이터를 가져올 수 없습니다: ' + input + '</p>';
      hideLoading();
      return;
    }
    
    var tech = techResult.data;
    var risk = calculateUsRisk(tech);
    
    displayUsRiskResult(input, tech, risk);
    
  } catch (error) {
    console.error('미국 리스크 분석 오류:', error);
    container.innerHTML = '<p>분석 중 오류가 발생했습니다.</p>';
  }
  
  hideLoading();
}

// 미국 리스크 계산
function calculateUsRisk(tech) {
  var price = tech.currentPrice || 0;
  var atr = tech.atr || 0;
  
  var volatilityPercent = price > 0 ? (atr / price * 100) : 0;
  
  // VaR 계산
  var dailyVaRPercent = volatilityPercent * 1.65;
  var weeklyVaRPercent = dailyVaRPercent * Math.sqrt(5);
  
  // 손절가/목표가 (API에서 제공하면 사용)
  var stopLoss = tech.stopLoss || (price - (atr * 2));
  var targetPrice = tech.targetPrice || (price + (atr * 3));
  var stopLossPercent = price > 0 ? ((price - stopLoss) / price * 100) : 0;
  var targetPercent = price > 0 ? ((targetPrice - price) / price * 100) : 0;
  
  // 리스크 등급
  var riskLevel = '';
  var riskClass = '';
  
  if (volatilityPercent >= 5) {
    riskLevel = '🔴 매우 높음';
    riskClass = 'negative';
  } else if (volatilityPercent >= 3) {
    riskLevel = '🟠 높음';
    riskClass = 'negative';
  } else if (volatilityPercent >= 2) {
    riskLevel = '🟡 보통';
    riskClass = '';
  } else {
    riskLevel = '🟢 낮음';
    riskClass = 'positive';
  }
  
  return {
    volatilityPercent: volatilityPercent,
    dailyVaRPercent: dailyVaRPercent,
    weeklyVaRPercent: weeklyVaRPercent,
    stopLoss: stopLoss,
    stopLossPercent: stopLossPercent,
    targetPrice: targetPrice,
    targetPercent: targetPercent,
    riskLevel: riskLevel,
    riskClass: riskClass,
    atr: atr
  };
}

// 미국 리스크 결과 표시
function displayUsRiskResult(symbol, tech, risk) {
  var container = document.getElementById('us-ai-result');
  
  var html = '<div class="card">';
  html += '<h3>⚠️ ' + symbol + ' 리스크 분석</h3>';
  
  // 리스크 등급
  html += '<div style="text-align:center; padding:20px; background:#f8fafc; border-radius:8px; margin:15px 0;">';
  html += '<p style="color:#666; margin-bottom:10px;">리스크 등급</p>';
  html += '<p style="font-size:2rem; font-weight:bold;" class="' + risk.riskClass + '">' + risk.riskLevel + '</p>';
  html += '<p style="color:#666;">일일 변동성: <strong>' + risk.volatilityPercent.toFixed(2) + '%</strong></p>';
  html += '</div>';
  
  // VaR 정보
  html += '<div class="indicators-grid" style="margin-top:15px;">';
  html += '<div class="indicator-card"><div class="label">현재가</div><div class="value">$' + tech.currentPrice.toFixed(2) + '</div></div>';
  html += '<div class="indicator-card"><div class="label">ATR (변동폭)</div><div class="value">$' + risk.atr.toFixed(2) + '</div></div>';
  html += '<div class="indicator-card"><div class="label">일일 VaR (95%)</div><div class="value negative">-' + risk.dailyVaRPercent.toFixed(1) + '%</div></div>';
  html += '<div class="indicator-card"><div class="label">주간 VaR (95%)</div><div class="value negative">-' + risk.weeklyVaRPercent.toFixed(1) + '%</div></div>';
  html += '</div>';
  
  // 손절가/목표가
  html += '<div class="indicators-grid" style="margin-top:15px;">';
  html += '<div class="indicator-card" style="background:#fee2e2;"><div class="label">🛑 권장 손절가</div><div class="value" style="color:#991b1b;">$' + risk.stopLoss.toFixed(2) + '<br><small>(-' + risk.stopLossPercent.toFixed(1) + '%)</small></div></div>';
  html += '<div class="indicator-card" style="background:#dcfce7;"><div class="label">🎯 권장 목표가</div><div class="value" style="color:#166534;">$' + risk.targetPrice.toFixed(2) + '<br><small>(+' + risk.targetPercent.toFixed(1) + '%)</small></div></div>';
  html += '</div>';
  
  // 투자금액별 예상 손실
  html += '<div style="margin-top:15px; padding:15px; background:#f0f9ff; border-radius:8px;">';
  html += '<h4>💰 투자금액별 일일 최대 예상 손실 (95% 신뢰도)</h4>';
  html += '<table style="width:100%; margin-top:10px; font-size:0.9rem;">';
  html += '<tr><td>$1,000 투자 시</td><td style="text-align:right; color:#991b1b;"><strong>-$' + (1000 * risk.dailyVaRPercent / 100).toFixed(2) + '</strong></td></tr>';
  html += '<tr><td>$5,000 투자 시</td><td style="text-align:right; color:#991b1b;"><strong>-$' + (5000 * risk.dailyVaRPercent / 100).toFixed(2) + '</strong></td></tr>';
  html += '<tr><td>$10,000 투자 시</td><td style="text-align:right; color:#991b1b;"><strong>-$' + (10000 * risk.dailyVaRPercent / 100).toFixed(2) + '</strong></td></tr>';
  html += '</table>';
  html += '</div>';
  
  // 접히는 설명 패널 추가
  html += '<div style="margin-top:15px;">';
  html += '<button onclick="toggleUsRiskGuide()" style="width:100%; padding:12px; background:#e0f2fe; border:1px solid #7dd3fc; border-radius:8px; cursor:pointer; font-weight:bold; text-align:left; display:flex; justify-content:space-between; align-items:center;">';
  html += '<span>📖 리스크 분석 해석 가이드</span>';
  html += '<span id="usRiskGuideToggle">▼</span>';
  html += '</button>';
  html += '<div id="usRiskGuideContent" style="display:none; padding:15px; background:#f0f9ff; border-radius:0 0 8px 8px; border:1px solid #7dd3fc; border-top:none; margin-top:-1px;">';
  
  // VaR 설명
  html += '<div style="margin-bottom:15px; padding:10px; background:white; border-radius:6px;">';
  html += '<h4 style="margin:0 0 10px 0; color:#dc2626;">📊 VaR (Value at Risk)</h4>';
  html += '<ul style="margin:5px 0; padding-left:20px; line-height:1.8; font-size:0.9rem;">';
  html += '<li><strong>의미:</strong> 특정 기간 동안 발생할 수 있는 최대 손실 금액 (통계적 예측)</li>';
  html += '<li><strong>95% 신뢰도:</strong> 100일 중 95일은 이 손실 범위 안에 있다는 의미</li>';
  html += '<li><strong>일일 VaR -3%:</strong> 하루에 3% 이상 손실이 날 확률은 5% (20일 중 1일)</li>';
  html += '<li><strong>주간 VaR -7%:</strong> 일주일에 7% 이상 손실이 날 확률은 5%</li>';
  html += '<li><strong>활용:</strong> 투자 금액 결정 시 감당 가능한 손실 범위 파악</li>';
  html += '</ul>';
  html += '</div>';
  
  // ATR 설명
  html += '<div style="margin-bottom:15px; padding:10px; background:white; border-radius:6px;">';
  html += '<h4 style="margin:0 0 10px 0; color:#ea580c;">📈 ATR (Average True Range)</h4>';
  html += '<ul style="margin:5px 0; padding-left:20px; line-height:1.8; font-size:0.9rem;">';
  html += '<li><strong>의미:</strong> 일정 기간(보통 14일) 동안의 평균 가격 변동폭</li>';
  html += '<li><strong>ATR $5:</strong> 하루에 평균 $5 정도 움직인다는 의미</li>';
  html += '<li><strong>높은 ATR:</strong> 변동성 큼 → 리스크 크지만 수익 기회도 큼</li>';
  html += '<li><strong>낮은 ATR:</strong> 변동성 작음 → 안정적이지만 수익률도 제한적</li>';
  html += '<li><strong>활용:</strong> 손절가/목표가 설정, 포지션 크기 결정</li>';
  html += '</ul>';
  html += '</div>';
  
  // 리스크 등급 설명
  html += '<div style="margin-bottom:15px; padding:10px; background:white; border-radius:6px;">';
  html += '<h4 style="margin:0 0 10px 0; color:#3b82f6;">⚠️ 리스크 등급</h4>';
  html += '<ul style="margin:5px 0; padding-left:20px; line-height:1.8; font-size:0.9rem;">';
  html += '<li><strong>높음 (일일 변동성 3% 이상):</strong> 하루에 큰 등락 가능 → 단기 트레이딩, 소액 투자</li>';
  html += '<li><strong>보통 (1.5~3%):</strong> 적당한 변동성 → 중기 투자 적합</li>';
  html += '<li><strong>낮음 (1.5% 미만):</strong> 안정적 → 장기 투자, 대량 투자 가능</li>';
  html += '<li><strong>초보자:</strong> 낮음~보통 등급 종목부터 시작 권장</li>';
  html += '</ul>';
  html += '</div>';
  
  // 손절가/목표가 설명
  html += '<div style="margin-bottom:15px; padding:10px; background:white; border-radius:6px;">';
  html += '<h4 style="margin:0 0 10px 0; color:#16a34a;">🎯 손절가 & 목표가</h4>';
  html += '<ul style="margin:5px 0; padding-left:20px; line-height:1.8; font-size:0.9rem;">';
  html += '<li><strong>손절가 (Stop Loss):</strong> 이 가격까지 떨어지면 무조건 매도하여 큰 손실 방지</li>';
  html += '<li><strong>계산법:</strong> 현재가 - (ATR × 2) → 평균 변동폭의 2배 하락 시</li>';
  html += '<li><strong>목표가 (Target Price):</strong> 이 가격까지 오르면 익절 고려</strong></li>';
  html += '<li><strong>계산법:</strong> 현재가 + (ATR × 3) → 평균 변동폭의 3배 상승 시</li>';
  html += '<li><strong>리스크:리워드 비율:</strong> 1:1.5 (손실 2만큼 감수하면 이익 3 기대)</li>';
  html += '<li><strong>필수:</strong> 매수 즉시 손절가 주문 설정 습관화</li>';
  html += '</ul>';
  html += '</div>';
  
  // 투자 전략
  html += '<div style="padding:10px; background:white; border-radius:6px;">';
  html += '<h4 style="margin:0 0 10px 0; color:#7c3aed;">💡 리스크별 투자 전략</h4>';
  html += '<ul style="margin:5px 0; padding-left:20px; line-height:1.8; font-size:0.9rem;">';
  html += '<li><strong>고위험 종목:</strong> 투자 비중 5~10%, 단기 매매, 타이트한 손절</li>';
  html += '<li><strong>중위험 종목:</strong> 투자 비중 15~25%, 중기 보유, 적정 손절</li>';
  html += '<li><strong>저위험 종목:</strong> 투자 비중 30% 이상 가능, 장기 보유</li>';
  html += '<li><strong>분산 투자:</strong> 서로 다른 리스크 등급 종목을 조합</li>';
  html += '<li><strong>포지션 크기:</strong> VaR를 보고 총 자산 대비 감당 가능한 금액만 투자</li>';
  html += '</ul>';
  html += '</div>';
  
  // 중요 안내
  html += '<div style="margin-top:15px; padding:10px; background:#fef3c7; border-radius:6px; border-left:4px solid #f59e0b;">';
  html += '<p style="margin:0; font-size:0.85rem; color:#92400e; line-height:1.6;">';
  html += '<strong>⚠️ 리스크 관리 원칙:</strong><br>';
  html += '• VaR는 과거 데이터 기반 예측이며, 실제 손실은 더 클 수 있습니다<br>';
  html += '• 한 종목에 전체 자산의 20% 이상 투자하지 마세요<br>';
  html += '• 손절가는 반드시 설정하고, 감정에 흔들리지 말고 지키세요<br>';
  html += '• 감당할 수 없는 손실 금액이라면 투자 금액을 줄이세요';
  html += '</p>';
  html += '</div>';
  
  html += '</div>';
  html += '</div>';
  
  html += '</div>';
  container.innerHTML = html;
}

// 미국 리스크 가이드 토글 함수
function toggleUsRiskGuide() {
  var content = document.getElementById('usRiskGuideContent');
  var toggle = document.getElementById('usRiskGuideToggle');
  
  if (content.style.display === 'none') {
    content.style.display = 'block';
    toggle.textContent = '▲';
  } else {
    content.style.display = 'none';
    toggle.textContent = '▼';
  }
}


// ==================== 미국 AI 차트 패턴 ====================
async function analyzeUsAiPattern() {
  console.log('🔵🔵🔵 9078줄 함수 실행됨!!! 🔵🔵🔵');
  console.trace('호출 위치 추적');
  var input = document.getElementById('us-ai-input').value.trim().toUpperCase();
  
  if (!input) {
    alert('심볼을 입력하세요. (예: AAPL)');
    return;
  }
  
  showLoading();
  
  var container = document.getElementById('us-ai-result');
  container.innerHTML = '<p>🤖 차트 패턴 분석 중...</p>';
  
  try {
    // 차트 데이터 조회
    var chartResult = await apiCall('/api/us/candles/' + input);
    var techResult = await apiCall('/api/us/analysis/' + input);
    
    if (!chartResult.success || !chartResult.data || chartResult.data.length < 20) {
      container.innerHTML = '<p>차트 데이터가 부족합니다: ' + input + '</p>';
      hideLoading();
      return;
    }
    
    var tech = techResult.success ? techResult.data : {};
    
    // 패턴 분석 (한국 함수 재사용)
    var patterns = detectChartPatterns(chartResult.data);
    
    // 결과 표시
    displayUsPatternResult(input, tech, patterns);
    
  } catch (error) {
    console.error('미국 차트 패턴 분석 오류:', error);
    container.innerHTML = '<p>분석 중 오류가 발생했습니다.</p>';
  }
  
  hideLoading();
}


// 미국 패턴 결과 표시
function displayUsPatternResult(symbol, tech, patterns) {
  var container = document.getElementById('us-ai-result');
  
  var html = '<div class="card">';
  html += '<h3>📈 ' + symbol + ' 차트 패턴</h3>';
  
  // 현재가 정보
  html += '<div class="indicators-grid" style="margin:15px 0;">';
  html += '<div class="indicator-card"><div class="label">현재가</div><div class="value">$' + (tech.currentPrice ? tech.currentPrice.toFixed(2) : '--') + '</div></div>';
  html += '<div class="indicator-card"><div class="label">기술점수</div><div class="value">' + (tech.technicalScore || 0) + '점</div></div>';
  html += '</div>';
  
  // 감지된 패턴들
  html += '<div style="margin-top:15px;">';
  
  patterns.forEach(function(pattern) {
    var bgColor = '#f8fafc';
    var borderColor = '#e2e8f0';
    
    if (pattern.type === 'bullish') {
      bgColor = '#dcfce7';
      borderColor = '#86efac';
    } else if (pattern.type === 'bearish') {
      bgColor = '#fee2e2';
      borderColor = '#fca5a5';
    } else if (pattern.type === 'info') {
      bgColor = '#e0f2fe';
      borderColor = '#7dd3fc';
    }
    
    html += '<div style="padding:15px; background:' + bgColor + '; border:1px solid ' + borderColor + '; border-radius:8px; margin-bottom:10px;">';
    html += '<div style="display:flex; justify-content:space-between; align-items:center;">';
    html += '<strong>' + pattern.name + '</strong>';
    html += '<span style="font-size:0.85rem; color:#666;">신뢰도: ' + pattern.reliability + '</span>';
    html += '</div>';
    html += '<p style="color:#666; margin-top:8px; font-size:0.9rem;">' + pattern.description + '</p>';
    html += '</div>';
  });
  
  html += '</div>';
  
  // 접히는 설명 패널 추가
  html += '<div style="margin-top:15px;">';
  html += '<button onclick="toggleUsPatternGuide()" style="width:100%; padding:12px; background:#e0f2fe; border:1px solid #7dd3fc; border-radius:8px; cursor:pointer; font-weight:bold; text-align:left; display:flex; justify-content:space-between; align-items:center;">';
  html += '<span>📖 차트 패턴 해석 가이드</span>';
  html += '<span id="usPatternGuideToggle">▼</span>';
  html += '</button>';
  html += '<div id="usPatternGuideContent" style="display:none; padding:15px; background:#f0f9ff; border-radius:0 0 8px 8px; border:1px solid #7dd3fc; border-top:none; margin-top:-1px;">';
  
  // 반전 패턴
  html += '<div style="margin-bottom:15px; padding:10px; background:white; border-radius:6px;">';
  html += '<h4 style="margin:0 0 10px 0; color:#16a34a;">📈 상승 반전 패턴 (Bullish Reversal)</h4>';
  html += '<ul style="margin:5px 0; padding-left:20px; line-height:1.8; font-size:0.9rem;">';
  html += '<li><strong>Double Bottom (더블바텀, W형):</strong> 두 번 저점 확인 후 반등 → 강력한 매수 신호</li>';
  html += '<li><strong>Inverse Head & Shoulders (역헤드앤숄더):</strong> 머리-어깨-머리 형태의 바닥 → 큰 상승 기대</li>';
  html += '<li><strong>Ascending Triangle (상승 삼각수렴):</strong> 고점은 수평, 저점은 상승 → 위로 돌파 시 매수</li>';
  html += '<li><strong>Cup and Handle (컵앤핸들):</strong> U자 바닥 + 작은 조정 → 장기 상승 신호</li>';
  html += '<li><strong>공통 전략:</strong> 네크라인(저항선) 돌파 확인 후 매수</li>';
  html += '</ul>';
  html += '</div>';
  
  html += '<div style="margin-bottom:15px; padding:10px; background:white; border-radius:6px;">';
  html += '<h4 style="margin:0 0 10px 0; color:#dc2626;">📉 하락 반전 패턴 (Bearish Reversal)</h4>';
  html += '<ul style="margin:5px 0; padding-left:20px; line-height:1.8; font-size:0.9rem;">';
  html += '<li><strong>Double Top (더블탑, M형):</strong> 두 번 고점 실패 후 하락 → 강력한 매도 신호</li>';
  html += '<li><strong>Head & Shoulders (헤드앤숄더):</strong> 어깨-머리-어깨 형태의 천장 → 큰 하락 경고</li>';
  html += '<li><strong>Descending Triangle (하락 삼각수렴):</strong> 저점은 수평, 고점은 하락 → 아래로 이탈 시 매도</li>';
  html += '<li><strong>Rounding Top (라운딩탑):</strong> 반원형 천장 → 서서히 하락</li>';
  html += '<li><strong>공통 전략:</strong> 네크라인(지지선) 이탈 시 손절 또는 공매도</li>';
  html += '</ul>';
  html += '</div>';
  
  // 지속 패턴
  html += '<div style="margin-bottom:15px; padding:10px; background:white; border-radius:6px;">';
  html += '<h4 style="margin:0 0 10px 0; color:#3b82f6;">➡️ 추세 지속 패턴 (Continuation)</h4>';
  html += '<ul style="margin:5px 0; padding-left:20px; line-height:1.8; font-size:0.9rem;">';
  html += '<li><strong>Bull/Bear Flag (상승/하락 깃발):</strong> 급등/급락 후 짧은 조정 → 기존 방향 재개</li>';
  html += '<li><strong>Symmetrical Triangle (대칭 삼각수렴):</strong> 고점 하락 + 저점 상승 → 돌파 방향으로 큰 움직임</li>';
  html += '<li><strong>Rectangle/Range (박스권):</strong> 일정 범위 반복 → 지지선 매수, 저항선 매도</li>';
  html += '<li><strong>Rising Channel (상승 채널):</strong> 평행한 상승 추세선 → 추세 유지 시 분할 매수</li>';
  html += '<li><strong>활용:</strong> 패턴 이탈 시 큰 가격 변동 발생</li>';
  html += '</ul>';
  html += '</div>';
  
  // 신뢰도 설명
  html += '<div style="margin-bottom:15px; padding:10px; background:white; border-radius:6px;">';
  html += '<h4 style="margin:0 0 10px 0; color:#7c3aed;">🎯 신뢰도 점수</h4>';
  html += '<ul style="margin:5px 0; padding-left:20px; line-height:1.8; font-size:0.9rem;">';
  html += '<li><strong>높음:</strong> 패턴이 명확하고 전형적 → 높은 확률로 예측 방향 진행</li>';
  html += '<li><strong>보통:</strong> 패턴이 형성 중이거나 일부 조건 미충족 → 참고용</li>';
  html += '<li><strong>낮음:</strong> 패턴이 불완전하거나 다른 신호와 상충 → 신중히 판단</li>';
  html += '<li><strong>거래량 확인:</strong> 패턴 돌파 시 거래량 급증하면 신뢰도 UP</li>';
  html += '</ul>';
  html += '</div>';
  
  // 목표가 계산
  html += '<div style="margin-bottom:15px; padding:10px; background:white; border-radius:6px;">';
  html += '<h4 style="margin:0 0 10px 0; color:#ea580c;">📊 목표가 계산법 (Price Target)</h4>';
  html += '<ul style="margin:5px 0; padding-left:20px; line-height:1.8; font-size:0.9rem;">';
  html += '<li><strong>Double Top/Bottom:</strong> 목표가 = 네크라인 ± 패턴 높이</li>';
  html += '<li><strong>Head & Shoulders:</strong> 목표가 = 네크라인 ± (머리 - 네크라인)</li>';
  html += '<li><strong>Triangle:</strong> 목표가 = 돌파점 ± 삼각형 밑변 길이</li>';
  html += '<li><strong>Rectangle:</strong> 목표가 = 돌파점 ± 박스 높이</li>';
  html += '<li><strong>예시:</strong> 더블바텀에서 고점 $110, 저점 $90 → 돌파 후 목표가 $130</li>';
  html += '</ul>';
  html += '</div>';
  
  // 패턴 활용 전략
  html += '<div style="padding:10px; background:white; border-radius:6px;">';
  html += '<h4 style="margin:0 0 10px 0; color:#0891b2;">💡 패턴 활용 전략</h4>';
  html += '<ul style="margin:5px 0; padding-left:20px; line-height:1.8; font-size:0.9rem;">';
  html += '<li><strong>진입 타이밍:</strong> 패턴 완성 + 네크라인 돌파 + 거래량 증가 시</li>';
  html += '<li><strong>손절가 설정:</strong> 반전 패턴의 경우 패턴 반대쪽 끝</li>';
  html += '<li><strong>분할 매수/매도:</strong> 돌파 시 1/3, 중간 지점 1/3, 목표가 근처 1/3</li>';
  html += '<li><strong>여러 지표 확인:</strong> RSI, MACD, 이동평균선과 함께 종합 판단</li>';
  html += '<li><strong>가짜 돌파 주의:</strong> 돌파 후 다시 패턴 내부로 회귀 시 손절</li>';
  html += '</ul>';
  html += '</div>';
  
  // 중요 안내
  html += '<div style="margin-top:15px; padding:10px; background:#fef3c7; border-radius:6px; border-left:4px solid #f59e0b;">';
  html += '<p style="margin:0; font-size:0.85rem; color:#92400e; line-height:1.6;">';
  html += '<strong>⚠️ 차트 패턴 주의사항:</strong><br>';
  html += '• 패턴은 과거 가격 움직임 기반 예측이며, 항상 맞는 것은 아닙니다<br>';
  html += '• 패턴 형성 중에는 매매하지 말고, 완성 및 돌파 확인 후 진입하세요<br>';
  html += '• 뉴스, 실적 발표 등 펀더멘털 변화가 패턴을 무효화할 수 있습니다<br>';
  html += '• 단기 차트보다 장기 차트의 패턴이 더 신뢰도가 높습니다';
  html += '</p>';
  html += '</div>';
  
  html += '</div>';
  html += '</div>';
  
  html += '</div>';
  container.innerHTML = html;
}

// 미국 차트 패턴 가이드 토글 함수
function toggleUsPatternGuide() {
  var content = document.getElementById('usPatternGuideContent');
  var toggle = document.getElementById('usPatternGuideToggle');
  
  if (content.style.display === 'none') {
    content.style.display = 'block';
    toggle.textContent = '▲';
  } else {
    content.style.display = 'none';
    toggle.textContent = '▼';
  }
}


// ==================== 미국 AI 뉴스 감성 분석 ====================
async function analyzeUsAiSentiment() {
  var input = document.getElementById('us-ai-input').value.trim().toUpperCase();
  
  if (!input) {
    alert('심볼을 입력하세요. (예: AAPL)');
    return;
  }
  
  showLoading();
  
  var container = document.getElementById('us-ai-result');
  container.innerHTML = '<p>🤖 뉴스 감성 분석 중...</p>';
  
  try {
    // 뉴스 조회 (심볼로 검색)
    var newsResult = await apiCall('/api/korea/news/' + encodeURIComponent(input + ' stock'));
    
    if (!newsResult.success || !newsResult.data || newsResult.data.length === 0) {
      container.innerHTML = '<p>뉴스를 찾을 수 없습니다: ' + input + '</p>';
      hideLoading();
      return;
    }
    
    // 영어 감성 분석
    var sentiment = analyzeUsSentiment(newsResult.data);
    
    // 결과 표시
    displayUsSentimentResult(input, newsResult.data, sentiment);
    
  } catch (error) {
    console.error('미국 뉴스 감성 분석 오류:', error);
    container.innerHTML = '<p>분석 중 오류가 발생했습니다.</p>';
  }
  
  hideLoading();
}

// 영어 감성 분석
function analyzeUsSentiment(newsList) {
  // 영어 긍정/부정 키워드
  var positiveKeywords = [
    'surge', 'soar', 'jump', 'rally', 'gain', 'rise', 'up', 'high', 'record', 'best',
    'growth', 'profit', 'beat', 'exceed', 'strong', 'bullish', 'buy', 'upgrade',
    'success', 'innovation', 'breakthrough', 'positive', 'optimistic', 'boom',
    'revenue', 'earnings', 'outperform', 'recommend', 'target', 'opportunity'
  ];
  
  var negativeKeywords = [
    'fall', 'drop', 'plunge', 'crash', 'decline', 'down', 'low', 'worst', 'loss',
    'miss', 'weak', 'bearish', 'sell', 'downgrade', 'cut', 'warning', 'risk',
    'concern', 'fear', 'crisis', 'trouble', 'fail', 'lawsuit', 'investigation',
    'recall', 'layoff', 'bankruptcy', 'debt', 'negative', 'pessimistic'
  ];
  
  var results = [];
  var positiveCount = 0;
  var negativeCount = 0;
  var neutralCount = 0;
  
  newsList.forEach(function(news) {
    var title = (news.title || '').toLowerCase();
    var score = 0;
    var matchedPositive = [];
    var matchedNegative = [];
    
    positiveKeywords.forEach(function(keyword) {
      if (title.includes(keyword)) {
        score += 1;
        matchedPositive.push(keyword);
      }
    });
    
    negativeKeywords.forEach(function(keyword) {
      if (title.includes(keyword)) {
        score -= 1;
        matchedNegative.push(keyword);
      }
    });
    
    var sentiment = 'neutral';
    if (score > 0) {
      sentiment = 'positive';
      positiveCount++;
    } else if (score < 0) {
      sentiment = 'negative';
      negativeCount++;
    } else {
      neutralCount++;
    }
    
    results.push({
      title: news.title,
      date: news.date || '',
      source: news.source || '',
      sentiment: sentiment,
      score: score,
      matchedPositive: matchedPositive,
      matchedNegative: matchedNegative
    });
  });
  
  var totalScore = positiveCount - negativeCount;
  var totalNews = newsList.length;
  
  var overallSentiment = '';
  var sentimentClass = '';
  
  if (totalScore >= 3) {
    overallSentiment = '🟢 Very Positive';
    sentimentClass = 'positive';
  } else if (totalScore >= 1) {
    overallSentiment = '🔵 Positive';
    sentimentClass = 'positive';
  } else if (totalScore <= -3) {
    overallSentiment = '🔴 Very Negative';
    sentimentClass = 'negative';
  } else if (totalScore <= -1) {
    overallSentiment = '🟠 Negative';
    sentimentClass = 'negative';
  } else {
    overallSentiment = '⚪ Neutral';
    sentimentClass = '';
  }
  
  return {
    results: results,
    positiveCount: positiveCount,
    negativeCount: negativeCount,
    neutralCount: neutralCount,
    totalScore: totalScore,
    overallSentiment: overallSentiment,
    sentimentClass: sentimentClass,
    positivePercent: totalNews > 0 ? (positiveCount / totalNews * 100) : 0,
    negativePercent: totalNews > 0 ? (negativeCount / totalNews * 100) : 0,
    neutralPercent: totalNews > 0 ? (neutralCount / totalNews * 100) : 0
  };
}


// 미국 감성 분석 결과 표시
function displayUsSentimentResult(symbol, newsList, sentiment) {
  var container = document.getElementById('us-ai-result');
  
  var html = '<div class="card">';
  html += '<h3>📰 ' + symbol + ' News Sentiment</h3>';
  
  // 종합 감성
  html += '<div style="text-align:center; padding:20px; background:#f8fafc; border-radius:8px; margin:15px 0;">';
  html += '<p style="color:#666; margin-bottom:10px;">Overall Sentiment</p>';
  html += '<p style="font-size:2rem; font-weight:bold;" class="' + sentiment.sentimentClass + '">' + sentiment.overallSentiment + '</p>';
  html += '<p style="color:#666;">Analyzed: <strong>' + newsList.length + ' articles</strong></p>';
  html += '</div>';
  
  // 감성 비율
  html += '<div class="indicators-grid" style="margin-top:15px;">';
  html += '<div class="indicator-card" style="background:#dcfce7;"><div class="label">Positive</div><div class="value" style="color:#166534;">' + sentiment.positiveCount + ' (' + sentiment.positivePercent.toFixed(0) + '%)</div></div>';
  html += '<div class="indicator-card" style="background:#f3f4f6;"><div class="label">Neutral</div><div class="value" style="color:#666;">' + sentiment.neutralCount + ' (' + sentiment.neutralPercent.toFixed(0) + '%)</div></div>';
  html += '<div class="indicator-card" style="background:#fee2e2;"><div class="label">Negative</div><div class="value" style="color:#991b1b;">' + sentiment.negativeCount + ' (' + sentiment.negativePercent.toFixed(0) + '%)</div></div>';
  html += '</div>';
  
  // 감성 바 그래프
  html += '<div style="margin-top:15px; background:#e2e8f0; border-radius:8px; height:30px; display:flex; overflow:hidden;">';
  if (sentiment.positivePercent > 0) {
    html += '<div style="background:#22c55e; width:' + sentiment.positivePercent + '%; display:flex; align-items:center; justify-content:center; color:white; font-size:0.8rem;">' + (sentiment.positivePercent >= 15 ? sentiment.positivePercent.toFixed(0) + '%' : '') + '</div>';
  }
  if (sentiment.neutralPercent > 0) {
    html += '<div style="background:#9ca3af; width:' + sentiment.neutralPercent + '%; display:flex; align-items:center; justify-content:center; color:white; font-size:0.8rem;">' + (sentiment.neutralPercent >= 15 ? sentiment.neutralPercent.toFixed(0) + '%' : '') + '</div>';
  }
  if (sentiment.negativePercent > 0) {
    html += '<div style="background:#ef4444; width:' + sentiment.negativePercent + '%; display:flex; align-items:center; justify-content:center; color:white; font-size:0.8rem;">' + (sentiment.negativePercent >= 15 ? sentiment.negativePercent.toFixed(0) + '%' : '') + '</div>';
  }
  html += '</div>';
  
  // 뉴스 목록
  html += '<div style="margin-top:20px;">';
  html += '<h4>📋 Article Sentiment Analysis</h4>';
  html += '<div style="max-height:300px; overflow-y:auto; margin-top:10px;">';
  
  sentiment.results.forEach(function(news) {
    var bgColor = '#f8fafc';
    var borderColor = '#e2e8f0';
    var icon = '⚪';
    
    if (news.sentiment === 'positive') {
      bgColor = '#dcfce7';
      borderColor = '#86efac';
      icon = '🟢';
    } else if (news.sentiment === 'negative') {
      bgColor = '#fee2e2';
      borderColor = '#fca5a5';
      icon = '🔴';
    }
    
    html += '<div style="padding:12px; background:' + bgColor + '; border:1px solid ' + borderColor + '; border-radius:8px; margin-bottom:8px;">';
    html += '<div style="display:flex; gap:10px;">';
    html += '<span style="font-size:1.2rem;">' + icon + '</span>';
    html += '<div style="flex:1;">';
    html += '<p style="margin:0; font-size:0.9rem;">' + news.title + '</p>';
    html += '<p style="margin:5px 0 0; font-size:0.8rem; color:#666;">' + news.source + ' | ' + news.date + '</p>';
    html += '</div>';
    html += '</div>';
    html += '</div>';
  });
  
  html += '</div>';
  html += '</div>';
  
  // 접히는 설명 패널 추가
  html += '<div style="margin-top:15px;">';
  html += '<button onclick="toggleUsSentimentGuide()" style="width:100%; padding:12px; background:#e0f2fe; border:1px solid #7dd3fc; border-radius:8px; cursor:pointer; font-weight:bold; text-align:left; display:flex; justify-content:space-between; align-items:center;">';
  html += '<span>📖 뉴스 감성 분석 가이드</span>';
  html += '<span id="usSentimentGuideToggle">▼</span>';
  html += '</button>';
  html += '<div id="usSentimentGuideContent" style="display:none; padding:15px; background:#f0f9ff; border-radius:0 0 8px 8px; border:1px solid #7dd3fc; border-top:none; margin-top:-1px;">';
  
  // 뉴스 감성 분석이란
  html += '<div style="margin-bottom:15px; padding:10px; background:white; border-radius:6px;">';
  html += '<h4 style="margin:0 0 10px 0; color:#3b82f6;">📰 뉴스 감성 분석 (Sentiment Analysis)이란?</h4>';
  html += '<ul style="margin:5px 0; padding-left:20px; line-height:1.8; font-size:0.9rem;">';
  html += '<li><strong>의미:</strong> AI가 뉴스 기사의 긍정/부정 감정을 자동으로 분석</li>';
  html += '<li><strong>방법:</strong> 제목과 내용의 키워드를 분석하여 감정 판단</li>';
  html += '<li><strong>활용:</strong> 시장 심리 파악, 투자 타이밍 결정</li>';
  html += '<li><strong>예시:</strong> "record profit", "strong growth" → 긍정 / "lawsuit", "decline" → 부정</li>';
  html += '</ul>';
  html += '</div>';
  
  // 감성 유형 설명
  html += '<div style="margin-bottom:15px; padding:10px; background:white; border-radius:6px;">';
  html += '<h4 style="margin:0 0 10px 0; color:#16a34a;">🟢 Positive (긍정)</h4>';
  html += '<ul style="margin:5px 0; padding-left:20px; line-height:1.8; font-size:0.9rem;">';
  html += '<li><strong>의미:</strong> 기업에 유리한 뉴스 (실적 호조, 신제품 출시, 제휴 등)</li>';
  html += '<li><strong>키워드:</strong> profit, growth, innovation, partnership, breakthrough</li>';
  html += '<li><strong>영향:</strong> 주가 상승 압력 → 매수 심리 증가</li>';
  html += '<li><strong>예시:</strong> "Apple announces record iPhone sales"</li>';
  html += '</ul>';
  html += '</div>';
  
  html += '<div style="margin-bottom:15px; padding:10px; background:white; border-radius:6px;">';
  html += '<h4 style="margin:0 0 10px 0; color:#dc2626;">🔴 Negative (부정)</h4>';
  html += '<ul style="margin:5px 0; padding-left:20px; line-height:1.8; font-size:0.9rem;">';
  html += '<li><strong>의미:</strong> 기업에 불리한 뉴스 (실적 악화, 소송, 사고 등)</li>';
  html += '<li><strong>키워드:</strong> lawsuit, decline, loss, recall, investigation</li>';
  html += '<li><strong>영향:</strong> 주가 하락 압력 → 매도 심리 증가</li>';
  html += '<li><strong>예시:</strong> "Tesla faces safety probe over autopilot"</li>';
  html += '</ul>';
  html += '</div>';
  
  html += '<div style="margin-bottom:15px; padding:10px; background:white; border-radius:6px;">';
  html += '<h4 style="margin:0 0 10px 0; color:#6b7280;">⚪ Neutral (중립)</h4>';
  html += '<ul style="margin:5px 0; padding-left:20px; line-height:1.8; font-size:0.9rem;">';
  html += '<li><strong>의미:</strong> 가치 판단이 어려운 사실 전달 뉴스</li>';
  html += '<li><strong>예시:</strong> 단순 인사 발령, 일반 공지, 통계 자료</li>';
  html += '<li><strong>영향:</strong> 주가에 미미한 영향</li>';
  html += '</ul>';
  html += '</div>';
  
  // 종합 감성 해석
  html += '<div style="margin-bottom:15px; padding:10px; background:white; border-radius:6px;">';
  html += '<h4 style="margin:0 0 10px 0; color:#7c3aed;">📊 Overall Sentiment 해석</h4>';
  html += '<ul style="margin:5px 0; padding-left:20px; line-height:1.8; font-size:0.9rem;">';
  html += '<li><strong>Very Positive (매우 긍정):</strong> 긍정 70% 이상 → 강한 매수 분위기</li>';
  html += '<li><strong>Positive (긍정):</strong> 긍정 55~70% → 상승 모멘텀 존재</li>';
  html += '<li><strong>Neutral (중립):</strong> 긍정/부정 균형 → 관망 분위기</li>';
  html += '<li><strong>Negative (부정):</strong> 부정 55~70% → 하락 우려</li>';
  html += '<li><strong>Very Negative (매우 부정):</strong> 부정 70% 이상 → 강한 매도 압력</li>';
  html += '</ul>';
  html += '</div>';
  
  // 투자 활용 전략
  html += '<div style="margin-bottom:15px; padding:10px; background:white; border-radius:6px;">';
  html += '<h4 style="margin:0 0 10px 0; color:#ea580c;">💡 투자 활용 전략</h4>';
  html += '<ul style="margin:5px 0; padding-left:20px; line-height:1.8; font-size:0.9rem;">';
  html += '<li><strong>단기 트레이딩:</strong> 긍정 뉴스 발표 직후 단타 매수, 부정 뉴스 시 빠른 손절</li>';
  html += '<li><strong>중기 투자:</strong> 긍정 뉴스가 지속되면 비중 확대, 부정 뉴스 증가 시 비중 축소</li>';
  html += '<li><strong>역발상 전략:</strong> 과도한 부정 → 바닥 매수 기회, 과도한 긍정 → 고점 경계</li>';
  html += '<li><strong>뉴스 타이밍:</strong> 시간 외 거래 뉴스는 다음날 시장 개장 영향</li>';
  html += '<li><strong>종합 판단:</strong> 뉴스 감성 + 기술적 분석 + 재무제표를 함께 고려</li>';
  html += '</ul>';
  html += '</div>';
  
  // 주의사항
  html += '<div style="padding:10px; background:white; border-radius:6px;">';
  html += '<h4 style="margin:0 0 10px 0; color:#0891b2;">⚠️ 뉴스 감성 분석 한계</h4>';
  html += '<ul style="margin:5px 0; padding-left:20px; line-height:1.8; font-size:0.9rem;">';
  html += '<li><strong>AI 오판 가능:</strong> 반어법, 맥락 이해 부족으로 잘못 분류될 수 있음</li>';
  html += '<li><strong>시장 반응 불일치:</strong> 긍정 뉴스에도 주가 하락 가능 (이미 반영됨)</li>';
  html += '<li><strong>과거 뉴스:</strong> 오래된 뉴스는 이미 주가에 반영되어 영향 없음</li>';
  html += '<li><strong>루머 주의:</strong> 확인되지 않은 뉴스는 신뢰도 낮음</li>';
  html += '<li><strong>언론사 편향:</strong> 특정 언론의 과장 보도 주의</li>';
  html += '</ul>';
  html += '</div>';
  
  // 중요 안내
  html += '<div style="margin-top:15px; padding:10px; background:#fef3c7; border-radius:6px; border-left:4px solid #f59e0b;">';
  html += '<p style="margin:0; font-size:0.85rem; color:#92400e; line-height:1.6;">';
  html += '<strong>⚠️ 뉴스 활용 원칙:</strong><br>';
  html += '• 감성 분석은 시장 심리를 파악하는 참고 자료일 뿐입니다<br>';
  html += '• 뉴스 하나에 과도하게 반응하지 말고, 전체 흐름을 보세요<br>';
  html += '• 중요 뉴스는 원문을 직접 확인하여 정확히 이해하세요<br>';
  html += '• 뉴스 만으로 투자 결정하지 말고, 재무 지표도 함께 분석하세요';
  html += '</p>';
  html += '</div>';
  
  html += '</div>';
  html += '</div>';
  
  html += '</div>';
  container.innerHTML = html;
}

// 미국 뉴스 감성 가이드 토글 함수
function toggleUsSentimentGuide() {
  var content = document.getElementById('usSentimentGuideContent');
  var toggle = document.getElementById('usSentimentGuideToggle');
  
  if (content.style.display === 'none') {
    content.style.display = 'block';
    toggle.textContent = '▲';
  } else {
    content.style.display = 'none';
    toggle.textContent = '▼';
  }
}

// ==================== 미국 AI 포트폴리오 ====================
var usAiPortfolioStocks = [];

// 미국 포트폴리오에 종목 추가
async function addUsAiPortfolioStock() {
  var input = document.getElementById('us-ai-portfolio-input').value.trim().toUpperCase();
  
  if (!input) {
    alert('심볼을 입력하세요. (예: AAPL)');
    return;
  }
  
  showLoading();
  
  try {
    // 중복 확인
    if (usAiPortfolioStocks.find(function(s) { return s.symbol === input; })) {
      alert('이미 추가된 종목입니다.');
      hideLoading();
      return;
    }
    
    // 종목 정보 조회
    var techResult = await apiCall('/api/us/analysis/' + input);
    
    if (!techResult.success) {
      alert('종목 정보를 가져올 수 없습니다: ' + input);
      hideLoading();
      return;
    }
    
    var tech = techResult.data;
    
    usAiPortfolioStocks.push({
      symbol: input,
      price: tech.currentPrice || 0,
      atr: tech.atr || 0,
      volatility: tech.currentPrice > 0 ? (tech.atr / tech.currentPrice * 100) : 0,
      techScore: tech.technicalScore || 0
    });
    
    document.getElementById('us-ai-portfolio-input').value = '';
    displayUsAiPortfolioList();
    
  } catch (error) {
    console.error('종목 추가 오류:', error);
    alert('오류가 발생했습니다.');
  }
  
  hideLoading();
}

// 미국 포트폴리오에서 종목 제거
function removeUsAiPortfolioStock(symbol) {
  usAiPortfolioStocks = usAiPortfolioStocks.filter(function(s) { return s.symbol !== symbol; });
  displayUsAiPortfolioList();
  document.getElementById('us-ai-portfolio-result').innerHTML = '';
}

// 미국 포트폴리오 종목 목록 표시
function displayUsAiPortfolioList() {
  var container = document.getElementById('us-ai-portfolio-list');
  
  if (usAiPortfolioStocks.length === 0) {
    container.innerHTML = '<p style="color:#999;">No stocks added. Please add stocks.</p>';
    return;
  }
  
  var html = '<div style="display:flex; flex-wrap:wrap; gap:10px;">';
  
  usAiPortfolioStocks.forEach(function(stock) {
    html += '<div style="padding:8px 12px; background:#e0f2fe; border-radius:20px; display:flex; align-items:center; gap:8px;">';
    html += '<span><strong>' + stock.symbol + '</strong></span>';
    html += '<button onclick="removeUsAiPortfolioStock(\'' + stock.symbol + '\')" style="background:none; border:none; color:#ef4444; cursor:pointer; font-size:1.2rem;">×</button>';
    html += '</div>';
  });
  
  html += '</div>';
  html += '<p style="color:#666; font-size:0.85rem; margin-top:10px;">Total: ' + usAiPortfolioStocks.length + ' stocks</p>';
  
  container.innerHTML = html;
}

// 미국 포트폴리오 최적 비중 분석
async function analyzeUsAiPortfolio() {
  if (usAiPortfolioStocks.length < 2) {
    alert('Please add at least 2 stocks.');
    return;
  }
  
  var totalAmount = parseInt(document.getElementById('us-ai-portfolio-amount').value) || 10000;
  
  showLoading();
  
  var container = document.getElementById('us-ai-portfolio-result');
  container.innerHTML = '<p>🤖 Analyzing portfolio...</p>';
  
  try {
    // 최적 비중 계산
    var weights = calculateUsOptimalWeights(usAiPortfolioStocks);
    
    // 결과 표시
    displayUsAiPortfolioResult(weights, totalAmount);
    
  } catch (error) {
    console.error('포트폴리오 분석 오류:', error);
    container.innerHTML = '<p>Analysis error occurred.</p>';
  }
  
  hideLoading();
}

// 미국 최적 비중 계산
function calculateUsOptimalWeights(stocks) {
  var totalInverseVol = 0;
  
  stocks.forEach(function(stock) {
    var vol = stock.volatility || 1;
    if (vol < 0.5) vol = 0.5;
    stock.inverseVol = 1 / vol;
    totalInverseVol += stock.inverseVol;
  });
  
  var result = stocks.map(function(stock) {
    var baseWeight = (stock.inverseVol / totalInverseVol) * 100;
    var techAdjust = ((stock.techScore - 50) / 50) * 20;
    var adjustedWeight = baseWeight + (baseWeight * techAdjust / 100);
    
    return {
      symbol: stock.symbol,
      price: stock.price,
      volatility: stock.volatility,
      techScore: stock.techScore,
      baseWeight: baseWeight,
      adjustedWeight: adjustedWeight
    };
  });
  
  var totalWeight = result.reduce(function(sum, s) { return sum + s.adjustedWeight; }, 0);
  result.forEach(function(s) {
    s.finalWeight = (s.adjustedWeight / totalWeight) * 100;
  });
  
  result.sort(function(a, b) { return b.finalWeight - a.finalWeight; });
  
  var portfolioVolatility = 0;
  var portfolioScore = 0;
  result.forEach(function(s) {
    portfolioVolatility += s.volatility * s.finalWeight / 100;
    portfolioScore += s.techScore * s.finalWeight / 100;
  });
  
  return {
    stocks: result,
    portfolioVolatility: portfolioVolatility,
    portfolioScore: portfolioScore
  };
}


// 미국 포트폴리오 결과 표시
function displayUsAiPortfolioResult(weights, totalAmount) {
  var container = document.getElementById('us-ai-portfolio-result');
  
  var html = '<div class="card">';
  html += '<h3>💼 AI Portfolio Recommendation</h3>';
  
  // 포트폴리오 요약
  html += '<div style="text-align:center; padding:20px; background:#f8fafc; border-radius:8px; margin:15px 0;">';
  html += '<p style="color:#666; margin-bottom:10px;">Portfolio Summary</p>';
  html += '<div class="indicators-grid">';
  html += '<div class="indicator-card"><div class="label">Total Investment</div><div class="value">$' + totalAmount.toLocaleString() + '</div></div>';
  html += '<div class="indicator-card"><div class="label">Stocks</div><div class="value">' + weights.stocks.length + '</div></div>';
  html += '<div class="indicator-card"><div class="label">Avg Volatility</div><div class="value">' + weights.portfolioVolatility.toFixed(2) + '%</div></div>';
  html += '<div class="indicator-card"><div class="label">Avg Tech Score</div><div class="value">' + weights.portfolioScore.toFixed(0) + '</div></div>';
  html += '</div>';
  html += '</div>';
  
  // 종목별 비중
  html += '<div style="margin-top:15px;">';
  html += '<h4>📊 Optimal Allocation</h4>';
  html += '<table style="width:100%; margin-top:10px; border-collapse:collapse;">';
  html += '<thead><tr style="background:#f1f5f9;">';
  html += '<th style="padding:10px; text-align:left;">Symbol</th>';
  html += '<th style="padding:10px; text-align:right;">Weight</th>';
  html += '<th style="padding:10px; text-align:right;">Amount</th>';
  html += '<th style="padding:10px; text-align:right;">Shares</th>';
  html += '<th style="padding:10px; text-align:right;">Volatility</th>';
  html += '<th style="padding:10px; text-align:right;">Tech Score</th>';
  html += '</tr></thead><tbody>';
  
  weights.stocks.forEach(function(stock, index) {
    var investAmount = totalAmount * stock.finalWeight / 100;
    var shares = Math.floor(investAmount / stock.price);
    
    var bgColor = index % 2 === 0 ? '#ffffff' : '#f8fafc';
    
    html += '<tr style="background:' + bgColor + ';">';
    html += '<td style="padding:10px;"><strong>' + stock.symbol + '</strong></td>';
    html += '<td style="padding:10px; text-align:right;"><strong style="color:#3b82f6;">' + stock.finalWeight.toFixed(1) + '%</strong></td>';
    html += '<td style="padding:10px; text-align:right;">$' + investAmount.toFixed(0) + '</td>';
    html += '<td style="padding:10px; text-align:right;">' + shares + '</td>';
    html += '<td style="padding:10px; text-align:right;">' + stock.volatility.toFixed(2) + '%</td>';
    html += '<td style="padding:10px; text-align:right;">' + stock.techScore.toFixed(0) + '</td>';
    html += '</tr>';
  });
  
  html += '</tbody></table>';
  html += '</div>';
  
  // 비중 시각화
  html += '<div style="margin-top:20px;">';
  html += '<h4>📈 Allocation Chart</h4>';
  html += '<div style="margin-top:10px;">';
  
  weights.stocks.forEach(function(stock) {
    var barWidth = stock.finalWeight;
    var barColor = stock.techScore >= 70 ? '#22c55e' : stock.techScore >= 50 ? '#3b82f6' : '#f59e0b';
    
    html += '<div style="margin-bottom:8px;">';
    html += '<div style="display:flex; justify-content:space-between; margin-bottom:3px;">';
    html += '<span>' + stock.symbol + '</span>';
    html += '<span><strong>' + stock.finalWeight.toFixed(1) + '%</strong></span>';
    html += '</div>';
    html += '<div style="background:#e2e8f0; border-radius:4px; height:20px;">';
    html += '<div style="background:' + barColor + '; width:' + barWidth + '%; height:100%; border-radius:4px;"></div>';
    html += '</div>';
    html += '</div>';
  });
  
  html += '</div>';
  html += '</div>';
  
  // 접히는 설명 패널 추가
  html += '<div style="margin-top:15px;">';
  html += '<button onclick="toggleUsPortfolioGuide()" style="width:100%; padding:12px; background:#e0f2fe; border:1px solid #7dd3fc; border-radius:8px; cursor:pointer; font-weight:bold; text-align:left; display:flex; justify-content:space-between; align-items:center;">';
  html += '<span>📖 포트폴리오 구성 가이드</span>';
  html += '<span id="usPortfolioGuideToggle">▼</span>';
  html += '</button>';
  html += '<div id="usPortfolioGuideContent" style="display:none; padding:15px; background:#f0f9ff; border-radius:0 0 8px 8px; border:1px solid #7dd3fc; border-top:none; margin-top:-1px;">';
  
  // 분산투자 개념
  html += '<div style="margin-bottom:15px; padding:10px; background:white; border-radius:6px;">';
  html += '<h4 style="margin:0 0 10px 0; color:#3b82f6;">💼 포트폴리오 분산투자란?</h4>';
  html += '<ul style="margin:5px 0; padding-left:20px; line-height:1.8; font-size:0.9rem;">';
  html += '<li><strong>개념:</strong> "Don\'t put all your eggs in one basket" → 여러 종목에 투자하여 리스크 분산</li>';
  html += '<li><strong>원리:</strong> 한 종목이 하락해도 다른 종목이 상승하면 손실 완화</li>';
  html += '<li><strong>효과:</strong> 개별 종목 리스크는 높아도 포트폴리오 전체는 안정적</li>';
  html += '<li><strong>권장:</strong> 최소 5~10개 종목, 다양한 산업/섹터 조합</li>';
  html += '<li><strong>주의:</strong> 과도한 분산(30개 이상)은 관리 어려움 + 수익률 희석</li>';
  html += '</ul>';
  html += '</div>';
  
  // 비중 계산 방식
  html += '<div style="margin-bottom:15px; padding:10px; background:white; border-radius:6px;">';
  html += '<h4 style="margin:0 0 10px 0; color:#7c3aed;">⚖️ 최적 비중 계산 방식</h4>';
  html += '<ul style="margin:5px 0; padding-left:20px; line-height:1.8; font-size:0.9rem;">';
  html += '<li><strong>역변동성 가중:</strong> 변동성이 낮은 종목에 더 많은 비중 → 안정성 확보</li>';
  html += '<li><strong>예시:</strong> 변동성 1% 종목은 30%, 변동성 3% 종목은 10% 배분</li>';
  html += '<li><strong>기술점수 조정:</strong> RSI, MACD 등 기술적 지표가 좋은 종목에 가산점</li>';
  html += '<li><strong>균형 유지:</strong> 한 종목이 40% 이상 차지하지 않도록 제한</li>';
  html += '<li><strong>결과:</strong> 리스크는 낮추고, 수익 잠재력은 유지</li>';
  html += '</ul>';
  html += '</div>';
  
  // 상관관계
  html += '<div style="margin-bottom:15px; padding:10px; background:white; border-radius:6px;">';
  html += '<h4 style="margin:0 0 10px 0; color:#16a34a;">🔗 상관관계 (Correlation)</h4>';
  html += '<ul style="margin:5px 0; padding-left:20px; line-height:1.8; font-size:0.9rem;">';
  html += '<li><strong>의미:</strong> 두 종목의 가격이 함께 움직이는 정도 (-1 ~ +1)</li>';
  html += '<li><strong>높은 상관(+0.7~+1):</strong> 같이 오르고 내림 → 분산효과 낮음</li>';
  html += '<li><strong>낮은 상관(-0.3~+0.3):</strong> 독립적 움직임 → 분산효과 높음</li>';
  html += '<li><strong>역상관(-1~-0.7):</strong> 반대로 움직임 → 최고의 분산효과</li>';
  html += '<li><strong>예시:</strong> Tech + Healthcare (낮은 상관), AAPL + MSFT (높은 상관)</li>';
  html += '<li><strong>전략:</strong> 상관관계가 낮은 종목들을 조합하면 리스크 대폭 감소</li>';
  html += '</ul>';
  html += '</div>';
  
  // 리밸런싱
  html += '<div style="margin-bottom:15px; padding:10px; background:white; border-radius:6px;">';
  html += '<h4 style="margin:0 0 10px 0; color:#ea580c;">🔄 리밸런싱 (Rebalancing)</h4>';
  html += '<ul style="margin:5px 0; padding-left:20px; line-height:1.8; font-size:0.9rem;">';
  html += '<li><strong>의미:</strong> 시간이 지나 비중이 변한 포트폴리오를 원래 비중으로 재조정</li>';
  html += '<li><strong>필요성:</strong> AAPL 20% → 35% 상승 시, 리스크 과다 노출</li>';
  html += '<li><strong>방법:</strong> 비중 높아진 종목 일부 매도 → 비중 낮아진 종목 매수</li>';
  html += '<li><strong>주기:</strong> 분기별(3개월) 또는 반기별(6개월) 점검 권장</li>';
  html += '<li><strong>기준:</strong> 초기 비중 대비 ±5%p 이상 차이 나면 조정</li>';
  html += '<li><strong>효과:</strong> 고점 매도 + 저점 매수 효과, 리스크 일정하게 유지</li>';
  html += '</ul>';
  html += '</div>';
  
  // 포트폴리오 평가 지표
  html += '<div style="margin-bottom:15px; padding:10px; background:white; border-radius:6px;">';
  html += '<h4 style="margin:0 0 10px 0; color:#dc2626;">📊 포트폴리오 평가 지표</h4>';
  html += '<ul style="margin:5px 0; padding-left:20px; line-height:1.8; font-size:0.9rem;">';
  html += '<li><strong>평균 변동성:</strong> 포트폴리오 전체의 가격 변동 정도 → 낮을수록 안정적</li>';
  html += '<li><strong>평균 기술점수:</strong> 각 종목의 기술적 분석 점수 평균 → 높을수록 좋은 타이밍</li>';
  html += '<li><strong>샤프 비율:</strong> (수익률 - 무위험수익률) ÷ 변동성 → 높을수록 효율적</li>';
  html += '<li><strong>최대낙폭(MDD):</strong> 고점 대비 최대 하락률 → 낮을수록 안전</li>';
  html += '<li><strong>목표:</strong> 변동성은 낮추고, 기술점수는 높이기</li>';
  html += '</ul>';
  html += '</div>';
  
  // 투자 전략
  html += '<div style="padding:10px; background:white; border-radius:6px;">';
  html += '<h4 style="margin:0 0 10px 0; color:#0891b2;">💡 포트폴리오 투자 전략</h4>';
  html += '<ul style="margin:5px 0; padding-left:20px; line-height:1.8; font-size:0.9rem;">';
  html += '<li><strong>초기 구성:</strong> 추천 비중대로 분할 매수 (한번에 올인 금지)</li>';
  html += '<li><strong>섹터 분산:</strong> Tech, Finance, Healthcare, Consumer 등 다양한 산업 포함</li>';
  html += '<li><strong>대형주 + 중소형주:</strong> 대형주 60~70% (안정성) + 중소형주 30~40% (성장성)</li>';
  html += '<li><strong>정기 점검:</strong> 월 1회 수익률 확인, 분기 1회 리밸런싱</li>';
  html += '<li><strong>손절 기준:</strong> 개별 종목 -20% 또는 포트폴리오 전체 -15% 시 재검토</li>';
  html += '<li><strong>장기 관점:</strong> 최소 6개월~1년 보유 전제, 단기 변동에 흔들리지 않기</li>';
  html += '</ul>';
  html += '</div>';
  
  // 중요 안내
  html += '<div style="margin-top:15px; padding:10px; background:#fef3c7; border-radius:6px; border-left:4px solid #f59e0b;">';
  html += '<p style="margin:0; font-size:0.85rem; color:#92400e; line-height:1.6;">';
  html += '<strong>⚠️ 포트폴리오 투자 유의사항:</strong><br>';
  html += '• AI 추천 비중은 과거 데이터 기반이며, 미래 수익을 보장하지 않습니다<br>';
  html += '• 개인의 투자 성향, 목표 수익률, 위험 감수 능력에 따라 조정하세요<br>';
  html += '• 추천 비중은 참고용이며, 시장 상황 변화 시 유연하게 대응하세요<br>';
  html += '• 분산투자도 시장 전체 하락 시 손실을 막지는 못합니다';
  html += '</p>';
  html += '</div>';
  
  html += '</div>';
  html += '</div>';
  
  html += '</div>';
  container.innerHTML = html;
}

// 미국 포트폴리오 가이드 토글 함수
function toggleUsPortfolioGuide() {
  var content = document.getElementById('usPortfolioGuideContent');
  var toggle = document.getElementById('usPortfolioGuideToggle');
  
  if (content.style.display === 'none') {
    content.style.display = 'block';
    toggle.textContent = '▲';
  } else {
    content.style.display = 'none';
    toggle.textContent = '▼';
  }
}


// ==================== 알림 팝업 ====================
// 알림 컨테이너 생성
function initNotificationContainer() {
  if (!document.getElementById('notification-container')) {
    var container = document.createElement('div');
    container.id = 'notification-container';
    container.className = 'notification-container';
    document.body.appendChild(container);
  }
}

// 알림 팝업 표시
function showNotification(options, message) {
  // 문자열 2개로 호출된 경우 객체로 변환
  if (typeof options === 'string') {
    options = {
      type: options,
      title: '알림',
      stockName: '',
      message: message || ''
    };
  }
  
  initNotificationContainer();
  
  var container = document.getElementById('notification-container');
  
  var popup = document.createElement('div');
  popup.className = 'notification-popup ' + (options.type || '');
  
  var icon = options.type === 'profit' ? '🎯' : options.type === 'loss' ? '🛑' : '🔔';
  
  popup.innerHTML = 
    '<div class="notif-header">' +
      '<span class="notif-title">' + icon + ' ' + (options.title || '알림') + '</span>' +
      '<button class="notif-close" onclick="closeNotification(this)">×</button>' +
    '</div>' +
    '<div class="notif-body">' +
      '<div>' + (options.stockName || '') + '</div>' +
      '<div class="notif-price">' + (options.message || '') + '</div>' +
    '</div>';
  
  container.appendChild(popup);
  
  // 소리 재생 (선택사항)
  if (options.sound !== false) {
    playNotificationSound();
  }
  
  // 브라우저 알림도 함께 표시
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(options.title || '주식 알림', {
      body: options.stockName + '\n' + options.message,
      icon: '/favicon.ico'
    });
  }
  
  // 자동 닫기 (10초 후)
  setTimeout(function() {
    if (popup.parentNode) {
      popup.style.animation = 'slideOut 0.3s ease';
      setTimeout(function() {
        if (popup.parentNode) {
          popup.parentNode.removeChild(popup);
        }
      }, 300);
    }
  }, 10000);
}

// 알림 닫기
function closeNotification(btn) {
  var popup = btn.closest('.notification-popup');
  if (popup) {
    popup.style.animation = 'slideOut 0.3s ease';
    setTimeout(function() {
      if (popup.parentNode) {
        popup.parentNode.removeChild(popup);
      }
    }, 300);
  }
}

// 알림 소리 재생
function playNotificationSound() {
  try {
    var audioContext = new (window.AudioContext || window.webkitAudioContext)();
    var oscillator = audioContext.createOscillator();
    var gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  } catch (e) {
    console.log('알림 소리 재생 실패:', e);
  }
}

// 브라우저 알림 권한 요청
function requestNotificationPermission() {
  if ('Notification' in window) {
    if (Notification.permission === 'default') {
      Notification.requestPermission().then(function(permission) {
        if (permission === 'granted') {
          showNotification({
            title: '알림 설정 완료',
            stockName: '브라우저 알림이 활성화되었습니다.',
            message: '매도/매수 알림을 받을 수 있습니다.',
            type: 'profit'
          });
        }
      });
    }
  }
}


// ==================== 로그인/회원가입 ====================
var currentUser = null;

// 모달 열기/닫기
function openAuthModal() {
  document.getElementById('auth-modal').style.display = 'flex';
  showLoginForm();
}

function closeAuthModal() {
  document.getElementById('auth-modal').style.display = 'none';
}

// 폼 전환
function showLoginForm() {
  document.getElementById('login-form').style.display = 'block';
  document.getElementById('register-form').style.display = 'none';
}

function showRegisterForm() {
  document.getElementById('login-form').style.display = 'none';
  document.getElementById('register-form').style.display = 'block';
}

// 회원가입
async function handleRegister() {
  var name = document.getElementById('register-name').value.trim();
  var email = document.getElementById('register-email').value.trim();
  var password = document.getElementById('register-password').value;
  var passwordConfirm = document.getElementById('register-password-confirm').value;
  
  if (!name || !email || !password || !passwordConfirm) {
    alert('모든 필드를 입력해주세요.');
    return;
  }
  
  if (password !== passwordConfirm) {
    alert('비밀번호가 일치하지 않습니다.');
    return;
  }
  
  try {
    var result = await apiCall('/api/users/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password })
    });
    
    if (result.success) {
      alert('회원가입 성공! 로그인해주세요.');
      showLoginForm();
      document.getElementById('login-email').value = email;
    } else {
      alert(result.message || '회원가입 실패');
    }
  } catch (error) {
    console.error('회원가입 오류:', error);
    alert('서버 오류가 발생했습니다.');
  }
}

// 로그인
async function handleLogin() {
  var email = document.getElementById('login-email').value.trim();
  var password = document.getElementById('login-password').value;
  
  if (!email || !password) {
    alert('이메일과 비밀번호를 입력해주세요.');
    return;
  }
  
  try {
    var result = await apiCall('/api/users/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    
    if (result.success) {
      currentUser = result.user;
      localStorage.setItem('authToken', result.token);
      closeAuthModal();
      updateUserUI();
      
      // 로그인 후 데이터 자동 로드
      loadPortfolio();
      loadWatchlist();
      
      alert('환영합니다, ' + currentUser.name + '님!');
    }

    else {
      alert(result.message || '로그인 실패');
    }
  } catch (error) {
    console.error('로그인 오류:', error);
    alert('서버 오류가 발생했습니다.');
  }
}

// 로그아웃
async function handleLogout() {
  var token = localStorage.getItem('authToken');
  
  try {
    await apiCall('/api/users/logout', {
      method: 'POST',
      body: JSON.stringify({ token })
    });
  } catch (error) {
    console.error('로그아웃 오류:', error);
  }
  
  currentUser = null;
  localStorage.removeItem('authToken');
  updateUserUI();
  alert('로그아웃 되었습니다.');
}

// 토큰 검증 (자동 로그인)
async function verifyToken() {
  var token = localStorage.getItem('authToken');
  
  if (!token) return;
  
  try {
    var result = await apiCall('/api/users/verify', {
      method: 'POST',
      body: JSON.stringify({ token })
    });
    
    if (result.success) {
      currentUser = result.user;
      updateUserUI();
    } else {
      localStorage.removeItem('authToken');
    }
  } catch (error) {
    console.error('토큰 검증 오류:', error);
    localStorage.removeItem('authToken');
  }
}

// UI 업데이트
function updateUserUI() {
  var loginBtn = document.getElementById('login-btn');
  var userInfo = document.getElementById('user-info');
  
  if (currentUser) {
    // 로그인 상태
    if (loginBtn) loginBtn.style.display = 'none';
    if (userInfo) {
      userInfo.style.display = 'flex';
      userInfo.innerHTML = 
        '<span class="user-name">' + currentUser.name + '</span>' +
        '<span class="user-plan ' + (currentUser.plan === 'premium' ? 'premium' : '') + '">' + 
          (currentUser.plan === 'premium' ? 'Premium' : 'Free') + 
        '</span>' +
        '<button class="logout-btn" onclick="handleLogout()">로그아웃</button>';
    }
  } else {
    // 로그아웃 상태
    if (loginBtn) loginBtn.style.display = 'block';
    if (userInfo) userInfo.style.display = 'none';
  }
}


// ========================================
// 차트 패턴 인식
// ========================================
if (document.getElementById('analyzePatternBtn')) {
  document.getElementById('analyzePatternBtn').addEventListener('click', async function() {
    console.log('🔍 패턴 분석 버튼 클릭됨');
    
    const stockCode = document.getElementById('analysis-stock-code').value.trim();
    console.log('종목코드:', stockCode);
    
    if (!stockCode) {
      alert('종목코드를 먼저 입력하고 분석을 실행해주세요.');
      return;
    }
    
    console.log('차트 데이터:', window.currentChartData);
    
    if (!window.currentChartData || window.currentChartData.length === 0) {
      alert('먼저 "분석 시작" 버튼을 눌러 차트를 로드해주세요.');
      return;
    }
    
    try {
      showLoading();
      
      const response = await fetch('/api/patterns/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          data: window.currentChartData,
          patterns: ['doubleTop', 'doubleBottom']
        })
      });
      
      const result = await response.json();
      
      if (result.success && result.patterns && result.patterns.length > 0) {
        displayPatternResults(result.patterns, result.summary);
        document.getElementById('patternResults').style.display = 'block';
      } else {
        var patternList = document.getElementById('patternList');
        if (patternList) {
          patternList.innerHTML = '<p style="color:#666;">신뢰도 55점 이상의 패턴이 발견되지 않았습니다.</p>';
        }
        document.getElementById('patternResults').style.display = 'block';
      }
      
    } catch (error) {
      console.error('패턴 분석 오류:', error);
      alert('패턴 분석 중 오류가 발생했습니다.');
    } finally {
      hideLoading();
    }
  });
}


// ========================================
// 미국 차트 패턴 인식
// ========================================
if (document.getElementById('analyzeUsPatternBtn')) {
  document.getElementById('analyzeUsPatternBtn').addEventListener('click', async function() {
    console.log('🔍 미국 패턴 분석 버튼 클릭됨');
    
    const stockSymbol = document.getElementById('us-stock-input').value.trim();
    console.log('종목 심볼:', stockSymbol);
    
    if (!stockSymbol) {
      alert('종목 심볼을 먼저 입력하고 분석을 실행해주세요.');
      return;
    }
    
    console.log('미국 차트 데이터:', window.currentUsChartData);
    
    if (!window.currentUsChartData || window.currentUsChartData.length === 0) {
      alert('먼저 종목을 검색하여 차트를 로드해주세요.');
      return;
    }
    
    try {
      showLoading();
      
      const response = await fetch('/api/patterns/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          data: window.currentUsChartData,
          patterns: ['doubleTop', 'doubleBottom']
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        displayUsPatternResults(result);
      } else {
        alert('패턴 분석 중 오류가 발생했습니다: ' + result.error);
      }
      
    } catch (error) {
      console.error('미국 패턴 분석 오류:', error);
      alert('패턴 분석 중 오류가 발생했습니다.');
    } finally {
      hideLoading();
    }
  });
}


function displayPatternResults(patterns, summary) {
  const resultsDiv = document.getElementById('patternResults');
  const listDiv = document.getElementById('patternList');
  
  if (patterns.length === 0) {
    listDiv.innerHTML = '<p style="color:#666;">발견된 패턴이 없습니다.</p>';
    resultsDiv.style.display = 'block';
    return;
  }
  
  let html = '<div style="display:grid; gap:10px;">';
  
  patterns.forEach(function(pattern, index) {
    const isDoubleTop = pattern.type === 'doubleTop';
    const bgColor = isDoubleTop ? '#fee2e2' : '#dcfce7';
    const iconColor = isDoubleTop ? '#dc2626' : '#16a34a';
    const icon = isDoubleTop ? '📉' : '📈';
    const title = isDoubleTop ? '더블탑 (매도 신호)' : '더블바텀 (매수 신호)';
    
    html += '<div style="padding:15px; background:' + bgColor + '; border-radius:8px; border-left:4px solid ' + iconColor + ';">';
    html += '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">';
    html += '<h4 style="margin:0; color:' + iconColor + ';">' + icon + ' ' + title + '</h4>';
    html += '<span style="background:' + iconColor + '; color:white; padding:4px 8px; border-radius:4px; font-size:0.85rem; font-weight:bold;">신뢰도: ' + pattern.confidence + '점</span>';
    html += '</div>';
    html += '<div style="font-size:0.9rem; color:#333;">';
    
    if (isDoubleTop) {
      html += '<p style="margin:5px 0;">📍 고점1: ' + pattern.peak1Price.toLocaleString() + '원</p>';
      html += '<p style="margin:5px 0;">📍 저점: ' + pattern.valleyPrice.toLocaleString() + '원</p>';
      html += '<p style="margin:5px 0;">📍 고점2: ' + pattern.peak2Price.toLocaleString() + '원</p>';
      html += '<p style="margin:5px 0;">🎯 목표가: ' + pattern.targetPrice.toLocaleString() + '원</p>';
    } else {
      html += '<p style="margin:5px 0;">📍 저점1: ' + pattern.bottom1Price.toLocaleString() + '원</p>';
      html += '<p style="margin:5px 0;">📍 고점: ' + pattern.peakPrice.toLocaleString() + '원</p>';
      html += '<p style="margin:5px 0;">📍 저점2: ' + pattern.bottom2Price.toLocaleString() + '원</p>';
      html += '<p style="margin:5px 0;">🎯 목표가: ' + pattern.targetPrice.toLocaleString() + '원</p>';
    }
    
    html += '</div>';
    html += '</div>';
  });
  
  html += '</div>';
  
  // 접히는 설명 패널 추가
  html += '<div style="margin-top:15px;">';
  html += '<button onclick="togglePatternGuide()" style="width:100%; padding:12px; background:#e0f2fe; border:1px solid #7dd3fc; border-radius:8px; cursor:pointer; font-weight:bold; text-align:left; display:flex; justify-content:space-between; align-items:center;">';
  html += '<span>📖 패턴 해석 가이드</span>';
  html += '<span id="patternGuideToggle">▼</span>';
  html += '</button>';
  html += '<div id="patternGuideContent" style="display:none; padding:15px; background:#f0f9ff; border-radius:0 0 8px 8px; border:1px solid #7dd3fc; border-top:none; margin-top:-1px;">';
  
  // 더블탑 설명
  html += '<div style="margin-bottom:15px; padding:10px; background:white; border-radius:6px;">';
  html += '<h4 style="margin:0 0 10px 0; color:#dc2626;">📉 더블탑 (Double Top)</h4>';
  html += '<ul style="margin:5px 0; padding-left:20px; line-height:1.8; font-size:0.9rem;">';
  html += '<li><strong>의미:</strong> 주가가 두 번 고점을 시도했으나 돌파 실패 → 상승 동력 약화</li>';
  html += '<li><strong>신호:</strong> 매도 고려 (하락 반전 가능성)</li>';
  html += '<li><strong>목표가 계산:</strong> 저점(네크라인) - 패턴 높이(고점-저점)</li>';
  html += '<li><strong>예시:</strong> 고점 110,000원, 저점 90,000원 → 목표가 70,000원</li>';
  html += '<li><strong>주의:</strong> 저점을 하향 돌파할 때 패턴 확정</li>';
  html += '</ul>';
  html += '</div>';
  
  // 더블바텀 설명
  html += '<div style="margin-bottom:15px; padding:10px; background:white; border-radius:6px;">';
  html += '<h4 style="margin:0 0 10px 0; color:#16a34a;">📈 더블바텀 (Double Bottom)</h4>';
  html += '<ul style="margin:5px 0; padding-left:20px; line-height:1.8; font-size:0.9rem;">';
  html += '<li><strong>의미:</strong> 주가가 두 번 저점을 확인하고 반등 → 바닥 확인</li>';
  html += '<li><strong>신호:</strong> 매수 고려 (상승 반전 가능성)</li>';
  html += '<li><strong>목표가 계산:</strong> 고점(네크라인) + 패턴 높이(고점-저점)</li>';
  html += '<li><strong>예시:</strong> 저점 50,000원, 고점 55,000원 → 목표가 60,000원</li>';
  html += '<li><strong>주의:</strong> 고점을 상향 돌파할 때 패턴 확정</li>';
  html += '</ul>';
  html += '</div>';
  
  // 신뢰도 설명
  html += '<div style="padding:10px; background:white; border-radius:6px;">';
  html += '<h4 style="margin:0 0 10px 0; color:#3b82f6;">🎯 신뢰도 점수란?</h4>';
  html += '<ul style="margin:5px 0; padding-left:20px; line-height:1.8; font-size:0.9rem;">';
  html += '<li><strong>70점 이상:</strong> 높음 - 패턴이 명확함</li>';
  html += '<li><strong>50-70점:</strong> 보통 - 참고 가능</li>';
  html += '<li><strong>50점 미만:</strong> 낮음 - 다른 지표와 함께 판단 필요</li>';
  html += '<li><strong>계산 요소:</strong> 두 고점/저점의 가격 차이, 거리, 대칭성</li>';
  html += '</ul>';
  html += '</div>';
  
  // 중요 안내
  html += '<div style="margin-top:15px; padding:10px; background:#fef3c7; border-radius:6px; border-left:4px solid #f59e0b;">';
  html += '<p style="margin:0; font-size:0.85rem; color:#92400e; line-height:1.6;">';
  html += '<strong>⚠️ 투자 유의사항:</strong><br>';
  html += '• 패턴 분석은 참고 자료일 뿐, 확정된 미래 가격이 아닙니다<br>';
  html += '• 거래량, RSI, MACD 등 다른 지표와 함께 종합적으로 판단하세요<br>';
  html += '• 손절가를 반드시 설정하여 리스크를 관리하세요';
  html += '</p>';
  html += '</div>';
  
  html += '</div>';
  html += '</div>';
  
  html += '<div style="margin-top:15px; padding:10px; background:#f8fafc; border-radius:8px; font-size:0.85rem; color:#64748b;">';
  html += '<strong>📊 분석 요약:</strong> 더블탑 ' + (summary && summary.doubleTopCount || 0) + '개, 더블바텀 ' + (summary && summary.doubleBottomCount || 0) + '개 발견';
  html += '</div>';
  
  listDiv.innerHTML = html;
  resultsDiv.style.display = 'block';
  
  // 차트 마커 추가
  addPatternMarkers(patterns);
}


// 차트에 패턴 마커 추가
function addPatternMarkers(patterns) {
  // 한국 차트 또는 미국 차트 확인
  var chart = window.tvStockChart || window.tvUsStockChart;
  
  if (!chart || !chart.candleSeries) {
    console.log('차트를 찾을 수 없습니다');
    return;
  }
  
  var markers = [];
  
  patterns.forEach(function(pattern) {
    var color = pattern.type === 'doubleTop' ? '#ef4444' : '#3b82f6';
    var shape = pattern.type === 'doubleTop' ? 'arrowDown' : 'arrowUp';
    
    // 첫 번째 고점/저점
    markers.push({
      time: window.currentChartData[pattern.startIndex].time,
      position: pattern.type === 'doubleTop' ? 'aboveBar' : 'belowBar',
      color: color,
      shape: shape,
      text: pattern.type === 'doubleTop' ? '더블탑' : '더블바텀'
    });
    
    // 두 번째 고점/저점
    markers.push({
      time: window.currentChartData[pattern.endIndex].time,
      position: pattern.type === 'doubleTop' ? 'aboveBar' : 'belowBar',
      color: color,
      shape: shape,
      text: ''
    });
  });
  
  chart.candleSeries.setMarkers(markers);
}


function displayUsPatternResults(result) {
  const resultsDiv = document.getElementById('usPatternResults');
  const listDiv = document.getElementById('usPatternList');
  
  if (result.patterns.length === 0) {
    listDiv.innerHTML = '<p style="color:#666;">발견된 패턴이 없습니다.</p>';
    resultsDiv.style.display = 'block';
    return;
  }
  
  const displayCount = 3;  // 기본 3개만 표시
  const hasMore = result.patterns.length > displayCount;  // 더 있는지 확인
  
  let html = '<div id="usPatternContainer" style="display:grid; gap:10px;">';
  
  result.patterns.forEach(function(pattern, index) {
    // 처음 3개는 항상 표시, 나머지는 숨김
    const isHidden = index >= displayCount;
    const hiddenClass = isHidden ? ' us-extra-pattern' : '';
    const hiddenStyle = isHidden ? 'display:none;' : '';
    
    const isDoubleTop = pattern.type === 'doubleTop';
    const bgColor = isDoubleTop ? '#fee2e2' : '#dcfce7';
    const iconColor = isDoubleTop ? '#dc2626' : '#16a34a';
    const icon = isDoubleTop ? '📉' : '📈';
    const title = isDoubleTop ? '더블탑 (매도 신호)' : '더블바텀 (매수 신호)';
    
    html += '<div class="us-pattern-item' + hiddenClass + '" style="' + hiddenStyle + 'padding:15px; background:' + bgColor + '; border-radius:8px; border-left:4px solid ' + iconColor + ';">';
    html += '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">';
    html += '<h4 style="margin:0; color:' + iconColor + ';">' + icon + ' ' + title + '</h4>';
    html += '<span style="background:' + iconColor + '; color:white; padding:4px 8px; border-radius:4px; font-size:0.85rem; font-weight:bold;">신뢰도: ' + pattern.confidence + '점</span>';
    html += '</div>';
    html += '<div style="font-size:0.9rem; color:#333;">';
    
    if (isDoubleTop) {
      html += '<p style="margin:5px 0;">📍 고점1: $' + pattern.peak1Price.toFixed(2) + '</p>';
      html += '<p style="margin:5px 0;">📍 저점: $' + pattern.valleyPrice.toFixed(2) + '</p>';
      html += '<p style="margin:5px 0;">📍 고점2: $' + pattern.peak2Price.toFixed(2) + '</p>';
      html += '<p style="margin:5px 0;">🎯 목표가: $' + pattern.targetPrice.toFixed(2) + '</p>';
    } else {
      html += '<p style="margin:5px 0;">📍 저점1: $' + pattern.bottom1Price.toFixed(2) + '</p>';
      html += '<p style="margin:5px 0;">📍 고점: $' + pattern.peakPrice.toFixed(2) + '</p>';
      html += '<p style="margin:5px 0;">📍 저점2: $' + pattern.bottom2Price.toFixed(2) + '</p>';
      html += '<p style="margin:5px 0;">🎯 목표가: $' + pattern.targetPrice.toFixed(2) + '</p>';
    }
    
    html += '</div>';
    html += '</div>';
  });
  
  html += '</div>';
  
  // 더 보기 버튼 (패턴이 3개 초과일 때만)
  if (hasMore) {
    html += '<div style="margin-top:10px; text-align:center;">';
    html += '<button id="usToggleMoreBtn" onclick="toggleUsMorePatterns()" style="padding:10px 20px; background:#6366f1; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">';
    html += '더 보기 (' + (result.patterns.length - displayCount) + '개) ▼';
    html += '</button>';
    html += '</div>';
  }
  
  // 접히는 설명 패널 추가
  html += '<div style="margin-top:15px;">';
  html += '<button onclick="toggleUsPatternGuide()" style="width:100%; padding:12px; background:#e0f2fe; border:1px solid #7dd3fc; border-radius:8px; cursor:pointer; font-weight:bold; text-align:left; display:flex; justify-content:space-between; align-items:center;">';
  html += '<span>📖 패턴 해석 가이드</span>';
  html += '<span id="usPatternGuideToggle">▼</span>';
  html += '</button>';
  html += '<div id="usPatternGuideContent" style="display:none; padding:15px; background:#f0f9ff; border-radius:0 0 8px 8px; border:1px solid #7dd3fc; border-top:none; margin-top:-1px;">';
  
  // 더블탑 설명
  html += '<div style="margin-bottom:15px; padding:10px; background:white; border-radius:6px;">';
  html += '<h4 style="margin:0 0 10px 0; color:#dc2626;">📉 더블탑 (Double Top)</h4>';
  html += '<ul style="margin:5px 0; padding-left:20px; line-height:1.8; font-size:0.9rem;">';
  html += '<li><strong>의미:</strong> 주가가 두 번 고점을 시도했으나 돌파 실패 → 상승 동력 약화</li>';
  html += '<li><strong>신호:</strong> 매도 고려 (하락 반전 가능성)</li>';
  html += '<li><strong>목표가 계산:</strong> 저점(네크라인) - 패턴 높이(고점-저점)</li>';
  html += '<li><strong>예시:</strong> 고점 $110.00, 저점 $90.00 → 목표가 $70.00</li>';
  html += '<li><strong>주의:</strong> 저점을 하향 돌파할 때 패턴 확정</li>';
  html += '</ul>';
  html += '</div>';
  
  // 더블바텀 설명
  html += '<div style="margin-bottom:15px; padding:10px; background:white; border-radius:6px;">';
  html += '<h4 style="margin:0 0 10px 0; color:#16a34a;">📈 더블바텀 (Double Bottom)</h4>';
  html += '<ul style="margin:5px 0; padding-left:20px; line-height:1.8; font-size:0.9rem;">';
  html += '<li><strong>의미:</strong> 주가가 두 번 저점을 확인하고 반등 → 바닥 확인</li>';
  html += '<li><strong>신호:</strong> 매수 고려 (상승 반전 가능성)</li>';
  html += '<li><strong>목표가 계산:</strong> 고점(네크라인) + 패턴 높이(고점-저점)</li>';
  html += '<li><strong>예시:</strong> 저점 $50.00, 고점 $55.00 → 목표가 $60.00</li>';
  html += '<li><strong>주의:</strong> 고점을 상향 돌파할 때 패턴 확정</li>';
  html += '</ul>';
  html += '</div>';
  
  // 신뢰도 설명
  html += '<div style="padding:10px; background:white; border-radius:6px;">';
  html += '<h4 style="margin:0 0 10px 0; color:#3b82f6;">🎯 신뢰도 점수란?</h4>';
  html += '<ul style="margin:5px 0; padding-left:20px; line-height:1.8; font-size:0.9rem;">';
  html += '<li><strong>70점 이상:</strong> 높음 - 패턴이 명확함</li>';
  html += '<li><strong>50-70점:</strong> 보통 - 참고 가능</li>';
  html += '<li><strong>50점 미만:</strong> 낮음 - 다른 지표와 함께 판단 필요</li>';
  html += '<li><strong>계산 요소:</strong> 두 고점/저점의 가격 차이, 거리, 대칭성</li>';
  html += '</ul>';
  html += '</div>';
  
  // 중요 안내
  html += '<div style="margin-top:15px; padding:10px; background:#fef3c7; border-radius:6px; border-left:4px solid #f59e0b;">';
  html += '<p style="margin:0; font-size:0.85rem; color:#92400e; line-height:1.6;">';
  html += '<strong>⚠️ 투자 유의사항:</strong><br>';
  html += '• 패턴 분석은 참고 자료일 뿐, 확정된 미래 가격이 아닙니다<br>';
  html += '• 거래량, RSI, MACD 등 다른 지표와 함께 종합적으로 판단하세요<br>';
  html += '• 손절가를 반드시 설정하여 리스크를 관리하세요';
  html += '</p>';
  html += '</div>';
  
  html += '</div>';
  html += '</div>';
  
  html += '<div style="margin-top:15px; padding:10px; background:#f8fafc; border-radius:8px; font-size:0.85rem; color:#64748b;">';
  html += '<strong>📊 분석 요약:</strong> 더블탑 ' + result.summary.doubleTopCount + '개, 더블바텀 ' + result.summary.doubleBottomCount + '개 발견';
  html += '</div>';
  
  listDiv.innerHTML = html;
  resultsDiv.style.display = 'block';
}


// 미국 패턴 더 보기 토글
function toggleUsMorePatterns() {
  var extraPatterns = document.querySelectorAll('.us-extra-pattern');
  var btn = document.getElementById('usToggleMoreBtn');
  var isHidden = extraPatterns[0].style.display === 'none' || extraPatterns[0].style.display === '';
  
  extraPatterns.forEach(function(pattern) {
    pattern.style.display = isHidden ? 'block' : 'none';
  });
  
  btn.textContent = isHidden ? '접기 ▲' : '더 보기 (' + extraPatterns.length + '개) ▼';
}


// 패턴 가이드 토글 함수
function togglePatternGuide() {
  var content = document.getElementById('patternGuideContent');
  var toggle = document.getElementById('patternGuideToggle');
  
  if (content.style.display === 'none') {
    content.style.display = 'block';
    toggle.textContent = '▲';
  } else {
    content.style.display = 'none';
    toggle.textContent = '▼';
  }
}


// RSI 가이드 토글 함수
function toggleRsiGuide() {
  var content = document.getElementById('rsiGuideContent');
  var toggle = document.getElementById('rsiGuideToggle');
  
  if (content.style.display === 'none') {
    content.style.display = 'block';
    toggle.textContent = '▲';
  } else {
    content.style.display = 'none';
    toggle.textContent = '▼';
  }
}


// 미국 RSI 가이드 토글 함수
function toggleUsRsiGuide() {
  var content = document.getElementById('usRsiGuideContent');
  var toggle = document.getElementById('usRsiGuideToggle');
  
  if (content.style.display === 'none') {
    content.style.display = 'block';
    toggle.textContent = '▲';
  } else {
    content.style.display = 'none';
    toggle.textContent = '▼';
  }
}


// MACD 가이드 토글 함수
function toggleMacdGuide() {
  var content = document.getElementById('macdGuideContent');
  var toggle = document.getElementById('macdGuideToggle');
  
  if (content.style.display === 'none') {
    content.style.display = 'block';
    toggle.textContent = '▲';
  } else {
    content.style.display = 'none';
    toggle.textContent = '▼';
  }
}


// 미국 MACD 가이드 토글 함수
function toggleUsMacdGuide() {
  var content = document.getElementById('usMacdGuideContent');
  var toggle = document.getElementById('usMacdGuideToggle');
  
  if (content.style.display === 'none') {
    content.style.display = 'block';
    toggle.textContent = '▲';
  } else {
    content.style.display = 'none';
    toggle.textContent = '▼';
  }
}


// 스토캐스틱 가이드 토글 함수
function toggleStochasticGuide() {
  var content = document.getElementById('stochasticGuideContent');
  var toggle = document.getElementById('stochasticGuideToggle');
  
  if (content.style.display === 'none') {
    content.style.display = 'block';
    toggle.textContent = '▲';
  } else {
    content.style.display = 'none';
    toggle.textContent = '▼';
  }
}


// 미국 스토캐스틱 가이드 토글 함수
function toggleUsStochasticGuide() {
  var content = document.getElementById('usStochasticGuideContent');
  var toggle = document.getElementById('usStochasticGuideToggle');
  
  if (content.style.display === 'none') {
    content.style.display = 'block';
    toggle.textContent = '▲';
  } else {
    content.style.display = 'none';
    toggle.textContent = '▼';
  }
}


// ATR 가이드 토글 함수
function toggleAtrGuide() {
  var content = document.getElementById('atrGuideContent');
  var toggle = document.getElementById('atrGuideToggle');
  
  if (content.style.display === 'none') {
    content.style.display = 'block';
    toggle.textContent = '▲';
  } else {
    content.style.display = 'none';
    toggle.textContent = '▼';
  }
}


// 미국 ATR 가이드 토글 함수
function toggleUsAtrGuide() {
  var content = document.getElementById('usAtrGuideContent');
  var toggle = document.getElementById('usAtrGuideToggle');
  
  if (content.style.display === 'none') {
    content.style.display = 'block';
    toggle.textContent = '▲';
  } else {
    content.style.display = 'none';
    toggle.textContent = '▼';
  }
}


// 미국 패턴 가이드 토글 함수
function toggleUsPatternGuide() {
  var content = document.getElementById('usPatternGuideContent');
  var toggle = document.getElementById('usPatternGuideToggle');
  
  if (content.style.display === 'none') {
    content.style.display = 'block';
    toggle.textContent = '▲';
  } else {
    content.style.display = 'none';
    toggle.textContent = '▼';
  }
}



// 인덱스에서 날짜 가져오기 (현재 차트 데이터 기준)
function getDateFromIndex(index) {
  if (window.currentChartData && window.currentChartData[index]) {
    return window.currentChartData[index].time;
  }
  return '날짜 정보 없음';
}


// ==================== 포트폴리오 최적화 ====================

// 종목 개수 슬라이더 업데이트
function updateStockCount(value) {
  document.getElementById('stock-count-value').textContent = value;
}

// 시장 선택 버튼
document.addEventListener('DOMContentLoaded', function() {
  // 시장 선택
  const marketBtns = document.querySelectorAll('.market-btn');
  marketBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      marketBtns.forEach(b => b.classList.remove('active'));
      this.classList.add('active');
    });
  });

  // 모드 선택
  const modeBtns = document.querySelectorAll('.mode-btn');
  modeBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      modeBtns.forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      
      // UI 전환
      const mode = this.dataset.mode;
      const manualUI = document.getElementById('manual-selection-ui');
      const stockCountDiv = document.getElementById('stock-count-slider').closest('div');
      
      if (mode === 'manual') {
        manualUI.style.display = 'block';
        stockCountDiv.style.display = 'none'; // 직접 선택 시 슬라이더 숨김
      } else {
        manualUI.style.display = 'none';
        stockCountDiv.style.display = 'block';
      }
    });
  });
});
//최적화 실행 버튼
//const optimizeBtn = document.getElementById('optimize-btn');
//if (optimizeBtn) {
//optimizeBtn.addEventListener('click', runPortfolioOptimization);
//}


// 선택된 종목 목록
let selectedStocks = [];

// 종목 추가
const addStockBtn = document.getElementById('add-stock-btn');
if (addStockBtn) {
  addStockBtn.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    console.log('버튼 클릭 이벤트!'); // 디버그
    addStockToSelection();
  });
}
  
  const searchInput = document.getElementById('stock-search-input');
if (searchInput) {
  searchInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      console.log('Enter 키 이벤트!'); // 디버그
      addStockToSelection();
    }
  });
}
  
  const clearAllBtn = document.getElementById('clear-all-btn');
  if (clearAllBtn) {
    clearAllBtn.addEventListener('click', clearAllStocks);
  }


// 종목 검색 및 추가
async function addStockToSelection() {
  const inputElement = document.getElementById('portfolio-stock-input');;
  console.log('Input Element:', inputElement); // 디버그
  
  if (!inputElement) {
    alert('검색창을 찾을 수 없습니다.');
    return;
  }
  
  const input = inputElement.value.trim();
  console.log('Input Value:', input); // 디버그
  
  if (!input) {
    alert('종목명 또는 종목코드를 입력하세요.');
    return;
  }
  
  showLoading();
  
  try {
    // 시장 확인 (한국/미국)
    const market = document.querySelector('.market-btn.active').dataset.market;
    
    let stockInfo = null;
    
    // 한국 종목 검색
    if (market === 'korea' || market === 'mixed') {
      stockInfo = await searchKoreanStock(input);
    }
    
    // 미국 종목 검색
    if (!stockInfo && (market === 'us' || market === 'mixed')) {
      stockInfo = await searchUSStock(input);
    }
    
    if (stockInfo) {
      selectedStocks.push(stockInfo);
      updateSelectedStocksList();
      document.getElementById('stock-search-input').value = '';
    } else {
      alert('종목을 찾을 수 없습니다: ' + input);
    }
    
  } catch (error) {
    console.error('종목 검색 오류:', error);
    alert('종목 검색 중 오류가 발생했습니다.');
  } finally {
    hideLoading();
  }
}



async function searchKoreanStock(query) {
  try {
    const response = await fetch(`/api/korea/search?keyword=${encodeURIComponent(query)}`);
    const result = await response.json();
    
    // 배열로 반환되므로 첫 번째 항목 사용!
    if (result.success && result.data && result.data.length > 0) {
      const stock = result.data[0];  // ← 첫 번째 항목!
      
      return {
        code: stock.code,
        name: stock.name,
        market: 'korea',
        sector: stock.sector || '기타'
      };
    }
    
    return null;
    
  } catch (error) {
    console.error('한국 종목 검색 오류:', error);
    return null;
  }
}


// 미국 종목 검색
async function searchUSStock(query) {
  // 간단 버전: 미리 정의된 목록에서 검색
  const usStocks = {
    'AAPL': { name: 'Apple Inc.', sector: 'Technology' },
    'MSFT': { name: 'Microsoft', sector: 'Technology' },
    'GOOGL': { name: 'Alphabet', sector: 'Technology' },
    'AMZN': { name: 'Amazon', sector: 'Consumer' },
    'NVDA': { name: 'NVIDIA', sector: 'Technology' },
    'META': { name: 'Meta', sector: 'Technology' },
    'TSLA': { name: 'Tesla', sector: 'Automotive' },
  };
  
  const upperQuery = query.toUpperCase();
  
  if (usStocks[upperQuery]) {
    return {
      code: upperQuery,
      name: usStocks[upperQuery].name,
      market: 'us',
      sector: usStocks[upperQuery].sector
    };
  }
  
  return null;
}

// 선택된 종목 목록 업데이트
function updateSelectedStocksList() {
  const listDiv = document.getElementById('selected-stocks-list');
  const countSpan = document.getElementById('selected-count');
  
  countSpan.textContent = selectedStocks.length;
  
  if (selectedStocks.length === 0) {
    listDiv.innerHTML = '<p style="color: #666; text-align: center; margin: 20px 0;">종목을 검색하여 추가하세요</p>';
    return;
  }
  
  let html = '<div style="display: flex; flex-direction: column; gap: 8px;">';
  
  selectedStocks.forEach((stock, index) => {
    const marketEmoji = stock.market === 'korea' ? '🇰🇷' : '🇺🇸';
    
    html += '<div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: #f9fafb; border-radius: 6px;">';
    html += '<div style="flex: 1;">';
    html += '<span style="font-weight: bold;">' + stock.name + '</span>';
    html += ' <span style="color: #666; font-size: 0.85rem;">(' + stock.code + ')</span>';
    html += ' ' + marketEmoji;
    html += '</div>';
    html += '<button class="btn-secondary" onclick="removeStock(' + index + ')" style="padding: 5px 10px; font-size: 0.85rem;">삭제</button>';
    html += '</div>';
  });
  
  html += '</div>';
  
  listDiv.innerHTML = html;
}

// 종목 삭제
function removeStock(index) {
  selectedStocks.splice(index, 1);
  updateSelectedStocksList();
}

// 전체 삭제
function clearAllStocks() {
  if (selectedStocks.length === 0) return;
  
  if (confirm('선택된 모든 종목을 삭제하시겠습니까?')) {
    selectedStocks = [];
    updateSelectedStocksList();
  }
}


// 포트폴리오 최적화 실행
async function runPortfolioOptimization() {
  const market = document.querySelector('.market-btn.active').dataset.market;
  const mode = document.querySelector('.mode-btn.active').dataset.mode;
  
  // 직접 선택 모드 검증
  if (mode === 'manual') {
    if (selectedStocks.length < 3) {
      alert('최소 3개 이상의 종목을 선택해주세요.');
      return;
    }
    if (selectedStocks.length > 20) {
      alert('최대 20개까지만 선택할 수 있습니다.');
      return;
    }
  }
  
  const stockCount = mode === 'auto' 
    ? parseInt(document.getElementById('stock-count-slider').value)
    : selectedStocks.length;
  
  console.log('최적화 실행:', { stockCount, market, mode, selectedStocks });
  
  showLoading();
  
  try {
    // API 호출
    const response = await fetch('/api/optimizer/optimize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        market: market,
        stockCount: stockCount,
        mode: mode,
        selectedStocks: mode === 'manual' ? selectedStocks : undefined
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      // 결과 표시
      displayOptimizationResults(result.data);
    } else {
      alert('최적화 실패: ' + result.message);
    }
    
  } catch (error) {
    console.error('최적화 오류:', error);
    alert('최적화 중 오류가 발생했습니다.');
  } finally {
    hideLoading();
  }
}


// 최적화 결과 표시
function displayOptimizationResults(data) {
  const resultsDiv = document.getElementById('optimizer-results');
  const contentDiv = document.getElementById('optimizer-result-content');
  
  if (!data || !data.stocks || data.stocks.length === 0) {
    contentDiv.innerHTML = '<p>결과를 표시할 수 없습니다.</p>';
    resultsDiv.style.display = 'block';
    return;
  }
  
  let html = '';
  
  // 포트폴리오 지표
  html += '<div style="margin-bottom: 20px; padding: 15px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 10px; color: white;">';
  html += '<h4 style="margin: 0 0 15px 0;">📊 포트폴리오 지표</h4>';
  html += '<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px;">';
  html += '<div style="text-align: center;">';
  html += '<div style="font-size: 0.85rem; opacity: 0.9;">예상 수익률</div>';
  html += '<div style="font-size: 1.5rem; font-weight: bold; margin-top: 5px;">' + data.metrics.expectedReturn + '</div>';
  html += '</div>';
  html += '<div style="text-align: center;">';
  html += '<div style="font-size: 0.85rem; opacity: 0.9;">변동성</div>';
  html += '<div style="font-size: 1.5rem; font-weight: bold; margin-top: 5px;">' + data.metrics.volatility + '</div>';
  html += '</div>';
  html += '<div style="text-align: center;">';
  html += '<div style="font-size: 0.85rem; opacity: 0.9;">샤프 비율</div>';
  html += '<div style="font-size: 1.5rem; font-weight: bold; margin-top: 5px;">' + data.metrics.sharpeRatio + '</div>';
  html += '</div>';
  html += '</div>';
  html += '</div>';
  
  // 종목별 비중
  html += '<h4 style="margin: 20px 0 10px 0;">💼 추천 포트폴리오 구성</h4>';
  html += '<div style="overflow-x: auto;">';
  html += '<table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">';
  html += '<thead>';
  html += '<tr style="background: #f3f4f6; border-bottom: 2px solid #e5e7eb;">';
  html += '<th style="padding: 10px; text-align: left;">종목</th>';
  html += '<th style="padding: 10px; text-align: center;">시장</th>';
  html += '<th style="padding: 10px; text-align: center;">섹터</th>';
  html += '<th style="padding: 10px; text-align: right;">비중</th>';
  html += '<th style="padding: 10px; text-align: right;">기대수익률</th>';
  html += '<th style="padding: 10px; text-align: right;">변동성</th>';
  html += '</tr>';
  html += '</thead>';
  html += '<tbody>';
  
  data.stocks.forEach(function(stock, index) {
    const bgColor = index % 2 === 0 ? '#ffffff' : '#f9fafb';
    const marketEmoji = stock.market === 'korea' ? '🇰🇷' : '🇺🇸';
    
    html += '<tr style="background: ' + bgColor + '; border-bottom: 1px solid #e5e7eb;">';
    html += '<td style="padding: 10px;">';
    html += '<div style="font-weight: bold;">' + stock.name + '</div>';
    html += '<div style="font-size: 0.8rem; color: #666;">' + stock.code + '</div>';
    html += '</td>';
    html += '<td style="padding: 10px; text-align: center;">' + marketEmoji + '</td>';
    html += '<td style="padding: 10px; text-align: center; font-size: 0.85rem;">' + stock.sector + '</td>';
    html += '<td style="padding: 10px; text-align: right; font-weight: bold; color: #667eea;">' + (stock.weight * 100).toFixed(1) + '%</td>';
    html += '<td style="padding: 10px; text-align: right;">' + (stock.expectedReturn * 100).toFixed(2) + '%</td>';
    html += '<td style="padding: 10px; text-align: right;">' + (stock.volatility * 100).toFixed(2) + '%</td>';
    html += '</tr>';
  });
  
  html += '</tbody>';
  html += '</table>';
  html += '</div>';
  
  // 투자 안내
  html += '<div style="margin-top: 20px; padding: 15px; background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 6px;">';
  html += '<p style="margin: 0; font-size: 0.9rem; color: #92400e; line-height: 1.6;">';
  html += '<strong>⚠️ 투자 유의사항:</strong><br>';
  html += '• 이 분석은 과거 데이터 기반 참고 자료이며, 미래 수익을 보장하지 않습니다<br>';
  html += '• 실제 투자 전 충분한 리서치와 분산 투자를 권장합니다<br>';
  html += '• 본인의 투자 성향과 리스크 허용도를 고려하여 투자하세요';
  html += '</p>';
  html += '</div>';
  
  contentDiv.innerHTML = html;
  resultsDiv.style.display = 'block';
  
  // 결과 영역으로 스크롤
  resultsDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}


// =============================================
// 포트폴리오 최적화 - 기존 백엔드 API 호환 버전
// =============================================

// 전역 변수는 위로 옮김


window.optimizerSettings = optimizerSettings;  // ← 이 줄 추가!

// 종목 개수 업데이트
function updateStockCount(value) {
  optimizerSettings.stockCount = parseInt(value);
  document.getElementById('stock-count-value').textContent = value;
}

// 시장 선택
function selectMarket(market) {
  optimizerSettings.market = market;
  
  // 버튼 활성화 상태 변경
  document.querySelectorAll('.market-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  document.querySelector(`[data-market="${market}"]`).classList.add('active');
}

// 모드 선택 (자동/수동)
function selectMode(mode) {
  optimizerSettings.mode = mode;
  
  // 버튼 활성화 상태 변경
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  document.querySelector(`[data-mode="${mode}"]`).classList.add('active');
  
  // UI 표시/숨김
  if (mode === 'auto') {
    document.getElementById('auto-selection-ui').style.display = 'block';
    document.getElementById('manual-selection-ui').style.display = 'none';
  } else {
    document.getElementById('auto-selection-ui').style.display = 'none';
    document.getElementById('manual-selection-ui').style.display = 'block';
  }
}

// AI 시가총액 기반 추천 (기존 API 사용)
async function aiSelectByMarketCap(capType) {
  showLoading();
  
  try {
    // capType에 따라 API 경로 결정
    let capIndex = 0;  // 기본 대형주
    if (capType === 'mid') capIndex = 1;
    else if (capType === 'small') capIndex = 2;
    
    const response = await fetch('/api/korea/market-cap/' + capIndex);
    const data = await response.json();
    
    if (data.success && data.data && data.data.length > 0) {
      // 설정된 종목 개수만큼 선택
      const count = optimizerSettings.stockCount || 10;
      const selectedStocks = data.data.slice(0, count).map(stock => ({
        code: stock.code,
        name: stock.name,
        market: 'korea'
      }));
      
      optimizerSettings.selectedStocks = selectedStocks;
      optimizerSettings.mode = 'manual';
      
      alert(capType + ' 기준 ' + selectedStocks.length + '개 종목 추천 완료!');
    } else {
      alert('해당 시가총액 종목을 찾을 수 없습니다.');
    }
  } catch (error) {
    console.error('AI 추천 오류:', error);
    alert('AI 추천 중 오류가 발생했습니다.');
  } finally {
    hideLoading();
  }
}

// AI 테마 기반 추천
async function aiSelectByTheme() {
  const themeId = document.getElementById('ai-theme-selector').value;
  
  if (!themeId) {
    alert('테마를 먼저 선택해주세요.');
    return;
  }
  
  showLoading();
  
  try {
    const response = await fetch('/api/korea/theme/' + themeId);
    const data = await response.json();
    
    if (data.success && data.data && data.data.length > 0) {
      // 테마 종목을 optimizerSettings에 저장
      optimizerSettings.selectedStocks = data.data.map(stock => ({
        code: stock.code,
        name: stock.name,
        market: 'korea'
      }));
      optimizerSettings.mode = 'manual';  // 이 줄 추가!
      
      alert('테마 기준 ' + data.data.length + '개 종목 추천 완료!');
    } else {
      alert('테마 종목을 불러올 수 없습니다.');
    }
  } catch (error) {
    console.error('테마 추천 오류:', error);
    alert('테마 추천 중 오류가 발생했습니다.');
  } finally {
    hideLoading();
  }
}


// 수동 종목 추가
async function manualAddStock() {
  const input = document.getElementById('portfolio-stock-input');
  const codeOrName = input.value.trim();
  
  if (!codeOrName) {
    alert('종목명 또는 종목코드를 입력해주세요.');
    return;
  }
  
  // 선택된 시장 확인
  const marketBtn = document.querySelector('.market-btn.active');
  const selectedMarket = marketBtn ? marketBtn.dataset.market : 'korea';
  
  showLoading();
  
  try {
    let stock = null;
    
    // 한국 종목 검색
    if (selectedMarket === 'korea' || selectedMarket === 'mixed') {
      const response = await fetch(`/api/korea/search?keyword=${encodeURIComponent(codeOrName)}`);
      const result = await response.json();
      
      if (result.success && result.data && result.data.length > 0) {
        stock = {
          code: result.data[0].code,
          name: result.data[0].name,
          market: 'korea'
        };
      }
    }
    
    // 미국 종목 검색 (한국에서 못 찾았거나 미국 시장 선택 시)
    if (!stock && (selectedMarket === 'us' || selectedMarket === 'mixed')) {
      const response = await fetch(`/api/us/search?keyword=${encodeURIComponent(codeOrName)}`);
      const result = await response.json();
      
      if (result.success && result.data && result.data.length > 0) {
        stock = {
          code: result.data[0].symbol,  // 미국은 symbol
          name: result.data[0].name || result.data[0].description,
          market: 'us'
        };
      }
    }
    
    if (stock) {
      // 중복 체크
      if (optimizerSettings.selectedStocks.find(s => s.code === stock.code)) {
        alert('이미 추가된 종목입니다.');
        hideLoading();
        return;
      }
      
      // 종목 추가
      optimizerSettings.selectedStocks.push(stock);
      
      // 리스트 업데이트
      updateSelectedStocksList();
      
      // 입력창 초기화
      input.value = '';
      
      alert(`${stock.name} 추가 완료!`);
    } else {
      alert('종목을 찾을 수 없습니다.');
    }
    
  } catch (error) {
    console.error('종목 추가 오류:', error);
    alert('종목 추가 중 오류가 발생했습니다.');
  } finally {
    hideLoading();
  }
}


// 선택된 종목 리스트 업데이트
function updateSelectedStocksList() {
  const container = document.getElementById('selected-stocks-list');
  const countEl = document.getElementById('selected-count');
  
  countEl.textContent = optimizerSettings.selectedStocks.length;
  
  if (optimizerSettings.selectedStocks.length === 0) {
    container.innerHTML = '<p style="color: #666; text-align: center; margin: 20px 0;">종목을 검색하여 추가하세요</p>';
    return;
  }
  
  container.innerHTML = optimizerSettings.selectedStocks.map((stock, index) => `
    <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: #f8fafc; border-radius: 8px; margin-bottom: 8px;">
      <div>
        <strong>${stock.name}</strong>
        <span style="color: #666; margin-left: 10px; font-size: 0.9rem;">${stock.code}</span>
      </div>
      <button onclick="removeStock(${index})" style="background: #ef4444; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">
        삭제
      </button>
    </div>
  `).join('');
}

// 종목 삭제
function removeStock(index) {
  optimizerSettings.selectedStocks.splice(index, 1);
  updateSelectedStocksList();
}

function clearAllStocks() {
  if (optimizerSettings.selectedStocks.length === 0) return;
  
  if (confirm('선택된 모든 종목을 삭제하시겠습니까?')) {
    optimizerSettings.selectedStocks = [];
    updateSelectedStocksList();
  }
}



// 최적화 실행 (기존 API 호환)
async function runOptimization() {
  // 유효성 검사
  const totalInvestment = parseFloat(document.getElementById('total-investment-amount').value);
  if (!totalInvestment || totalInvestment <= 0) {
    showNotification('error', '유효한 투자 금액을 입력해주세요.');
    return;
  }
  
  optimizerSettings.totalInvestment = totalInvestment;
  
  showLoading();
  
  try {
    // 기존 API 호출 (자동 추천 + 최적화를 한 번에)
    const response = await fetch('/api/optimizer/optimize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        market: optimizerSettings.market,
        stockCount: optimizerSettings.stockCount,
        mode: optimizerSettings.mode,
        selectedStocks: optimizerSettings.mode === 'manual' ? optimizerSettings.selectedStocks : null
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      displayOptimizationResults(result.data, totalInvestment);
    } else {
      showNotification('error', '최적화 실패: ' + result.message);
    }
  } catch (error) {
    console.error('최적화 오류:', error);
    showNotification('error', '최적화 중 오류가 발생했습니다.');
  } finally {
    hideLoading();
  }
}



// 최적화 결과 표시 (기존 API 응답 구조에 맞춤)
function displayOptimizationResults(data, totalInvestment) {
  // 결과 영역 표시
  document.getElementById('optimizer-results').style.display = 'block';
  
  // 기존 API 응답 구조:
  // data = { stocks: [...], metrics: { expectedReturn, volatility, sharpeRatio } }
  
  const stocks = data.stocks || [];
  const metrics = data.metrics || {};
  
  // 요약 정보 업데이트
  document.getElementById('summary-stock-count').textContent = stocks.length + '개';
  document.getElementById('summary-expected-return').textContent = metrics.expectedReturn || '0%';
  document.getElementById('summary-volatility').textContent = metrics.volatility || '0%';
  
  // 다각화 점수는 기존 API에 없으므로 임시 계산
  const avgWeight = 1 / stocks.length;
  const diversificationScore = Math.round((1 - avgWeight) * 100);
  document.getElementById('summary-diversification').textContent = diversificationScore + '점';
  
  // 배분 데이터 생성
  const allocations = stocks.map(stock => ({
    code: stock.code,
    name: stock.name,
    weight: stock.weight,
    amount: totalInvestment * 10000 * stock.weight, // 만원 → 원
    expectedReturn: stock.expectedReturn || 0
  }));
  
  // 파이 차트 그리기
  drawAllocationPieChart(allocations);
  
  // 상세 테이블 업데이트
  updateAllocationTable(allocations);
  
  // 상관관계 매트릭스 (기존 API에 없으므로 임시)
  displayCorrelationMatrix([]);
  
  // 리스크 분석 표시
  displayRiskAnalysis({
    var95: parseFloat(metrics.volatility) * 1.645 / 100 || 0,
    sharpeRatio: parseFloat(metrics.sharpeRatio) || 0,
    diversificationEffect: 15 // 임시값
  });
  
  // 결과로 스크롤
  document.getElementById('optimizer-results').scrollIntoView({ behavior: 'smooth' });
}

// 파이 차트 그리기
let allocationChart = null;

function drawAllocationPieChart(allocations) {
  const ctx = document.getElementById('allocation-pie-chart').getContext('2d');
  
  // 기존 차트 제거
  if (allocationChart) {
    allocationChart.destroy();
  }
  
  const labels = allocations.map(a => a.name);
  const data = allocations.map(a => a.weight * 100);
  
  const colors = [
    '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
    '#FF9F40', '#FF6384', '#C9CBCF', '#4BC0C0', '#FF6384',
    '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40',
    '#FF6384', '#C9CBCF', '#4BC0C0', '#FF6384', '#36A2EB'
  ];
  
  allocationChart = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: colors.slice(0, allocations.length),
        borderWidth: 2,
        borderColor: '#fff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 15,
            font: { size: 12 }
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return context.label + ': ' + context.parsed.toFixed(2) + '%';
            }
          }
        }
      }
    }
  });
}

// 상세 테이블 업데이트
function updateAllocationTable(allocations) {
  const tbody = document.getElementById('allocation-table-body');
  
  tbody.innerHTML = allocations.map(a => `
    <tr>
      <td><strong>${a.name}</strong></td>
      <td>${a.code}</td>
      <td style="color: #3b82f6; font-weight: bold;">${(a.weight * 100).toFixed(2)}%</td>
      <td>${(a.amount / 10000).toFixed(0)} 만원</td>
      <td style="color: ${a.expectedReturn >= 0 ? '#10b981' : '#ef4444'};">
        ${(a.expectedReturn * 100).toFixed(2)}%
      </td>
    </tr>
  `).join('');
}

// 상관관계 매트릭스 표시 (기존 API에 없으므로 임시)
function displayCorrelationMatrix(matrix) {
  const container = document.getElementById('correlation-matrix');
  container.innerHTML = '<p style="color: #666;">상관관계 데이터는 추후 업데이트 예정입니다.</p>';
}

// 리스크 분석 표시
function displayRiskAnalysis(data) {
  const container = document.getElementById('risk-analysis');
  
  container.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
      <div style="background: #fef2f2; padding: 15px; border-radius: 8px; border-left: 4px solid #ef4444;">
        <div style="font-size: 0.9rem; color: #666; margin-bottom: 5px;">최대 예상 손실 (VaR 95%)</div>
        <div style="font-size: 1.5rem; font-weight: bold; color: #dc2626;">${(data.var95 * 100).toFixed(2)}%</div>
      </div>
      
      <div style="background: #fef3c7; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b;">
        <div style="font-size: 0.9rem; color: #666; margin-bottom: 5px;">샤프 비율</div>
        <div style="font-size: 1.5rem; font-weight: bold; color: #d97706;">${data.sharpeRatio.toFixed(2)}</div>
      </div>
      
      <div style="background: #ecfdf5; padding: 15px; border-radius: 8px; border-left: 4px solid #10b981;">
        <div style="font-size: 0.9rem; color: #666; margin-bottom: 5px;">다각화 효과</div>
        <div style="font-size: 1.5rem; font-weight: bold; color: #059669;">${data.diversificationEffect}%</div>
      </div>
    </div>
    
    <div style="margin-top: 20px; padding: 15px; background: #f0f9ff; border-radius: 8px; border-left: 4px solid #3b82f6;">
      <h4 style="margin: 0 0 10px 0; color: #1e40af;">📌 해석 가이드</h4>
      <ul style="margin: 0; padding-left: 20px; line-height: 1.8; color: #1e40af; font-size: 0.9rem;">
        <li><strong>VaR (Value at Risk):</strong> 95% 확률로 발생하지 않을 최대 손실</li>
        <li><strong>샤프 비율:</strong> 위험 대비 수익률 (높을수록 좋음, 1 이상 우수)</li>
        <li><strong>다각화 효과:</strong> 분산투자로 인한 리스크 감소율 (높을수록 좋음)</li>
      </ul>
    </div>
  `;
}

// 초기화: 테마 목록 로드
async function loadThemeListForOptimizer() {
  try {
    const response = await fetch('/api/korea/themes');
    const data = await response.json();
    const themes = Array.isArray(data) ? data : (data.themes || data.data || []);
    
    const selector = document.getElementById('ai-theme-selector');
    selector.innerHTML = '<option value="">-- 테마 선택 --</option>' +
    themes.map(t => `<option value="${t.code}">${t.name}</option>`).join('');
  } catch (error) {
    console.error('테마 목록 로드 오류:', error);
  }
}

// 페이지 로드 시 테마 목록 로드
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('ai-theme-selector')) {
    loadThemeListForOptimizer();
  }
});



// ========== 카카오 로그인 관련 함수 ==========

// 카카오 로그인
function kakaoLogin() {
    Kakao.Auth.authorize({
        redirectUri: KAKAO_REDIRECT_URI,
        scope: 'talk_message'  // 나에게 메시지 보내기 권한
    });
}

// 카카오 로그아웃
function kakaoLogout() {
    if (Kakao.Auth.getAccessToken()) {
        Kakao.Auth.logout(() => {
            localStorage.removeItem('kakaoToken');
            localStorage.removeItem('kakaoUser');
            updateKakaoUI(false);
            alert('카카오 로그아웃 완료');
        });
    }
}

// OAuth 콜백 처리 (인가코드로 토큰 받기)
async function handleKakaoCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    
    if (code) {
        try {
            // 인가코드로 토큰 받기
            const response = await fetch('https://kauth.kakao.com/oauth/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                    grant_type: 'authorization_code',
                    client_id: KAKAO_JS_KEY,
                    redirect_uri: KAKAO_REDIRECT_URI,
                    code: code
                })
            });
            
            const tokenData = await response.json();
            
            if (tokenData.access_token) {
                // 토큰 저장
                localStorage.setItem('kakaoToken', tokenData.access_token);
                Kakao.Auth.setAccessToken(tokenData.access_token);
                
                // 사용자 정보 가져오기
                const userInfo = await Kakao.API.request({ url: '/v2/user/me' });
                localStorage.setItem('kakaoUser', JSON.stringify(userInfo));
                
                console.log('카카오 로그인 성공:', userInfo);
                updateKakaoUI(true, userInfo);
                
                // URL에서 code 파라미터 제거
                window.history.replaceState({}, document.title, window.location.pathname);
            }
        } catch (error) {
            console.error('카카오 토큰 요청 실패:', error);
            alert('카카오 로그인 처리 중 오류가 발생했습니다.');
        }
    }
}

// 로그인 상태 확인
function checkKakaoLoginStatus() {
    const token = localStorage.getItem('kakaoToken');
    const userInfo = localStorage.getItem('kakaoUser');
    
    if (token && userInfo) {
        Kakao.Auth.setAccessToken(token);
        updateKakaoUI(true, JSON.parse(userInfo));
        loadNotificationSettings();
        initNotificationListeners();
    } else {
        // OAuth 콜백 확인
        handleKakaoCallback();
    }
}

// UI 업데이트
function updateKakaoUI(isLoggedIn, userInfo = null) {
    const loginBtn = document.getElementById('kakaoLoginBtn');
    const logoutBtn = document.getElementById('kakaoLogoutBtn');
    const userStatus = document.getElementById('kakaoUserStatus');
    const notificationSettings = document.getElementById('notificationSettings');
    
    if (isLoggedIn && userInfo) {
        if (loginBtn) loginBtn.style.display = 'none';
        if (logoutBtn) logoutBtn.style.display = 'inline-flex';
        if (userStatus) userStatus.textContent = `${userInfo.properties?.nickname || '사용자'}님 연동됨`;
        if (notificationSettings) notificationSettings.style.display = 'block';
    } else {
        if (loginBtn) loginBtn.style.display = 'inline-flex';
        if (logoutBtn) logoutBtn.style.display = 'none';
        if (userStatus) userStatus.textContent = '';
        if (notificationSettings) notificationSettings.style.display = 'none';
    }
}


// 카카오톡 나에게 메시지 보내기 (테스트)
async function testKakaoMessage() {
    if (!Kakao.Auth.getAccessToken()) {
        alert('카카오 로그인이 필요합니다.');
        return;
    }
    
    try {
        await Kakao.API.request({
            url: '/v2/api/talk/memo/default/send',
            data: {
                template_object: {
                    object_type: 'text',
                    text: '📈 Stock-PWA 알림 테스트\n\n카카오톡 알림이 정상적으로 연동되었습니다!',
                    link: {
                        web_url: 'https://stock-pwa.vercel.app',
                        mobile_web_url: 'https://stock-pwa.vercel.app'
                    },
                    button_title: '앱으로 이동'
                }
            }
        });
        alert('테스트 메시지가 전송되었습니다! 카카오톡을 확인하세요.');
    } catch (error) {
        console.error('메시지 전송 실패:', error);
        if (error.code === -401) {
            alert('카카오 로그인이 만료되었습니다. 다시 로그인해주세요.');
            localStorage.removeItem('kakaoToken');
            updateKakaoUI(false);
        } else {
            alert('메시지 전송 실패: ' + (error.msg || error.message));
        }
    }
}


// ========== 알림 설정 저장/불러오기 ==========

// 알림 설정 저장
function saveNotificationSettings() {
    const settings = {
        priceTarget: document.getElementById('alertPriceTarget')?.checked || false,
        bigChange: document.getElementById('alertBigChange')?.checked || false,
        signal: document.getElementById('alertSignal')?.checked || false
    };
    localStorage.setItem('kakaoNotificationSettings', JSON.stringify(settings));
    console.log('알림 설정 저장됨:', settings);
}

// 알림 설정 불러오기
function loadNotificationSettings() {
    const saved = localStorage.getItem('kakaoNotificationSettings');
    if (saved) {
        const settings = JSON.parse(saved);
        const priceTarget = document.getElementById('alertPriceTarget');
        const bigChange = document.getElementById('alertBigChange');
        const signal = document.getElementById('alertSignal');
        
        if (priceTarget) priceTarget.checked = settings.priceTarget;
        if (bigChange) bigChange.checked = settings.bigChange;
        if (signal) signal.checked = settings.signal;
        
        console.log('알림 설정 불러옴:', settings);
    }
}

// 체크박스 변경 시 자동 저장
function initNotificationListeners() {
    const checkboxes = ['alertPriceTarget', 'alertBigChange', 'alertSignal'];
    checkboxes.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', saveNotificationSettings);
        }
    });
}


// ========== 실제 알림 발송 ==========

// 카카오톡 알림 보내기 (공통 함수)
async function sendKakaoNotification(title, message, stockCode = '') {
    if (!Kakao.Auth.getAccessToken()) {
        console.log('카카오 로그인 필요 - 알림 미발송');
        return false;
    }
    
    try {
        await Kakao.API.request({
            url: '/v2/api/talk/memo/default/send',
            data: {
                template_object: {
                    object_type: 'text',
                    text: `${title}\n\n${message}`,
                    link: {
                        web_url: stockCode 
                            ? `https://stock-pwa.vercel.app?stock=${stockCode}` 
                            : 'https://stock-pwa.vercel.app',
                        mobile_web_url: stockCode 
                            ? `https://stock-pwa.vercel.app?stock=${stockCode}` 
                            : 'https://stock-pwa.vercel.app'
                    },
                    button_title: '앱에서 확인'
                }
            }
        });
        console.log('카카오톡 알림 발송 성공:', title);
        return true;
    } catch (error) {
        console.error('카카오톡 알림 발송 실패:', error);
        return false;
    }
}

// 목표가 도달 알림
async function sendPriceTargetAlert(stockName, stockCode, currentPrice, targetPrice) {
    const settings = JSON.parse(localStorage.getItem('kakaoNotificationSettings') || '{}');
    if (!settings.priceTarget) return;
    
    const title = `🎯 목표가 도달! ${stockName}`;
    const message = `현재가: ${currentPrice.toLocaleString()}원\n목표가: ${targetPrice.toLocaleString()}원\n\n목표가에 도달했습니다!`;
    
    await sendKakaoNotification(title, message, stockCode);
}

// 급등/급락 알림 (±5% 이상)
async function sendBigChangeAlert(stockName, stockCode, currentPrice, changePercent) {
    const settings = JSON.parse(localStorage.getItem('kakaoNotificationSettings') || '{}');
    if (!settings.bigChange) return;
    
    const direction = changePercent > 0 ? '📈 급등' : '📉 급락';
    const title = `${direction} 알림! ${stockName}`;
    const message = `현재가: ${currentPrice.toLocaleString()}원\n등락률: ${changePercent > 0 ? '+' : ''}${changePercent.toFixed(2)}%\n\n${Math.abs(changePercent).toFixed(1)}% ${changePercent > 0 ? '상승' : '하락'}했습니다!`;
    
    await sendKakaoNotification(title, message, stockCode);
}

// 매수/매도 신호 알림
async function sendSignalAlert(stockName, stockCode, signalType, reason) {
    const settings = JSON.parse(localStorage.getItem('kakaoNotificationSettings') || '{}');
    if (!settings.signal) return;
    
    const emoji = signalType === '매수' ? '🟢' : '🔴';
    const title = `${emoji} ${signalType} 신호! ${stockName}`;
    const message = `신호: ${signalType}\n근거: ${reason}\n\n기술적 분석 결과입니다.`;
    
    await sendKakaoNotification(title, message, stockCode);
}

// 포트폴리오 모니터링 (주기적 체크)
async function checkPortfolioAlerts() {
    const settings = JSON.parse(localStorage.getItem('kakaoNotificationSettings') || '{}');
    
    // 알림 설정이 모두 꺼져있으면 스킵
    if (!settings.priceTarget && !settings.bigChange && !settings.signal) {
        return;
    }
    
    // 카카오 로그인 안되어 있으면 스킵
    if (!Kakao.Auth.getAccessToken()) {
        return;
    }
    
    console.log('포트폴리오 알림 체크 중...');
    
    // 여기에 실제 포트폴리오 데이터 체크 로직 추가
    // 예: 보유 종목의 현재가 조회 후 조건 확인
}

// ==================== 시장 스캐너 ====================
async function runMarketScanner() {
  const statusEl = document.getElementById('scanner-status');
  const resultsEl = document.getElementById('scanner-results');
  const buyListEl = document.getElementById('buy-signals-list');
  const sellListEl = document.getElementById('sell-signals-list');
  const timestampEl = document.getElementById('scanner-timestamp');
  
  statusEl.textContent = '스캔 중... (약 1-2분 소요)';
  resultsEl.style.display = 'none';
  
  try {
    const response = await fetch('/api/analysis/scanner');
    const data = await response.json();
    
    if (data.success) {
      const { buySignals, sellSignals, scannedCount, timestamp } = data.data;
      
      // 매수 신호 표시
      if (buySignals.length > 0) {
        buyListEl.innerHTML = buySignals.map(stock => 
          '<div style="padding: 10px; margin-bottom: 8px; background: white; border-radius: 6px; border-left: 4px solid #10b981;">' +
            '<strong>' + stock.name + '</strong> (' + stock.code + ') - ' + 
            (stock.price ? stock.price.toLocaleString() + '원' : '') +
            '<div style="font-size: 0.85rem; color: #10b981; margin-top: 5px;">' + 
            stock.reasons.join(', ') + '</div>' +
          '</div>'
        ).join('');
      } else {
        buyListEl.innerHTML = '<p style="color: #666;">현재 매수 신호 종목이 없습니다.</p>';
      }
      
      // 매도 신호 표시
      if (sellSignals.length > 0) {
        sellListEl.innerHTML = sellSignals.map(stock => 
          '<div style="padding: 10px; margin-bottom: 8px; background: white; border-radius: 6px; border-left: 4px solid #ef4444;">' +
            '<strong>' + stock.name + '</strong> (' + stock.code + ') - ' + 
            (stock.price ? stock.price.toLocaleString() + '원' : '') +
            '<div style="font-size: 0.85rem; color: #ef4444; margin-top: 5px;">' + 
            stock.reasons.join(', ') + '</div>' +
          '</div>'
        ).join('');
      } else {
        sellListEl.innerHTML = '<p style="color: #666;">현재 매도 신호 종목이 없습니다.</p>';
      }
      
      // 알림 전송
      sendScannerNotification(buySignals, sellSignals);
      
      statusEl.textContent = '스캔 완료! (' + scannedCount + '개 종목 분석)';
      timestampEl.textContent = '마지막 스캔: ' + new Date(timestamp).toLocaleString('ko-KR');
      resultsEl.style.display = 'block';
      
    } else {
      statusEl.textContent = '스캔 실패: ' + data.error;
    }
  } catch (error) {
    console.error('스캐너 오류:', error);
    statusEl.textContent = '스캔 중 오류가 발생했습니다.';
  }
}
// ==================== 스캐너 알림 설정 ====================

// 브라우저 푸시 알림 권한 요청
async function requestPushPermission() {
  if (!('Notification' in window)) {
    alert('이 브라우저는 푸시 알림을 지원하지 않습니다.');
    return false;
  }
  
  if (Notification.permission === 'granted') {
    return true;
  }
  
  const permission = await Notification.requestPermission();
  return permission === 'granted';
}

// 스캐너 알림 설정 저장
async function saveScannerNotifySettings() {
  const pushNotify = document.getElementById('scanner-push-notify').checked;
  const kakaoNotify = document.getElementById('scanner-kakao-notify').checked;
  
  // 브라우저 푸시 체크 시 권한 요청
  if (pushNotify) {
    const granted = await requestPushPermission();
    if (!granted) {
      document.getElementById('scanner-push-notify').checked = false;
      alert('브라우저 알림 권한이 거부되었습니다. 브라우저 설정에서 허용해주세요.');
      return;
    }
  }
  
  // 설정 저장
  localStorage.setItem('scannerPushNotify', pushNotify);
  localStorage.setItem('scannerKakaoNotify', kakaoNotify);
  
  alert('알림 설정이 저장되었습니다!');
}

// 설정 불러오기
function loadScannerNotifySettings() {
  const pushNotify = localStorage.getItem('scannerPushNotify') === 'true';
  const kakaoNotify = localStorage.getItem('scannerKakaoNotify') === 'true';
  
  const pushEl = document.getElementById('scanner-push-notify');
  const kakaoEl = document.getElementById('scanner-kakao-notify');
  
  if (pushEl) pushEl.checked = pushNotify;
  if (kakaoEl) kakaoEl.checked = kakaoNotify;
}

// 테스트 알림
async function testScannerNotify() {
  const pushNotify = document.getElementById('scanner-push-notify').checked;
  const kakaoNotify = document.getElementById('scanner-kakao-notify').checked;
  
  if (!pushNotify && !kakaoNotify) {
    alert('알림 방식을 선택해주세요.');
    return;
  }
  
  // 브라우저 푸시 테스트
  if (pushNotify) {
    const granted = await requestPushPermission();
    if (granted) {
      new Notification('📡 시장 스캐너 테스트', {
        body: '매수 신호: 테스트 종목\nRSI 과매도 (25.0)',
        icon: '/icons/icon-192.png'
      });
    }
  }
  
  // 카카오톡 테스트
  if (kakaoNotify) {
    if (typeof sendKakaoMessage === 'function') {
      sendKakaoMessage('📡 시장 스캐너 테스트\n\n매수 신호: 테스트 종목\nRSI 과매도 (25.0)');
    } else {
      alert('카카오톡 로그인이 필요합니다.');
    }
  }
}

// 스캐너 결과 알림 전송
function sendScannerNotification(buySignals, sellSignals) {
  const pushNotify = localStorage.getItem('scannerPushNotify') === 'true';
  const kakaoNotify = localStorage.getItem('scannerKakaoNotify') === 'true';
  
  if (!pushNotify && !kakaoNotify) return;
  if (buySignals.length === 0 && sellSignals.length === 0) return;
  
  // 메시지 생성
  let message = '📡 시장 스캐너 결과\n\n';
  
  if (buySignals.length > 0) {
    message += '📈 매수 신호:\n';
    buySignals.slice(0, 5).forEach(stock => {
      message += '• ' + stock.name + ' - ' + stock.reasons.join(', ') + '\n';
    });
    message += '\n';
  }
  
  if (sellSignals.length > 0) {
    message += '📉 매도 신호:\n';
    sellSignals.slice(0, 5).forEach(stock => {
      message += '• ' + stock.name + ' - ' + stock.reasons.join(', ') + '\n';
    });
  }
  
  // 브라우저 푸시
  if (pushNotify && Notification.permission === 'granted') {
    new Notification('📡 시장 스캐너 결과', {
      body: (buySignals.length > 0 ? '매수 ' + buySignals.length + '개 ' : '') + 
            (sellSignals.length > 0 ? '매도 ' + sellSignals.length + '개' : ''),
      icon: '/icons/icon-192.png'
    });
  }
  
  // 카카오톡
  if (kakaoNotify && typeof sendKakaoMessage === 'function') {
    sendKakaoMessage(message);
  }
}


// ==================== 자동 스캔 ====================
let autoScanTimer = null;
let isAutoScanning = false;

function toggleAutoScan() {
  if (isAutoScanning) {
    stopAutoScan();
  } else {
    startAutoScan();
  }
}

function startAutoScan() {
  const intervalSelect = document.getElementById('auto-scan-interval');
  const autoScanBtn = document.getElementById('auto-scan-btn');
  const statusEl = document.getElementById('scanner-status');
  
  const minutes = parseInt(intervalSelect.value);
  const milliseconds = minutes * 60 * 1000;
  
  isAutoScanning = true;
  autoScanBtn.innerHTML = '⏹️ 자동 스캔 중지';
  autoScanBtn.style.background = '#ef4444';
  intervalSelect.disabled = true;
  
  // 즉시 한 번 실행
  runMarketScanner();
  
  // 주기적 실행
  autoScanTimer = setInterval(function() {
    console.log('자동 스캔 실행:', new Date().toLocaleString('ko-KR'));
    runMarketScanner();
  }, milliseconds);
  
  statusEl.textContent = minutes + '분마다 자동 스캔 중...';
  
  alert('자동 스캔이 시작되었습니다!\n' + minutes + '분마다 시장을 스캔합니다.');
}

function stopAutoScan() {
  const intervalSelect = document.getElementById('auto-scan-interval');
  const autoScanBtn = document.getElementById('auto-scan-btn');
  const statusEl = document.getElementById('scanner-status');
  
  if (autoScanTimer) {
    clearInterval(autoScanTimer);
    autoScanTimer = null;
  }
  
  isAutoScanning = false;
  autoScanBtn.innerHTML = '▶️ 자동 스캔 시작';
  autoScanBtn.style.background = '#10b981';
  intervalSelect.disabled = false;
  
  statusEl.textContent = '자동 스캔 중지됨';
  
  alert('자동 스캔이 중지되었습니다.');
}