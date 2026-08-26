"use client";

import { useEffect, useState } from "react";

export function ScrollTurningLine() {
  const [isHorizontal, setIsHorizontal] = useState(false);

  useEffect(() => {
    let previousScrollY = window.scrollY;
    let frame = 0;

    const handleScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        const nextScrollY = window.scrollY;
        if (Math.abs(nextScrollY - previousScrollY) > 1) {
          setIsHorizontal(nextScrollY > previousScrollY);
          previousScrollY = nextScrollY;
        }
        frame = 0;
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <span
      className={`returning-scroll-line${isHorizontal ? " is-horizontal" : ""}`}
      aria-hidden="true"
    />
  );
}
