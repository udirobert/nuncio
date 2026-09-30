export function detachUnsubscribedTrack(
  track: { detach: () => HTMLMediaElement | HTMLMediaElement[] },
  keep: HTMLMediaElement | null,
): void {
  const detached = track.detach();
  const elements = Array.isArray(detached) ? detached : [detached];
  for (const element of elements) {
    if (element !== keep) element.remove();
  }
}
