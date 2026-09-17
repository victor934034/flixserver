import { Image as ExpoImage } from 'expo-image';

// Drop-in replacement for RN's <Image> that actually caches to disk.
// RN's own Image only keeps a small, unreliable in-memory/OkHttp cache -
// on a flaky connection (or offline entirely) posters/thumbnails/avatars
// that loaded fine a minute ago would go black again. expo-image caches
// to disk by default, so anything already seen once keeps showing even
// with no network.
//
// Accepts the same `resizeMode` prop RN's Image uses (mapped to
// expo-image's `contentFit`) so most call sites just need the import
// swapped, no other prop changes.
export default function CachedImage({ resizeMode, style, source, ...rest }) {
  return (
    <ExpoImage
      source={source}
      style={style}
      contentFit={resizeMode || 'cover'}
      cachePolicy="disk"
      transition={150}
      {...rest}
    />
  );
}
