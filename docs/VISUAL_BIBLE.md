# Visual Bible — “Predatory Anatomy in Cold Rain”

## Target feeling

세포나 귀여운 군집이 아니라, 인간 크기의 기생 포식자가 격리 도시의 괴물들을 사냥하는 느낌. 멀리서는 규칙이 읽히고, 가까운 순간에는 근육·힘줄·골편이 비정상적으로 재배열되는 불쾌한 쾌감을 준다.

## Visual recipe

- 카메라: 탑다운 3/4에 가까운 높은 시점. 전투 판독을 위해 지붕과 높은 장애물은 절제한다.
- 환경: 젖은 아스팔트, 임시 방역등, 찢어진 격리 비닐, 빗물에 번지는 경광색.
- 주인공: 숯빛 생체 덩어리 + 상아색 골격 포인트 + 얇은 동맥색 발광. 네 방향 확장 시에도 중앙 본체가 가장 강한 명암 덩어리다.
- 적: 가족마다 하나의 지배적인 실루엣 규칙. 속도형은 창, 감시형은 눈/부채, 절단형은 가위, 분열형은 좌우 대칭.
- UI: 실험 장비의 판독기처럼 얇고 차갑게. 장식보다 생체 신호와 위험 정보를 우선한다.

## Palette

| 역할 | 색 | 용도 |
| --- | --- | --- |
| Void | `#090B0D` | 배경 최암부 |
| Wet asphalt | `#171C20` | 도로·건물 |
| Bone | `#D8D1BE` | 플레이어 핵심 형태·선택 가능 상태 |
| Tendon | `#8B7F6B` | 보조 구조 |
| Arterial | `#C9362B` | 플레이어 생체선·포획 |
| Warning amber | `#E8A33A` | 닻·공격 텔레그래프 |
| Hostile cyan | `#4EA7A8` | 연구소 장치·적 원거리 공격 |
| Rain haze | `#6F8189` | 원경·비·안개 |

빨강은 화면 전체에 흩뿌리지 않는다. 루프와 포획 성공에 집중시켜 플레이어의 행위가 가장 먼저 보이게 한다.

## Loop feedback beat

1. **Anchor:** 상아색 골편이 지면을 찌르고 짧은 저역 클릭.
2. **Tether:** 긴장도에 따라 선이 가늘어지고 내부 맥박 속도가 오른다.
3. **Valid preview:** 폐쇄 가능 영역에 아주 옅은 막이 생기고 닻이 당겨진다.
4. **Closure:** 2–3프레임의 명확한 밝은 윤곽과 짧은 히트 스톱.
5. **Contraction:** 영역이 중심으로 빨려 들어가며 적 실루엣이 먼저 찢어진다.
6. **Decomposition:** 피 분사보다 조직 조각과 골편이 방향성 있게 분해된다.
7. **Intake:** 보상 입자가 본체로 흡수되고 HUD에 같은 박자로 반응한다.

전체 비트는 기본 적 기준 약 0.6–0.9초. 게임 규칙이 멈추는 시간은 최소화한다.

M1 구현값은 0.82초다. 포획 적의 실제 위치마다 조직·골편을 분해하고, 수축 중심에서 본체 위치로 보상 입자가 이동한다. 카메라 충격은 폐쇄와 수축 두 지점에만 작게 적용하며 빈 고리는 약한 잔상만 남긴다.

## Readability rules

- 적 공격 텔레그래프는 실제 위험보다 먼저, 같은 형태와 색으로 반복한다.
- 활성 루프 선, 적 투사체, 환경 균열이 같은 명도와 굵기를 갖지 않는다.
- 비와 후처리는 실루엣을 가리지 않는 강도로 제한한다.
- 색각에만 의존하지 않고 선 모양, 맥박, 아이콘을 함께 쓴다.
- 모바일 최소 화면에서도 닻, 본체, 폐쇄 미리보기가 구분돼야 한다.

## Reference ledger

`references/source/`의 이미지는 사용자가 제공한 분위기 레퍼런스다.

- Prototype 계열 이미지에서 취할 것: 생체 재질의 밀도, 무게감 있는 비정형 운동, 도시 대비, 공격 시 형태 변화.
- 취하지 않을 것: 기존 주인공의 후드/의상, 칼날 팔의 정확한 실루엣, UI·로고, 특정 장면 구도, 캐릭터 정체성.
- `references/generated/loop-gameplay-styleframe-v1.png`: 2026-08-11 사용자가 최종 방향으로 승인한 **비주얼 기준판**. 최종 자산 자체는 아니지만 카메라, 젖은 도시의 밀도, 검은 생체량/상아 골편/동맥색의 비율, 루프 가독성과 포획 강도의 기준이다.

모든 최종 캐릭터와 적은 루프 메커닉에서 출발한 독자 실루엣으로 다시 설계한다.

## Asset order

1. M1.5 대표 화면: 플레이어, Drifter, 살아 있는 루프, 포획 VFX, 젖은 도로 한 세트를 실제 런타임에서 완성한다.
2. 대표 화면에서 승인된 형태 문법으로 플레이어/적 실루엣 시트를 확장한다.
3. 각 게임 시스템과 함께 공격 텔레그래프·임프린트·진화 VFX를 제작한다.
4. 환경 타일과 비/안개를 모듈화한다.
5. 타이틀·결과 화면 일러스트와 최종 후처리를 완성한다.

### M1.5B production asset set

The first runtime-ready bitmap set lives under `public/assets/art/` and covers
Carrier-09, Drifter, the living tether, and the empty quarantine-street arena.
The original chroma-key renders and the final generation prompt summary are
preserved under `references/generated/production-art-v1/`. The runtime treats
these images as replaceable production assets: simulation state remains
independent, actor sprites are pooled, and the earlier procedural drawings
remain as underlays, readability accents, and load-failure fallbacks.

### P3 quarantine district map

The finite district uses
`public/assets/art/environment/wet-asphalt-tile-v1.png` as a quiet repeating
material layer. Its prompt and validation record live under
`references/generated/quarantine-map-v1/`. World-space Graphics layers add
authored puddles, worn crossing paint, vents, perimeter barricades, infection
colonies, and emergency-light bloom. Only rain remains screen-fixed. This keeps
the styleframe's wet material density without baking gameplay landmarks or
screen-space lighting into one stretched arena image.

### P5 production presentation lock

The runtime armored Drifter uses
`public/assets/art/enemies/armored-drifter.png` only while its shell is intact.
Its six large ivory plates alter the gameplay silhouette instead of relying on
color. Peel immediately swaps to the exposed base Drifter and uses bone shards,
stagger deformation, an ivory HUD signal, and a distinct dry shell-break sound.
The final capture alone uses the full body tear, decomposition, and intake beat.

Carrier-09 remains one pooled bitmap but now has state-led deformation for
movement stride, active-tether tension, and closure impact. The screen-space HUD
borrows the approved styleframe's ivory integrity pips and narrow arterial
progress meter while retaining the existing restrained diagnostic frame.

### P7-2 living tether lock

The active tether uses
`public/assets/art/loop/living-tether-tile-v2.webp` as its production strip.
Distance-based presentation geometry keeps black-tendon and arterial strands
braided independently of loop sample density, while ivory hooks repeat at
world-space intervals. The procedural version remains the load-failure fallback
and uses the same spacing contract.

Closure now preserves that material language through contraction. Captured
bodies emit several curved black-red/tendon strands toward the closure centroid
and Carrier-09 before decomposition and intake. These strands are feedback only:
capture membership, layered peel rules, XP, and recovery remain unchanged. The
source, final cleanup prompt, alpha validation, and runtime dimensions are
recorded under `references/generated/production-art-v5/`.

### P7-3 world-fixed actor grounding

Production actor textures bake one light direction, and the runtime rotates the
whole sprite to follow facing, so the baked light turns with the body. Each
actor therefore draws three pooled companions from its own texture: a silhouette
cast shadow offset down-right, a mirrored wet-road reflection, and an additive
bone rim offset back toward the key light. The offsets live in
`src/presentation/GroundedLighting.ts` and stay screen-fixed under rotation.

The district key light is fixed high and screen up-left. Any future authored
lighting, prop shading, or environment bloom must agree with that direction.

This is a partial fix. Interior shading still rotates with the sprite, and one
authored direction cannot show perspective change between facing toward and
away from the camera. The full fix is multi-direction prerendered actor sheets
— 3D used offline as a render source, not a runtime renderer — planned as P7-4
and constrained by the 6MiB startup art budget.

### P7-3 district volumes

Depth in this camera comes from objects, not from the character. Any raised
world object draws through `src/presentation/ExtrudedVolume.ts` as three parts:
a cast shadow thrown down-right along the key light, the side faces that turn
toward the viewer, and a top face lifted up-screen from the ground footprint.
A flat fill on the ground plane is a decal and must only be used for things
that genuinely lie flat — road paint, puddles, stains, cracks.

Ground tone is never uniform. The district carries a darkening pass with cold
light pools around each emergency lamp. Pools use wet-asphalt tone, not lamp
colour: arterial red stays reserved for the loop and the capture beat.

Street blocks are presentation only. They carry no collision, so interior
heights stay low enough that an actor crossing one still reads as plausible.
Tall pieces belong in the perimeter band.

### P7-5 fixed-light directional actors and authored depth

- Carrier-09 and onboarding Drifters use eight offline-rendered directions with one stable upper-left key light. Runtime rotation of these bitmaps is forbidden; direction selection changes the frame.
- Foot-contact Y is the shared depth key for actors, extruded blocks, and authored quarantine props. Low props may occlude lower body mass but must not hide loop telegraphs or capture feedback.
- Every representative combat frame should show at least three depth bands: a cropped foreground occluder, the playable actor/enemy band, and a distant landmark or light source.
- Large landmarks use cold metal, wet concrete, ivory growth, and restrained arterial binding. They remain presentation-only unless a future gameplay decision explicitly adds collision.

### P7-8 late-enemy and Warden closure

- Armored Drifter, Rusher, Watcher, Cutter, Mimic, Elite Husk, and Warden use fixed-light directional or stable-frame 3D prerenders. Directional actors must never rotate their bitmap; motion selects an atlas frame and keeps shadows, reflections, and rim lighting screen-fixed.
- Warden reads through body volume first: a large grounded shell, segmented bone/tendon arcs, restrained arterial seams, and small stage-specific cyan control structures. Full bright circles are reserved for authoritative telegraph boundaries and must be segmented rather than reading as flat UI rings.
- Capture closure is a short lethal seam, contraction preserves mass, decomposition retains target silhouettes, and exactly three heavy reward conduits terminate at Carrier before the arrival pulse.
- The current desktop visual gate is GO. Do not trade this readability for full mesh simulation; physical mobile and full-run evidence are release QA, not reasons to change locked gameplay.
