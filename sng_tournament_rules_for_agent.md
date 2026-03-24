# 8-max SNG No-Limit Texas Hold'em Tournament Rules for Coding Agent

이 문서는 **8-max SNG No-Limit Texas Hold'em** 엔진을 구현/수정하는 coding agent가 참고해야 할 **행동 규칙(spec)** 이다.  
목표는 “실제 온라인 토너먼트(GG Poker 계열 운영 관행 + Poker TDA 표준)에 크게 어긋나지 않는 진행”을 만드는 것이다.

---

## 1. 적용 범위

- 게임 타입: **8-max Single Table Sit & Go (SNG)**
- 베팅 구조: **No-Limit Texas Hold'em**
- 블라인드/앤티 구조: 토너먼트 블라인드 레벨 사용
- 기본 철학:
  - **칩 보존(invariant)**
  - **이벤트 로그와 실제 상태가 항상 동일**
  - **모든 팟(main/side pot)은 독립적으로 생성·정산**
  - **행동 가능 여부는 “현재 facing amount”와 “베팅 재개(reopen)” 규칙에 따라 결정**

---

## 2. 토너먼트 기본 전제

### 2.1 좌석 / 버튼
- 버튼은 매 핸드마다 이동한다.
- 3인 이상에서는 SB = 버튼 왼쪽 첫 좌석, BB = 그 다음 좌석.
- 헤즈업 전환 시:
  - **버튼이 SB를 낸다.**
  - 상대 플레이어가 BB를 낸다.
  - **버튼(SB)이 프리플랍에서 먼저 행동**한다.
  - 포스트플랍은 BB 쪽이 먼저 행동한다.
- 탈락자 발생 후에도 **가능한 한 정상적인 moving button 규칙**을 유지한다.
- dead button / missed blind / balancing seat 같은 예외 규칙은 구현 복잡도가 높으므로, 우선순위는 낮지만 문서화는 필요하다.

### 2.2 참가 상태
- 핸드 시작 시 칩이 1 이상인 플레이어만 hand 참가 대상이다.
- 좌석만 차지하고 칩이 0이면 탈락 상태로 간주한다.
- sat-out / disconnected 상태를 지원한다면, 일반 온라인 룰처럼 **블라인드/앤티는 계속 차감되고 카드도 배부될 수 있음**을 별도 정책으로 둘 수 있다.

---

## 3. 핸드 시작 절차

핸드는 아래 순서로만 진행한다.

1. 활성 플레이어 확인
2. 버튼 / SB / BB 결정
3. 블라인드/앤티 게시
4. 덱 셔플
5. 홀카드 2장씩 배부
6. 프리플랍 액션
7. 필요 시 플랍/턴/리버 진행
8. 쇼다운 또는 폴드 승리 처리
9. 탈락 처리
10. 다음 핸드 준비

### 3.1 블라인드/앤티 게시
- 일반 토너먼트 기준으로:
  - SB posts min(SB amount, stack)
  - BB posts min(BB amount, stack)
- **Big Blind Ante(BBA)** 를 사용하는 변형을 추가하고 싶다면,
  - BB가 ante를 우선 부담하고 부족하면 가능한 만큼만 낸다.
  - 부족분을 다른 플레이어에게 강제로 분배하지 않는다.
- 현 단계에서는 **일반 SNG(ante 없음 또는 전원 ante)** 와 **BBA variant** 를 명확히 분리 구현하는 편이 안전하다.

---

## 4. 액션 가능 여부 규칙

각 액션 시점마다 플레이어는 다음 중 일부만 선택 가능하다.

- Fold
- Check
- Call
- Bet
- Raise
- All-in

### 4.1 기본 규칙
- `facing = currentBet - player.currentBet`
- `facing == 0` 이면 Check 가능
- `facing > 0` 이면 Fold/Call 가능
- `stack > 0` 이면 All-in 가능
- Bet은 현재 라운드에 아직 베팅이 없을 때만 가능
- Raise는 현재 라운드에 베팅이 있고, **raise가 법적으로 reopen되어 있을 때만** 가능

### 4.2 최소 오픈 / 최소 레이즈
- 프리플랍 오픈 최소 베팅 = BB
- 포스트플랍 첫 베팅 최소 = BB 이상(엔진 정책으로 BB를 하한으로 두어도 됨)
- 최소 레이즈 금액은 **직전의 full bet / full raise 크기만큼**
- 예:
  - current bet = 100
  - 직전 full raise size = 100
  - 다음 최소 total bet = 200

### 4.3 짧은 올인(short all-in)과 betting reopen
이 규칙은 반드시 구현한다.

- 어떤 플레이어가 **올인으로 금액을 올렸더라도**, 그 증가분이 **직전 full raise size 미만**이면 이는 **short all-in raise** 다.
- short all-in은 다음을 만족해야 한다.
  - 이미 액션을 마친 플레이어에게 **베팅을 다시 열지 않는다(reopen 안 됨)**.
  - 해당 플레이어는 **call/fold만 가능**하고 다시 raise할 수 없다.
- 단, 아직 이 라운드에서 한 번도 액션하지 않은 플레이어는 정상적으로 raise 가능할 수 있다.

구현 체크 포인트:
- `lastFullRaiseSize`를 별도로 추적한다.
- `currentBet` 증가가 있었더라도, 증가분이 `lastFullRaiseSize`보다 작으면 **action order는 계속 돌더라도 raise 권한은 일부 플레이어에게 열리지 않아야 한다.**
- “누가 마지막으로 full raise를 만들었는지”, “각 플레이어가 마지막으로 합법적 full raise를 facing한 시점이 언제인지”를 추적하는 편이 안전하다.

---

## 5. 베팅 라운드 종료 조건

베팅 라운드는 아래 중 하나일 때만 종료된다.

### 5.1 모두 폴드하여 1명만 남음
- 남은 1명이 즉시 승리한다.
- **커뮤니티 카드를 더 깔지 않는다.**
- 쇼다운도 없다.
- 단, unmatched portion(언콜된 부분)이 있다면 먼저 반환하고, **매칭된 금액만 팟으로 확정**해 승자에게 지급한다.

### 5.2 2명 이상이 남아 있고, 행동이 모두 완료됨
행동 완료 조건:
- 모든 live player가 아래 중 하나를 만족한다.
  - fold 상태
  - all-in 상태
  - 이번 라운드에서 필요한 액션을 마쳤고 current bet에 맞춰져 있음
- 그리고 추가로 행동할 플레이어가 없다.

### 5.3 all-in runout 가능 상태
- 남은 live player 중 **칩이 남아 있는 플레이어가 더 이상 의사결정을 할 필요가 없을 때만** runout 한다.
- 즉, 다음 경우에만 자동 runout 가능:
  - 남은 모든 live player가 all-in 이다.
  - 또는 칩이 남아 있는 플레이어는 있어도 **아무도 facing bet 상태가 아니다.**
- **중요:**
  - 한 플레이어가 올인했고 다른 플레이어가 아직 콜/폴드 결정을 하지 않았다면 **runout 하면 안 된다.**

---

## 6. 언콜 베팅(uncalled bet) 처리

이 규칙은 엔진 버그를 가장 많이 만드는 부분이라 단일 원천(source of truth)으로 구현해야 한다.

### 6.1 원칙
- 어떤 플레이어의 투자액 중 **상대 누구도 매칭하지 않은 부분**은 팟에 귀속되지 않는다.
- 그 부분은 해당 플레이어에게 **반환(return)** 된다.
- 팟에는 **매칭된 금액만** 남는다.

### 6.2 처리 시점
- 폴드 승리로 핸드가 끝날 때
- 쇼다운 직전, 마지막 베팅 라운드 종료 시점
- 사이드팟 계산 이전에 모든 outstanding bet을 정규화할 때

### 6.3 구현 원칙
- `collectBetsIntoPots()` 와 `returnUncalledPortion()` 을 서로 다른 곳에서 중복 호출하지 않는다.
- 이벤트 로그에 `UNCALLED_RETURN`을 남겼다면,
  - 실제 상태에서도 동일한 반환이 반영되어야 하고
  - 그 뒤 `AWARD_POT` 금액은 **반환 후 남은 팟 금액**과 정확히 일치해야 한다.
- **금지사항:**
  - 반환 전 금액을 `AWARD_POT`에 넣거나
  - 반환 후 상태와 이벤트 금액이 서로 어긋나는 것

---

## 7. 팟 생성 규칙

### 7.1 메인팟
- 핸드에 남아 있는 플레이어(폴드 제외) 중 가장 작은 committed amount 기준으로 형성한다.
- 메인팟은 **쇼다운까지 살아남은 모든 non-folded player** 가 우승 자격을 가진다.

### 7.2 사이드팟
- committed amount가 서로 다른 올인 상황에서 추가 투자분으로 생성된다.
- 각 사이드팟은 **그 금액 이상을 실제로 낸 eligible player 집합**을 가진다.
- 어떤 플레이어가 특정 팟에 돈을 내지 않았다면, 그 팟을 이길 수 없다.

### 7.3 정산 단위
- **각 side pot은 독립적으로 평가·분배한다.**
- 그 다음 main pot을 분배한다.
- 팟마다 eligible player 집합이 다를 수 있으므로, **winner calculation은 팟 단위로 수행**해야 한다.

### 7.4 odd chip
- 팟이 동점 분할로 나누어떨어지지 않으면 odd chip이 생긴다.
- odd chip은 **버튼 기준 왼쪽에서 가장 가까운 winner**에게 간다.
- 모든 팟은 odd chip을 **각 팟별로 독립 처리**한다.

---

## 8. 쇼다운 규칙

### 8.1 all-in showdown
- 베팅이 끝났고 남은 플레이어 중 한 명 이상이 all-in이면, **남아 있는 live hand는 모두 오픈**한다.
- 메인팟이나 해당 사이드팟에 참가 중인 손패는 모두 live hand로 취급한다.
- 이후 남은 보드(턴/리버)가 없다면 차례대로 runout 한다.

### 8.2 non-all-in showdown order
- 리버에서 베팅/레이즈가 있었다면, **마지막 공격자(last aggressor)** 가 먼저 보여준다.
- 리버에 베팅이 없었다면, **버튼 왼쪽 첫 생존자부터 시계방향**으로 공개한다.
- 단, 구현 단순화를 위해 “모두 자동 공개(auto reveal)”를 채택할 수도 있다. 그 경우 문서에 명시한다.

### 8.3 머킹(muck)
- 최소 구현 버전에서는 **모든 live hand 자동 공개**가 가장 안전하다.
- 사람이 개입하는 UI가 없다면 전략적 muck를 굳이 구현하지 않는 편이 낫다.

### 8.4 승자 판정
- 7장(홀카드 2 + 보드 5) 기준 최강 5장 조합으로 비교한다.
- 동일한 족보/킥커면 정확한 tie로 처리하고 팟을 분할한다.
- **정확히 같은 핸드 strength이면 팟은 균등 분배**한다.

---

## 9. 폴드 승리 처리

모두 폴드해서 1명만 남으면 아래 순서로 처리한다.

1. outstanding bet 중 uncalled portion 반환
2. 남은 matched contribution을 팟으로 확정
3. 승자에게 팟 지급
4. 보드 진행 중단
5. 쇼다운 생략
6. 탈락자 정리

### 9.1 매우 중요한 금지 규칙
- 폴드 승리 핸드에서 `AWARD_POT.amount == 0` 이거나, 이벤트 리듀서 재생 시 팟이 남아 있으면 안 된다.
- “실행 상태는 맞고 이벤트 리플레이는 틀리는” 상황은 허용하지 않는다.

---

## 10. 탈락 및 순위

- 핸드 종료 후 stack == 0 인 플레이어는 탈락한다.
- 기본 규칙:
  - 같은 핸드에서 여러 명이 탈락하면 **핸드 시작 시점 stack / 투자 구조 / 팟 자격**을 고려한 일관된 우선순위 정책이 필요하다.
  - 최소 구현에서는 “동일 핸드 동시 탈락 시 더 적은 시작 스택이 낮은 순위” 같은 정책을 둘 수 있다.
- SNG 보상은 보통 상위 2~3명에게 지급한다.
- prize payout 계산은 **토너먼트 칩 자체가 아니라 finishing position** 기준으로 처리한다.

---

## 11. 이벤트 로그 규격

엔진이 이벤트 소싱(event sourcing) 구조를 쓴다면 아래 규칙을 반드시 지킨다.

### 11.1 단일 진실 원천
- 상태 갱신 로직과 이벤트 생성 로직이 서로 다른 계산을 하면 안 된다.
- 이상적 구조:
  - **도메인 함수가 “상태 변화 + 이벤트”를 동시에 반환**
  - reducer는 그 이벤트를 재적용했을 때 동일 상태가 복원되어야 함

### 11.2 필수 불변식
핸드 종료 후 항상 아래가 참이어야 한다.

- 전체 칩 합계 보존
- 플레이어 stack 합 + 모든 팟 합 + 미회수 currentBet 합 = 초기 총칩
- 핸드 종료 시점에는:
  - `mainPot == 0`
  - `sidePots.amount == 0`
  - `currentBet == 0` for all players
- 이벤트 재생 후 상태 == 실시간 상태

### 11.3 추천 이벤트
- HAND_STARTED
- BLINDS_POSTED
- HOLE_CARDS_DEALT
- PLAYER_ACTION
- BETTING_ROUND_ENDED
- COMMUNITY_DEALT
- UNCALLED_RETURN
- POT_CREATED / SIDE_POT_CREATED
- HAND_REVEALED
- POT_AWARDED
- ELIMINATION
- HAND_FINISHED
- LEVEL_UP
- TOURNAMENT_FINISHED

---

## 12. 절대 금지할 구현 패턴

1. **all-in runout을 “active player 수 <= 1”만으로 결정하는 것**
   - facing action이 남아 있으면 아직 runout 아님.

2. **short all-in을 full raise처럼 취급하는 것**
   - 이 경우 betting reopen 버그가 발생.

3. **side pot eligible player가 비면 전체 reveals로 fallback 하는 것**
   - 이건 규칙이 아니라 데이터 손상 은폐다.

4. **폴드 승리 시 반환 전 팟 금액으로 award event를 찍는 것**
   - reducer parity가 깨진다.

5. **메인팟/사이드팟을 하나의 winner set으로 계산하는 것**
   - 팟 단위 평가가 필수.

---

## 13. 권장 구현 구조

### 13.1 베팅 엔진
별도 상태를 둔다.

- `street`
- `currentBet`
- `lastFullRaiseSize`
- `actionCursor`
- `playersWhoActedThisTurn`
- `playersEligibleToRaise`
- `playersAllIn`

### 13.2 핸드 종료 파이프라인
핸드 종료는 아래 하나의 함수로 정규화한다.

```text
resolveHandEnd(state):
  1) normalize outstanding bets
  2) return uncalled portion if any
  3) collect matched contributions into pots
  4) if single survivor -> award directly
  5) else showdown:
       a. reveal live hands
       b. resolve side pots independently
       c. resolve main pot
  6) clear current bets
  7) eliminate busted players
  8) assert invariants
```

### 13.3 showdown evaluator contract
- 입력:
  - board
  - revealed hands
  - eligiblePlayerIds
- 출력:
  - sorted winners / tie group
  - best hand descriptor
- evaluator는 **eligible filtering을 직접 추정하지 않는다.**
  - 항상 caller가 넘긴 eligible set만 비교한다.

---

## 14. 회귀 테스트 필수 목록

다음 테스트는 반드시 자동화한다.

### 14.1 폴드 승리
- BTN fold, SB fold, BB wins
- UNCALLED_RETURN + AWARD_POT 이벤트 합이 정확한지
- reducer replay 후 pot 0 / chips exact match

### 14.2 all-in facing decision
- A folds, B shoves, C still has chips
- C의 call/fold decision 없이 runout 되면 실패

### 14.3 short all-in no reopen
- A bet 100
- B short all-in to 150
- 이미 액션했던 C가 facing full raise가 아니면 raise 불가

### 14.4 single side pot
- A all-in 100, B 300, C 300
- main pot와 side pot winner가 다르게 나오는 케이스 검증

### 14.5 multiple side pots
- A 100, B 250, C 400, D 400
- 각 팟 eligible set과 우승자 정확성 검증

### 14.6 tie + odd chip
- split pot에서 odd chip이 버튼 왼쪽 first winner에게 가는지

### 14.7 all-in showdown reveal
- 리버 전 all-in 완료 시 모든 live hand가 공개되는지

### 14.8 heads-up blind order
- 버튼=SB, 프리플랍 버튼 선행 액션 검증

### 14.9 elimination ordering
- 같은 핸드에서 2명 bust되는 경우 순위 정책 일관성 검증

### 14.10 event sourcing parity
- 모든 랜덤 시뮬레이션 핸드 종료 후:
  - live state == reducer replay state

---

## 15. 구현 우선순위

### P0 (즉시 수정)
- all-in runout 조건 수정
- short all-in reopen 규칙 수정
- fold-win / uncalled bet / award event 정합성 수정
- side pot fallback 제거
- live state vs reducer parity 테스트 강화

### P1
- showdown 공개 순서 정교화
- side pot 먼저, main pot 나중 정산 이벤트 순서 통일
- 동시 탈락 순위 정책 명시

### P2
- sat-out / disconnect 정책
- dead button / missed blind 예외
- BBA 지원 확장
- muck / selective reveal UX

---

## 16. 구현 체크리스트

핸드 종료 직전 아래 질문에 모두 YES여야 한다.

- 아직 콜/폴드 결정이 필요한 플레이어가 남아 있지 않은가?
- current bet보다 적게 냈지만 chips > 0 인 플레이어가 대기 중이지 않은가?
- uncalled portion을 정확히 반환했는가?
- main/side pot eligible set을 올바르게 계산했는가?
- 각 팟을 독립적으로 분배했는가?
- tie/odd chip 규칙을 지켰는가?
- 이벤트 리플레이 결과가 실시간 상태와 완전히 같은가?

---

## 17. 참고 기준

이 문서는 다음 기준을 근거로 삼는다.

- 온라인 포커 하우스 룰의 일반 원칙(예: exact tie split, table stakes / all-in)
- Poker TDA 표준 룰:
  - all-in 시 live hands tabled
  - showdown order
  - short all-in does not reopen betting
  - odd chip / side pot 분리 정산

실제 사이트별 세부 운영(예: GG Poker UI reveal 순서)은 조금씩 다를 수 있으므로, **핵심은 결과적 규칙 정합성**이다.

