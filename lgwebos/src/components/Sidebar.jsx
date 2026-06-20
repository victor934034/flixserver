import React, { useState } from 'react';
import { useFocusable, FocusContext } from '@noriginmedia/norigin-spatial-navigation';

const SIDEBAR_SM = 72;
const SIDEBAR_LG = 240;

const NAV_ITEMS = [
  { key: 'home',   label: 'Início',  icon: IconHome },
  { key: 'movies', label: 'Filmes',  icon: IconFilm },
  { key: 'series', label: 'Séries',  icon: IconTv },
  { key: 'search', label: 'Busca',   icon: IconSearch },
];

function IconHome({ color }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill={color}>
      <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
    </svg>
  );
}

function IconFilm({ color }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill={color}>
      <path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z"/>
    </svg>
  );
}

function IconTv({ color }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill={color}>
      <path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 1.99-.9 1.99-2L23 5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z"/>
    </svg>
  );
}

function IconSearch({ color }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill={color}>
      <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
    </svg>
  );
}

function IconLogout({ color }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill={color}>
      <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
    </svg>
  );
}

function NavBtn({ navKey, label, Icon, active, expanded, onPress, onFocus, onBlur }) {
  const { ref, focused } = useFocusable({
    onEnterPress: onPress,
    onFocus,
    onBlur,
  });

  const isDanger = navKey === 'logout';
  const iconColor = focused
    ? '#fff'
    : isDanger
    ? '#E50914'
    : active
    ? '#fff'
    : '#888';

  return (
    <div
      ref={ref}
      onClick={onPress}
      style={{
        paddingLeft: 8,
        paddingRight: 8,
        marginTop: 2,
        marginBottom: 2,
        cursor: 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          borderRadius: 10,
          paddingTop: 10,
          paddingBottom: 10,
          paddingLeft: 8,
          paddingRight: 8,
          minHeight: 46,
          backgroundColor: focused
            ? isDanger
              ? 'rgba(229,9,20,0.25)'
              : '#E50914'
            : active
            ? 'rgba(255,255,255,0.07)'
            : 'transparent',
          transition: 'background-color 0.15s ease',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            position: 'relative',
          }}
        >
          <Icon color={iconColor} />
          {active && !focused && (
            <div
              style={{
                position: 'absolute',
                bottom: 2,
                right: 2,
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: '#E50914',
              }}
            />
          )}
        </div>
        <div
          style={{
            fontSize: 15,
            color: focused || active ? '#fff' : '#ccc',
            fontWeight: focused || active ? 800 : 600,
            whiteSpace: 'nowrap',
            opacity: expanded ? 1 : 0,
            transition: 'opacity 0.14s ease',
            letterSpacing: 0.2,
          }}
        >
          {label}
        </div>
      </div>
    </div>
  );
}

/**
 * Sidebar component
 *
 * Props:
 *   activeNav   — 'home' | 'movies' | 'series' | 'search'
 *   onSelect    — (navKey) => void
 *   onLogout    — () => void
 *   onExpand    — called when sidebar expands (any item focused)
 *   onCollapse  — called when sidebar loses all focus
 *   focusKey    — spatial-nav FocusContext key
 */
export default function Sidebar({
  activeNav,
  onSelect,
  onLogout,
  onExpand,
  onCollapse,
  focusKey = 'SIDEBAR',
}) {
  const [expanded, setExpanded] = useState(false);
  const { ref, focusSelf, focused: containerFocused } = useFocusable({
    focusKey,
    trackChildren: true,
  });

  let blurTimer = null;

  function handleFocus() {
    clearTimeout(blurTimer);
    setExpanded(true);
    onExpand?.();
  }

  function handleBlur() {
    blurTimer = setTimeout(() => {
      setExpanded(false);
      onCollapse?.();
    }, 160);
  }

  const width = expanded ? SIDEBAR_LG : SIDEBAR_SM;

  return (
    <FocusContext.Provider value={focusKey}>
      <div
        ref={ref}
        style={{
          position: 'relative',
          zIndex: 20,
          flexShrink: 0,
          width: SIDEBAR_SM,
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width,
            background: 'linear-gradient(to bottom, #161619, #0e0e11, #0b0b0d)',
            borderRight: '1px solid rgba(255,255,255,0.07)',
            overflow: 'hidden',
            transition: 'width 0.22s ease',
            zIndex: 20,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Logo */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              height: 72,
              paddingLeft: 10,
              paddingRight: 10,
              gap: 10,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 9,
                backgroundColor: '#E50914',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: 22, fontWeight: 900, color: '#fff' }}>F</span>
            </div>
            <span
              style={{
                fontSize: 17,
                fontWeight: 900,
                color: '#E50914',
                letterSpacing: 2,
                whiteSpace: 'nowrap',
                opacity: expanded ? 1 : 0,
                transition: 'opacity 0.14s ease',
              }}
            >
              LIXHOME
            </span>
          </div>

          {/* Divider */}
          <div
            style={{
              height: 1,
              backgroundColor: 'rgba(255,255,255,0.06)',
              marginLeft: 10,
              marginRight: 10,
              marginBottom: 6,
            }}
          />

          {/* Nav items */}
          {NAV_ITEMS.map((item) => (
            <NavBtn
              key={item.key}
              navKey={item.key}
              label={item.label}
              Icon={item.icon}
              active={activeNav === item.key}
              expanded={expanded}
              onPress={() => { onSelect(item.key); }}
              onFocus={handleFocus}
              onBlur={handleBlur}
            />
          ))}

          <div style={{ flex: 1 }} />

          {/* Divider */}
          <div
            style={{
              height: 1,
              backgroundColor: 'rgba(255,255,255,0.06)',
              marginLeft: 10,
              marginRight: 10,
              marginTop: 4,
              marginBottom: 6,
            }}
          />

          {/* Logout */}
          <NavBtn
            navKey="logout"
            label="Sair"
            Icon={IconLogout}
            active={false}
            expanded={expanded}
            onPress={onLogout}
            onFocus={handleFocus}
            onBlur={handleBlur}
          />
          <div style={{ height: 16 }} />
        </div>
      </div>
    </FocusContext.Provider>
  );
}
