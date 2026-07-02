import React from 'react';
import './macHealthShell.css';

export interface NavItem {
  id: string;
  label: string;
  href: string;
}

export function MacHealthShell({
  nav,
  activeId,
  children,
  onNavigate,
  onImport,
}: {
  nav: NavItem[];
  activeId: string;
  children: React.ReactNode;
  onNavigate: (href: string) => void;
  onImport: () => void;
}) {
  return (
    <div className="app-window">
      <header className="app-toolbar" aria-label="Toolbar">
        <strong className="toolbar-title">Summary</strong>
        <div className="toolbar-spacer" />
        <input className="toolbar-search no-drag" placeholder="Search metrics" aria-label="Search metrics" />
        <button className="toolbar-button no-drag" onClick={onImport}>Import</button>
      </header>
      <div className="app-shell">
        <aside className="sidebar" aria-label="Primary navigation">
          <nav className="sidebar-nav">
            {nav.map((item) => (
              <button
                key={item.id}
                className={item.id === activeId ? 'sidebar-item is-active' : 'sidebar-item'}
                onClick={() => onNavigate(item.href)}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </aside>
        <main className="main-content">{children}</main>
      </div>
    </div>
  );
}
