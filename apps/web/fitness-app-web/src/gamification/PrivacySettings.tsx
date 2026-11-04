import type { GamState, Visibility } from './types';
import './gamification.css';

type Props = { state: GamState; onState: (change: (current: GamState) => GamState) => void };

export default function PrivacySettings({ state, onState }: Props) {
  return (
    <article className="gm-card gm-detail">
      <h3>Privacidad y clasificación</h3>
      <label className="gm-field">Visibilidad del perfil
        <select value={state.visibility} onChange={(e) => onState((c) => ({ ...c, visibility: e.target.value as Visibility }))}>
          <option value="private">Privado (por defecto)</option>
          <option value="friends">Solo amigos</option>
          <option value="public">Público</option>
        </select>
      </label>
      <label className="gm-field">País (código de 2 letras)
        <input maxLength={2} placeholder="ES" value={state.country} onChange={(e) => onState((c) => ({ ...c, country: e.target.value.toUpperCase().replace(/[^A-Z]/g, '') }))} />
      </label>
      <label className="gm-check"><input type="checkbox" checked={state.hideRankings} onChange={(e) => onState((c) => ({ ...c, hideRankings: e.target.checked }))} /> Ocultarme de las clasificaciones</label>
      <label className="gm-check"><input type="checkbox" checked={state.sound} onChange={(e) => onState((c) => ({ ...c, sound: e.target.checked }))} /> Sonido al desbloquear logros</label>
      <p className="gm-note">Los cambios se aplican en la clasificación online la próxima vez que publiques tu puntuación.</p>
    </article>
  );
}