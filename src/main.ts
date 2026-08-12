import './style.css';
import {
  GameApp,
  type GameQaScene,
  type GameStatus,
} from './app/GameApp';
import {
  describeMutationUpgradeKo,
  getImprintChoicePresentationKo,
} from './content/choicePresentation';
import { getMutationDefinition } from './content/mutations';
import { filledIntegrityPipCount } from './presentation/HudPresentation';

const root = document.querySelector<HTMLElement>('#app');

if (root === null) {
  throw new Error('Missing #app root element.');
}

root.innerHTML = `
  <div class="game-shell">
    <div class="canvas-host" data-canvas-host></div>
    <div class="rain-glass" aria-hidden="true"></div>

    <section class="run-overlay" data-run-overlay aria-live="polite">
      <div class="run-overlay__frame">
        <span class="run-overlay__eyebrow" data-run-overlay-eyebrow>CARRIER-09 / 격리 생물구역</span>
        <h2 data-run-overlay-title>FLESH<span>LOOM</span></h2>
        <p data-run-overlay-copy>살아 있는 고리를 짜 감염체를 포획하고, 흡수한 형질로 워든을 사냥하세요.</p>
        <div class="run-overlay__protocol" data-run-protocol>
          <span>이동</span><b>WASD / 방향키</b>
          <span>고리</span><b>SPACE · 토글</b>
          <span>목표</span><b>09:00 생존</b>
        </div>
        <div class="run-summary" data-run-summary hidden></div>
        <div class="run-overlay__actions">
          <button type="button" class="run-primary" data-run-primary>사냥 시작</button>
          <button type="button" class="run-mode" data-run-mode>고리 · 토글</button>
          <button type="button" class="run-options" data-run-options>설정</button>
          <button type="button" class="run-secondary" data-run-secondary hidden>타이틀로</button>
        </div>
        <small data-run-seed>사냥 씨드 —</small>
      </div>
    </section>

    <section class="settings-panel" data-settings-panel hidden role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <span>접근성 / 오디오</span>
      <h2 id="settings-title">설정</h2>
      <p>변경 사항은 즉시 적용되며 현재 세션 동안 유지됩니다.</p>
      <div class="settings-grid">
        <button type="button" data-setting-motion><span>움직임 줄이기</span><strong>끔</strong></button>
        <button type="button" data-setting-flash><span>섬광 줄이기</span><strong>끔</strong></button>
        <button type="button" data-setting-master><span>전체 음량</span><strong>100%</strong></button>
        <button type="button" data-setting-music><span>음악</span><strong>50%</strong></button>
        <button type="button" data-setting-sfx><span>효과음</span><strong>100%</strong></button>
      </div>
      <button type="button" class="settings-close" data-settings-close>닫기</button>
    </section>

    <header class="hud hud--top">
      <div class="identity">
        <span class="eyebrow">CARRIER-09 / 9분 사냥</span>
        <h1 aria-label="FLESHLOOM">FLESH<span>L<span class="title-loops">OO</span>M</span></h1>
      </div>
      <div class="run-readouts" aria-live="polite">
        <div class="run-readout run-readout--hp" data-hp-panel>
          <span>숙주 생명력</span>
          <div class="integrity-pips" data-integrity-pips aria-hidden="true">
            <i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>
          </div>
          <strong data-hp>100 / 100</strong>
          <i class="hud-meter"><b data-hp-fill></b></i>
        </div>
        <div class="run-readout run-readout--xp">
          <span data-level>진화 01</span>
          <strong data-xp>경험치 00 / 30</strong>
          <i class="hud-meter hud-meter--xp"><b data-xp-fill></b></i>
          <em data-run-time>00:00 / 09:00</em>
        </div>
        <div class="capture-readout" data-capture-panel>
          <span>확보한 생체량</span>
          <strong data-captured>00</strong>
        </div>
      </div>
    </header>

    <section class="loop-readout" aria-live="polite">
      <div class="loop-readout__signal" data-signal></div>
      <div>
        <span data-loop-label>사냥 대기</span>
        <p data-hint>SPACE를 누르고 적 주위를 이동한 뒤 다시 눌러 고리를 닫으세요.</p>
      </div>
      <output data-area>면적 0000</output>
    </section>

    <aside class="tutorial-prompt" data-tutorial-prompt aria-live="polite">
      <span data-tutorial-step>01 / 이동</span>
      <strong data-tutorial-copy>WASD, 방향키 또는 터치 스틱으로 이동하세요.</strong>
    </aside>

    <aside class="imprint-readout" data-imprint-panel hidden>
      <span>활성 임프린트</span>
      <strong data-imprint>없음</strong>
    </aside>

    <section class="decision-panel" data-decision-panel hidden aria-live="assertive">
      <span class="decision-panel__eyebrow" data-decision-eyebrow>진화 가능</span>
      <h2 data-decision-title>변이를 선택하세요</h2>
      <p data-decision-copy>게임이 정지되었습니다. 1, 2, 3으로 선택하세요.</p>
      <div class="decision-options" data-decision-options></div>
    </section>

    <div class="touch-controls" data-touch-controls aria-label="Touch controls">
      <div class="touch-move" data-touch-move>
        <i aria-hidden="true"></i>
        <span>드래그하여 이동</span>
      </div>
      <div class="touch-actions">
        <button type="button" class="touch-mode" data-touch-mode aria-label="Change loop input mode">
          <span data-touch-mode-label>토글</span>
        </button>
        <button type="button" class="touch-restart" data-touch-restart aria-label="Restart run">R</button>
        <button type="button" class="touch-loop" data-touch-loop>고리</button>
      </div>
    </div>

    <footer class="hud hud--bottom">
      <div class="control"><kbd>WASD</kbd><span>이동</span></div>
      <div class="control"><kbd>SPACE</kbd><span data-loop-control>PRESS · TRACE · PRESS</span></div>
      <div class="control"><kbd>R</kbd><span>재시작</span></div>
      <button
        class="input-mode"
        data-loop-mode
        type="button"
        aria-label="고리 입력을 홀드 방식으로 변경"
        aria-pressed="true"
      >
        <span>고리 입력</span>
        <strong data-loop-mode-label>토글</strong>
      </button>
      <span class="build-note">격리구역 운영 빌드</span>
    </footer>
  </div>
`;

const qaParameters = new URLSearchParams(window.location.search);
const qaTouch = import.meta.env.DEV && qaParameters.has('qaTouch');
const qaSceneIds: readonly GameQaScene[] = [
  'enemy-gallery',
  'exposed-armored',
  'mutation',
  'imprint',
  'warden-arrival',
  'warden-arms',
  'warden-shell',
  'warden-core',
  'victory',
];
const requestedQaScene = qaParameters.get('qaScene');
const qaScene =
  import.meta.env.DEV &&
  qaSceneIds.includes(requestedQaScene as GameQaScene)
    ? (requestedQaScene as GameQaScene)
    : undefined;

if (qaTouch) {
  root.dataset.qaTouch = 'true';
}

const requiredElement = <T extends Element>(selector: string): T => {
  const element = root.querySelector<T>(selector);
  if (element === null) {
    throw new Error(`The game shell is missing ${selector}.`);
  }
  return element;
};

const canvasHost = requiredElement<HTMLElement>('[data-canvas-host]');
const gameShell = requiredElement<HTMLElement>('.game-shell');
const runOverlay = requiredElement<HTMLElement>('[data-run-overlay]');
const runOverlayEyebrow = requiredElement<HTMLElement>(
  '[data-run-overlay-eyebrow]',
);
const runOverlayTitle = requiredElement<HTMLElement>(
  '[data-run-overlay-title]',
);
const runOverlayCopy = requiredElement<HTMLElement>('[data-run-overlay-copy]');
const runProtocol = requiredElement<HTMLElement>('[data-run-protocol]');
const runSummary = requiredElement<HTMLElement>('[data-run-summary]');
const runPrimary = requiredElement<HTMLButtonElement>('[data-run-primary]');
const runMode = requiredElement<HTMLButtonElement>('[data-run-mode]');
const runOptions = requiredElement<HTMLButtonElement>('[data-run-options]');
const runSecondary = requiredElement<HTMLButtonElement>(
  '[data-run-secondary]',
);
const runSeed = requiredElement<HTMLElement>('[data-run-seed]');
const settingsPanel = requiredElement<HTMLElement>('[data-settings-panel]');
const settingMotion = requiredElement<HTMLButtonElement>('[data-setting-motion]');
const settingFlash = requiredElement<HTMLButtonElement>('[data-setting-flash]');
const settingMaster = requiredElement<HTMLButtonElement>('[data-setting-master]');
const settingMusic = requiredElement<HTMLButtonElement>('[data-setting-music]');
const settingSfx = requiredElement<HTMLButtonElement>('[data-setting-sfx]');
const settingsClose = requiredElement<HTMLButtonElement>('[data-settings-close]');
const capturedReadout = requiredElement<HTMLElement>('[data-captured]');
const capturePanel = requiredElement<HTMLElement>('[data-capture-panel]');
const loopLabel = requiredElement<HTMLElement>('[data-loop-label]');
const hint = requiredElement<HTMLElement>('[data-hint]');
const area = requiredElement<HTMLOutputElement>('[data-area]');
const signal = requiredElement<HTMLElement>('[data-signal]');
const loopControl = requiredElement<HTMLElement>('[data-loop-control]');
const loopModeButton = requiredElement<HTMLButtonElement>('[data-loop-mode]');
const loopModeLabel = requiredElement<HTMLElement>('[data-loop-mode-label]');
const hpPanel = requiredElement<HTMLElement>('[data-hp-panel]');
const hpReadout = requiredElement<HTMLElement>('[data-hp]');
const hpFill = requiredElement<HTMLElement>('[data-hp-fill]');
const xpFill = requiredElement<HTMLElement>('[data-xp-fill]');
const integrityPips = requiredElement<HTMLElement>('[data-integrity-pips]');
const levelReadout = requiredElement<HTMLElement>('[data-level]');
const xpReadout = requiredElement<HTMLElement>('[data-xp]');
const runTimeReadout = requiredElement<HTMLElement>('[data-run-time]');
const imprintPanel = requiredElement<HTMLElement>('[data-imprint-panel]');
const imprintReadout = requiredElement<HTMLElement>('[data-imprint]');
const decisionPanel = requiredElement<HTMLElement>('[data-decision-panel]');
const decisionEyebrow = requiredElement<HTMLElement>('[data-decision-eyebrow]');
const decisionTitle = requiredElement<HTMLElement>('[data-decision-title]');
const decisionCopy = requiredElement<HTMLElement>('[data-decision-copy]');
const decisionOptions = requiredElement<HTMLElement>('[data-decision-options]');
const touchMove = requiredElement<HTMLElement>('[data-touch-move]');
const touchLoop = requiredElement<HTMLButtonElement>('[data-touch-loop]');
const touchRestart = requiredElement<HTMLButtonElement>('[data-touch-restart]');
const touchMode = requiredElement<HTMLButtonElement>('[data-touch-mode]');
const touchModeLabel = requiredElement<HTMLElement>('[data-touch-mode-label]');
const tutorialPrompt = requiredElement<HTMLElement>('[data-tutorial-prompt]');
const tutorialStep = requiredElement<HTMLElement>('[data-tutorial-step]');
const tutorialCopy = requiredElement<HTMLElement>('[data-tutorial-copy]');

const tutorialCopyByStep: Record<GameStatus['tutorialStep'], string> = {
  move: 'WASD, 방향키 또는 터치 스틱으로 이동하세요.',
  anchor: 'SPACE 또는 고리 버튼을 한 번 눌러 생체 닻을 심으세요.',
  close: '적 주위를 이동한 뒤 SPACE 또는 고리 버튼을 다시 누르세요.',
  capture: '유효한 고리 안에 적을 넣어 포획하세요.',
  complete: '회복하고 진화하며 9분 뒤 워든과 접촉할 때까지 사냥하세요.',
};

const tutorialOrder: Record<GameStatus['tutorialStep'], string> = {
  move: '01 / 이동',
  anchor: '02 / 생체 닻',
  close: '03 / 고리 닫기',
  capture: '04 / 포획',
  complete: '사냥 프로토콜 활성',
};

const labels: Record<GameStatus['state'], string> = {
  title: '캐리어 대기',
  idle: '사냥 대기',
  drawing: '생체 고리 전개 중',
  valid: '포획 준비 완료',
  success: '생체량 포획 완료',
  'armor-peeled': '중장갑 외피 파괴',
  miss: '포획 대상 없음',
  hurt: '숙주 손상',
  dead: '캐리어 소실 — R 재시작',
  mutation: '영구 진화 가능',
  imprint: '임프린트 선택',
  complete: '워든 접촉 — R 재시작',
  'warden-arrival': '워든 출현 중',
  'warden-arms': '양팔을 절단하세요',
  'warden-shell': '외피를 벗기세요',
  'warden-core': '핵과 제어점 포획',
  ending: '워든 붕괴 중',
  victory: '워든 무력화 완료',
};

const updateHud = (status: GameStatus): void => {
  gameShell.dataset.scene = status.runScene;
  gameShell.dataset.reducedMotion = String(status.reducedMotion);
  gameShell.dataset.reducedFlash = String(status.reducedFlash);
  const showRunOverlay =
    status.runScene === 'title' || status.runScene === 'results';
  runOverlay.hidden = !showRunOverlay;
  runSeed.textContent = `사냥 씨드 ${status.runSeed.toString(16).toUpperCase().padStart(8, '0')}`;
  runMode.textContent = `고리 · ${status.inputMode === 'hold' ? '홀드' : '토글'}`;
  settingMotion.querySelector('strong')!.textContent = status.reducedMotion
    ? '켬'
    : '끔';
  settingFlash.querySelector('strong')!.textContent = status.reducedFlash
    ? '켬'
    : '끔';
  settingMotion.setAttribute('aria-pressed', String(status.reducedMotion));
  settingFlash.setAttribute('aria-pressed', String(status.reducedFlash));
  settingMaster.querySelector('strong')!.textContent = `${Math.round(status.masterVolume * 100)}%`;
  settingMusic.querySelector('strong')!.textContent = `${Math.round(status.musicVolume * 100)}%`;
  settingSfx.querySelector('strong')!.textContent = `${Math.round(status.sfxVolume * 100)}%`;

  if (status.runScene === 'title') {
    runOverlay.dataset.outcome = 'title';
    runOverlayEyebrow.textContent = 'CARRIER-09 / 격리 생물구역';
    runOverlayTitle.innerHTML = 'FLESH<span>LOOM</span>';
    runOverlayCopy.textContent =
      '살아 있는 고리를 짜 감염체를 포획하고, 흡수한 형질로 워든을 사냥하세요.';
    runProtocol.hidden = false;
    runSummary.hidden = true;
    runPrimary.textContent = '사냥 시작';
    runMode.hidden = false;
    runSecondary.hidden = true;
  } else if (status.runScene === 'results' && status.runResult !== null) {
    const result = status.runResult;
    const totalSeconds = Math.floor(result.totalSeconds);
    const resultMinutes = Math.floor(totalSeconds / 60);
    const resultSeconds = totalSeconds % 60;
    const mutations =
      result.mutations.length === 0
        ? '없음'
        : result.mutations
            .map(
              (mutation) =>
                `${getMutationDefinition(mutation.id).name} ${mutation.rank}등급`,
            )
            .join(' · ');
    const victoryRows =
      result.outcome === 'victory'
        ? `<span>워든</span><b>${result.wardenSeconds.toFixed(1)}초</b><span>최종 형태</span><b>${result.fourfold ? '사중 사냥' : '생체 고리'}</b>`
        : '';
    runOverlay.dataset.outcome = result.outcome;
    runOverlayEyebrow.textContent =
      result.outcome === 'victory'
        ? '격리 기록 / 워든 무력화'
        : '캐리어 부검 / 신호 소실';
    runOverlayTitle.textContent =
      result.outcome === 'victory' ? '사냥 완료' : '캐리어 소실';
    runOverlayCopy.textContent =
      result.outcome === 'victory'
        ? '워든이 붕괴했습니다. 생체 고리는 흡수한 모든 형질을 기억합니다.'
        : '격리 전에 숙주가 소실되었습니다. 새 캐리어가 사냥 프로토콜을 이어받습니다.';
    runProtocol.hidden = true;
    runSummary.hidden = false;
    runSummary.innerHTML = `
      <span>경과 시간</span><b>${resultMinutes.toString().padStart(2, '0')}:${resultSeconds.toString().padStart(2, '0')}</b>
      <span>포획 수</span><b>${result.captured.toString().padStart(2, '0')}</b>
      <span>진화 등급</span><b>${result.level.toString().padStart(2, '0')}</b>
      <span>미사용 선택</span><b>${result.unspentChoices}</b>
      <span>임프린트</span><b>${result.activeImprint === null ? '없음' : getImprintChoicePresentationKo(result.activeImprint).name}</b>
      ${victoryRows}
      <span>변이</span><b>${mutations}</b>
    `;
    runPrimary.textContent = '새 사냥';
    runMode.hidden = true;
    runSecondary.hidden = false;
  }

  capturedReadout.textContent = status.captured.toString().padStart(2, '0');
  capturePanel.dataset.state = status.state;
  loopLabel.textContent = labels[status.state];
  hint.textContent = status.hint;
  area.textContent = `면적 ${Math.round(status.loopArea).toString().padStart(4, '0')}`;
  signal.dataset.state = status.state;
  loopModeLabel.textContent = status.inputMode === 'hold' ? '홀드' : '토글';
  touchModeLabel.textContent = status.inputMode === 'hold' ? '홀드' : '토글';
  loopControl.textContent =
    status.inputMode === 'hold'
      ? '누르기 · 이동 · 놓기'
      : '누르기 · 이동 · 다시 누르기';
  loopModeButton.setAttribute(
    'aria-label',
    status.inputMode === 'hold'
      ? '고리 입력을 토글 방식으로 변경'
      : '고리 입력을 홀드 방식으로 변경',
  );
  loopModeButton.setAttribute(
    'aria-pressed',
    String(status.inputMode === 'toggle'),
  );

  hpReadout.textContent = `${Math.ceil(status.hp)} / ${status.maxHp}`;
  hpPanel.dataset.state = status.state;
  hpFill.style.width = `${Math.max(0, Math.min(100, (status.hp / status.maxHp) * 100))}%`;
  const filledPips = filledIntegrityPipCount(status.hp, status.maxHp);
  Array.from(integrityPips.children).forEach((pip, index) => {
    (pip as HTMLElement).dataset.filled = String(index < filledPips);
  });
  levelReadout.textContent = `진화 ${status.level.toString().padStart(2, '0')}`;
  xpReadout.textContent = `경험치 ${Math.floor(status.xp).toString().padStart(2, '0')} / ${status.xpForNextLevel}`;
  xpFill.style.width = `${Math.max(0, Math.min(100, (status.xp / status.xpForNextLevel) * 100))}%`;
  if (status.wardenStage === null) {
    const elapsedSeconds = Math.min(540, Math.floor(status.runSeconds));
    const minutes = Math.floor(elapsedSeconds / 60);
    const seconds = elapsedSeconds % 60;
    runTimeReadout.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')} / 09:00`;
  } else {
    const wardenSeconds = Math.floor(status.wardenSeconds);
    const completed = Math.min(
      status.wardenProgress,
      status.wardenProgressRequired,
    );
    const progress =
      status.wardenStage === 'arrival'
        ? `${completed.toFixed(1)} / ${status.wardenProgressRequired.toFixed(1)}`
        : `${Math.floor(completed)} / ${Math.floor(status.wardenProgressRequired)}`;
    runTimeReadout.textContent = `워든 ${wardenSeconds.toString().padStart(2, '0')}초 · ${progress}`;
  }

  tutorialPrompt.hidden = status.tutorialComplete;
  tutorialPrompt.dataset.assist = String(status.tutorialAssist);
  tutorialStep.textContent = tutorialOrder[status.tutorialStep];
  tutorialCopy.textContent = `${tutorialCopyByStep[status.tutorialStep]}${
    status.tutorialAssist ? ' · 보조 스냅이 활성화되었습니다. 더 넓게 회전하세요.' : ''
  }`;

  imprintPanel.hidden = status.activeImprint === null;
  if (status.activeImprint !== null) {
    imprintReadout.textContent = `${getImprintChoicePresentationKo(status.activeImprint).name} · ${Math.ceil(status.imprintSeconds)}초`;
  }

  const hasMutationDraft = status.mutationCandidates.length > 0;
  const hasImprintOffer = status.imprintCandidates.length > 0;
  decisionPanel.hidden = !hasMutationDraft && !hasImprintOffer;
  decisionPanel.dataset.mode = status.decisionMode;

  if (hasMutationDraft) {
    decisionEyebrow.textContent = '영구 진화';
    decisionTitle.textContent = '변이를 선택하세요';
    decisionCopy.textContent = '정지 상태 · 1, 2, 3으로 선택하세요';
    decisionOptions.replaceChildren(
      ...status.mutationCandidates.map((candidate, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.choiceIndex = String(index);
        const upgradeDescription = describeMutationUpgradeKo(candidate);
        button.innerHTML = `<kbd>${index + 1}</kbd><span><strong>${candidate.name}</strong><small>${candidate.description}<br>적용: ${upgradeDescription} · ${candidate.nextRank}/${candidate.maxRank}등급</small></span>`;
        return button;
      }),
    );
  } else if (hasImprintOffer) {
    decisionEyebrow.textContent = '임시 적응';
    decisionTitle.textContent = '임프린트를 흡수하세요';
    const imprintInstruction =
      status.activeImprint === null
        ? '1 또는 2로 임시 특성을 선택하세요.'
        : `현재 ${getImprintChoicePresentationKo(status.activeImprint).name}을 교체하거나 3 / ESC로 유지하세요.`;
    decisionCopy.textContent =
      status.decisionMode === 'slow'
        ? `시간 감속 15% · ${imprintInstruction}`
        : `정지 상태 · ${imprintInstruction}`;
    const optionButtons = status.imprintCandidates.map((candidate, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.choiceIndex = String(index);
      const presentation = getImprintChoicePresentationKo(candidate);
      button.innerHTML = `<kbd>${index + 1}</kbd><span><strong>${presentation.name}</strong><small>${presentation.description}</small></span>`;
      return button;
    });
    if (status.activeImprint !== null) {
      const keepButton = document.createElement('button');
      keepButton.type = 'button';
      keepButton.dataset.choiceIndex = '2';
      const activePresentation = getImprintChoicePresentationKo(
        status.activeImprint,
      );
      keepButton.innerHTML = `<kbd>3</kbd><span><strong>${activePresentation.name} 유지</strong><small>남은 지속시간 ${Math.ceil(status.imprintSeconds)}초를 그대로 유지합니다.</small></span>`;
      optionButtons.push(keepButton);
    }
    decisionOptions.replaceChildren(...optionButtons);
  }
};

const game = new GameApp(
  updateHud,
  qaScene === undefined ? {} : { qaScene },
);
let selectedLoopMode: GameStatus['inputMode'] = 'toggle';

const toggleLoopMode = (): void => {
  selectedLoopMode = selectedLoopMode === 'hold' ? 'toggle' : 'hold';
  game.setLoopInputMode(selectedLoopMode);
};

loopModeButton.addEventListener('click', toggleLoopMode);
touchMode.addEventListener('click', toggleLoopMode);
runPrimary.addEventListener('click', () => game.requestStartRun());
runMode.addEventListener('click', toggleLoopMode);
runSecondary.addEventListener('click', () => game.requestReturnToTitle());
runOptions.addEventListener('click', () => {
  settingsPanel.hidden = false;
  settingMotion.focus();
});
settingsClose.addEventListener('click', () => {
  settingsPanel.hidden = true;
  runOptions.focus();
});
settingMotion.addEventListener('click', () => game.toggleReducedMotion());
settingFlash.addEventListener('click', () => game.toggleReducedFlash());
settingMaster.addEventListener('click', () => game.cycleAudioVolume('master'));
settingMusic.addEventListener('click', () => game.cycleAudioVolume('music'));
settingSfx.addEventListener('click', () => game.cycleAudioVolume('sfx'));
settingsPanel.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  settingsPanel.hidden = true;
  runOptions.focus();
});

decisionOptions.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }
  const button = target.closest<HTMLButtonElement>('[data-choice-index]');
  const index = Number(button?.dataset.choiceIndex);
  if (index === 0 || index === 1 || index === 2) {
    game.chooseDecision(index);
  }
});

touchMove.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  touchMove.setPointerCapture(event.pointerId);
  game.beginPointerMove(event.pointerId, event.clientX, event.clientY);
  touchMove.dataset.active = 'true';
});

touchMove.addEventListener('pointermove', (event) => {
  if (!touchMove.hasPointerCapture(event.pointerId)) {
    return;
  }
  event.preventDefault();
  game.movePointer(event.pointerId, event.clientX, event.clientY);
  const bounds = touchMove.getBoundingClientRect();
  touchMove.style.setProperty('--touch-x', `${event.clientX - bounds.left}px`);
  touchMove.style.setProperty('--touch-y', `${event.clientY - bounds.top}px`);
});

const releaseMovementPointer = (event: PointerEvent): void => {
  game.endPointer(event.pointerId);
  touchMove.dataset.active = 'false';
};
touchMove.addEventListener('pointerup', releaseMovementPointer);
touchMove.addEventListener('pointercancel', (event) => {
  game.cancelPointer(event.pointerId);
  touchMove.dataset.active = 'false';
});

touchLoop.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  touchLoop.setPointerCapture(event.pointerId);
  game.beginPointerLoop(event.pointerId);
  touchLoop.dataset.active = 'true';
});

const releaseLoopPointer = (event: PointerEvent): void => {
  game.endPointerLoop(event.pointerId);
  touchLoop.dataset.active = 'false';
};
touchLoop.addEventListener('pointerup', releaseLoopPointer);
touchLoop.addEventListener('pointercancel', releaseLoopPointer);
touchRestart.addEventListener('click', () => game.requestPointerRestart());

game.start(canvasHost).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  root.innerHTML = `<div class="fatal-error"><strong>초기화 실패</strong><p>${message}</p></div>`;
  throw error;
});
