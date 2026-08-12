import { PLAYGROUND_TUNING } from '../config/graphics';
import { PROGRESSION_BASELINE } from '../config/progression';
import type { EnemyImprintKind } from './enemies';
import type { MutationId } from './mutations';

export interface ImprintChoicePresentation {
  readonly name: string;
  readonly description: string;
}

export interface MutationUpgradePresentationInput {
  readonly id: MutationId;
  readonly currentRank: number;
  readonly nextRank: number;
}

const freezeImprint = (
  presentation: ImprintChoicePresentation,
): ImprintChoicePresentation => Object.freeze({ ...presentation });

export const IMPRINT_CHOICES_KO: Readonly<
  Record<EnemyImprintKind, ImprintChoicePresentation>
> = Object.freeze({
  blade: freezeImprint({
    name: '칼날',
    description: '닫힌 고리 바깥에 칼날 띠를 만들어 외곽의 적도 포획합니다.',
  }),
  nerve: freezeImprint({
    name: '신경',
    description: '생체 닻 주변의 적을 둔화해 큰 고리를 안전하게 그립니다.',
  }),
  spike: freezeImprint({
    name: '가시',
    description: 'Rusher를 포획할 때 추가 체력을 회복합니다.',
  }),
  symmetry: freezeImprint({
    name: '대칭',
    description: '닻 반대편에 같은 고리를 하나 더 투영합니다.',
  }),
});

export const getImprintChoicePresentationKo = (
  kind: EnemyImprintKind,
): ImprintChoicePresentation => IMPRINT_CHOICES_KO[kind];

const percent = (value: number): string => `${Math.round(value)}%`;

export const describeMutationUpgradeKo = (
  candidate: MutationUpgradePresentationInput,
): string => {
  const { currentRank, nextRank } = candidate;

  switch (candidate.id) {
    case 'strider':
      return `이동 속도 ${percent(100 + currentRank * 10)} → ${percent(100 + nextRank * 10)}`;
    case 'marrow':
      return `최대 체력 ${PROGRESSION_BASELINE.maxHp + currentRank * 20} → ${PROGRESSION_BASELINE.maxHp + nextRank * 20} · 현재 체력 +20`;
    case 'carrion':
      return `포획 회복 보너스 +${currentRank * 2} → +${nextRank * 2} · 회복 상한 ${PROGRESSION_BASELINE.captureRecoveryCap + currentRank * 4} → ${PROGRESSION_BASELINE.captureRecoveryCap + nextRank * 4}`;
    case 'hunger':
      return `경험치 획득량 ${percent(100 + currentRank * 10)} → ${percent(100 + nextRank * 10)}`;
    case 'synapse':
      return `닻 스냅 ${PLAYGROUND_TUNING.anchorSnapRadius + currentRank * 4}px → ${PLAYGROUND_TUNING.anchorSnapRadius + nextRank * 4}px · 궤적 스냅 ${PLAYGROUND_TUNING.trailSnapRadius + currentRank * 4}px → ${PLAYGROUND_TUNING.trailSnapRadius + nextRank * 4}px`;
    case 'memory':
      return `임프린트 지속시간 ${PROGRESSION_BASELINE.imprintDurationSeconds + currentRank * 8}초 → ${PROGRESSION_BASELINE.imprintDurationSeconds + nextRank * 8}초`;
    case 'blade-gland': {
      const stability = nextRank >= 2 ? ' · 안정도 추가 피해 +1' : '';
      return `칼날 띠 ${PROGRESSION_BASELINE.bladeBandWidth + currentRank * 18}px → ${PROGRESSION_BASELINE.bladeBandWidth + nextRank * 18}px${stability}`;
    }
    case 'spike-crown': {
      const stability = nextRank >= 2 ? ' · Elite 안정도 추가 피해 +1' : '';
      return `Rusher 포획 회복 +${PROGRESSION_BASELINE.spikeRusherRecoveryBonus + currentRank * 2} → +${PROGRESSION_BASELINE.spikeRusherRecoveryBonus + nextRank * 2}${stability}`;
    }
    case 'nerve-lattice': {
      const currentSlow =
        (1 -
          Math.max(
            0.25,
            PROGRESSION_BASELINE.nerveEnemySpeedFactor - currentRank * 0.1,
          )) *
        100;
      const nextSlow =
        (1 -
          Math.max(
            0.25,
            PROGRESSION_BASELINE.nerveEnemySpeedFactor - nextRank * 0.1,
          )) *
        100;
      return `신경장 ${PROGRESSION_BASELINE.nerveFieldRadius + currentRank * 28}px → ${PROGRESSION_BASELINE.nerveFieldRadius + nextRank * 28}px · 둔화 ${percent(currentSlow)} → ${percent(nextSlow)}`;
    }
    case 'mirror-organ': {
      const preview = nextRank >= 2 ? ' · 대칭 고리 미리보기 해금' : '';
      return `대칭 고리 경험치 ${percent(100 + currentRank * 10)} → ${percent(100 + nextRank * 10)}${preview}`;
    }
    case 'fourfold-hunt':
      return '본체 고리를 포함해 네 방향 고리 투영 해금';
  }
};

