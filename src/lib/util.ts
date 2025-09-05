// src/lib/util.ts

// 가격 숫자를 보기 좋게 포맷 (정수/소수 구분)
export function toFixedNice(n: number, digits = 2) {
  if (n >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: digits });
  // 소수 코인도 깔끔하게
  return n.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 8 });
}

// 문자열 대문자화
export function upper(s: string) { 
  return s.toUpperCase(); 
}

// 현재 시간을 한국 시간(KST)으로 포맷
export function nowKST() {
  return new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
}

// ✅ 김프, 변동률 등에 쓰는 퍼센트 포맷
export function toPct(n: number, digits = 2) {
  return `${(n * 100).toFixed(digits)}%`;
}
