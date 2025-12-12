/**
 * 네이버 금융 데이터 수집 모듈 (Node.js 내장 모듈 사용)
 */

const iconv = require('iconv-lite');
const https = require('https');
const http = require('http');

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
};

/**
 * HTTP GET 요청
 */
function httpGet(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    };
    
    const req = client.get(url, options, (res) => {
      const chunks = [];
      
      res.on('data', (chunk) => {
        chunks.push(chunk);
      });
      
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        
        // Content-Type 헤더에서 인코딩 확인
        const contentType = res.headers['content-type'] || '';
        let html;
        
        if (contentType.includes('utf-8') || contentType.includes('UTF-8')) {
          html = buffer.toString('utf-8');
        } else {
          // EUC-KR 디코딩 시도
          html = iconv.decode(buffer, 'EUC-KR');
          
          // 깨진 문자 확인 후 UTF-8 재시도
          if (html.includes('�') || html.includes('锟')) {
            html = buffer.toString('utf-8');
          }
        }
        
        resolve(html);
      });
    });
    
    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}



/**
 * 간단한 HTML 파싱 헬퍼
 */
function extractText(html, startTag, endTag) {
  const startIdx = html.indexOf(startTag);
  if (startIdx === -1) return '';
  const start = startIdx + startTag.length;
  const end = html.indexOf(endTag, start);
  if (end === -1) return '';
  return html.substring(start, end).trim();
}



/**
 * 종목 검색
 */
async function searchStock(keyword) {
  try {
    // 종목코드인 경우 직접 조회
    if (/^\d{6}$/.test(keyword)) {
      const stockData = await getStockData(keyword);
      if (stockData && stockData.name) {
        return [{ code: keyword, name: stockData.name }];
      }
      return [];
    }
    
    const results = [];
    
    // KOSPI 전체 페이지 검색 (1~40페이지)
    for (let page = 1; page <= 40; page++) {
      const url = `https://finance.naver.com/sise/sise_market_sum.naver?sosok=0&page=${page}`;
      const html = await httpGet(url);
      
      const pattern = /href="\/item\/main\.naver\?code=(\d{6})"[^>]*>\s*([^<]+)\s*<\/a>/g;
      let match;
      
      while ((match = pattern.exec(html)) !== null) {
        const code = match[1];
        const name = match[2].trim();
        
        if (name.includes(keyword) && !results.find(r => r.code === code)) {
          results.push({ code, name });
        }
      }
      
      if (results.length >= 20) break;
    }
    
    // KOSDAQ 전체 페이지 검색 (1~40페이지)
    if (results.length < 20) {
      for (let page = 1; page <= 40; page++) {
        const url = `https://finance.naver.com/sise/sise_market_sum.naver?sosok=1&page=${page}`;
        const html = await httpGet(url);
        
        const pattern = /href="\/item\/main\.naver\?code=(\d{6})"[^>]*>\s*([^<]+)\s*<\/a>/g;
        let match;
        
        while ((match = pattern.exec(html)) !== null) {
          const code = match[1];
          const name = match[2].trim();
          
          if (name.includes(keyword) && !results.find(r => r.code === code)) {
            results.push({ code, name });
          }
        }
        
        if (results.length >= 20) break;
      }
    }
    
    console.log('검색 키워드:', keyword, '결과:', results.length, '개');
    return results.slice(0, 20);
    
  } catch (error) {
    console.error('종목 검색 오류:', error);
    return [];
  }
}


/**
 * 종목 상세 정보 조회
 */
async function getStockData(stockCode) {
  try {
    console.log('종목 조회:', stockCode);
    
    const url = `https://finance.naver.com/item/main.naver?code=${stockCode}`;
    const html = await httpGet(url);

    // 종목명 추출
    let name = '';
    const titleMatch = html.match(/<title>([^:]+)/);
    if (titleMatch) {
      name = titleMatch[1].trim();
    }
    
    // 현재가 추출
    let price = 0;
    const priceMatch = html.match(/no_today[^>]*>[\s\S]*?blind[^>]*>([0-9,]+)/);
    if (priceMatch) {
      price = parseInt(priceMatch[1].replace(/,/g, '')) || 0;
    }
    
    // 전일대비 추출
    let change = 0;
    const changeMatch = html.match(/no_exday[^>]*>[\s\S]*?blind[^>]*>([0-9,]+)/);
    if (changeMatch) {
      change = parseInt(changeMatch[1].replace(/,/g, '')) || 0;
    }
    
    // 상승/하락 여부
    const isUp = html.includes('no_up');
    const isDown = html.includes('no_down');

    // PER 추출
    let per = '--';
    const perMatch = html.match(/PER[^0-9]*([0-9.]+)/i);
    if (perMatch) {
      per = perMatch[1];
    }

    // PBR 추출
    let pbr = '--';
    const pbrMatch = html.match(/PBR[^0-9]*([0-9.]+)/i);
    if (pbrMatch) {
      pbr = pbrMatch[1];
    }

    console.log('종목 조회 완료:', name, price);

    return {
      code: stockCode,
      name: name,
      price: price,
      change: isDown ? -change : change,
      changeRate: price > 0 ? ((change / (price - change)) * 100).toFixed(2) : 0,
      volume: 0,
      per: per,
      pbr: pbr,
      roe: '--',
      marketCap: '--',
      high52w: 0,
      low52w: 0,
      dividendYield: '--',
      isUp: isUp,
      isDown: isDown
    };
  } catch (error) {
    console.error('종목 정보 조회 오류:', error.message);
    throw new Error('종목 정보 조회에 실패했습니다: ' + error.message);
  }
}



/**
 * 차트 데이터 조회
 */
async function getChartData(stockCode, period) {
  try {
    console.log('차트 데이터 조회:', stockCode);
    
    const count = 250;
    const url = `https://fchart.stock.naver.com/siseJson.nhn?symbol=${stockCode}&requestType=1&startTime=20200101&endTime=20991231&timeframe=day&count=${count}`;
    
    const dataText = await httpGet(url);
    const chartData = [];
    
    // 각 줄 파싱
    const lines = dataText.trim().split('\n');
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line === ']' || line === ']]' || line.startsWith('[["')) continue;
      
      const cleanLine = line.replace(/[\[\]"'\s]/g, '');
      const parts = cleanLine.split(',');
      
      if (parts.length >= 6 && parts[0].length === 8) {
        const date = parts[0];
        const open = parseInt(parts[1]) || 0;
        const high = parseInt(parts[2]) || 0;
        const low = parseInt(parts[3]) || 0;
        const close = parseInt(parts[4]) || 0;
        const vol = parseInt(parts[5]) || 0;
        
        if (close > 0) {
          chartData.push({
            date: date,
            open: open,
            high: high,
            low: low,
            close: close,
            volume: vol
          });
        }
      }
    }

    console.log('차트 데이터:', chartData.length, '건');

    if (chartData.length === 0) {
      throw new Error('차트 데이터가 없습니다.');
    }

    return chartData;
  } catch (error) {
    console.error('차트 데이터 조회 오류:', error.message);
    throw new Error('차트 데이터 조회에 실패했습니다: ' + error.message);
  }
}

/**
 * 지수 조회
 */
async function getMarketIndex() {
  return { kospi: 0, kosdaq: 0 };
}



/**
 * 시가총액 순위 조회
 * market: 0 = KOSPI, 1 = KOSDAQ
 */
async function getMarketCapRanking(market = 0) {
  try {
    const stocks = [];
    
    // 3페이지까지 조회 (약 150종목)
    for (let page = 1; page <= 3; page++) {
      const url = `https://finance.naver.com/sise/sise_market_sum.naver?sosok=${market}&page=${page}`;
      const html = await httpGet(url);
      
      // 종목 링크 기준으로 파싱
      const stockRegex = /code=(\d{6})"[^>]*class="tltle">([^<]+)<\/a>/g;
      
      let match;
      const codeList = [];
      while ((match = stockRegex.exec(html)) !== null) {
        codeList.push({ code: match[1], name: match[2].trim() });
      }
      
      // 순수 숫자만 있는 td 추출 (내부에 span 없는 것)
      const numberRegex = /<td class="number">([0-9,]+)<\/td>/g;
      const numbers = [];
      while ((match = numberRegex.exec(html)) !== null) {
        numbers.push(match[1].replace(/,/g, ''));
      }
      
      // 종목당 숫자 필드: 현재가, 액면가, 시가총액, 상장주식수, 거래량 등 (약 6개)
      const fieldsPerStock = 6;
      
      for (let i = 0; i < codeList.length; i++) {
        const baseIdx = i * fieldsPerStock;
        if (baseIdx + 2 < numbers.length) {
          const price = parseInt(numbers[baseIdx]) || 0;         // 현재가
          const marketCapValue = parseInt(numbers[baseIdx + 2]) || 0; // 시가총액 (억원)
          
          if (price > 0 && marketCapValue > 0) {
            stocks.push({
              code: codeList[i].code,
              name: codeList[i].name,
              price: price,
              marketCap: marketCapValue,
              marketCapText: marketCapValue.toLocaleString() + '억'
            });
          }
        }
      }
    }
    
    // 시가총액 순으로 정렬 (내림차순)
    stocks.sort((a, b) => b.marketCap - a.marketCap);
    
    console.log('시가총액 순위 조회:', market === 0 ? 'KOSPI' : 'KOSDAQ', stocks.length, '개');
    return stocks;
    
  } catch (error) {
    console.error('시가총액 순위 조회 오류:', error);
    return [];
  }
}

/**
 * 환율 조회 (USD/KRW)
 */
async function getExchangeRate() {
  try {
    const url = 'https://finance.naver.com/marketindex/';
    const html = await httpGet(url);
    
    console.log('환율 HTML 길이:', html.length);
    
    // USD 환율 추출
    let usdRate = 0;
    const usdMatch = html.match(/미국 USD[\s\S]*?<span class="value">([0-9,.]+)<\/span>/);
    if (usdMatch) {
      usdRate = parseFloat(usdMatch[1].replace(/,/g, ''));
    } else {
      // 다른 패턴 시도
      const usdMatch2 = html.match(/class="head usd"[\s\S]*?<span class="value">([0-9,.]+)<\/span>/);
      if (usdMatch2) {
        usdRate = parseFloat(usdMatch2[1].replace(/,/g, ''));
      }
    }
    
    // 일본 엔화 추출
    let jpyRate = 0;
    const jpyMatch = html.match(/일본 JPY[\s\S]*?<span class="value">([0-9,.]+)<\/span>/);
    if (jpyMatch) {
      jpyRate = parseFloat(jpyMatch[1].replace(/,/g, ''));
    }
    
    // 유로 추출
    let eurRate = 0;
    const eurMatch = html.match(/유럽연합 EUR[\s\S]*?<span class="value">([0-9,.]+)<\/span>/);
    if (eurMatch) {
      eurRate = parseFloat(eurMatch[1].replace(/,/g, ''));
    }
    
    console.log('환율 조회:', usdRate, jpyRate, eurRate);
    
    return {
      usd: usdRate,
      jpy: jpyRate,
      eur: eurRate,
      updatedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('환율 조회 오류:', error);
    return { usd: 0, jpy: 0, eur: 0 };
  }
}


/**
 * 테마 목록 조회
 */
async function getThemeList() {
  try {
    const url = 'https://finance.naver.com/sise/theme.naver';
    const html = await httpGet(url);
    
    const themes = [];
    
    // 테마 테이블에서 데이터 추출
    const tableMatch = html.match(/class="type_1 theme"[\s\S]*?<\/table>/);
    if (!tableMatch) {
      console.log('테마 테이블을 찾을 수 없음');
      return themes;
    }
    
    const tableHtml = tableMatch[0];
    
    // 각 테마 행 추출
    const rowRegex = /<tr[^>]*>[\s\S]*?no=(\d+)[^>]*>([^<]+)<\/a>[\s\S]*?<td[^>]*>([^<]*)<\/td>[\s\S]*?<td[^>]*class="[^"]*col2[^"]*"[^>]*>([^<]*)<\/td>/g;
    
    let match;
    while ((match = rowRegex.exec(tableHtml)) !== null) {
      const themeCode = match[1];
      const themeName = match[2].trim();
      const changeRate = match[3].trim();
      
      if (themeName && themeCode) {
        themes.push({
          code: themeCode,
          name: themeName,
          changeRate: changeRate || '0.00%'
        });
      }
    }
    
    // 다른 패턴도 시도
    if (themes.length === 0) {
      const altRegex = /no=(\d+)"[^>]*>([^<]+)<\/a>/g;
      while ((match = altRegex.exec(tableHtml)) !== null) {
        themes.push({
          code: match[1],
          name: match[2].trim(),
          changeRate: '0.00%'
        });
      }
    }
    
    console.log('테마 목록 조회:', themes.length, '개');
    return themes;
    
  } catch (error) {
    console.error('테마 목록 조회 오류:', error);
    return [];
  }
}

/**
 * 테마별 종목 조회
 */
async function getThemeStocks(themeCode) {
  try {
    const url = `https://finance.naver.com/sise/sise_group_detail.naver?type=theme&no=${themeCode}`;
    const html = await httpGet(url);
    
    const stocks = [];
    
    // 종목 테이블에서 데이터 추출
    const rowRegex = /code=(\d{6})[^>]*>([^<]+)<\/a>[\s\S]*?<td[^>]*class="number"[^>]*>([^<]+)<\/td>[\s\S]*?<td[^>]*class="number"[^>]*>[\s\S]*?<span[^>]*class="[^"]*([a-z]+)[^"]*"[^>]*>([^<]*)<\/span>/g;
    
    let match;
    while ((match = rowRegex.exec(html)) !== null) {
      const stockCode = match[1];
      const stockName = match[2].trim();
      const price = match[3].trim().replace(/,/g, '');
      const changeType = match[4]; // 'red' or 'blue'
      const changeValue = match[5].trim();
      
      if (stockCode && stockName) {
        stocks.push({
          code: stockCode,
          name: stockName,
          price: parseInt(price) || 0,
          change: changeType === 'red' ? '+' + changeValue : '-' + changeValue,
          changeType: changeType === 'red' ? 'up' : 'down'
        });
      }
    }
    
    // 다른 패턴 시도
    if (stocks.length === 0) {
      const altRegex = /code=(\d{6})[^>]*>([^<]+)<\/a>/g;
      while ((match = altRegex.exec(html)) !== null) {
        stocks.push({
          code: match[1],
          name: match[2].trim(),
          price: 0,
          change: '0',
          changeType: 'none'
        });
      }
    }
    
    console.log('테마 종목 조회:', stocks.length, '개');
    return stocks;
    
  } catch (error) {
    console.error('테마 종목 조회 오류:', error);
    return [];
  }
}



/**
 * 종목 뉴스 조회 (RSS 사용)
 */
async function getStockNews(stockCode) {
  try {
    // 먼저 종목명 가져오기
    const stockData = await getStockData(stockCode);
    const stockName = stockData.name || stockCode;
    
    // 네이버 뉴스 RSS
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(stockName)}&hl=ko&gl=KR&ceid=KR:ko`;
    const xml = await httpGet(url);
    
    console.log('뉴스 XML 길이:', xml.length);
    
    const news = [];
    
    // RSS 파싱
    const itemRegex = /<item>[\s\S]*?<title>([^<]+)<\/title>[\s\S]*?<link>([^<]+)<\/link>[\s\S]*?<pubDate>([^<]+)<\/pubDate>/g;
    let match;
    
    while ((match = itemRegex.exec(xml)) !== null) {
      let title = match[1].trim();
      // CDATA 제거
      title = title.replace(/<!\[CDATA\[|\]\]>/g, '');
      // HTML 엔티티 디코딩
      title = title.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
      
      const link = match[2].trim();
      const pubDate = match[3].trim();
      
      // 날짜 포맷
      const date = new Date(pubDate);
      const dateStr = (date.getMonth() + 1) + '/' + date.getDate();
      
      news.push({
        title: title,
        link: link,
        source: 'Google News',
        date: dateStr
      });
    }
    
    console.log('뉴스 조회 최종:', news.length, '개');
    return news.slice(0, 10);
    
  } catch (error) {
    console.error('뉴스 조회 오류:', error);
    return [];
  }
}


module.exports = {
  searchStock: searchStock,
  getStockData: getStockData,
  getChartData: getChartData,
  getMarketIndex: getMarketIndex,
  getTopVolume: getMarketCapRanking,
  getMarketCapRanking: getMarketCapRanking,
  getExchangeRate: getExchangeRate,
  getThemeList: getThemeList,
  getThemeStocks: getThemeStocks,
  getStockNews: getStockNews
};