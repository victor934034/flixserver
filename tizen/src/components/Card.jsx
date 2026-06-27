import React from 'react';

const W = 200;
const H = 112;

// React.memo prevents re-render when parent state changes but this card's props didn't
const Card = React.memo(function Card({ item, focused, onSelect, cardRef }) {
  const img   = item.backdrop_url || item.poster_url;
  const title = item.title || item.name || '';

  return (
    <div
      ref={cardRef}
      onClick={() => onSelect && onSelect(item)}
      style={{
        display: 'inline-flex', flexDirection: 'column',
        marginRight: 14, flexShrink: 0, cursor: 'none',
        // will-change only on focused card to hint compositor
        willChange: focused ? 'transform' : 'auto',
        transform: focused ? 'scale(1.06)' : 'scale(1)',
      }}
    >
      <div style={{
        width: W, height: H,
        borderRadius: 8, overflow: 'hidden',
        backgroundColor: '#1f1f1f', position: 'relative',
        border: focused ? '3px solid #fff' : '3px solid transparent',
        // No transition — instant focus change is faster on LG WebOS
      }}>
        {img && (
          <img
            src={img}
            alt=""
            loading="lazy"
            decoding="async"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        )}
        {focused && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(0,0,0,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: 'rgba(255,255,255,0.88)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{ width: 0, height: 0, borderStyle: 'solid', borderWidth: '8px 0 8px 16px', borderColor: 'transparent transparent transparent #000', marginLeft: 3 }} />
            </div>
          </div>
        )}
      </div>
      <div style={{
        marginTop: 5, fontSize: 12,
        color: focused ? '#fff' : '#888',
        fontWeight: focused ? 700 : 400,
        width: W, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {title}
      </div>
    </div>
  );
});

export default Card;
