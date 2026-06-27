import React from 'react';

// Simple focusable wrapper — no external library.
// Pass `focused` prop to highlight the item.
const FocusItem = React.forwardRef(function FocusItem(
  { focused, style = {}, focusedStyle = {}, children, onClick, ...rest },
  ref
) {
  return (
    <div
      ref={ref}
      onClick={onClick}
      style={{
        cursor: 'none',
        transition: 'transform 0.15s ease, border-color 0.12s ease, background 0.12s ease',
        ...style,
        ...(focused ? focusedStyle : {}),
      }}
      {...rest}
    >
      {children}
    </div>
  );
});

export default FocusItem;
