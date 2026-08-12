import './style.css';
import { GameApp, type GameStatus } from './app/GameApp';
import {
  describeMutationUpgradeKo,
  getImprintChoicePresentationKo,
} from './content/choicePresentation';
import { getMutationDefinition } from './content/mutations';

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
        <span class="run-overlay__eyebrow" data-run-overlay-eyebrow>CARRIER-09 / RESTRICTED BIOZONE</span>
        <h2 data-run-overlay-title>FLESH<span>LOOM</span></h2>
        <p data-run-overlay-copy>Weave a living tether. Enclose the infected. Carry their traits into the Warden.</p>
        <div class="run-overlay__protocol" data-run-protocol>
          <span>MOVE</span><b>WASD / ARROWS</b>
          <span>LOOP</span><b>SPACE · TOGGLE</b>
          <span>OBJECTIVE</span><b>SURVIVE 09:00</b>
        </div>
        <div class="run-summary" data-run-summary hidden></div>
        <div class="run-overlay__actions">
          <button type="button" class="run-primary" data-run-primary>BEGIN HUNT</button>
          <button type="button" class="run-mode" data-run-mode>LOOP · TOGGLE</button>
          <button type="button" class="run-options" data-run-options>OPTIONS</button>
          <button type="button" class="run-secondary" data-run-secondary hidden>RETURN TO TITLE</button>
        </div>
        <small data-run-seed>RUN SEED —</small>
      </div>
    </section>

    <section class="settings-panel" data-settings-panel hidden role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <span>ACCESSIBILITY / AUDIO</span>
      <h2 id="settings-title">OPTIONS</h2>
      <p>Changes apply immediately and remain active for this session.</p>
      <div class="settings-grid">
        <button type="button" data-setting-motion><span>REDUCED MOTION</span><strong>OFF</strong></button>
        <button type="button" data-setting-flash><span>REDUCED FLASH</span><strong>OFF</strong></button>
        <button type="button" data-setting-master><span>MASTER</span><strong>100%</strong></button>
        <button type="button" data-setting-music><span>MUSIC</span><strong>50%</strong></button>
        <button type="button" data-setting-sfx><span>SFX</span><strong>100%</strong></button>
      </div>
      <button type="button" class="settings-close" data-settings-close>CLOSE</button>
    </section>

    <header class="hud hud--top">
      <div class="identity">
        <span class="eyebrow">CARRIER-09 / NINE-MINUTE HUNT</span>
        <h1 aria-label="FLESHLOOM">FLESH<span>L<span class="title-loops">OO</span>M</span></h1>
      </div>
      <div class="run-readouts" aria-live="polite">
        <div class="run-readout run-readout--hp" data-hp-panel>
          <span>HOST INTEGRITY</span>
          <strong data-hp>100 / 100</strong>
          <i><b data-hp-fill></b></i>
        </div>
        <div class="run-readout">
          <span data-level>EVOLUTION 01</span>
          <strong data-xp>XP 00 / 30</strong>
          <em data-run-time>00:00 / 09:00</em>
        </div>
        <div class="capture-readout" data-capture-panel>
          <span>BIOMASS SECURED</span>
          <strong data-captured>00</strong>
        </div>
      </div>
    </header>

    <section class="loop-readout" aria-live="polite">
      <div class="loop-readout__signal" data-signal></div>
      <div>
        <span data-loop-label>HUNTING IDLE</span>
        <p data-hint>Press SPACE, move around prey, then press SPACE again to close the loop.</p>
      </div>
      <output data-area>AREA 0000</output>
    </section>

    <aside class="tutorial-prompt" data-tutorial-prompt aria-live="polite">
      <span data-tutorial-step>01 / MOVE</span>
      <strong data-tutorial-copy>Move 56 pixels with WASD or the touch stick.</strong>
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
        <span>DRAG TO MOVE</span>
      </div>
      <div class="touch-actions">
        <button type="button" class="touch-mode" data-touch-mode aria-label="Change loop input mode">
          <span data-touch-mode-label>TGL</span>
        </button>
        <button type="button" class="touch-restart" data-touch-restart aria-label="Restart run">R</button>
        <button type="button" class="touch-loop" data-touch-loop>LOOP</button>
      </div>
    </div>

    <footer class="hud hud--bottom">
      <div class="control"><kbd>WASD</kbd><span>MOVE</span></div>
      <div class="control"><kbd>SPACE</kbd><span data-loop-control>PRESS · TRACE · PRESS</span></div>
      <div class="control"><kbd>R</kbd><span>RESTART</span></div>
      <button
        class="input-mode"
        data-loop-mode
        type="button"
        aria-label="Change loop input to hold mode"
        aria-pressed="true"
      >
        <span>LOOP INPUT</span>
        <strong data-loop-mode-label>TOGGLE</strong>
      </button>
      <span class="build-note">FULL RUN SYSTEMS 0.6</span>
    </footer>
  </div>
`;

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
  move: 'Move with WASD, arrow keys, or the touch stick.',
  anchor: 'Press SPACE or LOOP once to plant the living anchor.',
  close: 'Move around the prey, then press SPACE or LOOP again.',
  capture: 'Close one valid loop with prey inside it.',
  complete: 'Hunt, recover, and evolve until Warden contact at nine minutes.',
};

const tutorialOrder: Record<GameStatus['tutorialStep'], string> = {
  move: '01 / MOVE',
  anchor: '02 / ANCHOR',
  close: '03 / CLOSE',
  capture: '04 / CAPTURE',
  complete: 'HUNT PROTOCOL ONLINE',
};

const labels: Record<GameStatus['state'], string> = {
  title: 'AWAITING CARRIER',
  idle: 'HUNTING IDLE',
  drawing: 'TETHER DEPLOYING',
  valid: 'CLOSURE READY',
  success: 'BIOMASS CAPTURED',
  miss: 'NO BIOMASS FOUND',
  hurt: 'HOST DAMAGED',
  dead: 'CARRIER LOST — PRESS R',
  mutation: 'EVOLUTION AVAILABLE',
  imprint: 'IMPRINT DECISION',
  complete: 'WARDEN CONTACT — PRESS R',
  'warden-arrival': 'WARDEN SURFACING',
  'warden-arms': 'SEVER THE ARMS',
  'warden-shell': 'PEEL THE SHELL',
  'warden-core': 'CLOSE THE TRIAD',
  ending: 'WARDEN COLLAPSING',
  victory: 'WARDEN NEUTRALIZED',
};

const updateHud = (status: GameStatus): void => {
  gameShell.dataset.scene = status.runScene;
  gameShell.dataset.reducedMotion = String(status.reducedMotion);
  gameShell.dataset.reducedFlash = String(status.reducedFlash);
  const showRunOverlay =
    status.runScene === 'title' || status.runScene === 'results';
  runOverlay.hidden = !showRunOverlay;
  runSeed.textContent = `RUN SEED ${status.runSeed.toString(16).toUpperCase().padStart(8, '0')}`;
  runMode.textContent = `LOOP · ${status.inputMode.toUpperCase()}`;
  settingMotion.querySelector('strong')!.textContent = status.reducedMotion
    ? 'ON'
    : 'OFF';
  settingFlash.querySelector('strong')!.textContent = status.reducedFlash
    ? 'ON'
    : 'OFF';
  settingMotion.setAttribute('aria-pressed', String(status.reducedMotion));
  settingFlash.setAttribute('aria-pressed', String(status.reducedFlash));
  settingMaster.querySelector('strong')!.textContent = `${Math.round(status.masterVolume * 100)}%`;
  settingMusic.querySelector('strong')!.textContent = `${Math.round(status.musicVolume * 100)}%`;
  settingSfx.querySelector('strong')!.textContent = `${Math.round(status.sfxVolume * 100)}%`;

  if (status.runScene === 'title') {
    runOverlay.dataset.outcome = 'title';
    runOverlayEyebrow.textContent = 'CARRIER-09 / RESTRICTED BIOZONE';
    runOverlayTitle.innerHTML = 'FLESH<span>LOOM</span>';
    runOverlayCopy.textContent =
      'Weave a living tether. Enclose the infected. Carry their traits into the Warden.';
    runProtocol.hidden = false;
    runSummary.hidden = true;
    runPrimary.textContent = 'BEGIN HUNT';
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
        ? `<span>WARDEN</span><b>${result.wardenSeconds.toFixed(1)}s</b><span>FINAL FORM</span><b>${result.fourfold ? 'FOURFOLD HUNT' : 'LIVING LOOP'}</b>`
        : '';
    runOverlay.dataset.outcome = result.outcome;
    runOverlayEyebrow.textContent =
      result.outcome === 'victory'
        ? 'CONTAINMENT RECORD / WARDEN NEUTRALIZED'
        : 'CARRIER AUTOPSY / SIGNAL LOST';
    runOverlayTitle.textContent =
      result.outcome === 'victory' ? 'HUNT COMPLETE' : 'CARRIER LOST';
    runOverlayCopy.textContent =
      result.outcome === 'victory'
        ? 'The Warden has collapsed. The living tether retains what it consumed.'
        : 'The host failed before containment. A new carrier can inherit the protocol.';
    runProtocol.hidden = true;
    runSummary.hidden = false;
    runSummary.innerHTML = `
      <span>ELAPSED</span><b>${resultMinutes.toString().padStart(2, '0')}:${resultSeconds.toString().padStart(2, '0')}</b>
      <span>BIOMASS</span><b>${result.captured.toString().padStart(2, '0')}</b>
      <span>EVOLUTION</span><b>${result.level.toString().padStart(2, '0')}</b>
      <span>UNSPENT</span><b>${result.unspentChoices}</b>
      <span>IMPRINT</span><b>${result.activeImprint === null ? '없음' : getImprintChoicePresentationKo(result.activeImprint).name}</b>
      ${victoryRows}
      <span>MUTATIONS</span><b>${mutations}</b>
    `;
    runPrimary.textContent = 'NEW HUNT';
    runMode.hidden = true;
    runSecondary.hidden = false;
  }

  capturedReadout.textContent = status.captured.toString().padStart(2, '0');
  capturePanel.dataset.state = status.state;
  loopLabel.textContent = labels[status.state];
  hint.textContent = status.hint;
  area.textContent = `AREA ${Math.round(status.loopArea).toString().padStart(4, '0')}`;
  signal.dataset.state = status.state;
  loopModeLabel.textContent = status.inputMode.toUpperCase();
  touchModeLabel.textContent = status.inputMode === 'hold' ? 'HLD' : 'TGL';
  loopControl.textContent =
    status.inputMode === 'hold'
      ? 'HOLD · TRACE · RELEASE'
      : 'PRESS · TRACE · PRESS';
  loopModeButton.setAttribute(
    'aria-label',
    status.inputMode === 'hold'
      ? 'Change loop input to toggle mode'
      : 'Change loop input to hold mode',
  );
  loopModeButton.setAttribute(
    'aria-pressed',
    String(status.inputMode === 'toggle'),
  );

  hpReadout.textContent = `${Math.ceil(status.hp)} / ${status.maxHp}`;
  hpPanel.dataset.state = status.state;
  hpFill.style.width = `${Math.max(0, Math.min(100, (status.hp / status.maxHp) * 100))}%`;
  levelReadout.textContent = `EVOLUTION ${status.level.toString().padStart(2, '0')}`;
  xpReadout.textContent = `XP ${Math.floor(status.xp).toString().padStart(2, '0')} / ${status.xpForNextLevel}`;
  if (status.wardenStage === null) {
    const elapsedSeconds = Math.min(540, Math.floor(status.runSeconds));
    const minutes = Math.floor(elapsedSeconds / 60);
    const seconds = elapsedSeconds % 60;
    runTimeReadout.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')} / 09:00`;
  } else {
    const wardenSeconds = Math.floor(status.wardenSeconds);
    const progress = `${Math.min(status.wardenProgress, status.wardenProgressRequired)} / ${status.wardenProgressRequired}`;
    runTimeReadout.textContent = `WARDEN ${wardenSeconds.toString().padStart(2, '0')}s · ${progress}`;
  }

  tutorialPrompt.hidden = status.tutorialComplete;
  tutorialPrompt.dataset.assist = String(status.tutorialAssist);
  tutorialStep.textContent = tutorialOrder[status.tutorialStep];
  tutorialCopy.textContent = `${tutorialCopyByStep[status.tutorialStep]}${
    status.tutorialAssist ? ' · Assisted snap is active—make a wider turn.' : ''
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

const game = new GameApp(updateHud);
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
  root.innerHTML = `<div class="fatal-error"><strong>INITIALIZATION FAILED</strong><p>${message}</p></div>`;
  throw error;
});
