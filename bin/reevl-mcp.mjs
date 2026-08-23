#!/usr/bin/env node
// Reevl MCP — stdio ↔ Streamable HTTP 브리지.
//
// 왜 필요한가: 리블 MCP 서버는 https://reevl.co.kr/api/mcp 에 이미 떠 있고,
// Streamable HTTP를 직접 지원하는 호스트(ChatGPT·Claude 웹 등)는 URL만 넣으면 된다.
// 그런데 stdio만 지원하는 호스트가 아직 많다 — 이 파일은 그들을 위한 얇은 다리다.
//
// 이 브리지가 실제로 하는 일은 하나다: **2026-07-28 사양이 요구하는 헤더를 붙이는 것.**
//   MCP-Protocol-Version · Mcp-Method · Mcp-Name
// 서버는 이 헤더를 본문과 대조해 다르면 거절한다(-32020). 손으로 curl을 쓰면 매번 틀린다.
//
// 의존성 0. Node 18+ 의 내장 fetch만 쓴다 — 설치가 가벼워야 사람들이 실제로 붙인다.
const ENDPOINT = process.env.REEVL_MCP_URL || 'https://reevl.co.kr/api/mcp';
const VERSION = '2026-07-28';

/** ASCII로 못 담는 값(한글 단지명 등)은 사양이 정한 센티넬로 감싼다. 안 그러면 헤더가 깨진다. */
const encodeHeader = (v) =>
  /^[\x21-\x7e]([\x20-\x7e]*[\x21-\x7e])?$/.test(v) && !v.startsWith('=?base64?')
    ? v
    : `=?base64?${Buffer.from(v, 'utf8').toString('base64')}?=`;

const write = (obj) => process.stdout.write(JSON.stringify(obj) + '\n');

async function forward(msg) {
  const headers = {
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
    'mcp-protocol-version': VERSION,
    'mcp-method': msg.method,
  };
  // tools/call·resources/read·prompts/get 은 대상 이름도 헤더로 미러링해야 한다.
  const name = msg.params?.name ?? msg.params?.uri;
  if (name) headers['mcp-name'] = encodeHeader(String(name));

  // 본문에도 같은 값을 싣는다 — 헤더는 거울일 뿐이고 본문이 진실이다(사양 표현).
  const body = {
    ...msg,
    params: {
      ...(msg.params ?? {}),
      _meta: {
        ...(msg.params?._meta ?? {}),
        'io.modelcontextprotocol/protocolVersion': VERSION,
        'io.modelcontextprotocol/clientInfo': {name: 'reevl-mcp-bridge', version: '1.0.0'},
        'io.modelcontextprotocol/clientCapabilities': {},
      },
    },
  };

  const res = await fetch(ENDPOINT, {method: 'POST', headers, body: JSON.stringify(body)});
  if (res.status === 202) return;                       // 알림은 본문이 없다
  const text = await res.text();
  try { write(JSON.parse(text)); }
  catch {
    // 서버가 JSON이 아닌 것을 주면(차단 페이지 등) 그대로 흘리지 않고 오류로 바꾼다 —
    // 호스트가 파싱하다 죽으면 원인을 알 길이 없다.
    write({jsonrpc: '2.0', id: msg.id ?? null,
      error: {code: -32603, message: `Unexpected response (HTTP ${res.status}): ${text.slice(0, 200)}`}});
  }
}

// ★★들어온 순서대로 하나씩 처리하고, **큐가 빈 뒤에** 종료한다.
//   처음엔 stdin의 'end'에서 곧장 process.exit(0)을 했는데, 그러면 응답을 기다리지 않고 죽는다 —
//   파이프로 두 줄을 넣으면 첫 줄만 나오고 둘째 줄이 통째로 사라졌다.
//   ★호스트가 프로세스를 계속 띄워 두는 실사용에서는 안 드러나고 테스트에서만 보이는 종류다.
//   ★순차 처리로 두는 이유: MCP는 id로 응답을 짝지으므로 병렬이어도 되지만, 순서가 섞이면
//     사람이 로그를 읽을 때 원인을 못 쫓는다. 이 다리는 초당 수백 건을 나를 물건이 아니다.
let queue = Promise.resolve();

let buf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buf += chunk;
  let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i).trim();
    buf = buf.slice(i + 1);
    if (!line) continue;
    let msg;
    try { msg = JSON.parse(line); }
    catch { write({jsonrpc: '2.0', id: null, error: {code: -32700, message: 'Parse error'}}); continue; }
    const m = msg;
    queue = queue.then(() => forward(m)).catch((e) => {
      write({jsonrpc: '2.0', id: m.id ?? null, error: {code: -32603, message: String(e).slice(0, 200)}});
    });
  }
});
process.stdin.on('end', () => { queue.then(() => process.exit(0)); });
