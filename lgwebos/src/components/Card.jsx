import React from 'react';
import { useFocusable } from '@noriginmedia/norigin-spatial-navigation';

const CARD_W = 248;
const CARD_H = 140; // 16:9

/**
 * Card — content card for horizontal rows (movies/series).
 *
 * Props:
 *   item     — { id, title, name, backdrop_url, poster_url }
 *   onSelect — called with item when Enter is pressed or card is clicked
 *   onFocus  — called when card gains focus (for row scroll)
 */
export default function Card({ item, onSelect, onFocus: notifyRow }) {
  const { ref, focused } = useFocusable({
    onEnterPress: () => onSelect && onSelect(item),
    onFocus: notifyRow,
  });

  const img = item.backdrop_url || item.poster_url;
  const title = item.title || item.name || '';

  return (
    <div
      ref={ref}
      onClick={() => onSelect && onSelect(item)}
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        marginRight: 16,
        flexShrink: 0,
        cursor: 'none',
      }}
    >
      <div
        style={{
          width: CARD_W,
          height: CARD_H,
          borderRadius: 9,
          overflow: 'hidden',
          backgroundColor: '#1f1f1f',
          position: 'relative',
          border: focused ? '3px solid #fff' : '3px solid transparent',
          transform: focused ? 'scale(1.06)' : 'scale(1)',
          transition: 'transform 0.15s ease, border-color 0.12s ease',
          flexShrink: 0,
        }}
      >
        {img && (
          <img
            src={img}
            alt={title}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        )}
        {focused && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="46" height="46" viewBox="0 0 24 24" fill="rgba(255,255,255,0.95)">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
            </svg>
          </div>
        )}
      </div>
      <div
        style={{
          marginTop: 5,
          fontSize: 13,
          color: focused ? '#fff' : '#999',
          fontWeight: focused ? 700 : 500,
          width: CARD_W,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          paddingLeft: 2,
          transition: 'color 0.12s ease',
        }}
      >
        {title}
      </div>
    </div>
  );
}
