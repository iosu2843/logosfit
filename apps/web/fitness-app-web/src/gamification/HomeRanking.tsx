import { useEffect, useState } from 'react';
import { fetchLeaderboard, submitScore, type OnlineRow, type OnlineScope } from './online';
import type { GamReport } from './engine';
import { divisionFor, nextDivision } from './leagues';
import type { GamState } from './types';

type Props = { report: GamReport; state: GamState; name: string; onOpen: () => void };

const scopes: Array<[OnlineScope, string]> = [['global', 'Global'], ['friends', 'Amigos'], ['country', 'Mi país']];
const medals = ['🥇', '🥈', '🥉'];

export default function HomeRanking({ report, state, name, onOpen }: Props) {
  const [scope, setScope] = useState<OnlineScope>('global');
  const [rows, setRows] = useState<OnlineRow[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const logos = report.logos.total;
  const division = divisionFor(logos);
  const next = nextDivision(logos);
  const visible = state.visibility !== 'private';

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        if (visible) {
          await submitScore({
            name,
            country: state.country,
            visibility: state.visibility,
            hideRankings: state.hideRankings,
            logos,
            muscles: Object.fromEntries(report.muscles.map((m) => [m.muscle, m.score])),
          }).catch(() => undefined);
        }
        const data = await fetchLeaderboard('logos', scope);
        if (!cancelled) { setRows(data); setError(''); }
      } catch (e) {
        if (!cancelled) { setRows([]); setError(e instanceof Error ? e.message : 'No se pudo cargar la clasificación.'); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, logos, visible, state.country]);

  const me = rows.find((row) => row.self);
  const top = rows.slice(0, 5);

  return (
    <div className="card side-card home-ranking-card">
      <div className="section-header">
        <div>
          <p className="eyebrow muted">Logos Score</p>
          <h3>Clasificación</h3>
        </div>
        <button className="daily-plan-link" type="button" onClick={onOpen}>Ver completa</button>
      </div>
      <div className="home-ranking-league">
        <strong>Liga {division.name}</strong>
        <span>Nivel {report.level.level} · {report.level.title}</span>
        <small>{logos} pts{next ? ` · ${next.missing} para ${next.division.name}` : ' · liga máxima'}</small>
      </div>
      <div className="gm-tabs">
        {scopes.map(([id, label]) => (
          <button key={id} type="button" className={scope === id ? 'on' : ''} onClick={() => setScope(id)}>{label}</button>
        ))}
      </div>
      {loading && <p className="muted">Cargando…</p>}
      {!loading && error && <p className="muted">{error}</p>}
      {!loading && !error && top.length === 0 && (
        <p className="muted">Aún no hay usuarios en esta lista. Pon tu visibilidad en «Pública» (Usuarios → Privacidad) para aparecer.</p>
      )}
      {!loading && !error && top.length > 0 && (
        <ol className="home-ranking-list">
          {top.map((row) => (
            <li key={row.userId} className={row.self ? 'self' : ''}>
              <span>{medals[row.position - 1] ?? `#${row.position}`}</span>
              <strong>{row.name}{row.country ? ` · ${row.country}` : ''}</strong>
              <em>{row.score}</em>
            </li>
          ))}
        </ol>
      )}
      {!loading && !error && me && me.position > 5 && <p className="muted">Tu posición: #{me.position} · {me.score} pts</p>}
      {!visible && <p className="muted">Tu perfil es privado: no apareces en listas ajenas.</p>}
    </div>
  );
}
