import type { ReactNode } from 'react'

/** Story helper: renders its children twice, once per theme, so both can be reviewed at a glance. */
export function ThemePair({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {label && <h3 style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>{label}</h3>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-start' }}>
        {(['light', 'dark'] as const).map((theme) => (
          <div
            key={theme}
            data-theme={theme}
            style={{
              padding: '1.25rem',
              borderRadius: 16,
              border: '1px solid var(--color-border-strong)',
              background: 'var(--color-bg)',
              color: 'var(--color-text)',
            }}
          >
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
              {theme === 'light' ? 'Claro' : 'Oscuro'}
            </p>
            {children}
          </div>
        ))}
      </div>
    </section>
  )
}
