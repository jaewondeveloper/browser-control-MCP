# browser-control-mcp

![](https://badge.mcpx.dev 'MCP') 

에이전트가 **MCP 도구만**으로 브라우저를 조작합니다. 별도 `.mjs` 스크립트는 필요 없습니다.

## 핵심

- **BOT 커서 항상 표시**: 모든 페이지·이동·프레임 후 자동 주입, `BOT` 뱃지
- **부드러운 이동**: 거리 기반 420–1600ms, ease-in-out quint
- **클릭 모션**: 누르기 축소 + 파란 리플
- **브라우저**: `chromium` | `chrome` | `edge` | `firefox`

## 설치

```bash
npm install
npm run install:browsers
npm run build
```

## Cursor MCP

```json
{
  "mcpServers": {
    "browser-control": {
      "command": "node",
      "args": ["C:/Users/신 재원/Projects/browser-control-mcp/dist/index.js"],
      "env": { "BROWSER_CONTROL_DEFAULT_BROWSER": "chromium" }
    }
  }
}
```

## 에이전트 워크플로 (스크립트 금지)

1. `browser_navigate` — `{ "url": "https://youtube.com" }`
2. `browser_wait_for` — `{ "text": "Accept" }` 또는 쿠키 버튼
3. `browser_snapshot` — ref 목록
4. `browser_click` / `browser_click_selector` / `browser_click_text`
5. `browser_type`, `browser_press_key`, `browser_scroll`, `browser_screenshot`

## MCP 도구 목록

| 도구 | 용도 |
|------|------|
| `browser_navigate` | URL 이동 |
| `browser_launch` | 빈 창 열기 |
| `browser_snapshot` | ref 트리 |
| `browser_click` | ref 클릭 |
| `browser_click_selector` | CSS 클릭 |
| `browser_click_text` | 텍스트 클릭 |
| `browser_click_role` | role+name 클릭 |
| `browser_click_xy` | 좌표 클릭 |
| `browser_hover` / `browser_hover_selector` | 호버 |
| `browser_drag` | 드래그 |
| `browser_fill` / `browser_fill_ref` | 입력 |
| `browser_type` | 키보드 입력 |
| `browser_select_option` | 셀렉트 |
| `browser_press_key` | 단축키 |
| `browser_scroll` / `browser_scroll_to_ref` | 스크롤 |
| `browser_wait` / `browser_wait_for` | 대기 |
| `browser_evaluate` | JS 실행 |
| `browser_back` / `browser_forward` / `browser_reload` | 탐색 |
| `browser_get_page_info` | URL/제목 |
| `browser_screenshot` | 캡처 |
| `browser_close` | 종료 |

## 예: YouTube 재생 (도구만)

```
browser_navigate → youtube.com
browser_click_text → "Accept all" 또는 "모두 수락"
browser_click_selector → "a#thumbnail[href*='watch']"  (또는 snapshot 후 browser_click)
browser_click_selector → "button.ytp-large-play-button"
```

## 커서 커스터마이즈

`src/virtual-cursor.ts` — 속도·색·SVG·BOT 뱃지
