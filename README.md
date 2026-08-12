# FLESHLOOM

살아 있는 고리를 유일한 공격 수단으로 사용하는 탑다운 액션 로그라이트입니다. 플레이어는 격리구역을 이동하며 생체 실을 짜고, 계속 움직여 만든 궤적으로 감염체를 포획합니다. 포획은 생존 자원과 경험치, 일시적인 적 특성 표본을 제공합니다.

현재 P1~P5 정식 버전 구현과 자동 릴리스 검증이 완료되었습니다. 한국어 선택 설명, 3,200×1,800 스크롤 맵과 추적 카메라, 두 번 포획해야 죽는 중장갑 Drifter, 9분 Warden 전환, 프로덕션 비주얼·HUD·오디오가 한 빌드에 통합되어 있습니다. P6의 실제 Chrome·Edge·모바일 전체 플레이 검수만 남아 있습니다.

## 실행

```powershell
npm install
npm run dev
```

## 검증

```powershell
npm run check
npm run release:verify
```

`release:verify`는 린트, 300개 이상의 규칙 테스트, 엄격한 TypeScript 검사와 프로덕션 빌드에 더해 정적 자산 누락, 하위 경로 배포 URL, 시작 자산 6MiB 예산을 확인합니다. 완성된 `dist/` 폴더는 정적 호스팅 서비스에 그대로 배포할 수 있습니다.

## 조작

- 이동: 방향키 또는 `WASD`
- 고리(Toggle, 기본): `Space`로 추적 시작, 이동 후 다시 `Space`로 봉합
- 고리(Hold, 선택): 옵션에서 `HOLD`로 바꾼 뒤 `Space`를 누른 채 이동하고 놓아서 봉합
- 선택: 숫자 `1`~`3`; 선택/취소 가능 상황에서는 `3` 또는 `Esc`
- 시작/확인: `Enter` 또는 화면 버튼
- 다시 시작: `R`
- 결과 화면에서 타이틀로: `Esc`
- 터치: 왼쪽 이동 스틱과 오른쪽 `LOOP` 버튼 동시 사용

## 문서

1. `docs/GAME_DESIGN.md`
2. `docs/PRODUCTION_PLAN.md`
3. `docs/QA_CHECKLIST.md`
4. `docs/EVOLUTION_PATH.md`
5. `docs/VISUAL_BIBLE.md`
6. `docs/ARCHITECTURE.md`
7. `docs/DECISIONS.md`
8. `docs/CODEX_COLLABORATION.md`
