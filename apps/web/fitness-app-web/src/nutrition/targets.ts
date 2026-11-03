import { activityFactor, goalFromText, mifflinBmr, suggestTargets } from './calc';
import type { NutritionProfileInfo } from './ctx';
import type { NutritionGoal, Targets } from './types';

export function profileBmr(profile: NutritionProfileInfo): number | null {
  const { weightKg, heightCm, age } = profile;
  if (!weightKg || !heightCm || !age || weightKg < 20 || heightCm < 100 || age < 10) return null;
  return mifflinBmr({ sex: profile.sex, weightKg, heightCm, age });
}

/** Estimación de objetivos a partir del perfil. Devuelve null si faltan datos. */
export function suggestTargetsFromProfile(profile: NutritionProfileInfo, goal: NutritionGoal): Targets | null {
  const bmr = profileBmr(profile);
  if (bmr === null || !profile.weightKg) return null;
  const tdee = bmr * activityFactor(profile.activityLevel);
  // A menores de edad no se les propone déficit calórico.
  const safeGoal: NutritionGoal = profile.age !== null && profile.age < 18 && goal === 'lose' ? 'maintain' : goal;
  return suggestTargets({ goal: safeGoal, weightKg: profile.weightKg, tdee, bmr });
}

export const FALLBACK_TARGETS: Targets = { calories: 2200, protein: 130, carbohydrates: 250, fat: 70 };

export function resolveTargets(profile: NutritionProfileInfo, goal: NutritionGoal | null, saved: Targets | null, legacyProteinGoal: number) {
  const effectiveGoal = goal ?? goalFromText(profile.goalText);
  if (saved) return { goal: effectiveGoal, targets: saved, provisional: false };
  const estimated = suggestTargetsFromProfile(profile, effectiveGoal);
  if (estimated) return { goal: effectiveGoal, targets: estimated, provisional: true };
  return { goal: effectiveGoal, targets: { ...FALLBACK_TARGETS, protein: legacyProteinGoal || FALLBACK_TARGETS.protein }, provisional: true };
}
