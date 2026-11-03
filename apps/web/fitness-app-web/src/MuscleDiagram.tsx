import type { ReactNode } from 'react';
import type { MuscleGroup } from './exerciseLibrary';

type Region =
  | 'chest' | 'shoulders' | 'rearDelts' | 'biceps' | 'triceps' | 'forearms' | 'abs' | 'obliques'
  | 'quads' | 'traps' | 'lats' | 'lowerBack' | 'glutes' | 'hamstrings' | 'calves';

type MuscleActivation = { primary: Region[]; secondary: Region[] };

const regionLabels: Record<Region, string> = {
  chest: 'pecho',
  shoulders: 'hombros',
  rearDelts: 'hombro posterior',
  biceps: 'bíceps',
  triceps: 'tríceps',
  forearms: 'antebrazos',
  abs: 'abdominales',
  obliques: 'oblicuos',
  quads: 'cuádriceps',
  traps: 'trapecio',
  lats: 'dorsales',
  lowerBack: 'lumbar',
  glutes: 'glúteos',
  hamstrings: 'isquiotibiales',
  calves: 'gemelos',
};

const groupActivation: Record<MuscleGroup, MuscleActivation> = {
  Pecho: { primary: ['chest'], secondary: ['shoulders', 'triceps'] },
  Espalda: { primary: ['lats', 'traps'], secondary: ['rearDelts', 'biceps'] },
  Hombros: { primary: ['shoulders'], secondary: ['traps', 'triceps'] },
  Bíceps: { primary: ['biceps'], secondary: ['forearms'] },
  Tríceps: { primary: ['triceps'], secondary: ['shoulders'] },
  Antebrazos: { primary: ['forearms'], secondary: ['biceps'] },
  Cuádriceps: { primary: ['quads'], secondary: ['glutes'] },
  Isquiotibiales: { primary: ['hamstrings'], secondary: ['glutes', 'calves'] },
  Glúteos: { primary: ['glutes'], secondary: ['hamstrings', 'quads'] },
  Gemelos: { primary: ['calves'], secondary: [] },
  Core: { primary: ['abs', 'obliques'], secondary: ['lowerBack'] },
  Cardio: { primary: ['quads', 'hamstrings', 'calves', 'glutes'], secondary: ['abs', 'shoulders'] },
};

export function musclesFor(exercise: { name: string; group: MuscleGroup }): MuscleActivation {
  const name = exercise.name.toLowerCase();
  if (exercise.group === 'Hombros' && /face pull|p[áa]jaro|posterior|reverse|inverso/.test(name)) {
    return { primary: ['rearDelts'], secondary: ['traps', 'lats'] };
  }
  if (exercise.group === 'Espalda' && /lumbar|hiperextensi|peso muerto|good morning|buenos d[íi]as/.test(name)) {
    return { primary: ['lowerBack', 'lats'], secondary: ['glutes', 'hamstrings'] };
  }
  if (exercise.group === 'Espalda' && /encogimiento|shrug|trapecio/.test(name)) {
    return { primary: ['traps'], secondary: ['forearms'] };
  }
  return groupActivation[exercise.group];
}

export function muscleSummary(exercise: { name: string; group: MuscleGroup }) {
  const { primary, secondary } = musclesFor(exercise);
  const primaryText = primary.map((region) => regionLabels[region]).join(', ');
  const secondaryText = secondary.map((region) => regionLabels[region]).join(', ');
  return secondaryText ? `${primaryText} (apoyo: ${secondaryText})` : primaryText;
}

const frontCenter = 50;
const backCenter = 150;

function Shapes({ region, cx }: { region: Region; cx: number }): ReactNode {
  const x = (offset: number) => cx + offset;
  switch (region) {
    case 'chest':
      return <><ellipse cx={x(-9)} cy="48" rx="10" ry="8" /><ellipse cx={x(9)} cy="48" rx="10" ry="8" /></>;
    case 'shoulders':
      return <><circle cx={x(-21)} cy="36" r="7" /><circle cx={x(21)} cy="36" r="7" /></>;
    case 'biceps':
      return <><line x1={x(-26)} y1="44" x2={x(-30)} y2="66" strokeWidth="8" /><line x1={x(26)} y1="44" x2={x(30)} y2="66" strokeWidth="8" /></>;
    case 'abs':
      return <ellipse cx={x(0)} cy="75" rx="7" ry="16" />;
    case 'obliques':
      return <><line x1={x(-13)} y1="62" x2={x(-12)} y2="90" strokeWidth="5" /><line x1={x(13)} y1="62" x2={x(12)} y2="90" strokeWidth="5" /></>;
    case 'quads':
      return <><line x1={x(-8)} y1="114" x2={x(-10)} y2="148" strokeWidth="14" /><line x1={x(8)} y1="114" x2={x(10)} y2="148" strokeWidth="14" /></>;
    case 'rearDelts':
      return <><circle cx={x(-21)} cy="36" r="7" /><circle cx={x(21)} cy="36" r="7" /></>;
    case 'traps':
      return <ellipse cx={x(0)} cy="40" rx="14" ry="9" />;
    case 'lats':
      return <><ellipse cx={x(-11)} cy="62" rx="9" ry="15" /><ellipse cx={x(11)} cy="62" rx="9" ry="15" /></>;
    case 'lowerBack':
      return <ellipse cx={x(0)} cy="88" rx="10" ry="8" />;
    case 'triceps':
      return <><line x1={x(-26)} y1="44" x2={x(-30)} y2="66" strokeWidth="8" /><line x1={x(26)} y1="44" x2={x(30)} y2="66" strokeWidth="8" /></>;
    case 'glutes':
      return <><circle cx={x(-7)} cy="106" r="9" /><circle cx={x(7)} cy="106" r="9" /></>;
    case 'hamstrings':
      return <><line x1={x(-8)} y1="120" x2={x(-10)} y2="150" strokeWidth="13" /><line x1={x(8)} y1="120" x2={x(10)} y2="150" strokeWidth="13" /></>;
    case 'calves':
      return <><line x1={x(-11)} y1="158" x2={x(-12)} y2="190" strokeWidth="9" /><line x1={x(11)} y1="158" x2={x(12)} y2="190" strokeWidth="9" /></>;
    case 'forearms':
      return <><line x1={x(-31)} y1="72" x2={x(-34)} y2="94" strokeWidth="7" /><line x1={x(31)} y1="72" x2={x(34)} y2="94" strokeWidth="7" /></>;
  }
}

const frontRegions: Region[] = ['shoulders', 'chest', 'biceps', 'forearms', 'abs', 'obliques', 'quads', 'calves'];
const backRegions: Region[] = ['traps', 'rearDelts', 'lats', 'lowerBack', 'triceps', 'forearms', 'glutes', 'hamstrings', 'calves'];

function BodySilhouette({ cx }: { cx: number }) {
  return (
    <g className="muscle-body">
      <circle cx={cx} cy="14" r="9" />
      <rect x={cx - 4} y="21" width="8" height="9" rx="3" />
      <path d={`M${cx - 22} 32 Q${cx} 26 ${cx + 22} 32 L${cx + 17} 72 Q${cx + 15} 90 ${cx + 15} 104 L${cx - 15} 104 Q${cx - 15} 90 ${cx - 17} 72 Z`} />
      <line x1={cx - 26} y1="44" x2={cx - 30} y2="66" strokeWidth="10" />
      <line x1={cx + 26} y1="44" x2={cx + 30} y2="66" strokeWidth="10" />
      <line x1={cx - 31} y1="72" x2={cx - 34} y2="94" strokeWidth="8" />
      <line x1={cx + 31} y1="72" x2={cx + 34} y2="94" strokeWidth="8" />
      <line x1={cx - 8} y1="112" x2={cx - 10} y2="150" strokeWidth="16" />
      <line x1={cx + 8} y1="112" x2={cx + 10} y2="150" strokeWidth="16" />
      <line x1={cx - 11} y1="158" x2={cx - 12} y2="192" strokeWidth="11" />
      <line x1={cx + 11} y1="158" x2={cx + 12} y2="192" strokeWidth="11" />
    </g>
  );
}

export default function MuscleDiagram({ exercise, size = 'lg' }: { exercise: { name: string; group: MuscleGroup }; size?: 'sm' | 'lg' }) {
  const { primary, secondary } = musclesFor(exercise);
  const stateOf = (region: Region) => (primary.includes(region) ? 'primary' : secondary.includes(region) ? 'secondary' : 'idle');
  const renderView = (regions: Region[], cx: number) => (
    <>
      <BodySilhouette cx={cx} />
      {regions.map((region) => (
        <g key={`${cx}-${region}`} className={`muscle-region ${stateOf(region)}`}>
          <Shapes region={region} cx={cx} />
        </g>
      ))}
    </>
  );

  return (
    <svg
      className={`muscle-figure ${size}`}
      viewBox="0 0 200 204"
      role="img"
      aria-label={`${exercise.name}: ${muscleSummary(exercise)}`}
      focusable="false"
    >
      <title>{`Músculos: ${muscleSummary(exercise)}`}</title>
      {renderView(frontRegions, frontCenter)}
      {renderView(backRegions, backCenter)}
    </svg>
  );
}
