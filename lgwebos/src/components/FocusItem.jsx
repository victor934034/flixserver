import React from 'react';
import { useFocusable } from '@noriginmedia/norigin-spatial-navigation';

/**
 * FocusItem — generic focusable wrapper.
 * Renders as a <div> (or any `as` tag) with spatial-nav focus support.
 * When focused: applies white 3px border + scale(1.06).
 *
 * Props:
 *   onEnterPress   — called when Enter/OK is pressed while focused
 *   onClick        — called on mouse click (dev mode)
 *   focusKey       — optional stable focus key
 *   style          — base style object
 *   focusedStyle   — additional style when focused (merged with base)
 *   as             — element tag (default 'div')
 *   children       — content
 *   onFocus        — called when this item gains focus (receives {x,y,width,height,left,top})
 *   onBlur         — called when this item loses focus
 */
const FocusItem = React.forwardRef(function FocusItem(
  {
    onEnterPress,
    onClick,
    focusKey: fk,
    style = {},
    focusedStyle = {},
    as: Tag = 'div',
    children,
    onFocus: onFocusProp,
    onBlur: onBlurProp,
    ...rest
  },
  outerRef
) {
  const { ref, focused } = useFocusable({
    focusKey: fk,
    onEnterPress,
    onFocus: onFocusProp,
    onBlur: onBlurProp,
  });

  // Merge refs
  const mergedRef = (el) => {
    ref.current = el;
    if (typeof outerRef === 'function') outerRef(el);
    else if (outerRef) outerRef.current = el;
  };

  const computedStyle = {
    transition: 'transform 0.15s ease, border-color 0.12s ease',
    cursor: 'none',
    ...style,
    ...(focused ? { border: '3px solid #fff', transform: 'scale(1.06)', ...focusedStyle } : {}),
  };

  return (
    <Tag
      ref={mergedRef}
      style={computedStyle}
      onClick={onClick || onEnterPress}
      {...rest}
    >
      {children}
    </Tag>
  );
});

export default FocusItem;
