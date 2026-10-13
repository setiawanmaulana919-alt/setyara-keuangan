"use client";

import { useRef } from "react";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";

function isInteractiveTarget(target: EventTarget | null): boolean {
  return (
    target instanceof globalThis.Element &&
    Boolean(target.closest("button, input, textarea, select, a"))
  );
}

export function SwipeableCard({
  as = "div",
  className,
  onSwipeLeft,
  onSwipeRight,
  children,
}: {
  as?: "article" | "div";
  className: string;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  children: ReactNode;
}) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const TagName = as;

  function handlePointerDown(event: ReactPointerEvent<HTMLElement>) {
    if (
      (event.pointerType === "mouse" && event.button !== 0) ||
      isInteractiveTarget(event.target)
    ) {
      start.current = null;
      return;
    }
    start.current = { x: event.clientX, y: event.clientY };
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLElement>) {
    const initialPoint = start.current;
    start.current = null;
    if (!initialPoint || isInteractiveTarget(event.target)) return;

    const horizontalDistance = event.clientX - initialPoint.x;
    const verticalDistance = event.clientY - initialPoint.y;
    if (
      Math.abs(horizontalDistance) < 50 ||
      Math.abs(verticalDistance) > Math.abs(horizontalDistance)
    ) {
      return;
    }

    if (horizontalDistance < 0) onSwipeLeft();
    else onSwipeRight();
  }

  return (
    <TagName
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => {
        start.current = null;
      }}
      className={className}
    >
      {children}
    </TagName>
  );
}
