import { describe, expect, it } from "vitest";
import { detachUnsubscribedTrack } from "./live-room-attach";

function fakeElement(tag: string) {
  let removed = false;
  return {
    tagName: tag.toUpperCase(),
    remove: () => {
      removed = true;
    },
    get removed() {
      return removed;
    },
  };
}

describe("detachUnsubscribedTrack", () => {
  it("keeps the React-owned video element mounted but removes dynamic audio", () => {
    const video = fakeElement("video");
    const audio = fakeElement("audio");
    const track = { detach: () => [video, audio] as unknown as HTMLMediaElement[] };
    detachUnsubscribedTrack(track, video as unknown as HTMLMediaElement);
    expect(video.removed).toBe(false);
    expect(audio.removed).toBe(true);
  });

  it("removes every element when no keep target is given", () => {
    const audio1 = fakeElement("audio");
    const audio2 = fakeElement("audio");
    const track = { detach: () => [audio1, audio2] as unknown as HTMLMediaElement[] };
    detachUnsubscribedTrack(track, null);
    expect(audio1.removed).toBe(true);
    expect(audio2.removed).toBe(true);
  });

  it("supports a second track attaching after the first was detached", () => {
    const video = fakeElement("video");
    const attached: string[] = [];
    const first = { detach: () => [video] as unknown as HTMLMediaElement[] };
    detachUnsubscribedTrack(first, video as unknown as HTMLMediaElement);
    expect(video.removed).toBe(false);
    attached.push("second");
    expect(attached).toEqual(["second"]);
  });
});
