// 產生 PWA 所需的所有圖示（從同一個 SVG 繪製）。
// 用法：npm run icons    —— 圖示已提交在 public/，通常不用重跑。
import sharp from 'sharp'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const publicDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')

// 兩張疊起來的卡片；內容都畫在中央 60% 範圍內，maskable 圖示被裁切也不會缺角
const cards = `
  <g transform="rotate(-8 256 256)">
    <rect x="150" y="150" width="212" height="260" rx="28" fill="#c7d2fe"/>
  </g>
  <rect x="168" y="124" width="212" height="260" rx="28" fill="#ffffff"/>
  <rect x="204" y="176" width="140" height="18" rx="9" fill="#4f46e5"/>
  <rect x="204" y="222" width="104" height="18" rx="9" fill="#a5b4fc"/>
  <rect x="204" y="268" width="124" height="18" rx="9" fill="#a5b4fc"/>
`

const svg = (rounded) => `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" ${rounded ? 'rx="112"' : ''} fill="#4f46e5"/>
  ${cards}
</svg>`

const out = async (markup, name, size) => {
  await sharp(Buffer.from(markup)).resize(size, size).png().toFile(join(publicDir, name))
  console.log('已產生', name)
}

// 一般圖示（圓角）
await out(svg(true), 'pwa-192x192.png', 192)
await out(svg(true), 'pwa-512x512.png', 512)
// maskable：滿版背景，系統自己裁切形狀
await out(svg(false), 'maskable-512x512.png', 512)
// iPhone 主畫面圖示：iOS 會自己加圓角，所以用滿版方形
await out(svg(false), 'apple-touch-icon.png', 180)
writeFileSync(join(publicDir, 'favicon.svg'), svg(true).trim() + '\n')
console.log('已產生 favicon.svg')
