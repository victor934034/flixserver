import React from 'react';

const SB = 64;   // collapsed width
const SB_EX = 300; // expanded width
const ACCENT = '#c91c2c';

const NAV = [
  {
    key: 'home', label: 'Início',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
        <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
      </svg>
    ),
  },
  {
    key: 'movies', label: 'Filmes',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z"/>
      </svg>
    ),
  },
  {
    key: 'series', label: 'Séries',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
        <path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z"/>
      </svg>
    ),
  },
  {
    key: 'search', label: 'Buscar',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
        <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
      </svg>
    ),
  },
];

const LOGOUT_ICON = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
  </svg>
);

export default function Sidebar({
  activeNav, focusIdx, expanded,
  onSelect, onLogout, onMouseEnter, onMouseLeave,
}) {
  const w = expanded ? SB_EX : SB;

  return (
    <div
      style={{ position: 'relative', zIndex: 30, flexShrink: 0, width: SB }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: w,
        background: 'linear-gradient(to bottom, #111114 0%, #0c0c0f 60%, #090909 100%)',
        borderRight: '1px solid rgba(255,255,255,0.055)',
        overflow: 'hidden',
        transition: 'width 0.25s cubic-bezier(.4,0,.2,1)',
        display: 'flex', flexDirection: 'column',
        boxShadow: expanded ? '4px 0 32px rgba(0,0,0,0.5)' : 'none',
      }}>

        {/* Logo */}
        <div style={{
          height: 80, display: 'flex', alignItems: 'center',
          paddingLeft: 16, gap: 12, flexShrink: 0, overflow: 'hidden',
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8, flexShrink: 0,
            background: ACCENT,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 20, fontWeight: 900, color: '#fff', lineHeight: 1 }}>F</span>
          </div>
          <span style={{
            fontSize: 16, fontWeight: 900, color: '#fff',
            letterSpacing: 2.5, whiteSpace: 'nowrap',
            opacity: expanded ? 1 : 0,
            transition: 'opacity 0.15s ease',
          }}>
            LIXHOME
          </span>
        </div>

        <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '0 12px 8px' }} />

        {/* Nav items */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', paddingTop: 4, overflow: 'hidden' }}>
          {NAV.map((item, i) => {
            const isFocused = focusIdx === i;
            const isActive  = activeNav === item.key;
            return (
              <SideItem
                key={item.key}
                icon={item.icon}
                label={item.label}
                focused={isFocused}
                active={isActive}
                expanded={expanded}
                onClick={() => onSelect(item.key)}
              />
            );
          })}
        </div>

        {/* Separator + logout */}
        <div style={{ flexShrink: 0 }}>
          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '4px 12px 8px' }} />
          <SideItem
            icon={LOGOUT_ICON}
            label="Sair"
            focused={focusIdx === NAV.length}
            active={false}
            expanded={expanded}
            danger
            onClick={onLogout}
          />
          <div style={{ height: 20 }} />
        </div>
      </div>
    </div>
  );
}

function SideItem({ icon, label, focused, active, expanded, danger, onClick }) {
  const bg = focused
    ? (danger ? 'rgba(201,28,44,0.18)' : 'rgba(255,255,255,0.95)')
    : active ? 'rgba(255,255,255,0.07)' : 'transparent';

  const textColor = focused
    ? (danger ? ACCENT : '#0a0a0a')
    : active ? '#fff' : 'rgba(255,255,255,0.55)';

  const iconColor = focused
    ? (danger ? ACCENT : '#0a0a0a')
    : active ? '#fff' : 'rgba(255,255,255,0.45)';

  return (
    <div
      onClick={onClick}
      style={{ padding: '3px 10px', cursor: 'pointer' }}
    >
      <div style={{
        display: 'flex', flexDirection: 'row', alignItems: 'center',
        gap: 14, borderRadius: 10, padding: '11px 10px',
        background: bg,
        transition: 'background 0.18s ease',
        overflow: 'hidden',
        border: focused && !danger ? '1.5px solid rgba(0,0,0,0.07)' : '1.5px solid transparent',
      }}>
        <div style={{
          flexShrink: 0, width: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: iconColor,
          transition: 'color 0.18s ease',
        }}>
          {icon}
        </div>
        <span style={{
          fontSize: 15, fontWeight: focused || active ? 700 : 500,
          color: textColor,
          whiteSpace: 'nowrap',
          opacity: expanded ? 1 : 0,
          transition: 'opacity 0.15s ease, color 0.18s ease',
          letterSpacing: 0.2,
        }}>
          {label}
        </span>
      </div>
    </div>
  );
}
