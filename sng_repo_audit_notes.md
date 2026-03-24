# sng-practice Repo Audit Notes

대상 레포: `udfnd/sng-practice`

이 문서는 코드 기반으로 확인한 **게임 진행상 문제점**을 요약한 감사(audit) 메모다.  
주요 관심사는 **베팅 라운드 종료 조건, all-in 처리, 쇼다운, 사이드팟, 이벤트 리듀서 정합성** 이다.

---

## 핵심 결론

현재 엔진은 기본적인 핸드 진행 구조는 갖추고 있지만, 실제 토너먼트 기준으로는 아래 3개가 특히 치명적이다.

1. **올인 후 아직 결정을 해야 하는 플레이어가 남아 있어도 자동 runout 되는 버그**
2. **short all-in이 잘못 betting reopen을 발생시키는 버그**
3. **폴드 승리 핸드에서 실제 상태와 이벤트 리플레이 상태가 달라지는 버그**

이 3개는 우선순위 P0로 수정해야 한다.

---

## 1) 폴드 승리 시 실제 상태와 이벤트 로그가 불일치

### 관련 코드
- `src/engine/orchestrator.ts`
- `src/engine/betting.ts`
- `src/engine/event-reducer.ts`

### 관찰
폴드로 1명만 남는 핸드에서 오케스트레이터는 `handleFoldWin()` 이전 시점의 pot snapshot으로 `AWARD_POT` 이벤트를 만들고 있다.  
그런데 같은 흐름 안에서 `UNCALLED_RETURN`이 별도로 처리되면서, **실제 state와 event replay 결과가 달라질 수 있다.**

### 재현 결과
간단한 3인 핸드(BTN fold, SB fold, BB wins)를 로컬 실행해보면:

- 이벤트에는 `UNCALLED_RETURN` amount 20
- 그 직후 `AWARD_POT` payout 0
- live state는 BB가 정상 승리해 chips 증가
- reducer replay 결과는 main pot이 남고 chips가 안 맞음

### 문제점
- 이벤트 소싱 구조에서 **replay parity가 깨짐**
- hand history / audit / 학습 데이터 / 디버깅 신뢰성이 무너짐

### 수정 방향
- fold-win 처리에서 uncalled return과 matched pot 확정을 한 번에 정규화
- `AWARD_POT`은 **반환 후 실제 남은 팟 금액**만 기록
- reducer와 live engine이 동일한 도메인 함수를 공유하도록 정리

---

## 2) all-in runout 조건이 너무 느슨함

### 관련 코드
- `src/engine/betting.ts`의 `isAllInRunout()`
- `src/engine/orchestrator.ts`의 betting loop 종료 조건

### 관찰
현재 구현은 non-folded player 중 `active.length <= 1` 같은 단순 조건으로 all-in runout 여부를 판단한다.  
이 때문에 **한 플레이어가 올인하고, 다른 플레이어가 아직 call/fold 결정을 하지 않은 상태에서도** 엔진이 바로 플랍/턴/리버를 깔아버릴 수 있다.

### 실제로 발생하는 시나리오
- 3인 핸드
- 첫 번째 플레이어 폴드
- 두 번째 플레이어 올인
- 세 번째 플레이어는 아직 칩이 있고 call/fold를 선택해야 함
- 그런데 엔진은 세 번째 플레이어 액션 없이 바로 runout

### 문제점
이건 실제 토너먼트 규칙과 명백히 다르다.

### 수정 방향
runout은 아래일 때만 허용:

- 남은 live player 전원이 all-in
- 또는 칩이 남아 있는 플레이어가 있더라도 **아무도 facing bet 상태가 아님**

즉, **결정해야 할 플레이어가 1명이라도 남아 있으면 runout 금지**

---

## 3) short all-in이 잘못 betting reopen을 일으킴

### 관련 코드
- `src/engine/betting.ts`
- `src/engine/action-order.ts`

### 관찰
현재는 raise가 발생할 때마다 사실상 `actedPlayerIds`를 초기화하고, `getValidActions()`도 단순히 facing bet과 stack만 보고 raise 가능 여부를 열어준다.

그 결과:
- 직전 full raise보다 작은 **short all-in raise**도
- 이전 플레이어에게 **정상 raise 권한을 다시 열어버리는** 문제가 생긴다.

### 왜 문제인가
표준 토너먼트 룰에서는 short all-in은 베팅을 완전히 reopen하지 않는다.  
이미 액션을 마친 플레이어는 **full raise를 새로 facing한 것이 아니면** call/fold만 가능해야 한다.

### 수정 방향
- `lastFullRaiseSize` 추적
- 각 플레이어가 마지막으로 full raise를 facing한 상태 추적
- `currentBet`가 올라갔다고 무조건 raise 권한을 재개하면 안 됨

---

## 4) 쇼다운 공개 순서가 표준 규칙과 다소 다름

### 관련 코드
- `src/engine/showdown.ts`

### 관찰
현재 `getShowdownOrder()`는 all-in 플레이어를 먼저 정렬하고, 마지막 공격자 등으로 순서를 만든다.

### 해석
이건 **UI용 reveal queue** 로는 이해할 수 있지만, 실제 표준 규칙에서 중요한 핵심은 아래다.

- all-in이 있으면 live hand는 모두 tabled 되어야 함
- non-all-in showdown order는 last aggressor / button left 규칙을 따름

### 수정 방향
- 내부 로직은 “모든 live hand 공개 여부”와 “UI에서 어떤 순서로 보여줄지”를 분리
- 엔진 규칙과 연출 순서를 같은 개념으로 섞지 않는 것이 좋음

---

## 5) 사이드팟 정산 순서가 표준 예시와 다름

### 관련 코드
- `src/engine/orchestrator.ts`

### 관찰
현재는 **main pot 먼저, side pot 나중** 정산한다.

### 문제점
최종 칩 합은 같을 수 있지만, 표준 예시와 다르고 디버깅이 불편하다.

### 권장
- **side pot을 먼저, main pot을 마지막**에 정산
- 각 팟마다 eligible set을 독립적으로 계산 및 기록

---

## 6) side pot eligible fallback은 규칙이 아니라 위험한 우회

### 관련 코드
- `src/engine/orchestrator.ts`

### 관찰
사이드팟 eligible 플레이어가 비면 전체 `reveals`로 fallback 하는 로직이 있다.

### 문제점
- 실제 규칙에는 없는 동작
- 상류 단계의 eligibility 계산 버그를 가려버림
- 잘못된 플레이어가 사이드팟을 먹을 가능성까지 생김

### 권장
- eligible set이 비면 즉시 에러 또는 invariant failure
- fallback 금지

---

## 7) odd chip 분배는 대체로 정상

### 관련 코드
- `src/engine/pot.ts`

### 관찰
나머지 칩을 버튼 기준 왼쪽에서 가장 가까운 승자에게 주는 방식이라, 일반적인 토너먼트 odd chip 처리와 대체로 맞다.

### 권장
- 문서에 명시
- 테스트 추가

---

## 8) heads-up 전환 로직은 단순화되어 있음

### 관련 코드
- `src/engine/seat-resolver.ts`

### 관찰
헤즈업 관련 별도 보정 함수가 있으나 실제 사용은 제한적이거나 단순화된 moving button 구조로 보인다.

### 해석
- 일반 연습 프로그램에는 충분할 수 있음
- 다만 3인→2인 전환에서 **버튼/SB/BB 액션 순서**는 회귀 테스트가 꼭 필요

---

## 9) 테스트가 치명적 엣지케이스를 못 잡고 있음

### 관찰
현재 테스트는 주로:
- 상태가 터지지 않는지
- 칩 합이 보존되는지
- 어느 정도의 이벤트가 발생하는지

위주라서, 다음 핵심 문제가 통과해버린다.

### 빠진 테스트
- fold-win reducer parity exact match
- shove 후 남은 플레이어 액션 보장
- short all-in no-reopen
- multi-side-pot winner correctness
- all-in showdown reveal contract
- exact odd-chip direction

---

## 우선순위 제안

### P0
- all-in runout 조건 수정
- short all-in reopen 규칙 수정
- fold-win 이벤트/상태 정합성 수정
- side-pot fallback 제거
- live vs replay parity 테스트 강화

### P1
- showdown 공개 로직 정리
- side pot → main pot 정산 순서 통일
- 동시 탈락 순위 정책 명시

### P2
- sat-out/disconnect 정책
- dead button 예외
- BBA 변형 지원

---

## 추천 리팩터링 방향

- “베팅 상태 관리”와 “핸드 종료/팟 정산”을 분리
- pot normalization을 단일 함수로 모으기
- evaluator는 hand strength만 계산하고, eligibility는 호출자가 책임지기
- event reducer와 live engine이 동일한 도메인 계산 함수를 공유하도록 구성
- 랜덤 시뮬레이션보다 **결정론적 regression fixture** 를 많이 두기

