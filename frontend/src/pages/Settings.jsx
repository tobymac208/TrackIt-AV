import { THEMES, useTheme } from '../theme';

export default function Settings() {
  const { theme, setTheme } = useTheme();

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Settings</h2>
          <p>Preferences for this browser</p>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">Appearance</div>
        <div className="settings-section">
          <p className="settings-intro">
            Choose a theme for the whole app. Your selection is saved on this device.
          </p>
          <div className="theme-grid" role="radiogroup" aria-label="App theme">
            {THEMES.map((option) => {
              const selected = theme === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={`theme-card${selected ? ' selected' : ''}`}
                  onClick={() => setTheme(option.id)}
                >
                  <div className="theme-preview" aria-hidden="true">
                    {option.swatches.map((color) => (
                      <span key={color} style={{ background: color }} />
                    ))}
                  </div>
                  <div className="theme-card-title">{option.label}</div>
                  <div className="theme-card-desc">{option.description}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
