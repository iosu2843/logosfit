import { useState } from 'react';
import { buildLeaderboard, type GamReport, type RankEntry } from './engine';
import { categoryInfo, leagueMuscles, tierLabels, type AchievementState, type Category, type CustomMilestone, type GamState, type LeagueMuscle, type Tier } from './types';
import { divisions } from './leagues';
import { cumXP } from './xp';
import { ironMilestones } from './milestones';
import { withDate } from './store';
import { fetchLeaderboard, listFriendRequests, reportScore, respondFriendRequest, sendFriendRequest, submitScore, type OnlineRow, type OnlineScope } from './online';
import './gamification.css';

const tierIcon: Record<Tier, string> = { bronce: '🥉', plata: '🥈', oro: '🥇', platino: '💠', legendario: '👑' };
const tabs = ['Salón de logros', 'Mis músculos', 'Copas', 'Clasificación', 'Temporada', 'Vitrina'] as const;
type Tab = (typeof tabs)[number];

type Props = {
  report: GamReport;
  state: GamState;
  today: string;
  ranking: RankEntry[];
  exerciseNames: string[];
  onState: (change: (current: GamState) => GamState) => void;
};

const pct = (value: number) => `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;

function Bar({ value }: { value: number }) {
  return <div className="gm-bar"><span style={{ width: pct(value) }} /></div>;
}

function AchievementCard({ item, pinned, onPin }: { item: AchievementState; pinned?: boolean; onPin?: () => void }) {
  const { def, status, progress, unlockedAt } = item;
  const hidden = def.secret && status !== 'unlocked';
  return (
    <article className={`gm-card gm-ach ${status} tier-${def.tier}`}>
      <div className="gm-ach-head">
        <span className="gm-medal">{status === 'unlocked' ? tierIcon[def.tier] : hidden ? '❔' : '🔒'}</span>
        <div>
          <h4>{hidden ? 'Logro secreto' : def.name}</h4>
          <small>{hidden ? 'Sigue entrenando para descubrirlo.' : `${def.philosopher} · ${tierLabels[def.tier]}`}</small>
        </div>
      </div>
      {!hidden && <p>{def.description}</p>}
      {!hidden && <Bar value={progress.target ? progress.current / progress.target : 0} />}
      <footer>
        <span>{hidden ? '' : `${Math.round(progress.current * 10) / 10} / ${progress.target}`}</span>
        <span>{status === 'unlocked' ? `+${def.xp} XP · ${unlockedAt}` : hidden ? '' : `${def.xp} XP`}</span>
        {status === 'unlocked' && onPin && <button type="button" className="gm-link" onClick={onPin}>{pinned ? 'Quitar de vitrina' : 'A la vitrina'}</button>}
      </footer>
    </article>
  );
}

function Hall({ report, state, onState }: Pick<Props, 'report' | 'state' | 'onState'>) {
  const [category, setCategory] = useState<Category | 'todas'>('todas');
  const [filter, setFilter] = useState<'todos' | 'unlocked' | 'progress' | 'locked'>('todos');
  const list = report.achievements.filter((item) => (category === 'todas' || item.def.category === category) && (filter === 'todos' || item.status === filter));
  const togglePin = (id: string) =>
    onState((current) => ({ ...current, showcase: current.showcase.includes(id) ? current.showcase.filter((x) => x !== id) : [...current.showcase, id].slice(-6) }));
  return (
    <section>
      <div className="gm-chips">
        <button type="button" className={category === 'todas' ? 'on' : ''} onClick={() => setCategory('todas')}>Todas</button>
        {(Object.keys(categoryInfo) as Category[]).filter((key) => key !== 'propios' || state.custom.length > 0).map((key) => (
          <button key={key} type="button" className={category === key ? 'on' : ''} onClick={() => setCategory(key)}>{categoryInfo[key].icon} {categoryInfo[key].label}</button>
        ))}
      </div>
      <div className="gm-chips small">
        {(['todos', 'unlocked', 'progress', 'locked'] as const).map((key) => (
          <button key={key} type="button" className={filter === key ? 'on' : ''} onClick={() => setFilter(key)}>{{ todos: 'Todos', unlocked: 'Conseguidos', progress: 'En progreso', locked: 'Pendientes' }[key]}</button>
        ))}
      </div>
      <p className="gm-note">{report.unlockedCount} de {report.achievements.length} logros. Los logros premian constancia y progreso, no dietas restrictivas ni cargas peligrosas.</p>
      <div className="gm-grid">
        {list.map((item) => <AchievementCard key={item.def.id} item={item} pinned={state.showcase.includes(item.def.id)} onPin={() => togglePin(item.def.id)} />)}
        {list.length === 0 && <p className="gm-note">No hay logros con este filtro.</p>}
      </div>
    </section>
  );
}

function Muscles({ report }: { report: GamReport }) {
  const [selected, setSelected] = useState<LeagueMuscle>(leagueMuscles[0]);
  const detail = report.muscles.find((m) => m.muscle === selected)!;
  const labels: Array<[keyof typeof detail.parts, string]> = [['strength', 'Fuerza (hitos)'], ['progression', 'Progresión'], ['relative', 'Fuerza relativa al peso corporal'], ['volume', 'Volumen semanal'], ['consistency', 'Constancia'], ['achievements', 'Logros del músculo']];
  return (
    <section>
      <div className="gm-grid muscles">
        {report.muscles.map((m) => (
          <button key={m.muscle} type="button" className={`gm-card gm-muscle ${m.muscle === selected ? 'on' : ''}`} onClick={() => setSelected(m.muscle)}>
            <h4>{m.muscle}</h4>
            <strong>{m.score}</strong>
            <small>{m.division}</small>
            <Bar value={m.score / 10000} />
          </button>
        ))}
      </div>
      <article className="gm-card gm-detail">
        <h3>{detail.muscle} · {detail.division}</h3>
        <p className="gm-note">{detail.next ? `Te faltan ${detail.next.missing} puntos para ${detail.next.name}.` : 'Has alcanzado la división máxima.'} Cada músculo compite en su propia liga.</p>
        {labels.map(([key, label]) => (
          <div key={key} className="gm-row"><span>{label}</span>{detail.parts[key] === null ? <em>Añade tu peso corporal</em> : <Bar value={detail.parts[key] as number} />}</div>
        ))}
        <h4>Récords</h4>
        <ul className="gm-list">
          {detail.records.weight.map((r) => <li key={r.exercise}>{r.exercise}: <b>{r.value} kg</b></li>)}
          {detail.records.reps > 0 && <li>Máximo de repeticiones (peso corporal): <b>{detail.records.reps}</b></li>}
          <li>1RM estimado: <b>{detail.records.oneRepMax || '—'} kg</b></li>
          <li>Mejor volumen de sesión: <b>{detail.records.sessionVolume || '—'} kg</b></li>
        </ul>
        {detail.nextMilestone && <p className="gm-note">Siguiente hito: {detail.nextMilestone.exercise} → {detail.nextMilestone.target} {detail.nextMilestone.unit} (llevas {detail.nextMilestone.current}).</p>}
      </article>
    </section>
  );
}

function Cups({ report }: { report: GamReport }) {
  const icon = { ninguna: '⚪', bronce: '🥉', plata: '🥈', oro: '🏆' };
  return (
    <section>
      {(['filosofica', 'muscular', 'general'] as const).map((kind) => (
        <div key={kind}>
          <h3 className="gm-sub">{{ filosofica: 'Copas filosóficas', muscular: 'Copas musculares', general: 'Copa general' }[kind]}</h3>
          <div className="gm-grid">
            {report.cups.filter((cup) => cup.kind === kind).map((cup) => (
              <article key={cup.id} className={`gm-card gm-cup ${cup.level}`}>
                <span className="gm-trophy">{icon[cup.level]}</span>
                <h4>{cup.name}</h4>
                <small>{cup.philosopher} · {cup.concept}</small>
                <Bar value={cup.value} />
                <small>{cup.level === 'ninguna' ? 'Sin conseguir' : `Nivel ${cup.level}`} · {cup.hint}</small>
              </article>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

function OnlineRanking({ report, state, selfName, metric, onState }: { report: GamReport; state: GamState; selfName: string; metric: 'logos' | LeagueMuscle; onState: Props['onState'] }) {
  const [scope, setScope] = useState<OnlineScope>('global');
  const [rows, setRows] = useState<OnlineRow[]>([]);
  const [requests, setRequests] = useState<Array<{ requester: string; display_name: string }>>([]);
  const [code, setCode] = useState('');
  const [myCode, setMyCode] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Error de conexión.');
    } finally {
      setBusy(false);
    }
  };

  const load = (nextScope = scope) => run(async () => {
    setRows(await fetchLeaderboard(metric, nextScope));
    setRequests(await listFriendRequests().catch(() => []));
  });

  const publish = () => run(async () => {
    const result = await submitScore({
      name: selfName,
      country: state.country,
      visibility: state.visibility,
      hideRankings: state.hideRankings,
      logos: report.logos.total,
      muscles: Object.fromEntries(report.muscles.map((m) => [m.muscle, m.score])),
    });
    if (result.friendCode) setMyCode(result.friendCode);
    setMessage(result.message + (state.visibility === 'private' ? ' Tu visibilidad es «Privado»: no aparecerás en listas ajenas (cámbiala en Usuarios).' : ''));
    if (result.status === 'ok' || result.status === 'capped') setRows(await fetchLeaderboard(metric, scope));
  });

  const addFriend = () => run(async () => {
    const status = await sendFriendRequest(code);
    setMessage(status === 'not_found' ? 'Código no válido.' : status === 'accepted' ? 'Ya sois amigos.' : 'Solicitud enviada.');
    setCode('');
  });

  const report1 = (row: OnlineRow) => {
    const reason = window.prompt(`Motivo del reporte de ${row.name} (mín. 3 caracteres):`);
    if (!reason || reason.trim().length < 3) return;
    void run(async () => setMessage((await reportScore(row.userId, reason.trim())) ? 'Reporte enviado. Con 3 reportes distintos se retira la puntuación para su revisión.' : 'No se pudo reportar.'));
  };

  return (
    <article className="gm-card gm-detail">
      <h3>Clasificación online</h3>
      <p className="gm-note">Requiere sesión en la nube. El servidor valida rangos, frecuencia y subida máxima diaria, y registra cada envío en un historial de auditoría.</p>
      <div className="gm-form">
        <input maxLength={2} placeholder="País (ES)" value={state.country} onChange={(e) => onState((c) => ({ ...c, country: e.target.value.toUpperCase().replace(/[^A-Z]/g, '') }))} />
        <button type="button" className="gm-btn" disabled={busy} onClick={publish}>Publicar mi puntuación</button>
        <button type="button" className="gm-btn" disabled={busy} onClick={() => load()}>Actualizar</button>
      </div>
      <div className="gm-chips small">
        {(['global', 'friends', 'country'] as const).map((key) => (
          <button key={key} type="button" className={scope === key ? 'on' : ''} onClick={() => { setScope(key); void load(key); }}>{{ global: 'Global', friends: 'Amigos', country: 'Mi país' }[key]}</button>
        ))}
      </div>
      <ol className="gm-podium">
        {rows.map((row) => (
          <li key={row.userId} className={row.self ? 'self' : ''}>
            <b>{row.position <= 3 ? ['🥇', '🥈', '🥉'][row.position - 1] : `#${row.position}`}</b>
            <span>{row.name}{row.country ? ` · ${row.country}` : ''}</span>
            <em>{row.score}{!row.self && <button type="button" className="gm-link" title="Reportar puntuación sospechosa" onClick={() => report1(row)}> ⚑</button>}</em>
          </li>
        ))}
        {rows.length === 0 && <li><span /><span>Sin resultados todavía. Publica tu puntuación o pulsa Actualizar.</span><span /></li>}
      </ol>
      <h4>Amigos</h4>
      {myCode && <p className="gm-note">Tu código de amigo: <b>{myCode}</b></p>}
      <div className="gm-form">
        <input placeholder="Código de amigo" value={code} onChange={(e) => setCode(e.target.value)} />
        <button type="button" className="gm-btn" disabled={busy || code.trim().length < 4} onClick={addFriend}>Enviar solicitud</button>
      </div>
      {requests.map((req) => (
        <div key={req.requester} className="gm-form">
          <span>{req.display_name} quiere ser tu amigo</span>
          <button type="button" className="gm-btn" onClick={() => run(async () => { await respondFriendRequest(req.requester, true); await load(); })}>Aceptar</button>
          <button type="button" className="gm-link" onClick={() => run(async () => { await respondFriendRequest(req.requester, false); await load(); })}>Rechazar</button>
        </div>
      ))}
      {message && <p className="gm-note" role="status">{message}</p>}
    </article>
  );
}

function Ranking({ report, state, ranking, onState }: Pick<Props, 'report' | 'state' | 'ranking' | 'onState'>) {
  const [metric, setMetric] = useState<'logos' | LeagueMuscle>('logos');
  const rows = buildLeaderboard(ranking, metric);
  const dims = report.logos.dimensions;
  const selfName = ranking.find((entry) => entry.self)?.name ?? 'Atleta';
  return (
    <section>
      <article className="gm-card gm-detail">
        <h3>Logos Score: {report.logos.total} / 10000</h3>
        <p className="gm-note">Combina fuerza, disciplina, nutrición (hábitos), progreso y logros. Mejora semanal: {report.logos.improvement >= 0 ? '+' : ''}{report.logos.improvement} puntos (máx. {500}/semana).</p>
        {(Object.keys(dims) as Array<keyof typeof dims>).map((key) => <div key={key} className="gm-row"><span>{key}</span><Bar value={dims[key]} /></div>)}
      </article>
      <div className="gm-chips small">
        <button type="button" className={metric === 'logos' ? 'on' : ''} onClick={() => setMetric('logos')}>Logos Score</button>
        {leagueMuscles.map((m) => <button key={m} type="button" className={metric === m ? 'on' : ''} onClick={() => setMetric(m)}>{m}</button>)}
      </div>
      <h3 className="gm-sub">En este dispositivo</h3>
      <ol className="gm-podium">
        {rows.map((row) => (
          <li key={row.id} className={row.self ? 'self' : ''}>
            <b>{row.position === 1 ? '🥇' : row.position === 2 ? '🥈' : row.position === 3 ? '🥉' : `#${row.position}`}</b>
            <span>{row.name}</span>
            <em>{row.score}</em>
          </li>
        ))}
      </ol>
      <p className="gm-note">Los perfiles privados no aparecen en la lista de otros{state.hideRankings ? ' (has ocultado tu posición)' : ''}.</p>
      <OnlineRanking report={report} state={state} selfName={selfName} metric={metric} onState={onState} />
      <h3 className="gm-sub">Divisiones</h3>
      <div className="gm-chips small">{divisions.map((d) => <span key={d.id} className="gm-pill">{d.name} · {d.min}+</span>)}</div>
    </section>
  );
}
function Season({ report, state, today, onState }: Pick<Props, 'report' | 'state' | 'today' | 'onState'>) {
  const { season } = report;
  const month = today.slice(0, 7);
  const reviewed = state.reviews.some((date) => date.startsWith(month));
  return (
    <section>
      <article className="gm-card gm-detail">
        <h3>{season.name}</h3>
        <p className="gm-note">{season.start} → {season.end} · quedan {season.daysLeft} días · Foco muscular: <b>{season.focus}</b></p>
        {season.challenges.map((c) => (
          <div key={c.id} className="gm-row"><span>{c.done ? '✅' : '▫️'} {c.label} ({c.current}/{c.target})</span><Bar value={c.current / c.target} /></div>
        ))}
        <p className="gm-note">Recompensa: {season.reward}</p>
      </article>
      <article className="gm-card gm-detail">
        <h3>Revisión mensual</h3>
        <p className="gm-note">Repasa tu progreso del mes: peso, marcas y constancia. Cuenta para los logros de Sabiduría.</p>
        <p className="gm-note">{report.pendingReview > 0 ? `${report.pendingReview} serie(s) con un salto de marca inusual están en revisión: cuentan para ti pero no para la clasificación. Comprueba que el peso y las repeticiones sean correctos.` : 'No hay marcas en revisión.'}</p>
        <button type="button" className="gm-btn" disabled={reviewed} onClick={() => onState((c) => withDate(c, 'reviews', today))}>{reviewed ? 'Revisión de este mes hecha' : 'Marcar revisión del mes'}</button>
      </article>
    </section>
  );
}

function Showcase({ report, state, exerciseNames, onState }: Pick<Props, 'report' | 'state' | 'exerciseNames' | 'onState'>) {
  const [draft, setDraft] = useState({ exercise: exerciseNames[0] ?? '', metric: 'weight' as CustomMilestone['metric'], target: '', minReps: '3' });
  const pinned = report.achievements.filter((item) => state.showcase.includes(item.def.id) && item.status === 'unlocked');
  const addCustom = () => {
    const target = Number(draft.target);
    if (!draft.exercise || !(target > 0 && target <= 1000)) return;
    const item: CustomMilestone = { id: `${Date.now()}`, exercise: draft.exercise, metric: draft.metric, target, minReps: Number(draft.minReps) };
    onState((c) => ({ ...c, custom: [...c.custom, item].slice(-20) }));
    setDraft({ ...draft, target: '' });
  };
  const mine = report.achievements.filter((item) => item.def.category === 'propios');
  return (
    <section>
      <article className="gm-card gm-detail">
        <h3>Vitrina de trofeos</h3>
        {pinned.length === 0 ? <p className="gm-note">Fija hasta 6 logros desde el Salón con «A la vitrina».</p> : <div className="gm-grid">{pinned.map((item) => <AchievementCard key={item.def.id} item={item} />)}</div>}
      </article>
      <article className="gm-card gm-detail">
        <h3>Hitos personalizados</h3>
        <p className="gm-note">Se muestran en tu perfil, no dan XP ni cuentan para la clasificación.</p>
        <div className="gm-form">
          <select value={draft.exercise} onChange={(e) => setDraft({ ...draft, exercise: e.target.value })}>
            {[...new Set([...exerciseNames, ...ironMilestones.map((d) => d.exercise)])].sort().map((name) => <option key={name}>{name}</option>)}
          </select>
          <select value={draft.metric} onChange={(e) => setDraft({ ...draft, metric: e.target.value as CustomMilestone['metric'] })}>
            <option value="weight">Peso (kg)</option><option value="reps">Repeticiones</option><option value="seconds">Segundos</option>
          </select>
          <input inputMode="decimal" placeholder="Objetivo" value={draft.target} onChange={(e) => setDraft({ ...draft, target: e.target.value })} />
          <select value={draft.minReps} onChange={(e) => setDraft({ ...draft, minReps: e.target.value })}>
            {[1, 3, 5, 8, 10].map((n) => <option key={n} value={n}>mín. {n} reps</option>)}
          </select>
          <button type="button" className="gm-btn" onClick={addCustom}>Añadir</button>
        </div>
        <div className="gm-grid">
          {mine.map((item) => (
            <div key={item.def.id}>
              <AchievementCard item={item} />
              <button type="button" className="gm-link" onClick={() => onState((c) => ({ ...c, custom: c.custom.filter((x) => `custom-${x.id}` !== item.def.id.split(':')[1]) }))}>Eliminar</button>
            </div>
          ))}
        </div>
      </article>
      <article className="gm-card gm-detail">
        <h3>Historial de XP</h3>
        <ul className="gm-list">
          {[...report.xpLedger].reverse().slice(0, 25).map((event, index) => <li key={index}>{event.date} · {event.label}: <b>+{event.xp}</b></li>)}
          {report.xpLedger.length === 0 && <li>Aún no has ganado XP.</li>}
        </ul>
      </article>
    </section>
  );
}

export default function GamificationModule(props: Props) {
  const [tab, setTab] = useState<Tab>('Salón de logros');
  const { report, state, today, onState } = props;
  const { level } = report;
  return (
    <section className="gm-root">
      <header className="gm-header">
        <div>
          <p className="eyebrow">Logros y ligas</p>
          <h1>LOGOS · Nivel {level.level}</h1>
          <p className="gm-note">{level.title} · {level.xp} XP{level.nextAt ? ` · siguiente nivel en ${level.nextAt - level.xp} XP (${cumXP(level.level + 1)} acumulados)` : ' · nivel máximo'}</p>
          <Bar value={level.progress} />
        </div>
        <div className="gm-stats">
          <div><b>{report.logos.total}</b><small>Logos Score</small></div>
          <div><b>{report.unlockedCount}</b><small>Logros</small></div>
          <div><b>{report.cups.filter((c) => c.level !== 'ninguna').length}</b><small>Copas</small></div>
        </div>
      </header>
      <nav className="gm-tabs">{tabs.map((name) => <button key={name} type="button" className={tab === name ? 'on' : ''} onClick={() => setTab(name)}>{name}</button>)}</nav>
      {tab === 'Salón de logros' && <Hall report={report} state={state} onState={onState} />}
      {tab === 'Mis músculos' && <Muscles report={report} />}
      {tab === 'Copas' && <Cups report={report} />}
      {tab === 'Clasificación' && <Ranking report={report} state={state} ranking={props.ranking} onState={onState} />}
      {tab === 'Temporada' && <Season report={report} state={state} today={today} onState={onState} />}
      {tab === 'Vitrina' && <Showcase report={report} state={state} exerciseNames={props.exerciseNames} onState={onState} />}
    </section>
  );
}

export function UnlockToasts({ items, onDismiss }: { items: AchievementState[]; onDismiss: (id: string) => void }) {
  if (items.length === 0) return null;
  return (
    <div className="gm-toasts" role="status">
      {items.slice(0, 3).map((item) => (
        <button key={item.def.id} type="button" className="gm-toast" onClick={() => onDismiss(item.def.id)}>
          <span>{tierIcon[item.def.tier]}</span>
          <div><b>¡Logro desbloqueado!</b><small>{item.def.name} · +{item.def.xp} XP</small></div>
        </button>
      ))}
    </div>
  );
}

export function playUnlockSound() {
  try {
    const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Context) return;
    const ctx = new Context();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 660;
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch {
    /* el sonido es opcional */
  }
}
