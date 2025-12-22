/**
 * 미국 주식 데이터 모듈 (Finnhub API)
 */

const https = require('https');

// 여기에 본인의 API 키를 입력하세요
const API_KEY = 'd4qf0npr01quli1c78o0d4qf0npr01quli1c78og';



/**
 * HTTP GET 요청
 */
function httpGet(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    };
    
    https.get(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    }).on('error', reject);
  });
}



/**
 * 종목 검색
 */
async function searchStock(keyword) {
  try {
    const url = `https://finnhub.io/api/v1/search?q=${encodeURIComponent(keyword)}&token=${API_KEY}`;
    
    console.log('검색 URL:', url);
    
    const data = await httpGet(url);
    
    console.log('API 응답:', JSON.stringify(data));
    
    if (!data.result) {
      return [];
    }
    
    // 미국 거래소만 필터링 (점이 없는 심볼)
    const filtered = data.result.filter(function(item) {
      return !item.symbol.includes('.');
    });
    
    return filtered.map(function(item) {
      return {
        symbol: item.symbol,
        name: item.description,
        type: item.type
      };
    });
    
  } catch (error) {
    console.error('종목 검색 오류:', error);
    return [];
  }
}

/**
 * 주식 시세 조회
 */
async function getQuote(symbol) {
  try {
    const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${API_KEY}`;
    const data = await httpGet(url);
    
    return {
      symbol: symbol,
      price: data.c || 0,
      change: data.d || 0,
      changePercent: data.dp || 0,
      high: data.h || 0,
      low: data.l || 0,
      open: data.o || 0,
      prevClose: data.pc || 0
    };
  } catch (error) {
    console.error('시세 조회 오류:', error);
    throw new Error('시세 조회 실패: ' + error.message);
  }
}

/**
 * 회사 정보 조회
 */
async function getCompanyProfile(symbol) {
  try {
    const url = `https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${API_KEY}`;
    const data = await httpGet(url);
    
    return {
      symbol: symbol,
      name: data.name || symbol,
      industry: data.finnhubIndustry || '--',
      marketCap: data.marketCapitalization || 0,
      logo: data.logo || '',
      weburl: data.weburl || ''
    };
  } catch (error) {
    console.error('회사 정보 조회 오류:', error);
    return { symbol: symbol, name: symbol };
  }
}

/**
 * 차트 데이터 조회 (Yahoo Finance 사용)
 */
async function getCandles(symbol, resolution, from, to) {
  try {
    // Yahoo Finance API 사용
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=5y`;
    
    console.log('Yahoo 차트 URL:', url);
    
    const response = await httpGet(url);
    
    console.log('Yahoo 전체 응답:', JSON.stringify(response).substring(0, 500));
    
    // 응답이 문자열인 경우 파싱
    let data = response;
    if (typeof response === 'string') {
      try {
        data = JSON.parse(response);
      } catch (e) {
        console.log('JSON 파싱 실패, 원본:', response.substring(0, 200));
        throw new Error('응답 파싱 실패');
      }
    }
    
    if (!data.chart || !data.chart.result || data.chart.result.length === 0) {
      console.log('차트 데이터 구조:', Object.keys(data));
      throw new Error('차트 데이터 없음');
    }
    
    const result = data.chart.result[0];
    const timestamps = result.timestamp;
    const quotes = result.indicators.quote[0];
    
    if (!timestamps || !quotes) {
      throw new Error('차트 데이터 형식 오류');
    }
    
    const candles = [];
    for (let i = 0; i < timestamps.length; i++) {
      if (quotes.close[i] !== null) {
        candles.push({
          date: new Date(timestamps[i] * 1000).toISOString().slice(0, 10),
          open: quotes.open[i] || 0,
          high: quotes.high[i] || 0,
          low: quotes.low[i] || 0,
          close: quotes.close[i] || 0,
          volume: quotes.volume[i] || 0
        });
      }
    }
    
    console.log('Yahoo 차트 데이터:', candles.length, '건');
    return candles;
    
  } catch (error) {
    console.error('차트 데이터 조회 오류:', error);
    throw new Error('차트 조회 실패: ' + error.message);
  }
}



module.exports = {
  searchStock,
  getQuote,
  getCompanyProfile,
  getCandles
};