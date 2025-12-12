const express = require('express');
const router = express.Router();
const naverFinance = require('../api/naverFinance');

// 종목 검색
router.get('/search', async (req, res) => {
  try {
    const { keyword } = req.query;
    const results = await naverFinance.searchStock(keyword);
    res.json({ success: true, data: results });
  } catch (error) {
    console.error('검색 오류:', error);
    res.json({ success: false, error: error.message });
  }
});

// 종목 정보 조회
router.get('/stock/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const data = await naverFinance.getStockData(code);
    res.json({ success: true, data: data });
  } catch (error) {
    console.error('종목 조회 오류:', error);
    res.json({ success: false, error: error.message });
  }
});

// 차트 데이터 조회
router.get('/chart/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const { period } = req.query;
    const data = await naverFinance.getChartData(code, period || 'day');
    res.json({ success: true, data: data });
  } catch (error) {
    console.error('차트 조회 오류:', error);
    res.json({ success: false, error: error.message });
  }
});

// 환율 조회
router.get('/exchange', async (req, res) => {
  try {
    const data = await naverFinance.getExchangeRate();
    res.json({ success: true, data: data });
  } catch (error) {
    console.error('환율 조회 오류:', error);
    res.json({ success: false, error: error.message });
  }
});

// 테마 목록 조회
router.get('/themes', async (req, res) => {
  try {
    const data = await naverFinance.getThemeList();
    res.json({ success: true, data: data });
  } catch (error) {
    console.error('테마 목록 오류:', error);
    res.json({ success: false, error: error.message });
  }
});

// 테마별 종목 조회
router.get('/theme/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const data = await naverFinance.getThemeStocks(code);
    res.json({ success: true, data: data });
  } catch (error) {
    console.error('테마 종목 오류:', error);
    res.json({ success: false, error: error.message });
  }
});

// 종목 뉴스 조회
router.get('/news/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const data = await naverFinance.getStockNews(code);
    res.json({ success: true, data: data });
  } catch (error) {
    console.error('뉴스 조회 오류:', error);
    res.json({ success: false, error: error.message });
  }
});



// 시장 지수 조회
router.get('/market-index', async (req, res) => {
  try {
    const https = require('https');
    const iconv = require('iconv-lite');
    
    // KOSPI 조회
    const kospiBuffer = await new Promise((resolve, reject) => {
      https.get('https://finance.naver.com/sise/sise_index.naver?code=KOSPI', (response) => {
        const chunks = [];
        response.on('data', chunk => chunks.push(chunk));
        response.on('end', () => resolve(Buffer.concat(chunks)));
        response.on('error', reject);
      }).on('error', reject);
    });
    const kospiHtml = iconv.decode(kospiBuffer, 'EUC-KR');
    
    // KOSDAQ 조회
    const kosdaqBuffer = await new Promise((resolve, reject) => {
      https.get('https://finance.naver.com/sise/sise_index.naver?code=KOSDAQ', (response) => {
        const chunks = [];
        response.on('data', chunk => chunks.push(chunk));
        response.on('end', () => resolve(Buffer.concat(chunks)));
        response.on('error', reject);
      }).on('error', reject);
    });
    const kosdaqHtml = iconv.decode(kosdaqBuffer, 'EUC-KR');
    
    function parseIndex(html) {
      let value = '--';
      let change = '--';
      
      // 현재가: now_value 클래스에서 추출
      const valueMatch = html.match(/now_value[^>]*>\s*([0-9,.]+)/);
      if (valueMatch) value = valueMatch[1];
      
      // 변동값과 변동률
      const changeMatch = html.match(/change_value[^>]*>\s*([0-9,.]+)/);
      const rateMatch = html.match(/change_rate[^>]*>\s*([0-9,.]+)/);
      
      // 상승/하락 여부
      const isDown = html.includes('point_dn') || html.includes('ico_dw') || html.includes('down.gif') || html.includes('bu_down');
      
      if (changeMatch) {
        const sign = isDown ? '-' : '+';
        change = sign + changeMatch[1];
        if (rateMatch) {
          change += ' (' + sign + rateMatch[1] + '%)';
        }
      }
      
      return { value, change };
    }
    
    const result = {
      kospi: parseIndex(kospiHtml),
      kosdaq: parseIndex(kosdaqHtml)
    };
    
    console.log('시장 지수:', result);
    res.json({ success: true, data: result });
    
  } catch (error) {
    console.error('시장 지수 오류:', error);
    res.json({ success: false, error: error.message });
  }
});


// 거래량 상위 종목
router.get('/top-volume', async (req, res) => {
  try {
    const url = 'https://finance.naver.com/sise/sise_quant.naver';
    const https = require('https');
    const iconv = require('iconv-lite');
    
    const buffer = await new Promise((resolve, reject) => {
      https.get(url, (response) => {
        const chunks = [];
        response.on('data', chunk => chunks.push(chunk));
        response.on('end', () => resolve(Buffer.concat(chunks)));
        response.on('error', reject);
      }).on('error', reject);
    });
    
    const html = iconv.decode(buffer, 'EUC-KR');
    
    const stocks = [];
    const pattern = /href="\/item\/main\.naver\?code=(\d{6})"[^>]*>\s*([^<]+)\s*<\/a>/g;
    let match;
    
    while ((match = pattern.exec(html)) !== null && stocks.length < 10) {
      const code = match[1];
      const name = match[2].trim();
      
      if (name && !stocks.find(s => s.code === code)) {
        stocks.push({ code, name });
      }
    }
    
    console.log('거래량 상위:', stocks.length, '개');
    res.json({ success: true, data: stocks });
    
  } catch (error) {
    console.error('거래량 상위 오류:', error);
    res.json({ success: false, error: error.message });
  }
});

// 시가총액 순위 조회
router.get('/market-cap/:market', async (req, res) => {
  try {
    const market = parseInt(req.params.market) || 0; // 0=KOSPI, 1=KOSDAQ
    const data = await naverFinance.getMarketCapRanking(market);
    res.json({ success: true, data: data });
  } catch (error) {
    console.error('시가총액 순위 오류:', error);
    res.json({ success: false, error: error.message });
  }
});


// 종목 뉴스 검색
router.get('/news/:name', async (req, res) => {
  try {
    const stockName = decodeURIComponent(req.params.name);
    const data = await naverFinance.getStockNews(stockName);
    res.json({ success: true, data: data });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

module.exports = router;