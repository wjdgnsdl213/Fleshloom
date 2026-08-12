import { describe, expect, it } from 'vitest';
import {
  describeMutationUpgradeKo,
  getImprintChoicePresentationKo,
  IMPRINT_CHOICES_KO,
} from '../../../src/content/choicePresentation';
import type { EnemyImprintKind } from '../../../src/content/enemies';
import {
  MUTATION_DEFINITIONS,
  MUTATION_IDS,
  type MutationId,
} from '../../../src/content/mutations';

const upgrade = (
  id: MutationId,
  currentRank: number,
  nextRank: number,
): string => describeMutationUpgradeKo({ id, currentRank, nextRank });

describe('Korean choice presentation', () => {
  it('gives every mutation a Korean name, summary, and numeric upgrade copy', () => {
    for (const id of MUTATION_IDS) {
      const definition = MUTATION_DEFINITIONS[id];
      const nextRank = Math.min(1, definition.maxRank);

      expect(definition.name).toMatch(/[가-힣]/);
      expect(definition.description).toMatch(/[가-힣]/);
      expect(upgrade(id, 0, nextRank)).toMatch(/[가-힣]/);
    }
  });

  it('describes base mutation values before and after the selected rank', () => {
    expect(upgrade('strider', 0, 1)).toBe('이동 속도 100% → 110%');
    expect(upgrade('marrow', 1, 2)).toBe(
      '최대 체력 120 → 140 · 현재 체력 +20',
    );
    expect(upgrade('carrion', 0, 1)).toBe(
      '포획 회복 보너스 +0 → +2 · 회복 상한 12 → 16',
    );
    expect(upgrade('synapse', 1, 2)).toBe(
      '닻 스냅 30px → 34px · 궤적 스냅 24px → 28px',
    );
    expect(upgrade('memory', 0, 1)).toBe(
      '임프린트 지속시간 25초 → 33초',
    );
  });

  it('includes lineage unlocks only on the rank that grants them', () => {
    expect(upgrade('blade-gland', 0, 1)).toBe('칼날 띠 56px → 74px');
    expect(upgrade('blade-gland', 1, 2)).toContain('안정도 추가 피해 +1');
    expect(upgrade('spike-crown', 1, 2)).toContain(
      'Elite 안정도 추가 피해 +1',
    );
    expect(upgrade('mirror-organ', 0, 1)).not.toContain('미리보기');
    expect(upgrade('mirror-organ', 1, 2)).toContain('미리보기 해금');
    expect(upgrade('fourfold-hunt', 0, 1)).toBe(
      '본체 고리를 포함해 네 방향 고리 투영 해금',
    );
  });

  it('covers every imprint with deeply frozen Korean copy', () => {
    const kinds: readonly EnemyImprintKind[] = [
      'blade',
      'nerve',
      'spike',
      'symmetry',
    ];

    expect(Object.keys(IMPRINT_CHOICES_KO).sort()).toEqual([...kinds].sort());
    expect(Object.isFrozen(IMPRINT_CHOICES_KO)).toBe(true);
    for (const kind of kinds) {
      const presentation = getImprintChoicePresentationKo(kind);
      expect(presentation.name).toMatch(/[가-힣]/);
      expect(presentation.description).toMatch(/[가-힣]/);
      expect(Object.isFrozen(presentation)).toBe(true);
    }
  });
});

