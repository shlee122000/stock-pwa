// 차트 패턴 인식 함수들

/**
 * 더블탑 패턴 인식
 * @param {Array} data - 주가 데이터 [{time, open, high, low, close}]
 * @param {Number} tolerance - 허용 오차 (기본 2%)
 * @returns {Array} - 발견된 패턴들 [{type, startIndex, peak1Index, valleyIndex, peak2Index, endIndex, confidence}]
 */
function findDoubleTop(data, tolerance = 0.02) {
  const patterns = [];
  const minDistance = 10; // 최소 10개 캔들 간격
  const maxDistance = 50; // 최대 50개 캔들 간격

  for (let i = minDistance; i < data.length - minDistance * 2; i++) {
    // 첫 번째 고점 찾기
    if (isPeak(data, i)) {
      const peak1 = data[i].high;
      
      // 중간 저점 찾기
      for (let j = i + minDistance; j < Math.min(i + maxDistance, data.length - minDistance); j++) {
        if (isValley(data, j)) {
          const valley = data[j].low;
          
          // 두 번째 고점 찾기
          for (let k = j + minDistance; k < Math.min(j + maxDistance, data.length); k++) {
            if (isPeak(data, k)) {
              const peak2 = data[k].high;
              
              // 두 고점이 비슷한지 확인 (tolerance 범위 내)
              const priceDiff = Math.abs(peak1 - peak2) / peak1;
              
              if (priceDiff <= tolerance) {
                // 중간 저점이 두 고점보다 충분히 낮은지 확인 (최소 3% 차이)
                const valleyDrop = (peak1 - valley) / peak1;
                
                if (valleyDrop >= 0.03) {
                  // 신뢰도 계산 (고점이 비슷할수록, 저점이 낮을수록 높음)
                  const confidence = calculateConfidence(priceDiff, valleyDrop);
                  
                  patterns.push({
                    type: 'doubleTop',
                    startIndex: i,
                    peak1Index: i,
                    peak1Price: peak1,
                    valleyIndex: j,
                    valleyPrice: valley,
                    peak2Index: k,
                    peak2Price: peak2,
                    endIndex: k,
                    confidence: confidence,
                    targetPrice: valley - (peak1 - valley) // 예상 하락 목표가
                  });
                }
              }
            }
          }
        }
      }
    }
  }

  return patterns;
}

/**
 * 더블바텀 패턴 인식
 * @param {Array} data - 주가 데이터
 * @param {Number} tolerance - 허용 오차
 * @returns {Array} - 발견된 패턴들
 */
function findDoubleBottom(data, tolerance = 0.02) {
  const patterns = [];
  const minDistance = 10;
  const maxDistance = 50;

  for (let i = minDistance; i < data.length - minDistance * 2; i++) {
    // 첫 번째 저점 찾기
    if (isValley(data, i)) {
      const bottom1 = data[i].low;
      
      // 중간 고점 찾기
      for (let j = i + minDistance; j < Math.min(i + maxDistance, data.length - minDistance); j++) {
        if (isPeak(data, j)) {
          const peak = data[j].high;
          
          // 두 번째 저점 찾기
          for (let k = j + minDistance; k < Math.min(j + maxDistance, data.length); k++) {
            if (isValley(data, k)) {
              const bottom2 = data[k].low;
              
              // 두 저점이 비슷한지 확인
              const priceDiff = Math.abs(bottom1 - bottom2) / bottom1;
              
              if (priceDiff <= tolerance) {
                // 중간 고점이 두 저점보다 충분히 높은지 확인
                const peakRise = (peak - bottom1) / bottom1;
                
                if (peakRise >= 0.03) {
                  const confidence = calculateConfidence(priceDiff, peakRise);
                  
                  patterns.push({
                    type: 'doubleBottom',
                    startIndex: i,
                    bottom1Index: i,
                    bottom1Price: bottom1,
                    peakIndex: j,
                    peakPrice: peak,
                    bottom2Index: k,
                    bottom2Price: bottom2,
                    endIndex: k,
                    confidence: confidence,
                    targetPrice: peak + (peak - bottom1) // 예상 상승 목표가
                  });
                }
              }
            }
          }
        }
      }
    }
  }

  return patterns;
}

// 고점 판단 (앞뒤 5개 캔들보다 높으면 고점)
function isPeak(data, index, lookback = 5) {
  if (index < lookback || index >= data.length - lookback) {
    return false;
  }
  
  const current = data[index].high;
  
  for (let i = index - lookback; i <= index + lookback; i++) {
    if (i !== index && data[i].high >= current) {
      return false;
    }
  }
  
  return true;
}

// 저점 판단 (앞뒤 5개 캔들보다 낮으면 저점)
function isValley(data, index, lookback = 5) {
  if (index < lookback || index >= data.length - lookback) {
    return false;
  }
  
  const current = data[index].low;
  
  for (let i = index - lookback; i <= index + lookback; i++) {
    if (i !== index && data[i].low <= current) {
      return false;
    }
  }
  
  return true;
}

// 신뢰도 계산 (0-100 점수)
function calculateConfidence(priceDiff, heightDiff) {
  // 가격 차이가 작을수록 높은 점수 (최대 50점)
  const priceScore = (1 - priceDiff / 0.02) * 50;
  
  // 고점-저점 차이가 클수록 높은 점수 (최대 50점)
  const heightScore = Math.min(heightDiff / 0.10, 1) * 50;
  
  return Math.round(priceScore + heightScore);
}

module.exports = {
  findDoubleTop,
  findDoubleBottom
};