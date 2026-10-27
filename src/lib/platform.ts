// 判斷目前執行環境，用於「加入主畫面」引導。

/** 是否已從主畫面（獨立視窗）開啟 */
export function isStandalone(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
  return iosStandalone || window.matchMedia('(display-mode: standalone)').matches
}

export type Platform = 'ios' | 'android' | 'other'

export function detectPlatform(ua: string = navigator.userAgent, maxTouchPoints = navigator.maxTouchPoints): Platform {
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios'
  // iPadOS 13 以後的 Safari 會假裝成 Mac，用觸控點數判斷
  if (/Macintosh/i.test(ua) && maxTouchPoints > 1) return 'ios'
  if (/Android/i.test(ua)) return 'android'
  return 'other'
}
