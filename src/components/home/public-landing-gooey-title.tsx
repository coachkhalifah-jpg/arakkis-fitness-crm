"use client";

import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
  gsap.registerPlugin(SplitText, ScrollTrigger);
}

export function PublicLandingGooeyTitle() {
  const rootRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const title = titleRef.current;

    if (!root || !title) return;

    let split: SplitText | null = null;
    let trigger: ScrollTrigger | null = null;

    const context = gsap.context(() => {
      if (
        typeof window.matchMedia !== "function" ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      )
        return;

      split = SplitText.create(title, {
        type: "lines",
        linesClass: "home-gooey-line",
      });

      const blurLayers = split.lines.map((line) => {
        const inner = document.createElement("span");
        inner.className = "home-gooey-line-inner";

        while (line.firstChild) {
          inner.appendChild(line.firstChild);
        }

        line.appendChild(inner);
        return inner;
      });

      const tween = gsap.to(blurLayers, {
        filter: "blur(0em)",
        duration: 1.35,
        ease: "power3.out",
        stagger: 0.1,
        paused: true,
      });

      gsap.set(blurLayers, { filter: "blur(0.35em)" });

      trigger = ScrollTrigger.create({
        animation: tween,
        once: true,
        start: "top 85%",
        trigger: title,
      });
    }, root);

    return () => {
      trigger?.kill();
      split?.revert();
      context.revert();
    };
  }, []);

  return (
    <div ref={rootRef} className="home-gooey-title">
      <h1 id="home-title" ref={titleRef} className="home-title">
        Meet
        <br />
        <em>with</em>
        <br />
        purpose.
      </h1>
      <svg aria-hidden="true" className="home-gooey-filter" focusable="false" viewBox="0 0 0 0">
        <defs>
          <filter id="home-gooey-blur-matrix" x="-50%" y="-50%" width="200%" height="200%">
            <feColorMatrix
              in="SourceGraphic"
              type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 255 -140"
            />
          </filter>
        </defs>
      </svg>
    </div>
  );
}
