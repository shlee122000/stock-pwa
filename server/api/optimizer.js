const axios = require('axios');

/**
 * AI 자동 종목 추천
 * @param {String} market - 'korea', 'us', 'mixed'
 * @param {Number} count - 추천 종목 수
 * @returns {Array} 추천 종목 리스트
 */
async function recommendStocks(market, count) {
  try {
    let stocks = [];
    
    if (market === 'korea' || market === 'mixed') {
      const koreaStocks = await getTopKoreanStocks(market === 'mixed' ? Math.ceil(count / 2) : count);
      stocks = stocks.concat(koreaStocks);
    }
    
    if (market === 'us' || market === 'mixed') {
      const usStocks = await getTopUSStocks(market === 'mixed' ? Math.floor(count / 2) : count);
      stocks = stocks.concat(usStocks);
    }
    
    return stocks;
  } catch (error) {
    console.error('종목 추천 오류:', error);
    throw error;
  }
}

/**
 * 한국 시가총액 상위 종목 조회
 */
async function getTopKoreanStocks(count) {
  try {
    // NaverFinance API 호출
    const response = await axios.get('https://m.stock.naver.com/api/stocks/marketValue/KOSPI');
    const stocks = response.data.stocks || [];
    
    // 시가총액 상위 종목 선택
    return stocks
  .slice(0, count)
  .map(stock => ({
    code: stock.stockCode,
    name: stock.stockName || stock.itemabbrnm || '종목명 없음',
    market: 'korea',
    marketCap: stock.marketValue || stock.marketSum,
    sector: stock.industryCodeName || stock.sector || '기타'
  }));
  } catch (error) {
    console.error('한국 종목 조회 오류:', error);
    // 폴백: 기본 종목 리스트
    return getDefaultKoreanStocks(count);
  }
}

/**
 * 미국 시가총액 상위 종목 조회
 */
async function getTopUSStocks(count) {
  // S&P 500 상위 종목
  const topStocks = [
    { code: 'AAPL', name: 'Apple Inc.', sector: 'Technology' },
    { code: 'MSFT', name: 'Microsoft Corporation', sector: 'Technology' },
    { code: 'GOOGL', name: 'Alphabet Inc.', sector: 'Technology' },
    { code: 'AMZN', name: 'Amazon.com Inc.', sector: 'Consumer Cyclical' },
    { code: 'NVDA', name: 'NVIDIA Corporation', sector: 'Technology' },
    { code: 'META', name: 'Meta Platforms Inc.', sector: 'Technology' },
    { code: 'TSLA', name: 'Tesla Inc.', sector: 'Consumer Cyclical' },
    { code: 'BRK.B', name: 'Berkshire Hathaway', sector: 'Financial' },
    { code: 'JPM', name: 'JPMorgan Chase', sector: 'Financial' },
    { code: 'V', name: 'Visa Inc.', sector: 'Financial' },
    { code: 'JNJ', name: 'Johnson & Johnson', sector: 'Healthcare' },
    { code: 'WMT', name: 'Walmart Inc.', sector: 'Consumer Defensive' },
    { code: 'PG', name: 'Procter & Gamble', sector: 'Consumer Defensive' },
    { code: 'XOM', name: 'Exxon Mobil', sector: 'Energy' },
    { code: 'UNH', name: 'UnitedHealth Group', sector: 'Healthcare' },
  ];
  
  return topStocks.slice(0, count).map(stock => ({
    code: stock.code,
    name: stock.name,
    market: 'us',
    sector: stock.sector
  }));
}



/**
 * 기본 한국 종목 리스트 (폴백용)
 */
function getDefaultKoreanStocks(count) {
  const defaultStocks = [
    { code: '005930', name: '삼성전자', sector: '반도체' },
    { code: '000660', name: 'SK하이닉스', sector: '반도체' },
    { code: '373220', name: 'LG에너지솔루션', sector: '2차전지' },
    { code: '207940', name: '삼성바이오로직스', sector: '바이오' },
    { code: '005380', name: '현대차', sector: '자동차' },
    { code: '006400', name: '삼성SDI', sector: '2차전지' },
    { code: '051910', name: 'LG화학', sector: '화학' },
    { code: '005490', name: 'POSCO홀딩스', sector: '철강' },
    { code: '035420', name: 'NAVER', sector: 'IT서비스' },
    { code: '068270', name: '셀트리온', sector: '바이오' },
    { code: '035720', name: '카카오', sector: 'IT서비스' },
    { code: '012330', name: '현대모비스', sector: '자동차부품' },
    { code: '003670', name: '포스코퓨처엠', sector: '소재' },
    { code: '066570', name: 'LG전자', sector: '전자' },
    { code: '096770', name: 'SK이노베이션', sector: '에너지' },
    { code: '105560', name: 'KB금융', sector: '금융' },
    { code: '055550', name: '신한지주', sector: '금융' },
    { code: '086790', name: '하나금융지주', sector: '금융' },
    { code: '032830', name: '삼성생명', sector: '금융' },
    { code: '015760', name: '한국전력', sector: '유틸리티' },
  ];
  
  return defaultStocks.slice(0, count).map(stock => ({
    code: stock.code,
    name: stock.name,
    market: 'korea',
    sector: stock.sector
  }));
}



module.exports = {
  recommendStocks
};



/**
 * 포트폴리오 최적화 계산
 * @param {Array} stocks - 종목 리스트
 * @returns {Object} 최적화 결과
 */
async function optimizePortfolio(stocks) {
  try {
    // 1단계: 각 종목의 과거 데이터 수집
    const stocksWithData = await Promise.all(
      stocks.map(async (stock) => {
        const historicalData = await getHistoricalData(stock.code, stock.market);
        const returns = calculateReturns(historicalData);
        
        return {
          ...stock,
          expectedReturn: calculateExpectedReturn(returns),
          volatility: calculateVolatility(returns),
          data: historicalData
        };
      })
    );
    
    // 2단계: 최적 비중 계산 (균등 가중 시작)
    const weights = calculateOptimalWeights(stocksWithData);
    
    // 3단계: 포트폴리오 지표 계산
    const portfolioMetrics = calculatePortfolioMetrics(stocksWithData, weights);
    
    return {
      stocks: stocksWithData.map((stock, index) => ({
        code: stock.code,
        name: stock.name,
        market: stock.market,
        sector: stock.sector,
        weight: weights[index],
        expectedReturn: stock.expectedReturn,
        volatility: stock.volatility
      })),
      metrics: portfolioMetrics
    };
  } catch (error) {
    console.error('최적화 계산 오류:', error);
    throw error;
  }
}


/**
 * 과거 데이터 조회 (간단 버전)
 */
async function getHistoricalData(code, market) {
  try {
    let url;
    
    if (market === 'korea') {
      url = `http://localhost:3000/api/korea/chart/${code}`;
    } else {
      url = `http://localhost:3000/api/us/chart/${code}`;
    }
    
    const response = await axios.get(url);
    
    if (response.data.success && response.data.data) {
      return response.data.data.map(item => ({
        date: item.time || item.date,
        close: item.close
      }));
    }
    
    // API 실패 시 폴백
    return generateFallbackData();
    
  } catch (error) {
    console.error(`과거 데이터 조회 오류 (${code}):`, error.message);
    return generateFallbackData();
  }
}

// 폴백 데이터 생성 (API 실패 시)
function generateFallbackData() {
  const days = 60;
  const data = [];
  let price = 100;
  
  for (let i = 0; i < days; i++) {
    const change = (Math.random() - 0.5) * 0.04;
    price = price * (1 + change);
    data.push({ date: new Date(Date.now() - i * 86400000), close: price });
  }
  
  return data.reverse();
}



/**
 * 수익률 계산
 */
function calculateReturns(data) {
  const returns = [];
  for (let i = 1; i < data.length; i++) {
    returns.push((data[i].close - data[i-1].close) / data[i-1].close);
  }
  return returns;
}

/**
 * 기대 수익률 계산
 */
function calculateExpectedReturn(returns) {
  const sum = returns.reduce((a, b) => a + b, 0);
  return (sum / returns.length) * 252; // 연율화
}

/**
 * 변동성 계산
 */
function calculateVolatility(returns) {
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const squaredDiffs = returns.map(r => Math.pow(r - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / returns.length;
  return Math.sqrt(variance * 252); // 연율화
}

/**
 * 최적 비중 계산 (균등 가중)
 */
function calculateOptimalWeights(stocks) {
  // 간단 버전: 균등 분배
  const equalWeight = 1 / stocks.length;
  return stocks.map(() => equalWeight);
  
  // TODO: 고급 최적화 (샤프 비율 최대화)
  // - 역변동성 가중
  // - 최소분산 포트폴리오
  // - 최대 샤프 비율
}

/**
 * 포트폴리오 지표 계산
 */
function calculatePortfolioMetrics(stocks, weights) {
  // 포트폴리오 기대 수익률
  const expectedReturn = stocks.reduce((sum, stock, i) => 
    sum + stock.expectedReturn * weights[i], 0
  );
  
  // 포트폴리오 변동성 (간단 버전)
  const volatility = Math.sqrt(
    stocks.reduce((sum, stock, i) => 
      sum + Math.pow(stock.volatility * weights[i], 2), 0
    )
  );
  
  // 샤프 비율 (무위험 수익률 3% 가정)
  const riskFreeRate = 0.03;
  const sharpeRatio = (expectedReturn - riskFreeRate) / volatility;
  
  return {
    expectedReturn: (expectedReturn * 100).toFixed(2) + '%',
    volatility: (volatility * 100).toFixed(2) + '%',
    sharpeRatio: sharpeRatio.toFixed(2)
  };
}

module.exports = {
  recommendStocks,
  optimizePortfolio
};