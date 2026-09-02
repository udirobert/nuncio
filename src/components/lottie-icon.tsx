"use client";

import Lottie from "lottie-react";
import spinner from "../../public/lottie/spinner.json";
import spinnerLight from "../../public/lottie/spinner-light.json";
import spinnerCream from "../../public/lottie/spinner-cream.json";
import successCheck from "../../public/lottie/success-check.json";

const animations = {
  spinner,
  "spinner-light": spinnerLight,
  "spinner-cream": spinnerCream,
  "success-check": successCheck,
};

type LottieIconName = keyof typeof animations;

interface LottieIconProps {
  name: LottieIconName;
  className?: string;
  loop?: boolean;
  autoplay?: boolean;
}

export function LottieIcon({
  name,
  className,
  loop = true,
  autoplay = true,
}: LottieIconProps) {
  return (
    <Lottie
      animationData={animations[name]}
      loop={loop}
      autoplay={autoplay}
      className={className}
    />
  );
}
