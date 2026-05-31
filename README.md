# browser-control-mcp

![](https://badge.mcpx.dev 'MCP')

에이전트가 **MCP 도구만**으로 브라우저를 조작합니다. 웹사이트 개발·E2E 테스트 시 **BOT 커서**, **입력 잠금**, **파란 비네팅**으로 “지금 봇이 조작 중”임을 명확히 보여 줍니다.

## 핵심 (v0.6.5)

- **browser_done** — 조작 끝나면 커서·비네팅 제거, **창은 유지** (직접 클릭 가능)
- **browser_close** — 브라우저 창까지 닫기

## 이전 (v0.6)

- **BOT 커서**: 모든 탭·이동 직후 즉시 표시
- **개발/테스트 오버레이** (기본 ON): 화면 클릭 차단 + 창 가장자리 **파란 비네팅** + `BOT 조작 중` 배너
- **빠른 확인**: `browser_ready`, `browser_snapshot` + `quick:true` (네이버 등 무거운 페이지)
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
      "env": {
        "BROWSER_CONTROL_DEFAULT_BROWSER": "chromium",
        "BROWSER_CONTROL_DEV_MODE": "1",
        "BROWSER_CONTROL_LOCK_INPUT": "1",
        "BROWSER_CONTROL_VIGNETTE": "1",
        "BROWSER_CONTROL_FAST": "1",
        "BROWSER_CONTROL_DEV_URL": "http://localhost:5173"
      }
    }
  }
}
```

`BROWSER_CONTROL_DEV_MODE=0` 으로 오버레이만 끌 수 있습니다.

## 웹사이트 만들 때 (로컬 미리보기)

### 1) MCP로 테스트 (권장)

```
browser_dev_start          → localhost (기본 3000, env로 변경 가능)
browser_ready              → DOM 준비 확인 (스냅샷보다 빠름)
browser_snapshot quick:true
browser_click / browser_fill / browser_screenshot
browser_set_dev_mode       → lock·vignette·fast 토글
```

### 2) 프로젝트 HTML에 오버레이 스크립트

`inject/agent-bot-overlay.js` 를 `public/` 에 복사한 뒤:

```html
<script src="/agent-bot-overlay.js" data-agent-bot-overlay></script>
```

`localhost` / `127.0.0.1` 에서만 자동 활성화됩니다. 콘솔에서 `AgentBotOverlay.enable()` / `disable()` 가능.

## 에이전트 워크플로

1. `browser_dev_start` 또는 `browser_navigate`
2. **`browser_ready`** — 페이지 확인 (네이버 등에서 `browser_snapshot` 전에 사용)
3. `browser_snapshot` + `"quick": true` — 가벼운 ref 트리
4. `browser_click` / `browser_click_selector` / `browser_type`
5. `browser_screenshot`

## MCP 도구 (추가/변경)

| 도구 | 용도 |
|------|------|
| `browser_dev_start` | dev 오버레이 + localhost URL 열기 |
| `browser_set_dev_mode` | 입력 잠금·비네팅·빠른 모션 설정 |
| `browser_ready` | 빠른 로드/요소 확인 |
| `browser_snapshot` | `quick:true` 로 경량 트리 |
| `browser_navigate` | URL 이동 (commit 우선, 빠른 체감) |

기존 `browser_click`, `browser_type`, `browser_tabs` 등은 동일합니다.

## 환경 변수

| 변수 | 기본 | 설명 |
|------|------|------|
| `BROWSER_CONTROL_DEV_MODE` | `1` | 오버레이 전체 |
| `BROWSER_CONTROL_LOCK_INPUT` | `1` | 마우스/터치 차단 |
| `BROWSER_CONTROL_VIGNETTE` | `1` | 파란 가장자리 |
| `BROWSER_CONTROL_FAST` | `1` | 빠른 커서·타이핑 |
| `BROWSER_CONTROL_DEV_URL` | — | `browser_dev_start` 기본 URL |
| `BROWSER_CONTROL_DEV_PORT` | `3000` | localhost 포트 |

## 커서 커스터마이즈

`src/virtual-cursor.ts` 의 SVG·색상·`BOT` 뱃지를 수정한 뒤 `npm run build` 하세요.
