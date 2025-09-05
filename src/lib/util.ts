export function toFixedNice(n: number, digits = 2) {
  if (n >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: digits });
  // 소수 코인도 깔끔하게
  return n.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 8 });
}

export function upper(s: string) { return s.toUpperCase(); }

export function nowKST() {
  const kst = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
  return kst;
}
