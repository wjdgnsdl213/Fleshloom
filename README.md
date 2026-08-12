# FLESHLOOM

살아 있는 고리를 유일한 공격 수단으로 사용하는 탑다운 액션 로그라이트입니다. 플레이어는 격리구역을 이동하며 생체 실을 짜고, 계속 움직여 만든 궤적으로 감염체를 포획합니다. 포획은 생존 자원과 경험치, 일시적인 적 특성 표본을 제공합니다.

현재 타이틀부터 9분 사냥, Warden, 엔딩·결과·재시작까지 전체 게임 흐름과 P7-8 2.5D/3D 정합 패스가 구현되어 있습니다. 1.42x 카메라, 전 적 계열 고정광 8방향 프리렌더, 발 위치 기반 오클루전, 3단계 격리구역 소품, 강화된 포획 흡수, 비회전 Warden 해부학 연출과 비대칭 HUD가 한 빌드에 통합되어 있습니다. Chrome 1920×1080 포획·보스·전체 적 갤러리와 390×844 선택/결과·활성 테더를 검증했으며, 남은 릴리스 검수는 실제 모바일 연속 멀티터치와 전체 런·배포 스모크입니다.

## 완성 목표

![FLESHLOOM 승인 스타일프레임](references/generated/loop-gameplay-styleframe-v1.png)

이 스타일프레임은 카메라, 젖은 도시 재질, 검은 생체량·동맥색·상아 골편의 비율, 살아 있는 고리와 포획 순간의 가독성 기준입니다. 기존 캐릭터나 구도를 복제하는 자료가 아닙니다. 새 컴퓨터나 새 AI 세션에서 이어갈 때는 **[작업 인수인계](docs/HANDOFF.md)**를 가장 먼저 읽으세요. Claude Code는 루트의 `CLAUDE.md`에서 같은 진입점을 찾습니다.

## 실행

```powershell
npm ci
npm run dev
```

Node.js `24.16.0`을 권장하며 지원 범위는 `^20.19.0 || >=22.12.0`입니다.

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

1. `docs/HANDOFF.md` — 다른 컴퓨터/AI에서 시작하는 현재 작업 위치
2. `AGENTS.md` — 구속력 있는 저장소 작업 규칙
3. `docs/GAME_DESIGN.md`
4. `docs/PRODUCTION_PLAN.md`
5. `docs/QA_CHECKLIST.md`
6. `docs/EVOLUTION_PATH.md`
7. `docs/VISUAL_BIBLE.md`
8. `docs/ARCHITECTURE.md`
9. `docs/DECISIONS.md`
10. `docs/CODEX_COLLABORATION.md`
