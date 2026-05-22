"use client";

import { useEffect, useRef } from "react";
import type { RefObject } from "react";

interface DuckingAudioProps {
  soundscapeUrl: string;
  videoRef: RefObject<HTMLVideoElement | null>;
}

const DUCKED_VOLUME = 0.08;
const AMBIENT_VOLUME = 0.25;

export function DuckingAudio({ soundscapeUrl, videoRef }: DuckingAudioProps) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);

  useEffect(() => {
    async function init() {
      if (!soundscapeUrl) return;

      const ac = new AudioContext();
      audioContextRef.current = ac;

      const resp = await fetch(soundscapeUrl);
      const raw = await resp.arrayBuffer();
      const buffer = await ac.decodeAudioData(raw);

      const gain = ac.createGain();
      gain.gain.value = AMBIENT_VOLUME;
      gain.connect(ac.destination);
      gainRef.current = gain;

      const source = ac.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(gain);
      source.start();
      sourceRef.current = source;
    }

    init();

    return () => {
      if (sourceRef.current) {
        try { sourceRef.current.stop(); } catch {}
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [soundscapeUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !gainRef.current) return;

    let duckTimeout: ReturnType<typeof setTimeout> | undefined;

    function onPlay() {
      if (duckTimeout) clearTimeout(duckTimeout);
      if (gainRef.current) {
        gainRef.current.gain.linearRampToValueAtTime(
          DUCKED_VOLUME,
          audioContextRef.current!.currentTime + 0.3
        );
      }
    }

    function onPause() {
      duckTimeout = setTimeout(() => {
        if (gainRef.current) {
          gainRef.current.gain.linearRampToValueAtTime(
            AMBIENT_VOLUME,
            audioContextRef.current!.currentTime + 0.5
          );
        }
      }, 500);
    }

    function onEnded() {
      if (duckTimeout) clearTimeout(duckTimeout);
      if (gainRef.current) {
        gainRef.current.gain.linearRampToValueAtTime(
          AMBIENT_VOLUME,
          audioContextRef.current!.currentTime + 0.5
        );
      }
    }

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onEnded);

    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onEnded);
      if (duckTimeout) clearTimeout(duckTimeout);
    };
  }, [videoRef]);

  return null;
}
