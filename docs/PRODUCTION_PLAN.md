# FLESHLOOM Production Plan

Status: active · 2026-08-12  
Internal release target: 2026-08-25

## Goal

현재의 시스템 프로토타입을 완성도 높은 10–12분 정식 게임으로 전환한다. 이미 검증된 루프 판정, 성장, 적 행동, 9분 웨이브, Warden 흐름은 유지하고, 플레이어가 직접 체감하는 언어·월드·난이도·아트·연출·QA를 제품 수준으로 끌어올린다.

## Locked production direction

- 최종 비주얼 기준은 `references/generated/loop-gameplay-styleframe-v1.png`이다.
- 외부 레퍼런스는 재질, 조명, 카메라, 움직임 언어에만 사용하며 캐릭터·UI·구도를 그대로 복제하지 않는다.
- PC 16:9를 우선 제작하고 같은 게임 규칙으로 모바일 화면과 터치 입력을 지원한다.
- 맵은 무한 생성이 아니라 현재 화면 약 4–6배 규모의 유한 스크롤 격리 구역으로 제작한다.
- 초반 Drifter는 한 번의 포획으로 죽여 포획 쾌감을 보존한다.
- 중장갑 개체는 2회, Elite와 Warden은 명시적인 다단계 포획을 사용한다. 일반 HP만 늘리는 방식은 사용하지 않는다.
- 플레이어에게 보이는 능력·임프린트·튜토리얼·보스 목표 설명은 한국어를 기본으로 한다.

## Completion discipline

각 단계는 아래 조건을 모두 만족해야 완료로 표시한다.

1. 범위에 해당하는 구현과 회귀 테스트를 완료한다.
2. `npm run check`를 통과한다.
3. 이 문서의 상태표와 진행 로그를 갱신한다.
4. 단계 전용 Git 커밋을 만든다.
5. `origin/main`에 푸시하고 작업 트리가 깨끗한지 확인한다.

## Status

| ID | Workstream | Deliverable | Status |
| --- | --- | --- | --- |
| P0 | Production planning | 정식 버전 로드맵, 완료 규칙, 진행 기록 | Complete |
| P1 | Korean player-facing choices | 변이·임프린트 선택 이름/설명/수치 한국어화 | Complete |
| P2 | World and camera foundation | 월드 좌표, 추적 카메라, 화면/월드 계층 분리 | Complete |
| P3 | Scrollable quarantine map | 4–6화면 유한 맵, 환경 레이어, 스폰/경계 | Complete |
| P4 | Layered ordinary enemies | 2회 포획 중장갑 개체, 시각적 외피, 웨이브 배치 | Complete |
| P5 | Production presentation | 최종 캐릭터/적 애니메이션, VFX, HUD, 오디오 | Complete |
| P6 | Release QA | 전체 런, 모바일, 성능, 브라우저, 배포 자료 | Manual gate pending |
| P7 | Styleframe fidelity | 진화 문서, 보행 모션, 생체 고리, 방향별 배우, 깊이 정렬, 화면 정합 | P7-9 desktop visual GO candidate · physical-device/full-run/deploy gate |

## Workstream contracts

### P1 — Korean player-facing choices

- 모든 영구 변이에 한국어 이름과 효과 설명을 제공한다.
- 선택 카드에 다음 랭크와 실제 수치 변화를 함께 표시한다.
- 네 임프린트의 이름, 효과, 유지 선택을 한국어로 표시한다.
- 게임 규칙 데이터가 UI 문자열에 의존하지 않도록 콘텐츠 정의 또는 전용 표시 사전을 사용한다.
- Exit: 모든 선택 카드가 영문 지식 없이 이해되며 관련 테스트와 전체 검사가 통과한다.

### P2 — World and camera foundation

- 시뮬레이션은 화면 크기와 독립적인 월드 좌표를 사용한다.
- 카메라는 이동 방향을 볼 수 있는 완만한 데드존으로 플레이어를 추적한다.
- Pixi 월드 레이어만 카메라 변환을 받고 HUD·날씨·터치 UI는 화면에 고정한다.
- 루프 폴리곤, 투사체, 적 충돌, 포획 판정은 모두 월드 좌표를 유지한다.
- Warden 전투는 지정된 아레나 안에서 카메라가 제한된다.
- Exit: 화면 가장자리를 넘어 이동해도 판정이 변하지 않고 카메라·리사이즈 회귀 테스트가 통과한다.

### P3 — Scrollable quarantine map

- 반복 가능한 젖은 아스팔트 바닥과 도로 데칼을 구성한다.
- 장벽, 환기구, 격리등, 감염 조직, 물웅덩이를 별도 레이어로 배치한다.
- 적은 카메라 밖이면서 월드 안인 유효 지점에서 등장한다.
- 경계는 보이지 않는 벽이 아니라 격리 장벽과 생체 폐색으로 읽힌다.
- Exit: 맵 전체 이동 중 빈 화면·끊어진 타일·잘못된 스폰이 없고 16:9 및 좁은 화면에서 읽힌다.

### P4 — Layered ordinary enemies

- 초반 한 번 포획 적은 유지한다.
- 2회 포획 중장갑 변형을 추가하고 첫 포획은 외피 파괴와 짧은 경직으로 표현한다.
- 남은 외피는 색만이 아니라 골편 실루엣 또는 조각 표시로 전달한다.
- 첫 포획과 최종 처치의 XP·회복 보상을 분리하고 중복 지급을 방지한다.
- 중장갑 개체는 온보딩 이후부터 데이터 기반 비율로 웨이브에 섞는다.
- Exit: 한 폐쇄가 한 단계만 해결하고, 외피 상태·보상·난이도 곡선 테스트가 통과한다.

### P5 — Production presentation

- 스타일프레임의 카메라, 젖은 노면, 명암 밀도, 생체 재질, 제한된 동맥색을 런타임에서 재현한다.
- Carrier와 적마다 이동·공격·피격·외피 파괴·분해 상태가 구분된다.
- 고리 폐쇄 → 수축 → 분해 → 흡수 비트를 최종 VFX·카메라·오디오로 통합한다.
- 타이틀, HUD, 선택 카드, 보스 목표, 결과 화면을 하나의 디자인 시스템으로 정리한다.
- Exit: 정지 화면뿐 아니라 이동·전투 중에도 스타일프레임과 같은 게임으로 인식된다.

### P6 — Release QA

- 전체 10–12분 승리 및 사망 경로를 실제 브라우저에서 검증한다.
- Chrome, Edge, 모바일 브라우저와 키보드·터치 입력을 확인한다.
- 일반 노트북과 휴대폰 폭에서 프레임 예산과 가독성을 확인한다.
- 공개 배포, 백업 배포, 플레이 영상, 썸네일, 소개문, 제작 증빙을 준비한다.
- Exit: 비로그인 환경에서 공개 링크로 완주와 재시작이 가능하다.

## Progress log

### 2026-08-12 — P0 complete

- 정식 버전 전환 범위와 작업 순서를 확정했다.
- 단계별 완료 조건에 테스트, 문서 갱신, 독립 커밋, GitHub 푸시를 포함했다.
- P1 한국어 선택 UI 작업을 다음 활성 단계로 지정했다.

### 2026-08-12 — P1 complete

- 11개 영구 변이의 이름과 요약을 한국어로 변경했다.
- 선택 카드가 다음 등급의 실제 기본값과 `현재 → 적용 후` 수치를 표시하도록 전용 표시 계층을 추가했다.
- Blade, Nerve, Spike, Symmetry 임프린트의 선택·유지·활성 상태와 결과 요약을 한국어화했다.
- UI 수치와 실제 게임 규칙이 어긋나지 않도록 HP, 회복 상한, 임프린트 시간, Blade/Spike/Nerve 기본값을 `PROGRESSION_BASELINE`으로 통합했다.
- 검증: 관련 테스트 2파일/26개와 전체 `npm run check` 29파일/294개 테스트, lint, TypeScript, production build 통과.
- 남은 시각 검증: 실제 브라우저에서 긴 한국어 문구의 카드 줄바꿈과 좁은 화면 가독성을 확인해야 한다.
- Next: P2 유한 월드 좌표와 플레이어 추적 카메라 기반.

### 2026-08-12 — P2 complete

- 화면 크기와 독립적인 3,200×1,800 유한 월드와 중앙 시작 지점을 추가했다.
- 완만한 데드존, 지수 보간 추적, 월드 가장자리 제한, 화면 리사이즈 시 중심 보존을 담당하는 순수 `Camera2D` 모델을 추가했다.
- Pixi 게임 오브젝트를 하나의 월드 컨테이너로 묶어 카메라 변환을 한 번만 적용하고, 비와 DOM HUD·선택·터치 UI는 화면 공간에 유지했다.
- 플레이어, 루프, 적, 투사체와 충돌은 월드 좌표를 유지한다. 웨이브 시작 위치만 현재 카메라 주변으로 제한해 먼 월드 구석에 적이 고립되지 않게 했다.
- Warden 전환 시 현재 조우 지점 주위에 별도 아레나를 만들고 플레이어와 카메라를 함께 제한한다.
- 검증: 카메라 단위 테스트 6개를 포함한 전체 `npm run check`가 30파일/300개 테스트, lint, TypeScript, production build를 모두 통과했다.
- 남은 시각 검증: 자동 브라우저 런타임을 사용할 수 없어 실제 이동 중 카메라 감속감과 다양한 화면 비율은 수동 확인이 필요하다.
- Next: P3 반복 가능한 도로 바닥, 환경 레이어, 화면 밖 스폰과 가시적 월드 경계.

### 2026-08-12 — P3 complete

- 승인된 스타일프레임과 기존 환경판을 재질 참고로 사용해 1,254×1,254 젖은 아스팔트 반복 타일을 생성하고 런타임 자산으로 추가했다.
- 타일 위에 데이터 기반 웅덩이 10개, 격리등 10개, 배수구 6개, 감염 군락 8개, 횡단 표식 3개와 월드 전역 콘크리트 경계를 별도 레이어로 구성했다.
- 비는 화면에 고정하고, 웅덩이 반사와 경광등은 해당 랜드마크를 따라 월드 공간에서 움직이게 분리했다.
- 적 스폰은 우·하·좌·상 순환 선호도를 가진 카메라 바깥 띠에서만 선택하고, 월드 가장자리에서는 다음 유효 방향으로 자동 전환한다.
- 타일을 먼저 불러오고 실패했을 때만 기존 전체 환경판을 요청하도록 해 정상 경로의 중복 배경 다운로드를 제거했다.
- 검증: 전체 `npm run check`가 32파일/307개 테스트, lint, TypeScript, production build를 통과했다. 개발 서버의 진입점과 새 타일 URL도 HTTP 200을 반환했다.
- 남은 시각 검증: 자동 브라우저 런타임을 사용할 수 없어 전체 맵 이동 시 타일 이음새, 경계 밀도와 좁은 화면 구도는 수동 플레이 확인이 필요하다.
- Next: P4 한 번에 죽지 않는 2회 포획 중장갑 일반 적과 난이도 곡선.

### 2026-08-12 — P4 complete

- The first three-minute onboarding remains unchanged: Drifters, Rushers, and Watchers still die to one valid closure.
- A data-driven armored Drifter joins after the checkpoint at 1-in-4, 1-in-3, then 1-in-2 of scheduled Drifter spawns as the run advances.
- Its first closure permanently peels the shell, grants 7 XP/2 recovery, and staggers it for 0.8 seconds. A later closure kills it and grants a separate 14 XP/4 recovery. Dead captures pay nothing.
- Armored and exposed states have shape-led presentation: six ivory shell plates and a segmented rim become an arterial exposed core; peeling emits bone shards without playing the full body decomposition.
- Verification: targeted state/content/model/integration coverage passes 4 files/24 tests. Final `npm run check` passes 35 files/317 tests, ESLint, strict TypeScript, and the production build.
- Manual visual risk: the configured controllable browser backend remains unavailable, so armor readability at gameplay scale still needs an owner play check.
- Next: P5 production presentation polish across actors, closure VFX, HUD, and audio.

### 2026-08-12 — P5 complete

- Generated a dedicated armored Drifter production sprite from the approved Drifter/styleframe material language, removed the flat chroma background, validated its alpha edge, and archived the source plus final prompt record under `references/generated/production-art-v3/`.
- The intact shell now uses the dedicated six-plate ivory silhouette. The first capture swaps to the exposed Drifter body, applies a 0.8-second stagger deformation, emits shell shards, and deliberately omits the full corpse decomposition.
- Capture presentation now classifies miss, ordinary kill, and shell peel as separate authored beats. Shell peel has an ivory HUD signal, explicit Korean instruction, and a dry bone-break cue with a short reward pull; final kill retains the full tissue separation/intake sound.
- Carrier-09 now shows movement stride, active-loop tension, and capture kick in the production bitmap. The HUD adds eight ivory integrity pips and a red/amber XP meter based on pure tested display rules.
- Title, options, tutorial, hunt HUD, Warden objectives, and result summaries now use Korean player-facing copy while preserving the FLESHLOOM/CARRIER-09 fiction labels.
- Verification: targeted presentation/tutorial coverage passes 3 files/17 tests. Final `npm run check` passes 37 files/323 tests, ESLint, strict TypeScript, and the production build.
- Manual visual risk: the local preview child process exits in this managed environment and the controllable browser backend remains unavailable. Asset alpha was inspected directly, but 16:9/phone composition, live motion, and Web Audio still require owner/browser QA in P6.
- Next: P6 release audit, public deploy preparation, and a concise manual test checklist.

### 2026-08-12 — P6 automated release gate complete

- Centralized production art paths and removed root-absolute `/assets/...` URLs so the build works both at a domain root and under a repository sub-path.
- Split texture loading into a first-input gate and background phase. Startup waits for the asphalt, Carrier, Drifter, and tether (5.29MiB); armored/later enemies and Warden load after the canvas becomes interactive. The full street image is requested only if asphalt fails.
- Added `npm run release:verify` to run the full repository gate, verify every public file reaches `dist/`, reject missing/root-absolute bundle references, and enforce a 6MiB startup-art budget.
- Replaced the stale prototype README and generic checklist with the current Korean production summary and an exact Chrome/Edge/mobile, full-run, audio, accessibility, and deployment QA matrix.
- Verification: final `npm run release:verify` passes 38 files/327 tests, ESLint, strict TypeScript, production build, 12 public-file copies, 12 index references, and the startup payload budget.
- The browser-control skill was invoked for live QA but reported `No browser is available`. P6 remains at `Manual gate pending` until the three-device matrix, complete victory/death routes, and public signed-out smoke test are recorded.

### 2026-08-12 — P7-0 evolution source document complete

- Added `docs/EVOLUTION_PATH.md` as the owner-editable source for the complete in-run evolution flow: XP thresholds, eleven permanent mutations, four temporary imprints, Apex prerequisites, timed enemy escalation, armored Drifter layers, and Warden disassembly stages.
- Clearly separated implemented mechanics from missing visual body evolution and added blank tables for Carrier stage silhouettes, combination ideas, and owner decisions.
- Next: audit the approved styleframe at original resolution, then replace whole-sprite drifting with authored gait deformation for Carrier and every ordinary enemy family.

### 2026-08-12 — P7-1 authored locomotion implemented

- Re-inspected the approved styleframe at original resolution and locked grounded limb contact, low three-quarter top-down posture, restrained black/brown/ivory material, and species-specific weight as acceptance signals.
- Used the built-in image generation workflow to create eight exact 2×2 gait sheets: Carrier, Drifter, armored Drifter, Rusher, Watcher, Cutter, Mimic, and Elite Husk. Chroma sources, runtime alpha WebP sheets, prompt structure, and validation are recorded under `references/generated/production-art-v4/`.
- Replaced elapsed-time whole-bitmap bobbing with distance-driven four-pose animation. The gait pauses on an authored planted frame while the actor is stationary and advances only when its simulation position changes.
- Each species owns a different stride distance and authored cadence; gait phase also drives restrained roll, compression, lift, and contact-shadow weight instead of acting as a cosmetic texture flip.
- Startup waits only for the new 114KiB Carrier and 139KiB Drifter sheets; later species animation sheets remain deferred.
- Verification: final `npm run release:verify` passes 39 files/331 tests, ESLint, strict TypeScript, production build, 20 public-file copies, base-path checks, and a 5.54MiB startup-art payload under the 6MiB budget.
- Next: rebuild the living tether and capture contraction from the styleframe's braided black-red strands, ivory hook rhythm, and radial inward pull.

### 2026-08-12 — P7-2 living tether implemented

- Replaced the first tether strip with a 567KiB lossless alpha WebP built around braided charcoal biomass, a restrained arterial-red core, and repeating ivory hooks. Its wrap-aware boundaries match exactly in alpha and visible premultiplied color. Original, cleaned, and seamless chroma sources plus a three-repeat preview live under `references/generated/production-art-v5/`.
- Added pure presentation geometry that samples by world distance instead of input point index. Hook cadence and two opposite-phase braids therefore remain stable when the same path has different sampling density.
- The textured path and procedural fallback now share stronger hook/tendon accents. Closure keeps the braid visible while contracting, then draws curved tissue strands from each captured body toward the closure centroid and Carrier before decomposition/intake.
- No game rule changed: movement remains active while tethering, closure validity and capture membership are unchanged, and layered enemies still resolve one capture stage at a time.
- Performance review caught and fixed an initial repeated full-path scan. The final shared-sample implementation measures about 0.07ms for the pure active-tether geometry on a maximum 256-point zigzag path, down from about 13.45ms in the rejected draft.
- Verification: targeted geometry/manifest tests pass 2 files/10 tests. Final `npm run release:verify` passes 40 files/337 tests, ESLint, strict TypeScript, production build, the reviewed tether SHA, 20 public-file copies, 12 index references, 5.49MiB startup art under the 6MiB budget, and 17.28MiB total public payload.
- Manual visual risk: the Browser runtime reported no available backend. Live curve thickness, hook cadence, capture timing, and frame pacing still require owner inspection at laptop and phone widths.
- Next: P7-3 representative-screen composition and a side-by-side styleframe fidelity pass.

### 2026-08-12 — P7-3 representative-screen first pass

- Captured the unmodified 4bc51ab baseline at 1920×1080 and 390×844 under `references/qa/`. The largest measured gap was composition: one screen exposed almost the full 3,200×1,800 district, leaving actors and the living tether much smaller than the approved styleframe.
- Added a tested 1.42x fixed presentation zoom while preserving world-space simulation, camera bounds, capture geometry, and the shared input contract.
- Strengthened directional cast/contact shadows and placed a puddle, two emergency lights, and a vent around the starting hunt area so Carrier-09 has nearby depth and material references instead of floating over uninterrupted asphalt.
- Reworked HUD, title, tutorial, settings, and choice surfaces from uniform translucent rectangles into restrained asymmetric instrument plates with broken corners, inset depth, bone pips, and localized arterial accents. Text remains accessible DOM content.
- Verification: `npm run release:verify` passes 40 files/338 tests, ESLint, strict TypeScript, production build, public assets, base-path checks, and the 5.49MiB startup budget.
- Post-change Chrome evidence now covers title/gameplay at 1920×1080, live enemy scale, and gameplay/results at 390×844 under `references/qa/`. Actors and HUD read larger without overlap in these viewports. A real coarse-pointer phone check and sustained active-tether/closure capture still remain before P7-3 is marked complete.

### 2026-08-12 — P7-3 second pass: world-fixed actor grounding

- Owner report: actors read as rotating stickers and the scene reads flat. Diagnosis confirmed in code: `LoopPlaygroundRenderer` rotates each whole sprite to its facing (`sprite.rotation = angle + Math.PI * 0.5`), and each production texture bakes a single light direction, so the baked light rotates with the body. The walk sheets are four frames of one authored direction, so facing changes never change perspective.
- Added `src/presentation/GroundedLighting.ts`: pure, Pixi-free helpers returning screen-fixed cast-shadow, wet-reflection, and rim offsets from body radius and current sprite scale. Nine unit tests cover light-direction normalization, radius scaling, foreshortening, grounding strength falloff, reduced-motion wobble collapse, rim/shadow opposition, and degenerate input.
- Wired three pooled companion sprites per actor into new `actorReflectionLayer`, `actorShadowLayer`, and `actorRimLayer` containers around the existing `assetActors`. Companions reuse the actor texture so gait, stagger, breathing, and closure deformation stay in sync; each blend mode owns a layer so batching holds.
- Rules untouched: no simulation, capture geometry, layered peel, XP, reward, or input change. Companions are hidden with their actor and never consulted for hit resolution.
- Verification: ESLint clean, strict TypeScript clean, 41 files/347 tests pass. `npm run release:verify` could not complete — `vite build` aborts with `0xC0000409` (stack buffer overrun) inside the Rolldown native binding. The same crash reproduces on the unmodified `4bc51ab` baseline with all work stashed, so it is environmental, not a regression. The shell runs Node 24.12.0 while `.nvmrc` pins the verified 24.16.0.
- Blocked: build gate, post-change capture, and commit/push wait on a Node 24.16.0 environment and an owner visual check.
- Next: after the visual check, scope P7-4 multi-direction prerendered actor sheets against the 6MiB startup art budget.

### 2026-08-12 — P7-3 third pass: district volumes and ground lighting

- Owner report after the grounding pass: the scene still reads 2D overall, not just the actors. Re-diagnosis found the structural cause in the environment, not the characters. `drawConcreteBlock` filled perimeter barricades as flat oriented quads; every entry in `quarantineDistrict.ts` — puddles, lights, vents, crosswalks, biomass — was a decal painted on the ground plane; and `drawEnvironment` covered all 3,200x1,800 with one constant-alpha fill. No world object drew a side face or cast a shadow, and the road had no tone variation.
- Added `src/presentation/ExtrudedVolume.ts`: pure projection helpers for top-face lift, cast-shadow reach, oriented footprints, viewer-facing side selection, per-face shading against the fixed key light, and per-channel colour shading. Ten unit tests cover winding, visibility culling, degenerate footprints, and colour clamping.
- Converted perimeter barricades to real volumes and added `DISTRICT_BLOCKS`: 28 slabs, crates, rubble piles, and perimeter barriers, drawn back-to-front so nearer volumes overlap. Interior heights stay 11–30 world units, perimeter pieces 36–41.
- Added `drawGroundLighting`: a district-wide darkening pass with cold light pools around each emergency light and faint rain haze in the far bands, so the road carries near/far tone variation.
- Rules untouched: blocks are presentation only with no collision, capture role, or reward. Loop geometry, capture membership, XP, input, and camera are unchanged.
- Verification: ESLint clean, strict TypeScript clean, 42 files/357 tests pass. The `vite build` gate remains blocked by the environmental Rolldown crash described in the previous entry.
- Open: owner visual check at 1920×1080 against the styleframe, then tuning of block density, light pool strength, and volume height before commit.

### 2026-08-13 — P7-4 depth order and P7-5 directional actors

- Shared footpoint sorting now places raised blocks, authored props, Carrier-09, and ordinary Drifters in one presentation-only depth layer; combat overlays remain readable above it.
- Carrier-09 and ordinary Drifters use original eight-direction fixed-light prerender atlases, eliminating runtime bitmap rotation for the most common first-minute actors.
- A deferred four-cell quarantine prop atlas and data-driven placements add large foreground, midground, and background landmarks without collision or simulation changes.
- Chrome QA captured a real one-enemy loop from preview through reward recovery at 1920×1080 and an active movement+tether state at 390×844. Evidence is stored under `references/qa/2026-08-13-p7-5-*`.
- Automated gate: ESLint and all 44 test files/365 tests pass; strict TypeScript and a clean production build pass. Physical phone feel, complete run/boss screens, and deployment smoke tests remain.

### 2026-08-13 — P7-6 through P7-8 visual closure

- Replaced representative interior placeholder volumes with 11 authored 3-band landmarks while preserving presentation-only traversal.
- Strengthened the 0.82-second capture beat with a distinct closure seam, three readable intake conduits, and a Carrier arrival pulse; the independent desktop audit returned GO.
- Rebuilt Warden presentation as a grounded, nonrotating 2.5D anatomical boss with stage-specific arms/shell/core targets and segmented telegraphs.
- Added deferred fixed-light 8-direction atlases for every late enemy family, plus a stable Warden frame, without increasing the 4.61MiB startup payload.
- `npm run release:verify` passes 46 files/376 tests, build, 30 public files, and 19.15MiB total payload. Remaining release evidence is physical mobile, full-run audio, and deployment smoke testing.

## P8 ??실시간 3D 전환 (2026-08-13)

D-027 참조. 목표 이미지 정합을 위해 실시간 3D 백엔드를 추가했다.

### 완료

- 구조물 충돌 (D-028) ??사냥꾼과 적 4종 전부, 스폰 유효성 포함
- `RendererHost` 시임 ??백엔드 2개 공존, 동적 임포트
- Three.js 백엔드 ??직교 카메라 리그, 월드 지오메트리, 그림자, 비, 조명 컬링
- 절차적 관절 크리처 7종 + 사냥꾼 ??보행, 전투 스탠스, 갑주 판
- 살아있는 테더 + 0.82초 포획 비트, Warden 방사형 리그

### 남은 것 (3D를 기본으로 올리기 전)

우선순위 순.

1. **지면 텍스처.** 현재 단색 아스팔트. 2D의 노면 디테일이 3D에 없다.
   가장 큰 시각 격차다.
2. **아키타입 색 분리.** 7종이 전부 같은 살빛이다. 2D는 종별 틴트가 있다.
3. **웅덩이 반사.** 광택 하이라이트만 있고 배우를 비추지 않는다.
   평면 반사 대신 반전 블롭(2D 컨셉 이식)이 통합 GPU에 맞다.
4. **Warden 공격 텔레그래프.** 지오메트리는 그려지지만 예고 연출이 없다.
5. **보행 튜닝.** 수학은 테스트로 고정됐지만 미학은 사람이 봐야 한다.

### 예산

`scripts/verify-release.mjs`가 청크별 gzip을 개별로 막는다.
현재: boot 37.3 KiB / pixi 35.2 KiB / three 137.5 KiB. 시작 아트 4.61 MiB.
