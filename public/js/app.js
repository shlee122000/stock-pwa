// API 기본 URL
const API_BASE = '';

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


// ==================== 초기화 ====================
document.addEventListener('DOMContentLoaded', function() {
  initEventListeners();
  initTabs();
  loadExchangeRate();
  loadWatchlist();
  loadUsWatchlist();
  loadPortfolio();
  loadDashboard();
  loadAlertList();
  updateAlertStockSelect();
  loadUsPortfolio();
  loadUsAlertList();
  loadAiThemeList();
  
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
  document.getElementById('us-ai-portfolio-add-btn').addEventListener('click', addUsAiPortfolioStock);
  document.getElementById('us-ai-portfolio-input').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') addUsAiPortfolioStock();
  });
  document.getElementById('us-ai-portfolio-analyze-btn').addEventListener('click', analyzeUsAiPortfolio);
 
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
  document.getElementById('ai-portfolio-add-btn').addEventListener('click', addAiPortfolioStock);
  document.getElementById('ai-portfolio-input').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') addAiPortfolioStock();
  });
  document.getElementById('ai-portfolio-analyze-btn').addEventListener('click', analyzeAiPortfolio);

  // AI 뉴스 감성 분석
  document.getElementById('ai-sentiment-btn').addEventListener('click', analyzeAiSentiment);
  document.getElementById('ai-sentiment-input').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') analyzeAiSentiment();
  });

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
    var result = await apiCall('/api/korea/exchange');
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

// 차트 그리기
async function drawStockChart(stockCode) {
  try {
    var result = await apiCall('/api/korea/chart/' + stockCode);
    
    if (!result.success || !result.data || result.data.length === 0) {
      return;
    }
    
    var chartData = result.data.slice(-60);
    var labels = chartData.map(function(d) { return d.date ? d.date.substring(5) : ''; });
    var closes = chartData.map(function(d) { return d.close; });
    
    // MA20 계산
    var ma20 = [];
    for (var i = 0; i < closes.length; i++) {
      if (i < 19) {
        ma20.push(null);
      } else {
        var sum = 0;
        for (var j = i - 19; j <= i; j++) {
          sum += closes[j];
        }
        ma20.push(sum / 20);
      }
    }
    
    if (stockChart) stockChart.destroy();
    
    var ctx = document.getElementById('stock-chart').getContext('2d');
    stockChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: '종가',
            data: closes,
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            borderWidth: 2,
            fill: true,
            tension: 0.1,
            pointRadius: 0
          },
          {
            label: 'MA20',
            data: ma20,
            borderColor: '#f59e0b',
            borderWidth: 1.5,
            fill: false,
            tension: 0.1,
            pointRadius: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'top' } },
        scales: {
          y: {
            beginAtZero: false,
            ticks: {
              callback: function(value) {
                return value.toLocaleString() + '원';
              }
            }
          }
        }
      }
    });
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

async function drawUsStockChart(symbol) {
  try {
    var result = await apiCall('/api/us/candles/' + symbol);
    
    if (!result.success || !result.data || result.data.length === 0) {
      document.getElementById('us-chart-card').style.display = 'none';
      return;
    }
    
    document.getElementById('us-chart-card').style.display = 'block';
    
    var chartData = result.data.slice(-60);
    var labels = chartData.map(function(d) { return d.date.substring(5); });
    var closes = chartData.map(function(d) { return d.close; });
    
    if (usStockChart) usStockChart.destroy();
    
    var ctx = document.getElementById('us-stock-chart').getContext('2d');
    usStockChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Close',
          data: closes,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.1,
          pointRadius: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: false,
            ticks: { callback: function(v) { return '$' + v.toFixed(2); } }
          }
        }
      }
    });
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
  
  html += '</div>';
  container.innerHTML = html;
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
  
  // 리스크 설명
  html += '<div style="margin-top:15px; padding:15px; background:#fef3c7; border-radius:8px;">';
  html += '<h4>📋 리스크 지표 설명</h4>';
  html += '<ul style="margin:10px 0 0 20px; color:#666; font-size:0.9rem;">';
  html += '<li><strong>VaR (Value at Risk)</strong>: 95% 확률로 이 금액 이상 손실이 발생하지 않음</li>';
  html += '<li><strong>ATR</strong>: 평균 일일 가격 변동폭</li>';
  html += '<li><strong>손절가</strong>: ATR × 2 기준으로 계산</li>';
  html += '<li><strong>목표가</strong>: ATR × 3 기준 (리스크:리워드 = 1:1.5)</li>';
  html += '</ul>';
  html += '</div>';
  
  html += '</div>';
  container.innerHTML = html;
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
  
  // 패턴 해석 가이드
  html += '<div style="margin-top:15px; padding:15px; background:#fef3c7; border-radius:8px;">';
  html += '<h4>📋 패턴 해석 가이드</h4>';
  html += '<ul style="margin:10px 0 0 20px; color:#666; font-size:0.9rem;">';
  html += '<li><strong>쌍바닥</strong>: W 모양, 상승 반전 신호</li>';
  html += '<li><strong>쌍봉</strong>: M 모양, 하락 반전 신호</li>';
  html += '<li><strong>삼각수렴</strong>: 변동폭 축소, 큰 움직임 임박</li>';
  html += '<li><strong>박스권</strong>: 지지선 매수, 저항선 매도 전략</li>';
  html += '</ul>';
  html += '</div>';
  
  html += '</div>';
  container.innerHTML = html;
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
  
  // 비중 계산 방식 설명
  html += '<div style="margin-top:15px; padding:15px; background:#fef3c7; border-radius:8px;">';
  html += '<h4>📋 비중 계산 방식</h4>';
  html += '<ul style="margin:10px 0 0 20px; color:#666; font-size:0.9rem;">';
  html += '<li><strong>역변동성 가중</strong>: 변동성이 낮은 종목에 더 높은 비중 부여</li>';
  html += '<li><strong>기술점수 조정</strong>: 기술적 점수가 높은 종목에 추가 가중치</li>';
  html += '<li><strong>분산투자 효과</strong>: 여러 종목에 분산하여 리스크 감소</li>';
  html += '</ul>';
  html += '</div>';
  
  html += '</div>';
  container.innerHTML = html;
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
  
  html += '</div>';
  container.innerHTML = html;
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
  
  html += '</div>';
  container.innerHTML = html;
}


// ==================== 미국 AI 차트 패턴 ====================
async function analyzeUsAiPattern() {
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
  
  // 패턴 해석 가이드
  html += '<div style="margin-top:15px; padding:15px; background:#fef3c7; border-radius:8px;">';
  html += '<h4>📋 패턴 해석 가이드</h4>';
  html += '<ul style="margin:10px 0 0 20px; color:#666; font-size:0.9rem;">';
  html += '<li><strong>Double Bottom</strong>: W shape, bullish reversal</li>';
  html += '<li><strong>Double Top</strong>: M shape, bearish reversal</li>';
  html += '<li><strong>Triangle</strong>: Consolidation, breakout expected</li>';
  html += '<li><strong>Range</strong>: Buy at support, sell at resistance</li>';
  html += '</ul>';
  html += '</div>';
  
  html += '</div>';
  container.innerHTML = html;
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
  
  html += '</div>';
  container.innerHTML = html;
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
  
  html += '</div>';
  container.innerHTML = html;
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
function showNotification(options) {
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
