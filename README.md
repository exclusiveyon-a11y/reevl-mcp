# Reevl MCP

한국 아파트 실거래 데이터를 AI에서 바로 질의하는 [MCP](https://modelcontextprotocol.io) 서버입니다.
전국 아파트 **45,000여 개**의 실거래 시세·전세가율·거래량·입지 점수와 리블 AI 가격 예측을 제공합니다.

무료이고 인증이 없습니다. 읽기 전용입니다.

```
https://reevl.co.kr/api/mcp
```

---

## 연결하기

### Streamable HTTP를 지원하는 호스트 (권장)

Claude, ChatGPT 등 원격 MCP를 직접 지원하는 곳은 URL만 넣으면 됩니다.

```json
{
  "mcpServers": {
    "reevl": {
      "type": "http",
      "url": "https://reevl.co.kr/api/mcp"
    }
  }
}
```

### stdio만 지원하는 호스트

이 저장소의 브리지를 씁니다. 설치할 것이 없습니다(Node 18+).

```json
{
  "mcpServers": {
    "reevl": {
      "command": "npx",
      "args": ["-y", "reevl-mcp"]
    }
  }
}
```

브리지가 하는 일은 하나입니다 — MCP 2026-07-28 사양이 요구하는
`MCP-Protocol-Version`·`Mcp-Method`·`Mcp-Name` 헤더를 본문과 맞춰 붙입니다.
서버는 이 값들이 본문과 다르면 거절하므로(`-32020`), 손으로 붙이면 매번 틀립니다.

---

## 도구

| 도구 | 언제 쓰나 |
|---|---|
| `describe_fields` | **조건 검색 전에 먼저.** 쓸 수 있는 축과 **단위**, 값 분포를 준다 |
| `search_apartments` | 지역·브랜드·시공사·가격·세대수·전세가율·AI예측 등으로 거른다 |
| `get_apartment` | 단지 하나의 전 축을 묶음으로 |
| `list_articles` | 리블이 발행한 부동산 브리핑(정책·시장 분석) |

전부 `readOnlyHint: true`이고 쓰기·주문·중개 기능은 없습니다.

### 단위를 지어내지 마세요

응답에는 항상 `units`가 함께 옵니다. **그것을 그대로 읽으세요.**
단위를 모르고 범위를 넣으면 조건이 100배 틀립니다 —
예를 들어 전세가율은 값 그대로 %(60이면 60%)이고, 세대당 대지지분은 10으로 나눠야 ㎡입니다.
그래서 `describe_fields`를 먼저 부르길 권합니다.

---

## 이렇게 물어보세요

- 서울 강남구에서 1,000세대 넘고 AI 1년 예측이 높은 단지 알려줘
- 수원시에서 전세가율 70% 이상인 20억 이하 아파트 찾아줘
- 이 단지 시세·전세가율·학군 점수 정리해줘
- 요즘 부동산 정책 흐름 리블 아티클로 요약해줘

---

## 프로토콜

MCP **2026-07-28**과 이전 개정(`2025-11-25` ~ `2024-11-05`)을 함께 지원하는
[dual-era](https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning) 서버입니다.

- `_meta`에 버전을 실은 요청 → 2026-07-28 규칙(무세션·헤더 대조)
- `initialize`로 시작하는 요청 → 해당 legacy 개정

`server/discover`로 지원 버전을 한 번에 확인할 수 있습니다.

```bash
curl -s https://reevl.co.kr/api/mcp \
  -H 'content-type: application/json' \
  -H 'mcp-protocol-version: 2026-07-28' \
  -H 'mcp-method: server/discover' \
  -d '{"jsonrpc":"2.0","id":1,"method":"server/discover","params":{}}'
```

같은 데이터를 REST로도 씁니다 — [OpenAPI 명세](https://reevl.co.kr/api/v1/openapi.json)

---

## 데이터 출처

국토교통부 실거래가 공개시스템, 공동주택관리정보시스템(K-apt), 한국부동산원(R-ONE),
통계청(KOSIS), 한국은행(ECOS), 국토교통부 공간정보 오픈플랫폼(V-World),
교육부 학교알리미, 청약홈 등 각 기관의 공식 오픈API.

출처·수집 주기·가공 방법은 [데이터 출처·현황](https://reevl.co.kr/data)에 공개합니다.

## 유의사항

리블 데이터는 공공데이터를 가공한 **참고용 통계**이며 투자 자문이나 중개가 아닙니다.
예측 정보는 통계적 추정값으로 장래 가격이나 수익을 보장하지 않습니다.
원천 데이터에 오류·누락·지연이 있을 수 있고, 신고 후 정정·해제되는 거래가 있습니다.

자세한 내용은 [이용약관](https://reevl.co.kr/terms)과
[개인정보처리방침](https://reevl.co.kr/privacy)을 보세요.

## 라이선스

브리지 코드는 MIT입니다. 서버와 데이터는 위 약관을 따릅니다.
