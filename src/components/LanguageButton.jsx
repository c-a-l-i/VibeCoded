import { LANGS, setLang, t, useLang } from '../i18n/index.js'
import DisplayButton from './DisplaySettings.jsx'

// Language picker: a button showing the current language, with the native <select> laid over it so it opens
// the system list (handy on phones). `icon` shows just the globe, for toolbars.
export default function LanguageButton({ className = '', icon = false }) {
  const lang = useLang()
  const current = LANGS.find((l) => l.id === lang)
  return (
    <label className={`btn ghost lang-btn ${icon ? 'ds-icon' : ''} ${className}`} title={t('lang.label')}>
      🌍{icon ? '' : ` ${current.name}`}
      <select value={lang} onChange={(e) => setLang(e.target.value)} aria-label={t('lang.label')}>
        {LANGS.map((l) => (
          <option key={l.id} value={l.id} lang={l.html}>
            {l.name}
          </option>
        ))}
      </select>
    </label>
  )
}

// The language and Display buttons in the top-right corner of the menu, setup and lobby screens.
export function CornerTools() {
  return (
    <div className="corner-btn corner-tools">
      <LanguageButton />
      <DisplayButton />
    </div>
  )
}
