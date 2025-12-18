// ==================== API 캐싱 시스템 ====================

/**
 * 메모리 기반 캐시 관리자
 * - TTL(Time To Live) 지원
 * - 자동 만료 처리
 * - 캐시 통계
 */
class CacheManager {
  constructor() {
    this.cache = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0
    };
    
    // 캐시 설정 (초 단위)
    this.ttlConfig = {
      'stock-quote': 60,        // 주가: 1분
      'stock-chart': 300,       // 차트: 5분
      'stock-analysis': 300,    // 분석: 5분
      'news': 1800,             // 뉴스: 30분
      'theme': 3600,            // 테마: 1시간
      'market-index': 180,      // 시장지수: 3분
      'exchange-rate': 3600,    // 환율: 1시간
      'watchlist': 60,          // 관심종목: 1분
      'portfolio': 60,          // 포트폴리오: 1분
      'us-quote': 60,           // 미국주가: 1분
      'us-analysis': 300        // 미국분석: 5분
    };
    
    // 자동 정리 (5분마다)
    this.startCleanup();
  }
  
  /**
   * 캐시 키 생성
   */
  generateKey(type, params) {
    const paramStr = typeof params === 'object' ? JSON.stringify(params) : String(params);
    return `${type}:${paramStr}`;
  }
  
  /**
   * 캐시에서 데이터 가져오기
   */
  get(type, params) {
    const key = this.generateKey(type, params);
    const cached = this.cache.get(key);
    
    if (!cached) {
      this.stats.misses++;
      return null;
    }
    
    // TTL 체크
    if (Date.now() > cached.expiry) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }
    
    this.stats.hits++;
    return cached.data;
  }
  
  /**
   * 캐시에 데이터 저장
   */
  set(type, params, data) {
    const key = this.generateKey(type, params);
    const ttl = this.ttlConfig[type] || 300; // 기본 5분
    
    this.cache.set(key, {
      data: data,
      expiry: Date.now() + (ttl * 1000),
      createdAt: Date.now()
    });
    
    this.stats.sets++;
  }
  
  /**
   * 특정 타입의 캐시 무효화
   */
  invalidate(type) {
    let count = 0;
    for (const key of this.cache.keys()) {
      if (key.startsWith(type + ':')) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }
  
  /**
   * 특정 키 삭제
   */
  delete(type, params) {
    const key = this.generateKey(type, params);
    return this.cache.delete(key);
  }
  
  /**
   * 전체 캐시 클리어
   */
  clear() {
    const size = this.cache.size;
    this.cache.clear();
    return size;
  }
  
  /**
   * 만료된 캐시 정리
   */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, value] of this.cache.entries()) {
      if (now > value.expiry) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    
    return cleaned;
  }
  
  /**
   * 자동 정리 시작
   */
  startCleanup() {
    setInterval(() => {
      const cleaned = this.cleanup();
      if (cleaned > 0) {
        console.log(`[Cache] 만료된 ${cleaned}개 항목 정리`);
      }
    }, 5 * 60 * 1000); // 5분마다
  }
  
  /**
   * 캐시 통계
   */
  getStats() {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? (this.stats.hits / total * 100).toFixed(1) : 0;
    
    return {
      size: this.cache.size,
      hits: this.stats.hits,
      misses: this.stats.misses,
      sets: this.stats.sets,
      hitRate: hitRate + '%',
      memory: this.estimateMemory()
    };
  }
  
  /**
   * 메모리 사용량 추정 (KB)
   */
  estimateMemory() {
    let bytes = 0;
    for (const [key, value] of this.cache.entries()) {
      bytes += key.length * 2; // 키 (UTF-16)
      bytes += JSON.stringify(value.data).length * 2; // 데이터
    }
    return (bytes / 1024).toFixed(2) + ' KB';
  }
}

// 전역 캐시 인스턴스
const cacheManager = new CacheManager();


// ==================== Debounce/Throttle 유틸 ====================

/**
 * Debounce: 마지막 호출 후 일정 시간 대기
 */
function debounce(func, delay) {
  let timeoutId;
  return function(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
}

/**
 * Throttle: 일정 시간마다 한 번씩만 실행
 */
function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}


// ==================== 캐싱이 적용된 API 호출 ====================

/**
 * 캐싱된 API 호출
 */
async function cachedApiCall(type, endpoint, options, forceRefresh = false) {
  // 캐시 확인 (forceRefresh가 아닐 때만)
  if (!forceRefresh) {
    const cached = cacheManager.get(type, endpoint);
    if (cached) {
      console.log(`[Cache HIT] ${type}:${endpoint}`);
      return cached;
    }
  }
  
  console.log(`[Cache MISS] ${type}:${endpoint}`);
  
  // API 호출
  try {
    const response = await fetch(API_BASE + endpoint, {
      headers: {
        'Content-Type': 'application/json',
        ...((options && options.headers) || {})
      },
      method: (options && options.method) || 'GET',
      body: options && options.body
    });
    
    const data = await response.json();
    
    // 성공 시 캐시 저장
    if (data.success) {
      cacheManager.set(type, endpoint, data);
    }
    
    return data;
  } catch (error) {
    console.error('API 오류:', error);
    return { success: false, error: error.message };
  }
}


// ==================== 배치 API 호출 ====================

/**
 * 여러 API를 동시에 호출 (병렬 처리)
 */
async function batchApiCall(requests) {
  const promises = requests.map(req => 
    cachedApiCall(req.type, req.endpoint, req.options, req.forceRefresh)
  );
  
  return Promise.all(promises);
}


// ==================== 로딩 상태 관리 ====================

class LoadingManager {
  constructor() {
    this.activeLoaders = new Set();
  }
  
  start(id) {
    this.activeLoaders.add(id);
    this.updateUI();
  }
  
  stop(id) {
    this.activeLoaders.delete(id);
    this.updateUI();
  }
  
  updateUI() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
      overlay.style.display = this.activeLoaders.size > 0 ? 'flex' : 'none';
    }
  }
  
  isLoading(id) {
    return this.activeLoaders.has(id);
  }
  
  stopAll() {
    this.activeLoaders.clear();
    this.updateUI();
  }
}

const loadingManager = new LoadingManager();


// ==================== 에러 핸들러 ====================

/**
 * 에러 처리 및 사용자 알림
 */
function handleError(error, context = '') {
  console.error(`[Error${context ? ' - ' + context : ''}]:`, error);
  
  // 사용자 친화적 메시지
  let message = '오류가 발생했습니다.';
  
  if (error.message) {
    if (error.message.includes('fetch')) {
      message = '네트워크 연결을 확인해주세요.';
    } else if (error.message.includes('timeout')) {
      message = '요청 시간이 초과되었습니다. 다시 시도해주세요.';
    }
  }
  
  // 사용자에게 알림 (필요시)
  // showToast(message, 'error');
}


// ==================== 성능 모니터링 ====================

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      apiCalls: [],
      pageLoads: []
    };
  }
  
  trackApiCall(endpoint, duration, cached) {
    this.metrics.apiCalls.push({
      endpoint,
      duration,
      cached,
      timestamp: Date.now()
    });
    
    // 최근 100개만 유지
    if (this.metrics.apiCalls.length > 100) {
      this.metrics.apiCalls.shift();
    }
  }
  
  getAverageApiTime() {
    if (this.metrics.apiCalls.length === 0) return 0;
    
    const total = this.metrics.apiCalls.reduce((sum, call) => sum + call.duration, 0);
    return (total / this.metrics.apiCalls.length).toFixed(2);
  }
  
  getCacheEfficiency() {
    if (this.metrics.apiCalls.length === 0) return 0;
    
    const cached = this.metrics.apiCalls.filter(call => call.cached).length;
    return (cached / this.metrics.apiCalls.length * 100).toFixed(1);
  }
  
  getReport() {
    return {
      totalApiCalls: this.metrics.apiCalls.length,
      averageTime: this.getAverageApiTime() + 'ms',
      cacheEfficiency: this.getCacheEfficiency() + '%',
      ...cacheManager.getStats()
    };
  }
}

const performanceMonitor = new PerformanceMonitor();


// ==================== Export ====================

// 전역으로 사용 가능하도록 설정
window.cacheManager = cacheManager;
window.cachedApiCall = cachedApiCall;
window.batchApiCall = batchApiCall;
window.loadingManager = loadingManager;
window.performanceMonitor = performanceMonitor;
window.debounce = debounce;
window.throttle = throttle;
window.handleError = handleError;
