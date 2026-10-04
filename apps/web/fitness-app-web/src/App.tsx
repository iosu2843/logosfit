import { useEffect, useState, type FormEvent } from 'react';
import { routines } from '@core';
import { createRestTimer, formatRestTime, pauseRestTimer, resetRestTimer, startRestTimer, tickRestTimer, type RestTimerState } from '@core';
import { theme } from '@ui/theme';
import { equipmentTypes, exerciseLibrary, muscleGroups, type ActivityKind, type EquipmentType, type LibraryExercise, type MuscleGroup } from './exerciseLibrary';
import { analyzeMealDescription, type MacroTotals, type MealAnalysis } from './nutritionAnalyzer';

const navItems = ['Usuarios', 'Home', 'Calendario', 'Ejercicios', 'Progreso', 'Nutrición'];
const navIcons: Record<string, string> = {
  Usuarios: 'nav-users',
  Home: 'nav-home',
  Calendario: 'nav-calendar',
  Ejercicios: 'nav-exercises',
  Progreso: 'nav-progress',
  Nutrición: 'nav-nutrition',
};

const asset = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;

type CalendarExercise = { name: string; group: MuscleGroup; image?: string; equipment?: EquipmentType; kind?: ActivityKind };
type TrainingDay = { name: string; type: string; exercises: CalendarExercise[] };
type ExerciseMetrics = { sets: number; reps: number; weight: number; level: number; duration: number };
type ProgressPoint = { id: string; date: string; value: number };
type ProfileProgressHistory = { bodyWeight: ProgressPoint[]; exerciseLoads: Record<string, ProgressPoint[]> };
type NutritionKind = 'protein' | 'water' | 'meal';
type NutritionEntry = { id: string; timestamp: string; kind: NutritionKind; amount: number; description?: string; macros?: MacroTotals; foods?: string[] };
type NutritionProfileData = {
  proteinGoalGrams: number;
  waterGoalMl: number;
  entriesByDay: Record<string, NutritionEntry[]>;
};
type FitnessProfile = {
  id: string;
  name: string;
  age: string;
  sex: string;
  weight: string;
  height: string;
  goalWeight: string;
  goal: string;
  activityLevel: string;
  experience: string;
  trainingDays: string;
  limitations: string;
};
type ProfileDraft = Omit<FitnessProfile, 'id'>;

function defaultNutritionData(profile: FitnessProfile | null): NutritionProfileData {
  const bodyWeight = Number(profile?.weight);
  return {
    proteinGoalGrams: Number.isFinite(bodyWeight) && bodyWeight > 0 ? Math.round(bodyWeight * 1.6) : 130,
    waterGoalMl: 2500,
    entriesByDay: {},
  };
}

const emptyProfile: ProfileDraft = {
  name: '',
  age: '',
  sex: '',
  weight: '',
  height: '',
  goalWeight: '',
  goal: '',
  activityLevel: '',
  experience: '',
  trainingDays: '',
  limitations: '',
};

const exerciseImage = (id: string) =>
  `https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/${id}/0.jpg`;

function readSavedProfiles(): FitnessProfile[] {
  try {
    const saved = JSON.parse(localStorage.getItem('fitness-profiles') ?? '[]');
    return Array.isArray(saved) ? saved.filter((profile) => profile?.id && profile?.name) : [];
  } catch {
    return [];
  }
}

function readActiveProfileId() {
  try {
    return localStorage.getItem('fitness-active-profile') ?? '';
  } catch {
    return '';
  }
}

function profileDraftFrom(profile: FitnessProfile): ProfileDraft {
  const { id, ...draft } = profile;
  return draft;
}

const trainingDays: Record<number, TrainingDay> = {
  1: {
    name: 'Lunes',
    type: 'Push',
    exercises: [
      { name: 'Press inclinado máquina', group: 'Pecho', equipment: 'Máquina', image: exerciseImage('Leverage_Incline_Chest_Press') },
      { name: 'Press inclinado mancuernas', group: 'Pecho', equipment: 'Mancuernas', image: exerciseImage('Incline_Dumbbell_Press') },
      { name: 'Aperturas máquina', group: 'Pecho', equipment: 'Máquina', image: exerciseImage('Butterfly') },
      { name: 'Press militar', group: 'Hombros', equipment: 'Barra', image: exerciseImage('Barbell_Shoulder_Press') },
      { name: 'Elevaciones laterales', group: 'Hombros', equipment: 'Mancuernas', image: exerciseImage('Side_Lateral_Raise') },
      { name: 'Fondos', group: 'Tríceps', equipment: 'Peso corporal', image: exerciseImage('Dips_-_Triceps_Version') },
      { name: 'Tríceps polea', group: 'Tríceps', equipment: 'Polea', image: exerciseImage('Triceps_Pushdown') },
    ],
  },
  2: {
    name: 'Martes',
    type: 'Pull',
    exercises: [
      { name: 'Jalón al pecho', group: 'Espalda', equipment: 'Polea', image: exerciseImage('Full_Range-Of-Motion_Lat_Pulldown') },
      { name: 'Remo máquina', group: 'Espalda', equipment: 'Máquina', image: exerciseImage('Leverage_Iso_Row') },
      { name: 'Remo barra', group: 'Espalda', equipment: 'Barra', image: exerciseImage('Bent_Over_Barbell_Row') },
      { name: 'Face pull', group: 'Hombros', equipment: 'Polea', image: exerciseImage('Face_Pull') },
      { name: 'Curl barra', group: 'Bíceps', equipment: 'Barra', image: exerciseImage('Barbell_Curl') },
      { name: 'Curl mancuernas', group: 'Bíceps', equipment: 'Mancuernas', image: exerciseImage('Dumbbell_Bicep_Curl') },
      { name: 'Curl inclinado', group: 'Bíceps', equipment: 'Mancuernas', image: exerciseImage('Incline_Dumbbell_Curl') },
    ],
  },
  4: {
    name: 'Jueves',
    type: 'Push',
    exercises: [
      { name: 'Press banca', group: 'Pecho', equipment: 'Barra', image: exerciseImage('Barbell_Bench_Press_-_Medium_Grip') },
      { name: 'Press plano mancuernas', group: 'Pecho', equipment: 'Mancuernas', image: exerciseImage('Dumbbell_Bench_Press') },
      { name: 'Cruces polea', group: 'Pecho', equipment: 'Polea', image: exerciseImage('Cable_Crossover') },
      { name: 'Press hombro máquina', group: 'Hombros', equipment: 'Máquina', image: exerciseImage('Leverage_Shoulder_Press') },
      { name: 'Elevaciones laterales polea', group: 'Hombros', equipment: 'Polea', image: exerciseImage('Cable_Seated_Lateral_Raise') },
      { name: 'Tríceps overhead', group: 'Tríceps', equipment: 'Polea', image: exerciseImage('Cable_Rope_Overhead_Triceps_Extension') },
      { name: 'Patada tríceps', group: 'Tríceps', equipment: 'Mancuernas', image: asset('exercises/triceps-kickback.svg') },
    ],
  },
  5: {
    name: 'Viernes',
    type: 'Piernas',
    exercises: [
      { name: 'Prensa', group: 'Cuádriceps', equipment: 'Máquina', image: exerciseImage('Leg_Press') },
      { name: 'Extensión cuádriceps', group: 'Cuádriceps', equipment: 'Máquina', image: exerciseImage('Leg_Extensions') },
      { name: 'Curl femoral tumbado', group: 'Isquiotibiales', equipment: 'Máquina', image: exerciseImage('Lying_Leg_Curls') },
      { name: 'Curl femoral sentado', group: 'Isquiotibiales', equipment: 'Máquina', image: exerciseImage('Seated_Leg_Curl') },
      { name: 'Hip thrust máquina', group: 'Glúteos', equipment: 'Máquina', image: exerciseImage('Barbell_Hip_Thrust') },
      { name: 'Gemelos prensa', group: 'Gemelos', equipment: 'Máquina', image: exerciseImage('Calf_Press_On_The_Leg_Press_Machine') },
      { name: 'Abducciones', group: 'Glúteos', equipment: 'Máquina', image: asset('exercises/hip-abduction.svg') },
    ],
  },
  6: {
    name: 'Sábado',
    type: 'Pull',
    exercises: [
      { name: 'Dominadas/jalón', group: 'Espalda', equipment: 'Peso corporal', image: exerciseImage('Pullups') },
      { name: 'Remo polea baja', group: 'Espalda', equipment: 'Polea', image: exerciseImage('Seated_Cable_Rows') },
      { name: 'Pullover máquina', group: 'Espalda', equipment: 'Máquina', image: exerciseImage('Straight-Arm_Pulldown') },
      { name: 'Pájaros', group: 'Hombros', equipment: 'Mancuernas', image: exerciseImage('Bent_Over_Dumbbell_Rear_Delt_Raise_With_Head_On_Bench') },
      { name: 'Curl polea', group: 'Bíceps', equipment: 'Polea', image: exerciseImage('Standing_Biceps_Cable_Curl') },
      { name: 'Curl martillo', group: 'Bíceps', equipment: 'Mancuernas', image: exerciseImage('Hammer_Curls') },
      { name: 'Curl concentrado', group: 'Bíceps', equipment: 'Mancuernas', image: exerciseImage('Concentration_Curls') },
    ],
  },
};

const weekDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const editorDays = [
  { index: 1, name: 'Lunes' },
  { index: 2, name: 'Martes' },
  { index: 3, name: 'Miércoles' },
  { index: 4, name: 'Jueves' },
  { index: 5, name: 'Viernes' },
  { index: 6, name: 'Sábado' },
  { index: 0, name: 'Domingo' },
];
const weekdayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function startOfWeek(date: Date) {
  const monday = new Date(date);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return monday;
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function readSavedMetricsByProfile(): Record<string, Record<string, ExerciseMetrics>> {
  try {
    const saved = JSON.parse(localStorage.getItem('fitness-calendar-metrics-by-profile') ?? '{}');
    if (Object.keys(saved).length > 0) return saved;

    const legacyMetrics = JSON.parse(localStorage.getItem('fitness-calendar-metrics') ?? '{}');
    const legacyOwner = readActiveProfileId() || readSavedProfiles()[0]?.id || '__guest__';
    return Object.keys(legacyMetrics).length > 0 ? { [legacyOwner]: legacyMetrics } : {};
  } catch {
    return {};
  }
}

function readSavedProgressByProfile(): Record<string, Record<string, boolean>> {
  try {
    return JSON.parse(localStorage.getItem('fitness-completed-exercises-by-profile') ?? '{}');
  } catch {
    return {};
  }
}

function readProgressHistoryByProfile(): Record<string, ProfileProgressHistory> {
  try {
    return JSON.parse(localStorage.getItem('fitness-progress-history-by-profile') ?? '{}');
  } catch {
    return {};
  }
}

function readNutritionByProfile(): Record<string, NutritionProfileData> {
  try {
    return JSON.parse(localStorage.getItem('fitness-nutrition-by-profile') ?? '{}');
  } catch {
    return {};
  }
}

function readSavedTrainingPlansByProfile(): Record<string, Record<number, TrainingDay>> {
  try {
    return JSON.parse(localStorage.getItem('fitness-training-plans-by-profile') ?? '{}');
  } catch {
    return {};
  }
}

function exerciseKey(exercise: CalendarExercise) {
  return exercise.name;
}

function exerciseLoadKey(dayIndex: number, exerciseName: string) {
  return `${dayIndex}:${exerciseName}`;
}

function getMetrics(metrics: Record<string, ExerciseMetrics>, exercise: CalendarExercise) {
  const saved = metrics[exerciseKey(exercise)];
  return {
    sets: saved?.sets ?? 3,
    reps: saved?.reps ?? 10,
    weight: saved?.weight ?? 0,
    level: saved?.level ?? 5,
    duration: saved?.duration ?? 20,
  };
}

function formatMonth(date: Date) {
  return new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(date);
}

function formatDateRange(start: Date, end: Date) {
  const sameMonth = start.getMonth() === end.getMonth();
  const startText = new Intl.DateTimeFormat('es-ES', { day: 'numeric', ...(sameMonth ? {} : { month: 'short' }) }).format(start);
  const endText = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }).format(end);
  return `${startText} - ${endText}`;
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatProgressDate(date: string) {
  return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
    .format(new Date(`${date}T12:00:00`));
}

function upsertProgressPoint(points: ProgressPoint[], point: ProgressPoint) {
  const existingIndex = points.findIndex((item) => item.date === point.date);
  if (existingIndex < 0) return [...points, point].sort((first, second) => first.date.localeCompare(second.date));

  const nextPoints = [...points];
  nextPoints[existingIndex] = point;
  return nextPoints.sort((first, second) => first.date.localeCompare(second.date));
}

function ProgressLineChart({ points, unit, label }: { points: ProgressPoint[]; unit: string; label: string }) {
  if (points.length === 0) {
    return <div className="progress-empty-state">Aún no hay registros para mostrar.</div>;
  }

  const width = 640;
  const height = 220;
  const padding = 34;
  const values = points.map((point) => point.value);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const valueRange = Math.max(maximum - minimum, 1);
  const coordinates = points.map((point, index) => {
    const x = points.length === 1
      ? width / 2
      : padding + (index / (points.length - 1)) * (width - padding * 2);
    const y = height - padding - ((point.value - minimum) / valueRange) * (height - padding * 2);
    return { x, y, point };
  });
  const polylinePoints = coordinates.map(({ x, y }) => `${x},${y}`).join(' ');

  return (
    <div className="progress-chart-wrap">
      <div className="progress-chart-range"><span>{minimum} {unit}</span><span>{maximum} {unit}</span></div>
      <svg className="progress-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
        {[0, 1, 2].map((line) => {
          const y = padding + (line / 2) * (height - padding * 2);
          return <line key={line} x1={padding} x2={width - padding} y1={y} y2={y} className="progress-chart-gridline" />;
        })}
        {points.length > 1 && <polyline points={polylinePoints} className="progress-chart-line" />}
        {coordinates.map(({ x, y, point }) => <circle key={point.id} cx={x} cy={y} r="5" className="progress-chart-point" />)}
      </svg>
      <div className="progress-chart-dates"><span>{formatProgressDate(points[0].date)}</span><span>{formatProgressDate(points[points.length - 1].date)}</span></div>
    </div>
  );
}

export default function App() {
  const [activeNav, setActiveNav] = useState('Home');
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [screen, setScreen] = useState<'overview' | 'detail' | 'session'>('overview');
  const [selectedExercise, setSelectedExercise] = useState<{ name: string; sets: number; reps: number }>(() => ({
    name: routines.push[0].name,
    sets: routines.push[0].sets,
    reps: routines.push[0].reps,
  }));
  const [calendarView, setCalendarView] = useState<'week' | 'month'>('week');
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [sessionSetsCompleted, setSessionSetsCompleted] = useState<Record<string, number>>({});
  const [restTimer, setRestTimer] = useState<RestTimerState>(() => createRestTimer(60));
  const [restSecondsDraft, setRestSecondsDraft] = useState('60');
  const [exerciseMetricsByProfile, setExerciseMetricsByProfile] = useState(readSavedMetricsByProfile);
  const [trainingPlansByProfile, setTrainingPlansByProfile] = useState(readSavedTrainingPlansByProfile);
  const [progressHistoryByProfile, setProgressHistoryByProfile] = useState(readProgressHistoryByProfile);
  const [nutritionByProfile, setNutritionByProfile] = useState(readNutritionByProfile);
  const [editorDayIndex, setEditorDayIndex] = useState(1);
  const [muscleFilter, setMuscleFilter] = useState<MuscleGroup | 'Todos'>('Todos');
  const [equipmentFilter, setEquipmentFilter] = useState<EquipmentType | 'Todos'>('Todos');
  const [librarySearch, setLibrarySearch] = useState('');
  const [progressBodyWeightDraft, setProgressBodyWeightDraft] = useState('');
  const [progressDraftProfileId, setProgressDraftProfileId] = useState('');
  const [progressExerciseName, setProgressExerciseName] = useState('');
  const [progressDayIndex, setProgressDayIndex] = useState(() => new Date().getDay());
  const [proteinDraft, setProteinDraft] = useState('');
  const [waterDraft, setWaterDraft] = useState('');
  const [mealDescription, setMealDescription] = useState('');
  const [mealAnalysis, setMealAnalysis] = useState<MealAnalysis | null>(null);
  const [mealAnalysisError, setMealAnalysisError] = useState('');
  const [profiles, setProfiles] = useState(readSavedProfiles);
  const [activeProfileId, setActiveProfileId] = useState(readActiveProfileId);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(() => {
    const storedId = readActiveProfileId();
    return profiles.some((profile) => profile.id === storedId) ? storedId : null;
  });
  const [profileDraft, setProfileDraft] = useState<ProfileDraft>(() => {
    const activeProfile = profiles.find((profile) => profile.id === readActiveProfileId());
    return activeProfile ? profileDraftFrom(activeProfile) : emptyProfile;
  });
  const [completedByProfile, setCompletedByProfile] = useState(readSavedProgressByProfile);
  const activeProfile = profiles.find((profile) => profile.id === activeProfileId) ?? profiles[0] ?? null;
  const profileScopeId = activeProfile?.id ?? '__guest__';
  const exerciseMetrics = exerciseMetricsByProfile[profileScopeId] ?? {};
  const activeTrainingPlan = trainingPlansByProfile[profileScopeId] ?? trainingDays;
  const nextWorkout = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(new Date(), index + 1);
    return { date, day: activeTrainingPlan[date.getDay()] };
  }).find(({ day }) => day?.exercises.length);
  const progressHistory = progressHistoryByProfile[profileScopeId] ?? { bodyWeight: [], exerciseLoads: {} };
  const nutritionData = nutritionByProfile[profileScopeId] ?? defaultNutritionData(activeProfile);
  const nutritionEntriesToday = nutritionData.entriesByDay[localDateKey()] ?? [];
  const mealEntriesToday = nutritionEntriesToday.filter((entry) => entry.kind === 'meal' && entry.macros);
  const proteinToday = nutritionEntriesToday.filter((entry) => entry.kind === 'protein').reduce((total, entry) => total + entry.amount, 0)
    + mealEntriesToday.reduce((total, entry) => total + (entry.macros?.protein ?? 0), 0);
  const waterToday = nutritionEntriesToday.filter((entry) => entry.kind === 'water').reduce((total, entry) => total + entry.amount, 0);
  const caloriesToday = mealEntriesToday.reduce((total, entry) => total + (entry.macros?.calories ?? 0), 0);
  const carbohydratesToday = mealEntriesToday.reduce((total, entry) => total + (entry.macros?.carbohydrates ?? 0), 0);
  const fatToday = mealEntriesToday.reduce((total, entry) => total + (entry.macros?.fat ?? 0), 0);
  const progressDay = activeTrainingPlan[progressDayIndex];
  const editorDay = activeTrainingPlan[editorDayIndex];
  const progressExerciseOptions = progressDay?.exercises
    .filter((exercise) => exercise.kind !== 'cardio')
    .map((exercise) => exercise.name) ?? [];
  const selectedProgressExerciseName = progressExerciseOptions.includes(progressExerciseName)
    ? progressExerciseName
    : progressExerciseOptions[0] ?? '';
  const selectedProgressExercise = progressDay?.exercises.find((exercise) => exercise.name === selectedProgressExerciseName);
  const selectedProgressMetrics = selectedProgressExercise ? getMetrics(exerciseMetrics, selectedProgressExercise) : null;
  const sortedBodyWeightHistory = [...progressHistory.bodyWeight].sort((first, second) => first.date.localeCompare(second.date));
  const loggedExerciseNames = progressExerciseOptions.filter((exerciseName) =>
    (progressHistory.exerciseLoads[exerciseLoadKey(progressDayIndex, exerciseName)] ?? progressHistory.exerciseLoads[exerciseName] ?? []).length > 0,
  );
  const bodyWeightFieldValue = progressDraftProfileId === profileScopeId
    ? progressBodyWeightDraft
    : activeProfile?.weight ?? '';
  const completed = completedByProfile[profileScopeId] ?? (profileScopeId === '__guest__' ? { 'Bench Press': true } : {});

  useEffect(() => {
    if (!restTimer.isRunning) return;
    const intervalId = window.setInterval(() => {
      setRestTimer((current) => tickRestTimer(current));
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, [restTimer.isRunning]);

  const startWorkout = () => {
    setSessionSetsCompleted({});
    setRestTimer(createRestTimer(60));
    setRestSecondsDraft('60');
    setScreen('session');
  };

  const markWorkoutSetComplete = (exercise: CalendarExercise) => {
    const plannedSets = exercise.kind === 'cardio' ? 1 : getMetrics(exerciseMetrics, exercise).sets;
    const nextCount = Math.min(plannedSets, (sessionSetsCompleted[exercise.name] ?? 0) + 1);
    setSessionSetsCompleted((current) => ({ ...current, [exercise.name]: nextCount }));

    if (nextCount >= plannedSets) {
      setCompletedByProfile((current) => {
        const next = { ...current, [profileScopeId]: { ...completed, [exercise.name]: true } };
        localStorage.setItem('fitness-completed-exercises-by-profile', JSON.stringify(next));
        return next;
      });
    }
  };

  const beginRestPeriod = () => {
    const requestedSeconds = Math.min(600, Math.max(1, Number(restSecondsDraft) || 60));
    setRestSecondsDraft(String(requestedSeconds));
    setRestTimer(startRestTimer(createRestTimer(requestedSeconds)));
  };

  const finishWorkout = () => {
    setRestTimer((current) => pauseRestTimer(current));
    setScreen('overview');
  };

  const openDetail = (exercise: CalendarExercise) => {
    const metrics = getMetrics(exerciseMetrics, exercise);
    setSelectedExercise({ name: exercise.name, sets: metrics.sets, reps: metrics.reps });
    setScreen('detail');
  };

  const toggleExercise = () => {
    setCompletedByProfile((current) => {
      const next = {
        ...current,
        [profileScopeId]: {
          ...completed,
          [selectedExercise.name]: !completed[selectedExercise.name],
        },
      };
      localStorage.setItem('fitness-completed-exercises-by-profile', JSON.stringify(next));
      return next;
    });
  };

  const updateNutritionData = (update: (current: NutritionProfileData) => NutritionProfileData) => {
    setNutritionByProfile((current) => {
      const updatedProfileData = update(current[profileScopeId] ?? defaultNutritionData(activeProfile));
      const next = { ...current, [profileScopeId]: updatedProfileData };
      localStorage.setItem('fitness-nutrition-by-profile', JSON.stringify(next));
      return next;
    });
  };

  const updateNutritionGoal = (goal: 'proteinGoalGrams' | 'waterGoalMl', value: number) => {
    if (!Number.isFinite(value) || value < 1) return;
    updateNutritionData((current) => ({ ...current, [goal]: value }));
  };

  const recordNutritionIntake = (kind: NutritionKind, amountDraft: string) => {
    const amount = Number(amountDraft);
    if (!Number.isFinite(amount) || amount <= 0) return;
    const date = localDateKey();
    const entry: NutritionEntry = {
      id: `nutrition-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      kind,
      amount,
    };

    updateNutritionData((current) => ({
      ...current,
      entriesByDay: {
        ...current.entriesByDay,
        [date]: [...(current.entriesByDay[date] ?? []), entry],
      },
    }));
    if (kind === 'protein') setProteinDraft('');
    else setWaterDraft('');
  };

  const analyzeMealDraft = () => {
    const analysis = analyzeMealDescription(mealDescription);
    setMealAnalysis(analysis);
    setMealAnalysisError(analysis ? '' : 'No reconocí alimentos. Añade un alimento conocido y, si puedes, su cantidad en gramos.');
  };

  const saveAnalyzedMeal = () => {
    if (!mealAnalysis || !mealDescription.trim()) return;
    const date = localDateKey();
    const entry: NutritionEntry = {
      id: `meal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      kind: 'meal',
      amount: 0,
      description: mealDescription.trim(),
      macros: mealAnalysis.macros,
      foods: mealAnalysis.foods,
    };
    updateNutritionData((current) => ({
      ...current,
      entriesByDay: {
        ...current.entriesByDay,
        [date]: [...(current.entriesByDay[date] ?? []), entry],
      },
    }));
    setMealDescription('');
    setMealAnalysis(null);
    setMealAnalysisError('');
  };

  const recordBodyWeight = () => {
    const value = Number(bodyWeightFieldValue);
    if (!Number.isFinite(value) || value <= 0) return;
    const point: ProgressPoint = { id: `body-${Date.now()}`, date: localDateKey(), value };

    setProgressHistoryByProfile((current) => {
      const profileHistory = current[profileScopeId] ?? { bodyWeight: [], exerciseLoads: {} };
      const next = {
        ...current,
        [profileScopeId]: {
          ...profileHistory,
          bodyWeight: upsertProgressPoint(profileHistory.bodyWeight, point),
        },
      };
      localStorage.setItem('fitness-progress-history-by-profile', JSON.stringify(next));
      return next;
    });
    setProgressBodyWeightDraft(String(value));
    setProgressDraftProfileId(profileScopeId);

    if (activeProfile) {
      const nextProfiles = profiles.map((profile) => profile.id === activeProfile.id ? { ...profile, weight: String(value) } : profile);
      setProfiles(nextProfiles);
      localStorage.setItem('fitness-profiles', JSON.stringify(nextProfiles));
    }
  };

  const recordExerciseLoad = () => {
    if (!selectedProgressExercise || !selectedProgressMetrics) return;
    const key = exerciseLoadKey(progressDayIndex, selectedProgressExercise.name);
    const point: ProgressPoint = {
      id: `load-${Date.now()}`,
      date: localDateKey(),
      value: selectedProgressMetrics.weight,
    };

    setProgressHistoryByProfile((current) => {
      const profileHistory = current[profileScopeId] ?? { bodyWeight: [], exerciseLoads: {} };
      const currentExercisePoints = profileHistory.exerciseLoads[key] ?? [];
      const next = {
        ...current,
        [profileScopeId]: {
          ...profileHistory,
          exerciseLoads: {
            ...profileHistory.exerciseLoads,
            [key]: upsertProgressPoint(currentExercisePoints, point),
          },
        },
      };
      localStorage.setItem('fitness-progress-history-by-profile', JSON.stringify(next));
      return next;
    });
  };

  const updateProfileField = (field: keyof ProfileDraft, value: string) => {
    setProfileDraft((current) => ({ ...current, [field]: value }));
  };

  const selectProfile = (profileId: string) => {
    const profile = profiles.find((item) => item.id === profileId);
    if (!profile) return;

    setActiveProfileId(profile.id);
    setEditingProfileId(profile.id);
    setProfileDraft(profileDraftFrom(profile));
    setProgressDraftProfileId('');
    setProgressExerciseName('');
    setProteinDraft('');
    setWaterDraft('');
    localStorage.setItem('fitness-active-profile', profile.id);
  };

  const startNewProfile = () => {
    setEditingProfileId(null);
    setProfileDraft({ ...emptyProfile });
  };

  const saveProfile = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const profile: FitnessProfile = {
      ...profileDraft,
      id: editingProfileId ?? `profile-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    };
    const nextProfiles = editingProfileId
      ? profiles.map((item) => (item.id === editingProfileId ? profile : item))
      : [...profiles, profile];

    setProfiles(nextProfiles);
    setActiveProfileId(profile.id);
    setEditingProfileId(profile.id);
    setProfileDraft(profileDraftFrom(profile));
    setProgressDraftProfileId('');
    localStorage.setItem('fitness-profiles', JSON.stringify(nextProfiles));
    localStorage.setItem('fitness-active-profile', profile.id);
  };

  const deleteProfile = () => {
    if (!editingProfileId) return;
    const nextProfiles = profiles.filter((profile) => profile.id !== editingProfileId);
    const nextActiveProfile = nextProfiles[0] ?? null;

    setProfiles(nextProfiles);
    setActiveProfileId(nextActiveProfile?.id ?? '');
    setEditingProfileId(nextActiveProfile?.id ?? null);
    setProfileDraft(nextActiveProfile ? profileDraftFrom(nextActiveProfile) : { ...emptyProfile });
    setProgressDraftProfileId('');
    setProgressExerciseName('');
    localStorage.setItem('fitness-profiles', JSON.stringify(nextProfiles));
    if (nextActiveProfile) {
      localStorage.setItem('fitness-active-profile', nextActiveProfile.id);
    } else {
      localStorage.removeItem('fitness-active-profile');
    }
  };

  const currentTitle = activeNav === 'Progreso' ? 'Progreso' : activeNav === 'Nutrición' ? 'Nutrición' : 'Home';
  const weekStart = startOfWeek(calendarDate);
  const visibleWeek = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const monthStart = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1);
  const monthGridStart = startOfWeek(monthStart);
  const visibleMonth = Array.from({ length: 42 }, (_, index) => addDays(monthGridStart, index));
  const selectedDay = activeTrainingPlan[selectedDate.getDay()];
  const dailyExercises = selectedDay?.exercises ?? [];
  const completedDailyExercises = dailyExercises.filter((exercise) => Boolean(completed[exercise.name])).length;
  const plannedDailySets = dailyExercises
    .filter((exercise) => exercise.kind !== 'cardio')
    .reduce((total, exercise) => total + getMetrics(exerciseMetrics, exercise).sets, 0);
  const dailySummaryStats = [
    { label: 'Sesión', value: selectedDay?.type ?? 'Descanso' },
    { label: 'Ejercicios', value: String(dailyExercises.length) },
    { label: 'Series previstas', value: String(plannedDailySets) },
    { label: 'Completados', value: selectedDay ? `${completedDailyExercises}/${dailyExercises.length}` : '—' },
  ];

  const groupedLibrary = muscleGroups
    .filter((group) => muscleFilter === 'Todos' || group === muscleFilter)
    .map((group) => ({
      group,
      exercises: exerciseLibrary.filter((exercise) => {
        const searchMatch = exercise.name.toLocaleLowerCase('es').includes(librarySearch.trim().toLocaleLowerCase('es'));
        const equipmentMatch = equipmentFilter === 'Todos' || exercise.equipment === equipmentFilter;
        return exercise.group === group && searchMatch && equipmentMatch;
      }),
    }))
    .filter(({ exercises }) => exercises.length > 0);

  const saveTrainingDay = (dayIndex: number, exercises: CalendarExercise[]) => {
    const nextPlan = { ...activeTrainingPlan };
    if (exercises.length === 0) {
      delete nextPlan[dayIndex];
    } else {
      const previousDay = nextPlan[dayIndex];
      nextPlan[dayIndex] = {
        name: previousDay?.name ?? weekdayNames[dayIndex],
        type: previousDay?.type ?? 'Personalizado',
        exercises,
      };
    }
    const nextByProfile = { ...trainingPlansByProfile, [profileScopeId]: nextPlan };
    setTrainingPlansByProfile(nextByProfile);
    localStorage.setItem('fitness-training-plans-by-profile', JSON.stringify(nextByProfile));
  };

  const addLibraryExercise = (exercise: LibraryExercise) => {
    const currentExercises = editorDay?.exercises ?? [];
    if (currentExercises.some((item) => item.name === exercise.name)) return;
    saveTrainingDay(editorDayIndex, [...currentExercises, exercise]);
  };

  const removePlanExercise = (exerciseName: string) => {
    saveTrainingDay(editorDayIndex, (editorDay?.exercises ?? []).filter((item) => item.name !== exerciseName));
  };

  const changeExerciseMetric = (exercise: CalendarExercise, field: keyof ExerciseMetrics, value: number) => {
    const key = exerciseKey(exercise);
    setExerciseMetricsByProfile((current) => {
      const next = {
        ...current,
        [profileScopeId]: {
          ...exerciseMetrics,
          [key]: { ...getMetrics(exerciseMetrics, exercise), [field]: value },
        },
      };
      localStorage.setItem('fitness-calendar-metrics-by-profile', JSON.stringify(next));
      return next;
    });
  };

  const changeCalendarDate = (amount: number) => {
    const nextDate = calendarView === 'week'
      ? addDays(calendarDate, amount * 7)
      : new Date(calendarDate.getFullYear(), calendarDate.getMonth() + amount, 1);
    setCalendarDate(nextDate);
    setSelectedDate(nextDate);
    setProgressDayIndex(nextDate.getDay());
    setProgressExerciseName('');
  };

  const openCalendarDate = (date: Date) => {
    setSelectedDate(date);
    setCalendarDate(date);
    setProgressDayIndex(date.getDay());
    setProgressExerciseName('');
  };

  const renderCalendarExercise = (exercise: CalendarExercise) => {
    const metrics = getMetrics(exerciseMetrics, exercise);
    return (
      <article className="calendar-exercise" key={exercise.name}>
        {exercise.image ? (
          <img className="exercise-image" src={exercise.image} alt={exercise.name} loading="lazy" />
        ) : (
          <div className="exercise-image-placeholder" aria-hidden="true">{exercise.group.slice(0, 2).toUpperCase()}</div>
        )}
        <div className="calendar-exercise-info">
          <span className="exercise-group">{exercise.group}</span>
          <h3>{exercise.name}</h3>
          <div className="exercise-inputs">
            {exercise.kind === 'cardio' ? (
              <>
                <label>
                  Nivel <span>1-10</span>
                  <input aria-label={`Nivel de cardio para ${exercise.name}`} type="number" min="1" max="10" value={metrics.level} onChange={(event) => changeExerciseMetric(exercise, 'level', Math.min(10, Math.max(1, Number(event.target.value))))} />
                </label>
                <label>
                  Tiempo <span>min</span>
                  <input aria-label={`Tiempo de cardio para ${exercise.name}`} type="number" min="1" max="300" value={metrics.duration} onChange={(event) => changeExerciseMetric(exercise, 'duration', Math.max(1, Number(event.target.value)))} />
                </label>
              </>
            ) : (
              <>
                <label>
                  Series
                  <input aria-label={`Series para ${exercise.name}`} type="number" min="1" max="20" value={metrics.sets} onChange={(event) => changeExerciseMetric(exercise, 'sets', Math.max(1, Number(event.target.value)))} />
                </label>
                <label>
                  Reps
                  <input aria-label={`Repeticiones para ${exercise.name}`} type="number" min="1" max="100" value={metrics.reps} onChange={(event) => changeExerciseMetric(exercise, 'reps', Math.max(1, Number(event.target.value)))} />
                </label>
                <label>
                  Peso <span>kg</span>
                  <input aria-label={`Peso en kilogramos para ${exercise.name}`} type="number" min="0" max="999" step="0.5" value={metrics.weight} onChange={(event) => changeExerciseMetric(exercise, 'weight', Math.max(0, Number(event.target.value)))} />
                </label>
              </>
            )}
          </div>
          {exercise.kind !== 'cardio' && (
            <button className="exercise-detail-link" type="button" onClick={() => openDetail(exercise)}>Ver detalle</button>
          )}
        </div>
      </article>
    );
  };

  return (
    <div className={`app-shell ${sidebarExpanded ? '' : 'sidebar-collapsed'}`} style={{ background: theme.bg, color: theme.text }}>
      <aside className="sidebar-card" style={{ background: theme.card }}>
        <div className="brand-row">
          <img
            alt="Emblema de LOGOSFIT"
            className="brand-logo"
            src={asset('Captura%20de%20pantalla%202026-10-04%20180411.png')}
          />
          <div className="brand-copy">
            <h2>LOGOSFIT</h2>
            <small>Disciplina · Progreso · Equilibrio</small>
          </div>
          <button
            aria-label={sidebarExpanded ? 'Contraer menú lateral' : 'Expandir menú lateral'}
            aria-expanded={sidebarExpanded}
            aria-controls="main-sidebar-menu"
            className="sidebar-toggle"
            title={sidebarExpanded ? 'Contraer menú' : 'Expandir menú'}
            onClick={() => setSidebarExpanded((expanded) => !expanded)}
            type="button"
          >
            <span aria-hidden="true">{sidebarExpanded ? '‹' : '☰'}</span>
          </button>
        </div>

        <div className="profile-switcher" style={{ background: '#121212' }}>
          <p className="eyebrow muted">Perfil activo</p>
          {activeProfile ? (
            <select
              aria-label="Seleccionar usuario activo"
              className="profile-select"
              value={activeProfile.id}
              onChange={(event) => selectProfile(event.target.value)}
            >
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>{profile.name}</option>
              ))}
            </select>
          ) : (
            <p className="profile-empty-label">Sin perfil</p>
          )}
          <button className="profile-manage-button" type="button" onClick={() => setActiveNav('Usuarios')}>
            {activeProfile ? 'Gestionar usuarios' : 'Crear usuario'}
          </button>
        </div>

        <nav className="nav-list" id="main-sidebar-menu" aria-label="Main navigation">
          {navItems.map((item) => (
            <button
              key={item}
              className={`nav-item ${activeNav === item ? 'active' : ''}`}
              aria-label={item}
              title={item}
              onClick={() => {
                setActiveNav(item);
                setScreen('overview');
                if (window.matchMedia('(max-width: 900px)').matches) {
                  setSidebarExpanded(false);
                }
              }}
              type="button"
            >
              <svg className="nav-item-icon" aria-hidden="true" width="20" height="20">
                <use href={`${asset('nav-icons.svg')}#${navIcons[item]}`} />
              </svg>
              <span className="nav-item-label">{item}</span>
            </button>
          ))}
        </nav>

        <div className="mini-card" style={{ background: '#121212' }}>
          <p className="eyebrow muted">Próximo entrenamiento</p>
          {nextWorkout ? (
            <>
              <h3>{nextWorkout.day.name}</h3>
              <small className="next-workout-date">
                {new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'short' }).format(nextWorkout.date)} · {nextWorkout.day.type}
              </small>
              <p className="next-workout-preview">
                {nextWorkout.day.exercises.slice(0, 3).map((exercise) => exercise.name).join(' · ')}
                {nextWorkout.day.exercises.length > 3 ? ` +${nextWorkout.day.exercises.length - 3}` : ''}
              </p>
              <button className="next-workout-link" type="button" onClick={() => { openCalendarDate(nextWorkout.date); setActiveNav('Calendario'); }}>
                Ver plan
              </button>
            </>
          ) : (
            <>
              <h3>Sin sesiones</h3>
              <small>No hay entrenamientos programados para los próximos 7 días.</small>
            </>
          )}
        </div>
      </aside>

      <main className="main-panel">
        {screen === 'session' ? (
          <section className="session-screen">
            <header className="session-header">
              <div>
                <p className="eyebrow">Sesión en curso · {activeProfile?.name ?? 'Perfil local'}</p>
                <h1>{selectedDay ? `${selectedDay.name} · ${selectedDay.type}` : 'Entrenamiento'}</h1>
                <p>{new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).format(selectedDate)}</p>
              </div>
              <div className="session-header-actions">
                <button className="ghost-btn" type="button" onClick={() => setScreen('overview')}>Volver</button>
                <button className="primary-btn" type="button" onClick={finishWorkout}>Terminar sesión</button>
              </div>
            </header>

            {selectedDay?.exercises.length ? (
              <div className="session-layout">
                <section className="session-exercise-list">
                  {selectedDay.exercises.map((exercise) => {
                    const metrics = getMetrics(exerciseMetrics, exercise);
                    const completedSets = sessionSetsCompleted[exercise.name] ?? 0;
                    const targetSets = exercise.kind === 'cardio' ? 1 : metrics.sets;
                    const isComplete = completedSets >= targetSets;
                    return (
                      <article className={`session-exercise ${isComplete ? 'complete' : ''}`} key={exercise.name}>
                        <div className="session-exercise-heading">
                          {exercise.image ? <img className="session-exercise-image" src={exercise.image} alt={exercise.name} /> : <div className="session-exercise-image-placeholder">{exercise.group.slice(0, 2).toUpperCase()}</div>}
                          <div className="session-exercise-title">
                            <span className="exercise-group">{exercise.group}</span>
                            <h2>{exercise.name}</h2>
                            <small>{exercise.equipment ?? 'Peso corporal'} · {isComplete ? 'Completado' : `${completedSets}/${targetSets} series`}</small>
                          </div>
                          <span className={`status-pill ${isComplete ? 'done' : ''}`}>{isComplete ? 'Hecho' : 'Pendiente'}</span>
                        </div>

                        {exercise.kind === 'cardio' ? (
                          <div className="session-cardio-metrics">
                            <label>Nivel 1-10<input aria-label={`Nivel de ${exercise.name}`} type="number" min="1" max="10" value={metrics.level} onChange={(event) => changeExerciseMetric(exercise, 'level', Math.min(10, Math.max(1, Number(event.target.value))))} /></label>
                            <label>Tiempo min<input aria-label={`Tiempo de ${exercise.name}`} type="number" min="1" max="300" value={metrics.duration} onChange={(event) => changeExerciseMetric(exercise, 'duration', Math.max(1, Number(event.target.value)))} /></label>
                          </div>
                        ) : (
                          <div className="session-strength-metrics">
                            <span>{metrics.sets} series · {metrics.reps} reps planificadas</span>
                            <label>
                              Peso utilizado
                              <span className="session-weight-input"><input aria-label={`Peso utilizado en ${exercise.name}`} type="number" min="0" max="999" step="0.5" value={metrics.weight} onChange={(event) => changeExerciseMetric(exercise, 'weight', Math.max(0, Number(event.target.value)))} /><small>kg</small></span>
                            </label>
                          </div>
                        )}

                        <div className="session-exercise-actions">
                          <button className="session-set-button" type="button" disabled={isComplete} onClick={() => markWorkoutSetComplete(exercise)}>
                            {isComplete ? 'Ejercicio completado' : exercise.kind === 'cardio' ? 'Marcar actividad completada' : `Completar serie ${completedSets + 1} de ${targetSets}`}
                          </button>
                          {exercise.kind !== 'cardio' && <button className="rest-start-button" type="button" onClick={beginRestPeriod}>Iniciar descanso</button>}
                        </div>
                      </article>
                    );
                  })}
                </section>

                <aside className="rest-timer-panel" style={{ background: theme.card }}>
                  <p className="eyebrow muted">Descanso entre series</p>
                  <div className={`rest-timer-display ${restTimer.isRunning ? 'running' : ''}`} aria-live="polite">{formatRestTime(restTimer.secondsLeft)}</div>
                  <label className="rest-duration-field">
                    Duración del descanso
                    <span><input aria-label="Duración del descanso en segundos" type="number" min="1" max="600" step="15" value={restSecondsDraft} onChange={(event) => setRestSecondsDraft(event.target.value)} /><small>seg</small></span>
                  </label>
                  <div className="rest-timer-actions">
                    <button className="primary-btn" type="button" onClick={beginRestPeriod}>Iniciar</button>
                    <button className="ghost-btn" type="button" onClick={() => setRestTimer((current) => pauseRestTimer(current))}>Pausar</button>
                    <button className="ghost-btn" type="button" onClick={() => setRestTimer((current) => resetRestTimer(current))}>Reiniciar</button>
                  </div>
                </aside>
              </div>
            ) : (
              <div className="calendar-rest-state"><span className="rest-symbol">↗</span><p>No hay una rutina programada para este día.</p></div>
            )}
          </section>
        ) : activeNav === 'Progreso' ? (
          <section className="progress-screen">
            <header className="topbar">
              <div>
                <p className="eyebrow">Seguimiento personal</p>
                <h1>Progreso</h1>
              </div>
              <span className="progress-profile-name">{activeProfile?.name ?? 'Perfil local'}</span>
            </header>

            <section className="progress-panel-card" style={{ background: theme.card }}>
              <div className="section-header progress-section-header">
                <div>
                  <p className="eyebrow muted">Tendencia corporal</p>
                  <h2>Peso corporal</h2>
                </div>
                <span>{sortedBodyWeightHistory.length} registros</span>
              </div>
              <form className="progress-entry-form" onSubmit={(event) => { event.preventDefault(); recordBodyWeight(); }}>
                <label>
                  Peso actual
                  <span className="progress-input-unit">
                    <input aria-label="Peso corporal a registrar" type="number" min="1" max="500" step="0.1" value={bodyWeightFieldValue} onChange={(event) => { setProgressBodyWeightDraft(event.target.value); setProgressDraftProfileId(profileScopeId); }} />
                    <small>kg</small>
                  </span>
                </label>
                <button className="primary-btn" type="submit">Registrar peso</button>
              </form>
              <ProgressLineChart points={sortedBodyWeightHistory} unit="kg" label="Progresión del peso corporal" />
              <div className="progress-table-wrap">
                <table className="progress-history-table">
                  <thead><tr><th>Fecha</th><th>Peso corporal</th></tr></thead>
                  <tbody>
                    {sortedBodyWeightHistory.length ? sortedBodyWeightHistory.slice(-10).reverse().map((point) => (
                      <tr key={point.id}><td>{formatProgressDate(point.date)}</td><td>{point.value.toFixed(1)} kg</td></tr>
                    )) : <tr><td colSpan={2}>Registra el primer peso para empezar la gráfica.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="progress-panel-card" style={{ background: theme.card }}>
              <div className="section-header progress-section-header">
                <div>
                  <p className="eyebrow muted">Fuerza</p>
                  <h2>Cargas por ejercicio</h2>
                </div>
                <span>{loggedExerciseNames.length} ejercicios con registros</span>
              </div>
              <div className="progress-entry-form exercise-progress-entry">
                  <label>
                    Día del plan
                    <select aria-label="Día para consultar progreso" value={progressDayIndex} onChange={(event) => { setProgressDayIndex(Number(event.target.value)); setProgressExerciseName(''); }}>
                      {editorDays.map((day) => <option key={day.index} value={day.index}>{day.name}</option>)}
                    </select>
                  </label>
                <label>
                  Ejercicio
                  <select aria-label="Ejercicio para registrar carga" value={selectedProgressExerciseName} onChange={(event) => setProgressExerciseName(event.target.value)} disabled={progressExerciseOptions.length === 0}>
                      {progressExerciseOptions.length === 0 ? <option value="">No hay ejercicios de fuerza este día</option> : progressExerciseOptions.map((name) => <option key={name} value={name}>{name}</option>)}
                  </select>
                </label>
                {selectedProgressExercise && selectedProgressMetrics && (
                  <label>
                    Carga utilizada
                    <span className="progress-input-unit">
                      <input aria-label={`Carga actual de ${selectedProgressExercise.name}`} type="number" min="0" max="999" step="0.5" value={selectedProgressMetrics.weight} onChange={(event) => changeExerciseMetric(selectedProgressExercise, 'weight', Math.max(0, Number(event.target.value)))} />
                      <small>kg</small>
                    </span>
                  </label>
                )}
                <button className="primary-btn" type="button" disabled={!selectedProgressExercise} onClick={recordExerciseLoad}>Registrar carga</button>
              </div>

              {loggedExerciseNames.length ? (
                <div className="exercise-progress-list">
                  {loggedExerciseNames.map((exerciseName) => {
                    const points = [...(progressHistory.exerciseLoads[exerciseLoadKey(progressDayIndex, exerciseName)] ?? progressHistory.exerciseLoads[exerciseName] ?? [])]
                      .sort((first, second) => first.date.localeCompare(second.date));
                    return (
                      <article className="exercise-progress-card" key={exerciseName}>
                        <div className="exercise-progress-title">
                          <h3>{exerciseName} · {progressDay?.name ?? weekdayNames[progressDayIndex]}</h3>
                          <span>{points.length} registros</span>
                        </div>
                        <ProgressLineChart points={points} unit="kg" label={`Progresión de carga para ${exerciseName}`} />
                        <div className="progress-table-wrap">
                          <table className="progress-history-table">
                            <thead><tr><th>Fecha</th><th>Carga utilizada</th></tr></thead>
                            <tbody>{points.slice(-10).reverse().map((point) => (
                              <tr key={point.id}><td>{formatProgressDate(point.date)}</td><td>{point.value.toFixed(1)} kg</td></tr>
                            ))}</tbody>
                          </table>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="progress-empty-state">Aún no hay cargas registradas. Selecciona un ejercicio y guarda la carga usada para iniciar su historial.</div>
              )}
            </section>
          </section>
        ) : activeNav === 'Nutrición' ? (
          <section className="nutrition-screen">
            <header className="topbar">
              <div>
                <p className="eyebrow">Registro diario · {activeProfile?.name ?? 'Perfil local'}</p>
                <h1>Nutrición</h1>
              </div>
              <span className="nutrition-date">{new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}</span>
            </header>

            <section className="nutrition-goals">
              <article className="nutrition-goal-card" style={{ background: theme.card }}>
                <div className="nutrition-goal-heading">
                  <div>
                    <p className="eyebrow muted">Proteína</p>
                    <h2>{proteinToday} <small>g</small><span> / {nutritionData.proteinGoalGrams} g</span></h2>
                  </div>
                  <span className="nutrition-symbol protein-symbol">P</span>
                </div>
                <div className="nutrition-progress-track" role="progressbar" aria-label="Objetivo diario de proteína" aria-valuemin={0} aria-valuemax={nutritionData.proteinGoalGrams} aria-valuenow={Math.min(proteinToday, nutritionData.proteinGoalGrams)}>
                  <span className="protein-progress-fill" style={{ width: `${Math.min(100, (proteinToday / nutritionData.proteinGoalGrams) * 100)}%` }} />
                </div>
                <label className="nutrition-target-field">
                  Objetivo diario
                  <span><input aria-label="Objetivo diario de proteína en gramos" type="number" min="1" max="1000" value={nutritionData.proteinGoalGrams} onChange={(event) => updateNutritionGoal('proteinGoalGrams', Number(event.target.value))} /> g</span>
                </label>
                <form className="nutrition-intake-form" onSubmit={(event) => { event.preventDefault(); recordNutritionIntake('protein', proteinDraft); }}>
                  <label>
                    Añadir proteína
                    <span><input aria-label="Gramos de proteína ingeridos" type="number" min="1" max="1000" placeholder="Cantidad" value={proteinDraft} onChange={(event) => setProteinDraft(event.target.value)} /><small>g</small></span>
                  </label>
                  <button className="primary-btn" type="submit" disabled={!proteinDraft || Number(proteinDraft) <= 0}>Registrar</button>
                </form>
              </article>

              <article className="nutrition-goal-card" style={{ background: theme.card }}>
                <div className="nutrition-goal-heading">
                  <div>
                    <p className="eyebrow muted">Agua</p>
                    <h2>{(waterToday / 1000).toFixed(1)} <small>L</small><span> / {(nutritionData.waterGoalMl / 1000).toFixed(1)} L</span></h2>
                  </div>
                  <span className="nutrition-symbol water-symbol">H₂O</span>
                </div>
                <div className="nutrition-progress-track" role="progressbar" aria-label="Objetivo diario de agua" aria-valuemin={0} aria-valuemax={nutritionData.waterGoalMl} aria-valuenow={Math.min(waterToday, nutritionData.waterGoalMl)}>
                  <span className="water-progress-fill" style={{ width: `${Math.min(100, (waterToday / nutritionData.waterGoalMl) * 100)}%` }} />
                </div>
                <label className="nutrition-target-field">
                  Objetivo diario
                  <span><input aria-label="Objetivo diario de agua en mililitros" type="number" min="250" max="10000" step="250" value={nutritionData.waterGoalMl} onChange={(event) => updateNutritionGoal('waterGoalMl', Number(event.target.value))} /> ml</span>
                </label>
                <form className="nutrition-intake-form" onSubmit={(event) => { event.preventDefault(); recordNutritionIntake('water', waterDraft); }}>
                  <label>
                    Añadir agua
                    <span><input aria-label="Mililitros de agua bebidos" type="number" min="1" max="5000" step="50" placeholder="Cantidad" value={waterDraft} onChange={(event) => setWaterDraft(event.target.value)} /><small>ml</small></span>
                  </label>
                  <button className="primary-btn" type="submit" disabled={!waterDraft || Number(waterDraft) <= 0}>Registrar</button>
                </form>
              </article>
            </section>

            <section className="nutrition-macro-summary" aria-label="Macronutrientes estimados de hoy">
              <article><span>Kcal aproximadas</span><strong>{caloriesToday} <small>kcal</small></strong></article>
              <article><span>Carbohidratos</span><strong>{carbohydratesToday.toFixed(1)} <small>g</small></strong></article>
              <article><span>Grasas</span><strong>{fatToday.toFixed(1)} <small>g</small></strong></article>
            </section>

            <section className="nutrition-meal-panel" style={{ background: theme.card }}>
              <div className="section-header">
                <div>
                  <p className="eyebrow muted">Estimación local</p>
                  <h2>Analizar comida</h2>
                </div>
              </div>
              <form className="nutrition-meal-form" onSubmit={(event) => { event.preventDefault(); analyzeMealDraft(); }}>
                <label>
                  ¿Qué has comido?
                  <textarea aria-label="Descripción de la comida" rows={3} maxLength={500} placeholder="Ej.: 150 g de pollo, 200 g de arroz cocido y 1 huevo" value={mealDescription} onChange={(event) => { setMealDescription(event.target.value); setMealAnalysis(null); setMealAnalysisError(''); }} />
                </label>
                <button className="primary-btn" type="submit" disabled={!mealDescription.trim()}>Analizar comida</button>
              </form>
              <p className="nutrition-estimate-note">Estimación orientativa según alimentos reconocidos y cantidades. Revisa etiquetas para mayor precisión.</p>
              {mealAnalysisError && <p className="nutrition-analysis-error" role="alert">{mealAnalysisError}</p>}
              {mealAnalysis && (
                <div className="nutrition-analysis-result">
                  <div className="nutrition-analysis-foods">Alimentos reconocidos: {mealAnalysis.foods.join(', ')}</div>
                  <div className="macro-analysis-grid">
                    <div><span>Calorías</span><strong>{mealAnalysis.macros.calories} kcal</strong></div>
                    <div><span>Proteína</span><strong>{mealAnalysis.macros.protein} g</strong></div>
                    <div><span>Carbohidratos</span><strong>{mealAnalysis.macros.carbohydrates} g</strong></div>
                    <div><span>Grasas</span><strong>{mealAnalysis.macros.fat} g</strong></div>
                  </div>
                  <button className="primary-btn" type="button" onClick={saveAnalyzedMeal}>Guardar comida</button>
                </div>
              )}
            </section>

            <section className="nutrition-log-panel" style={{ background: theme.card }}>
              <div className="section-header">
                <div>
                  <p className="eyebrow muted">{new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long' }).format(new Date())}</p>
                  <h2>Registro de hoy</h2>
                </div>
                <span>{nutritionEntriesToday.length} entradas</span>
              </div>
              {nutritionEntriesToday.length ? (
                <div className="nutrition-entry-list">
                  {[...nutritionEntriesToday].reverse().map((entry) => (
                    <article className="nutrition-entry" key={entry.id}>
                      <span className={`nutrition-entry-mark ${entry.kind === 'protein' ? 'protein-mark' : entry.kind === 'water' ? 'water-mark' : 'meal-mark'}`} />
                      <div className="nutrition-entry-info">
                        <strong>{entry.kind === 'meal' ? entry.description : entry.kind === 'protein' ? 'Proteína' : 'Agua'}</strong>
                        <small>
                          {new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' }).format(new Date(entry.timestamp))}
                          {entry.kind === 'meal' && entry.macros ? ` · ${entry.macros.calories} kcal · P ${entry.macros.protein} g · C ${entry.macros.carbohydrates} g · G ${entry.macros.fat} g` : ''}
                        </small>
                      </div>
                      <strong className="nutrition-entry-amount">
                        {entry.kind === 'meal' ? `${entry.macros?.calories ?? 0} kcal` : `+${entry.amount} ${entry.kind === 'protein' ? 'g' : 'ml'}`}
                      </strong>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="nutrition-empty-state">Todavía no hay consumos registrados para hoy.</p>
              )}
            </section>
          </section>
        ) : activeNav === 'Usuarios' ? (
          <section className="users-screen">
            <header className="topbar">
              <div>
                <p className="eyebrow">Perfiles personales</p>
                <h1>Usuarios</h1>
              </div>
              <button className="primary-btn" type="button" onClick={startNewProfile}>Nuevo perfil</button>
            </header>

            <div className="user-layout">
              <section className="user-list-panel" style={{ background: theme.card }}>
                <div className="section-header">
                  <h2>Perfiles</h2>
                  <span>{profiles.length}</span>
                </div>
                {profiles.length > 0 ? (
                  <div className="profile-list">
                    {profiles.map((profile) => (
                      <button
                        aria-pressed={activeProfile?.id === profile.id}
                        className={`profile-option ${activeProfile?.id === profile.id ? 'active' : ''}`}
                        key={profile.id}
                        onClick={() => selectProfile(profile.id)}
                        type="button"
                      >
                        <span className="profile-avatar">{profile.name.trim().charAt(0).toUpperCase()}</span>
                        <span className="profile-option-details">
                          <strong>{profile.name}</strong>
                          <small>{[profile.age && `${profile.age} años`, profile.weight && `${profile.weight} kg`].filter(Boolean).join(' · ') || 'Datos por completar'}</small>
                        </span>
                        <span className="profile-option-state">{activeProfile?.id === profile.id ? 'Activo' : 'Elegir'}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="profile-empty-state">Aún no hay perfiles.</p>
                )}
              </section>

              <form className="profile-editor" onSubmit={saveProfile} style={{ background: theme.card }}>
                <div className="section-header profile-editor-header">
                  <div>
                    <p className="eyebrow muted">{editingProfileId ? 'Usuario seleccionado' : 'Nuevo usuario'}</p>
                    <h2>{editingProfileId ? profileDraft.name || 'Editar perfil' : 'Crear perfil'}</h2>
                  </div>
                  {editingProfileId && <span className="profile-status">Activo</span>}
                </div>

                <section className="profile-form-section">
                  <h3>Datos personales</h3>
                  <div className="profile-fields">
                    <label className="profile-field profile-field-wide">
                      <span>Nombre</span>
                      <input autoComplete="name" maxLength={60} required value={profileDraft.name} onChange={(event) => updateProfileField('name', event.target.value)} />
                    </label>
                    <label className="profile-field">
                      <span>Edad</span>
                      <div className="profile-input-unit"><input min="13" max="110" type="number" value={profileDraft.age} onChange={(event) => updateProfileField('age', event.target.value)} /><small>años</small></div>
                    </label>
                    <label className="profile-field">
                      <span>Sexo</span>
                      <select value={profileDraft.sex} onChange={(event) => updateProfileField('sex', event.target.value)}>
                        <option value="">Seleccionar</option>
                        <option>Mujer</option>
                        <option>Hombre</option>
                        <option>No binario</option>
                        <option>Prefiero no decirlo</option>
                      </select>
                    </label>
                    <label className="profile-field">
                      <span>Peso actual</span>
                      <div className="profile-input-unit"><input min="0" max="500" step="0.1" type="number" value={profileDraft.weight} onChange={(event) => updateProfileField('weight', event.target.value)} /><small>kg</small></div>
                    </label>
                    <label className="profile-field">
                      <span>Altura</span>
                      <div className="profile-input-unit"><input min="0" max="250" step="0.1" type="number" value={profileDraft.height} onChange={(event) => updateProfileField('height', event.target.value)} /><small>cm</small></div>
                    </label>
                  </div>
                </section>

                <section className="profile-form-section">
                  <h3>Objetivo y entrenamiento</h3>
                  <div className="profile-fields">
                    <label className="profile-field">
                      <span>Objetivo</span>
                      <select value={profileDraft.goal} onChange={(event) => updateProfileField('goal', event.target.value)}>
                        <option value="">Seleccionar</option>
                        <option>Pérdida de grasa</option>
                        <option>Ganancia muscular</option>
                        <option>Fuerza</option>
                        <option>Resistencia</option>
                        <option>Mantenimiento</option>
                        <option>Salud general</option>
                      </select>
                    </label>
                    <label className="profile-field">
                      <span>Peso objetivo</span>
                      <div className="profile-input-unit"><input min="0" max="500" step="0.1" type="number" value={profileDraft.goalWeight} onChange={(event) => updateProfileField('goalWeight', event.target.value)} /><small>kg</small></div>
                    </label>
                    <label className="profile-field">
                      <span>Nivel de actividad</span>
                      <select value={profileDraft.activityLevel} onChange={(event) => updateProfileField('activityLevel', event.target.value)}>
                        <option value="">Seleccionar</option>
                        <option>Sedentario</option>
                        <option>Ligero · 1-2 días/semana</option>
                        <option>Moderado · 3-4 días/semana</option>
                        <option>Alto · 5-6 días/semana</option>
                        <option>Muy alto · actividad diaria</option>
                      </select>
                    </label>
                    <label className="profile-field">
                      <span>Experiencia</span>
                      <select value={profileDraft.experience} onChange={(event) => updateProfileField('experience', event.target.value)}>
                        <option value="">Seleccionar</option>
                        <option>Principiante</option>
                        <option>Intermedio</option>
                        <option>Avanzado</option>
                      </select>
                    </label>
                    <label className="profile-field">
                      <span>Entrenamientos por semana</span>
                      <div className="profile-input-unit"><input min="1" max="7" type="number" value={profileDraft.trainingDays} onChange={(event) => updateProfileField('trainingDays', event.target.value)} /><small>días</small></div>
                    </label>
                    <label className="profile-field profile-field-wide">
                      <span>Lesiones o limitaciones</span>
                      <textarea maxLength={500} rows={3} value={profileDraft.limitations} onChange={(event) => updateProfileField('limitations', event.target.value)} />
                    </label>
                  </div>
                </section>

                <div className="profile-actions">
                  {editingProfileId && <button className="danger-btn" onClick={deleteProfile} type="button">Eliminar perfil</button>}
                  <button className="primary-btn" type="submit">Guardar perfil</button>
                </div>
              </form>
            </div>
          </section>
        ) : activeNav === 'Ejercicios' ? (
          <section className="exercise-editor-screen">
            <header className="topbar">
              <div>
                <p className="eyebrow">Plan por perfil</p>
                <h1>Editor de ejercicios</h1>
              </div>
              <button className="ghost-btn" type="button" onClick={() => setActiveNav('Calendario')}>Ver calendario</button>
            </header>

            <div className="exercise-editor-toolbar" style={{ background: theme.card }}>
              <label className="editor-day-field">
                <span>Día del plan</span>
                <select aria-label="Día del plan a editar" value={editorDayIndex} onChange={(event) => setEditorDayIndex(Number(event.target.value))}>
                  {editorDays.map((day) => <option key={day.index} value={day.index}>{day.name}</option>)}
                </select>
              </label>
              <p>Los cambios se guardan para {activeProfile?.name ?? 'este dispositivo'} y se reflejan en el calendario.</p>
            </div>

            <div className="exercise-editor-grid">
              <section className="editor-plan-panel" style={{ background: theme.card }}>
                <div className="section-header">
                  <div>
                    <p className="eyebrow muted">{editorDay?.type ?? 'Día libre'}</p>
                    <h2>{editorDays.find((day) => day.index === editorDayIndex)?.name}</h2>
                  </div>
                  <span>{editorDay?.exercises.length ?? 0} ejercicios</span>
                </div>
                {editorDay?.exercises.length ? (
                  <div className="editor-plan-list">
                    {editorDay.exercises.map((exercise) => {
                      const metrics = getMetrics(exerciseMetrics, exercise);
                      return (
                        <article className="editor-plan-exercise" key={exercise.name}>
                          <div className="editor-plan-exercise-title">
                            <div>
                              <span className="exercise-group">{exercise.group}</span>
                              <strong>{exercise.name}</strong>
                              <small>{exercise.equipment ?? 'Equipo por definir'}</small>
                            </div>
                            <button className="editor-remove-button" type="button" aria-label={`Quitar ${exercise.name} del plan`} onClick={() => removePlanExercise(exercise.name)}>×</button>
                          </div>
                          {exercise.kind === 'cardio' ? (
                            <div className="editor-plan-metrics cardio-plan-metrics">
                              <label>Nivel 1-10<input aria-label={`Nivel de cardio de ${exercise.name}`} type="number" min="1" max="10" value={metrics.level} onChange={(event) => changeExerciseMetric(exercise, 'level', Math.min(10, Math.max(1, Number(event.target.value))))} /></label>
                              <label>Tiempo min<input aria-label={`Tiempo de cardio de ${exercise.name}`} type="number" min="1" max="300" value={metrics.duration} onChange={(event) => changeExerciseMetric(exercise, 'duration', Math.max(1, Number(event.target.value)))} /></label>
                            </div>
                          ) : (
                            <div className="editor-plan-metrics">
                              <label>Series<input aria-label={`Series de ${exercise.name}`} type="number" min="1" max="20" value={metrics.sets} onChange={(event) => changeExerciseMetric(exercise, 'sets', Math.max(1, Number(event.target.value)))} /></label>
                              <label>Reps<input aria-label={`Repeticiones de ${exercise.name}`} type="number" min="1" max="100" value={metrics.reps} onChange={(event) => changeExerciseMetric(exercise, 'reps', Math.max(1, Number(event.target.value)))} /></label>
                              <label>Peso kg<input aria-label={`Peso de ${exercise.name}`} type="number" min="0" max="999" step="0.5" value={metrics.weight} onChange={(event) => changeExerciseMetric(exercise, 'weight', Math.max(0, Number(event.target.value)))} /></label>
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <p className="editor-empty-state">Este día está libre. Añade ejercicios desde el repertorio.</p>
                )}
              </section>

              <section className="exercise-library-panel" style={{ background: theme.card }}>
                <div className="section-header">
                  <div>
                    <p className="eyebrow muted">{exerciseLibrary.length} ejercicios</p>
                    <h2>Repertorio</h2>
                  </div>
                </div>
                <div className="library-filters">
                  <input aria-label="Buscar ejercicio" type="search" placeholder="Buscar ejercicio" value={librarySearch} onChange={(event) => setLibrarySearch(event.target.value)} />
                  <select aria-label="Filtrar por grupo o actividad" value={muscleFilter} onChange={(event) => setMuscleFilter(event.target.value as MuscleGroup | 'Todos')}>
                    <option value="Todos">Todos los grupos</option>
                    {muscleGroups.map((group) => <option key={group} value={group}>{group}</option>)}
                  </select>
                  <select aria-label="Filtrar por equipo" value={equipmentFilter} onChange={(event) => setEquipmentFilter(event.target.value as EquipmentType | 'Todos')}>
                    <option value="Todos">Todo el equipo</option>
                    {equipmentTypes.map((equipment) => <option key={equipment} value={equipment}>{equipment}</option>)}
                  </select>
                </div>
                <div className="library-groups">
                  {groupedLibrary.length ? groupedLibrary.map(({ group, exercises }) => (
                    <section className="library-muscle-block" key={group}>
                      <div className="library-muscle-heading"><h3>{group}</h3><span>{exercises.length}</span></div>
                      {exercises.map((exercise) => {
                        const alreadyAdded = Boolean(editorDay?.exercises.some((item) => item.name === exercise.name));
                        return (
                          <article className="library-exercise-row" key={exercise.name}>
                            <div>
                              <strong>{exercise.name}</strong>
                              <small>{exercise.equipment}</small>
                            </div>
                            <button className="editor-add-button" type="button" disabled={alreadyAdded} onClick={() => addLibraryExercise(exercise)}>
                              {alreadyAdded ? 'Añadido' : 'Añadir'}
                            </button>
                          </article>
                        );
                      })}
                    </section>
                  )) : <p className="editor-empty-state">No hay ejercicios que coincidan con esos filtros.</p>}
                </div>
              </section>
            </div>
          </section>
        ) : activeNav === 'Calendario' ? (
          <section className="calendar-screen">
            <header className="topbar calendar-topbar">
              <div>
                <p className="eyebrow">Tu planificación</p>
                <h1>Calendario</h1>
              </div>
              <div className="calendar-view-switch" role="group" aria-label="Vista del calendario">
                <button className={calendarView === 'week' ? 'selected' : ''} type="button" onClick={() => setCalendarView('week')}>Semana</button>
                <button className={calendarView === 'month' ? 'selected' : ''} type="button" onClick={() => setCalendarView('month')}>Mes</button>
              </div>
            </header>

            <div className="calendar-toolbar">
              <button className="calendar-arrow" type="button" aria-label="Periodo anterior" onClick={() => changeCalendarDate(-1)}>‹</button>
              <h2>{calendarView === 'week' ? formatDateRange(weekStart, addDays(weekStart, 6)) : formatMonth(calendarDate)}</h2>
              <button className="calendar-arrow" type="button" aria-label="Periodo siguiente" onClick={() => changeCalendarDate(1)}>›</button>
              <button className="today-button" type="button" onClick={() => openCalendarDate(new Date())}>Hoy</button>
            </div>

            {calendarView === 'week' ? (
              <div className="week-grid">
                {visibleWeek.map((date, index) => {
                  const day = activeTrainingPlan[date.getDay()];
                  const selected = dateKey(date) === dateKey(selectedDate);
                  return (
                    <button key={dateKey(date)} className={`week-day ${selected ? 'selected' : ''} ${day ? 'has-workout' : ''}`} type="button" onClick={() => openCalendarDate(date)}>
                      <span className="week-day-name">{weekDays[index]}</span>
                      <strong>{date.getDate()}</strong>
                      {day ? <><span className="day-type">{day.type}</span><span className="day-exercise-preview">{day.exercises.slice(0, 3).map((exercise) => exercise.name).join(' · ')}{day.exercises.length > 3 ? ` +${day.exercises.length - 3}` : ''}</span></> : <span className="rest-label">Descanso</span>}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="month-calendar">
                {weekDays.map((day) => <div className="month-weekday" key={day}>{day}</div>)}
                {visibleMonth.map((date) => {
                  const day = activeTrainingPlan[date.getDay()];
                  const selected = dateKey(date) === dateKey(selectedDate);
                  const inMonth = date.getMonth() === calendarDate.getMonth();
                  return (
                    <button key={dateKey(date)} className={`month-day ${selected ? 'selected' : ''} ${!inMonth ? 'outside-month' : ''} ${day ? 'has-workout' : ''}`} type="button" onClick={() => openCalendarDate(date)}>
                      <span className="month-day-number">{date.getDate()}</span>
                      {day && <span className="month-workout-label">{day.type}</span>}
                      {day?.exercises.length ? (
                        <span className="month-exercise-preview">
                          {day.exercises.slice(0, 2).map((exercise) => exercise.name).join(' · ')}
                          {day.exercises.length > 2 ? ` +${day.exercises.length - 2}` : ''}
                        </span>
                      ) : null}
                      {!day && inMonth && <span className="month-rest-label">Descanso</span>}
                    </button>
                  );
                })}
              </div>
            )}

            <section className="selected-day-section">
              <div className="section-header">
                <div>
                  <p className="eyebrow muted">{new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).format(selectedDate)}</p>
                  <h2>{selectedDay ? `${selectedDay.name} · ${selectedDay.type}` : 'Día de descanso'}</h2>
                </div>
                <span>{selectedDay ? `${selectedDay.exercises.length} ejercicios` : 'Recuperación'}</span>
              </div>
              {selectedDay ? (
                <div className="calendar-exercise-list">{selectedDay.exercises.map(renderCalendarExercise)}</div>
              ) : (
                <div className="calendar-rest-state"><span className="rest-symbol">↗</span><p>Un día para recuperar y volver con energía.</p></div>
              )}
            </section>
          </section>
        ) : screen === 'overview' ? (
          <>
            <header className="topbar">
              <div>
                <p className="eyebrow">{activeProfile?.goal || 'Resumen personal'}</p>
                <h1>{currentTitle}</h1>
              </div>
              <button className="primary-btn" type="button" disabled={!selectedDay?.exercises.length} onClick={startWorkout}>
                Empezar entrenamiento
              </button>
            </header>

            <section className="stats-grid daily-summary-grid" aria-label="Resumen del día">
              {dailySummaryStats.map((stat) => (
                <div key={stat.label} className="stat-card daily-summary-card" style={{ background: theme.card }}>
                  <span>{stat.label}</span>
                  <strong>{stat.value}</strong>
                </div>
              ))}
            </section>

            <section className="content-grid">
              <div className="card daily-plan-card" style={{ background: theme.card }}>
                <div className="section-header">
                  <div>
                    <p className="eyebrow muted">
                      {new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).format(selectedDate)}
                    </p>
                    <h3>Plan diario</h3>
                  </div>
                  <div className="daily-plan-heading-actions">
                    <button className="daily-plan-link" type="button" onClick={() => setActiveNav('Calendario')}>
                      Ver calendario
                    </button>
                  </div>
                </div>

                {selectedDay ? (
                  <div className="daily-plan-list">
                    {selectedDay.exercises.map((exercise) => {
                      const metrics = getMetrics(exerciseMetrics, exercise);
                      return (
                        <article className="daily-plan-exercise" key={exercise.name}>
                          {exercise.image ? (
                            <img className="daily-plan-image" src={exercise.image} alt={exercise.name} loading="lazy" />
                          ) : (
                            <div className="daily-plan-image-placeholder" aria-hidden="true">{exercise.group.slice(0, 2).toUpperCase()}</div>
                          )}
                          <div className="daily-plan-exercise-info">
                            <span className="exercise-group">{exercise.group}</span>
                            <strong>{exercise.name}</strong>
                            <small>{exercise.kind === 'cardio' ? `Nivel ${metrics.level}/10 · ${metrics.duration} min` : `${metrics.sets} series · ${metrics.reps} reps · ${metrics.weight} kg`}</small>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <div className="daily-plan-rest">
                    <span className="rest-symbol">↗</span>
                    <div>
                      <strong>Día de recuperación</strong>
                      <p>Hoy no hay ejercicios programados en el calendario.</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="card side-card home-nutrition-card" style={{ background: theme.card }}>
                <div className="section-header">
                  <div>
                    <p className="eyebrow muted">Objetivos diarios</p>
                    <h3>Nutrición hoy</h3>
                  </div>
                  <button className="daily-plan-link" type="button" onClick={() => setActiveNav('Nutrición')}>Ver registro</button>
                </div>

                <div className="home-nutrition-goals">
                  <div className="home-nutrition-goal">
                    <div className="home-nutrition-goal-label"><span>Proteína</span><strong>{proteinToday} / {nutritionData.proteinGoalGrams} g</strong></div>
                    <div className="nutrition-progress-track" role="progressbar" aria-label="Progreso del objetivo de proteína" aria-valuemin={0} aria-valuemax={nutritionData.proteinGoalGrams} aria-valuenow={Math.min(proteinToday, nutritionData.proteinGoalGrams)}>
                      <span className="protein-progress-fill" style={{ width: `${Math.min(100, (proteinToday / nutritionData.proteinGoalGrams) * 100)}%` }} />
                    </div>
                  </div>
                  <div className="home-nutrition-goal">
                    <div className="home-nutrition-goal-label"><span>Agua</span><strong>{(waterToday / 1000).toFixed(1)} / {(nutritionData.waterGoalMl / 1000).toFixed(1)} L</strong></div>
                    <div className="nutrition-progress-track" role="progressbar" aria-label="Progreso del objetivo de agua" aria-valuemin={0} aria-valuemax={nutritionData.waterGoalMl} aria-valuenow={Math.min(waterToday, nutritionData.waterGoalMl)}>
                      <span className="water-progress-fill" style={{ width: `${Math.min(100, (waterToday / nutritionData.waterGoalMl) * 100)}%` }} />
                    </div>
                  </div>
                </div>

                <div className="home-nutrition-macros">
                  <div><span>Kcal aprox.</span><strong>{caloriesToday}<small> kcal</small></strong></div>
                  <div><span>Carbohidratos</span><strong>{carbohydratesToday.toFixed(0)}<small> g</small></strong></div>
                  <div><span>Grasas</span><strong>{fatToday.toFixed(0)}<small> g</small></strong></div>
                </div>

                {mealEntriesToday.length === 0 && (
                  <p className="home-nutrition-empty">Registra comidas para ver los macros estimados.</p>
                )}
                {nutritionEntriesToday.length > 0 && (
                  <span className="home-nutrition-entry-count">{nutritionEntriesToday.length} registros hoy</span>
                )}
              </div>
            </section>
          </>
        ) : (
          <section className="detail-screen">
            <header className="detail-header">
              <button className="back-btn" type="button" onClick={() => setScreen('overview')}>
                ← Back
              </button>
              <span className="tag">Exercise detail</span>
            </header>

            <div className="detail-card" style={{ background: theme.card }}>
              <div className="detail-top">
                <div>
                  <p className="eyebrow muted">Main lift</p>
                  <h2>{selectedExercise.name}</h2>
                </div>
                <span className={`status-pill ${completed[selectedExercise.name] ? 'done' : ''}`}>
                  {completed[selectedExercise.name] ? 'Completed' : 'Pending'}
                </span>
              </div>

              <div className="detail-grid">
                <div className="metric-box">
                  <span>Sets</span>
                  <strong>{selectedExercise.sets}</strong>
                </div>
                <div className="metric-box">
                  <span>Reps</span>
                  <strong>{selectedExercise.reps}</strong>
                </div>
                <div className="metric-box">
                  <span>Tempo</span>
                  <strong>3-1-1</strong>
                </div>
                <div className="metric-box">
                  <span>Rest</span>
                  <strong>60s</strong>
                </div>
              </div>

              <div className="detail-copy">
                <p>
                  Focus on full range of motion and controlled lowering. Keep the shoulders stable and
                  drive with your chest and triceps.
                </p>
              </div>

              <div className="detail-actions">
                <button className="primary-btn large" type="button" onClick={toggleExercise}>
                  {completed[selectedExercise.name] ? 'Mark as not done' : 'Mark as done'}
                </button>
                <button className="ghost-btn" type="button">
                  Notes
                </button>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
