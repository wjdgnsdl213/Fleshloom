# FLESHLOOM

살아 있는 고리를 유일한 살상 수단으로 사용하는 탑다운 액션 로그라이트입니다. 플레이어는 격리된 도시를 이동하며 생체 닻을 심고, 계속 이동해 만든 궤적으로 괴물을 포획합니다. 포획은 생존 자원과 경험치, 일시적인 적 특성 후보를 제공합니다.

현재 단계는 **M4 코드 게이트 완료 / M5 아트·오디오·접근성 패스**입니다. 9분 사냥 뒤 Warden Prototype의 팔·외피·핵을 차례로 포획하고, 엔딩·결과·재시작까지 이어지는 전체 런이 구현되어 있습니다. 모든 적과 보스의 production bitmap, 반응형 합성 음악·효과음, 터치 조작과 모션·플래시·음량 옵션도 런타임에 연결되어 있습니다. 브라우저·실기기 완주 및 외부 플레이 테스트는 아직 남아 있습니다.

## 실행

```powershell
npm install
npm run dev
```

## 품질 확인

```powershell
npm run check
```

## 문서 읽는 순서

1. `docs/GAME_DESIGN.md`
2. `docs/PRODUCTION_PLAN.md`
3. `docs/STORY.md`
4. `docs/VISUAL_BIBLE.md`
5. `docs/VISUAL_TARGET_M1_5.md`
6. `docs/ARCHITECTURE.md`
7. `docs/MILESTONES.md`
8. `docs/TITLE_SHORTLIST.md`

## 현재 조작

- 이동: 방향키 또는 WASD
- 고리(Toggle, 기본): `Space`로 추적 시작, 이동 후 다시 `Space`로 폐쇄
- 고리(Hold, 선택): 화면 아래 `LOOP INPUT`을 `HOLD`로 바꾸고 `Space`를 누른 채 이동, 놓아서 폐쇄
- 보정: 닻 또는 이전 궤적에 가까워지면 밝은 스냅 마커 표시
- 선택: 숫자 `1`–`3`, 유지/취소는 상황에 따라 `3` 또는 `Esc`
- 시작/확인: `Enter` 또는 화면 버튼
- 다시 시작: `R`
- 결과에서 타이틀로: `Esc` 또는 `RETURN TO TITLE`
- 접근성/음량: 타이틀 또는 결과 화면의 `OPTIONS`
