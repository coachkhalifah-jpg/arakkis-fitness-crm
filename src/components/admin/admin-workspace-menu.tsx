"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import gsap from "gsap";
import CustomEase from "gsap/CustomEase";
import { DisclosureToggle } from "@/components/ui/disclosure-toggle";
import {
  isAdminWorkspaceItemActive,
  type AdminWorkspaceMenuItem,
} from "@/components/admin/admin-workspace-menu-items";

if (typeof window !== "undefined") {
  gsap.registerPlugin(CustomEase);
  if (!gsap.parseEase("hop")) CustomEase.create("hop", ".15, 1, .25, 1");
}

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function overlayTargets(overlay: HTMLDivElement | null, selector: string) {
  return overlay?.querySelectorAll(selector) ?? [];
}

export function AdminWorkspaceMenu({
  items,
  roleLabel = "Admin",
  scopeLabel = "",
  signOutAction,
}: {
  items: AdminWorkspaceMenuItem[];
  roleLabel?: string;
  scopeLabel?: string;
  signOutAction?: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [animating, setAnimating] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const navRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const navBrandRef = useRef<HTMLAnchorElement>(null);
  const overlayBrandRef = useRef<HTMLAnchorElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const firstItemRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!overlayRef.current) return;
    gsap.set(overlayRef.current, {
      clipPath: "polygon(0% 100%, 100% 100%, 100% 100%, 0% 100%)",
      pointerEvents: "none",
    });
    gsap.set([overlayBrandRef.current, closeRef.current].filter(Boolean), { y: "100%" });
    gsap.set(
      overlayTargets(overlayRef.current, ".ops-template-menu-items .ops-template-revealer a"),
      {
        y: "100%",
      },
    );
    gsap.set(
      overlayTargets(
        overlayRef.current,
        ".ops-template-menu-footer .ops-template-revealer span, .ops-template-menu-footer .ops-template-revealer button",
      ),
      { y: "100%" },
    );
  }, []);

  const openMenu = () => {
    if (animating || open || !overlayRef.current) return;
    setAnimating(true);
    if (prefersReducedMotion()) {
      gsap.set(overlayRef.current, {
        clipPath: "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)",
        pointerEvents: "all",
      });
      gsap.set([navBrandRef.current, triggerRef.current].filter(Boolean), { y: "100%" });
      gsap.set([overlayBrandRef.current, closeRef.current].filter(Boolean), { y: "0%" });
      gsap.set(
        overlayTargets(overlayRef.current, ".ops-template-menu-items .ops-template-revealer a"),
        {
          y: "0%",
        },
      );
      gsap.set(
        overlayTargets(
          overlayRef.current,
          ".ops-template-menu-footer .ops-template-revealer span, .ops-template-menu-footer .ops-template-revealer button",
        ),
        { y: "0%" },
      );
      if (navRef.current) navRef.current.style.pointerEvents = "none";
      setOpen(true);
      setAnimating(false);
      firstItemRef.current?.focus();
      return;
    }
    const timeline = gsap.timeline({
      onComplete: () => {
        setOpen(true);
        setAnimating(false);
        firstItemRef.current?.focus();
      },
    });
    timeline.to([navBrandRef.current, triggerRef.current].filter(Boolean), {
      y: "-100%",
      duration: 0.5,
      stagger: 0.1,
      ease: "power3.out",
      onComplete: () => {
        if (navRef.current) navRef.current.style.pointerEvents = "none";
        gsap.set([navBrandRef.current, triggerRef.current].filter(Boolean), { y: "100%" });
      },
    });
    timeline.to(
      overlayRef.current,
      {
        clipPath: "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)",
        duration: 1,
        ease: "hop",
        onStart: () => {
          if (overlayRef.current) overlayRef.current.style.pointerEvents = "all";
        },
      },
      "-=.55",
    );
    timeline.to(
      [overlayBrandRef.current, closeRef.current].filter(Boolean),
      { y: "0%", duration: 1, stagger: 0.1, ease: "power3.out" },
      "-=.5",
    );
    timeline.to(
      overlayTargets(overlayRef.current, ".ops-template-menu-items .ops-template-revealer a"),
      { y: "0%", duration: 1, stagger: 0.075, ease: "power3.out" },
      "<",
    );
    timeline.to(
      overlayTargets(
        overlayRef.current,
        ".ops-template-menu-footer .ops-template-revealer span, .ops-template-menu-footer .ops-template-revealer button",
      ),
      { y: "0%", duration: 1, stagger: 0.1, ease: "power3.out" },
      "<",
    );
  };

  const closeMenu = useCallback(() => {
    if (animating || !open || !overlayRef.current) return;
    gsap.killTweensOf(overlayRef.current);
    gsap.killTweensOf(
      [overlayBrandRef.current, closeRef.current, navBrandRef.current, triggerRef.current].filter(
        Boolean,
      ),
    );
    setAnimating(true);
    if (prefersReducedMotion()) {
      gsap.set(overlayRef.current, {
        clipPath: "polygon(0% 100%, 100% 100%, 100% 100%, 0% 100%)",
        pointerEvents: "none",
      });
      gsap.set([navBrandRef.current, triggerRef.current].filter(Boolean), { y: "0%" });
      gsap.set([overlayBrandRef.current, closeRef.current].filter(Boolean), { y: "100%" });
      gsap.set(
        overlayTargets(overlayRef.current, ".ops-template-menu-items .ops-template-revealer a"),
        {
          y: "100%",
        },
      );
      gsap.set(
        overlayTargets(
          overlayRef.current,
          ".ops-template-menu-footer .ops-template-revealer span, .ops-template-menu-footer .ops-template-revealer button",
        ),
        { y: "100%" },
      );
      if (navRef.current) navRef.current.style.pointerEvents = "all";
      setOpen(false);
      setAnimating(false);
      triggerRef.current?.focus();
      return;
    }
    const timeline = gsap.timeline({
      onComplete: () => {
        setOpen(false);
        setAnimating(false);
        triggerRef.current?.focus();
      },
    });
    timeline.to([overlayBrandRef.current, closeRef.current].filter(Boolean), {
      y: "-100%",
      duration: 0.5,
      stagger: 0.1,
      ease: "power3.out",
    });
    timeline.to(
      overlayTargets(overlayRef.current, ".ops-template-menu-items .ops-template-revealer a"),
      { y: "-100%", duration: 0.5, stagger: 0.05, ease: "power3.in" },
      "<",
    );
    timeline.to(
      overlayTargets(
        overlayRef.current,
        ".ops-template-menu-footer .ops-template-revealer span, .ops-template-menu-footer .ops-template-revealer button",
      ),
      { y: "-100%", duration: 0.5, stagger: 0.05, ease: "power3.in" },
      "<",
    );
    timeline.to(
      overlayRef.current,
      {
        clipPath: "polygon(0% 0%, 100% 0%, 100% 0%, 0% 0%)",
        duration: 1,
        ease: "hop",
        onComplete: () => {
          if (overlayRef.current) overlayRef.current.style.pointerEvents = "none";
          if (navRef.current) navRef.current.style.pointerEvents = "all";
          gsap.set(overlayRef.current, {
            clipPath: "polygon(0% 100%, 100% 100%, 100% 100%, 0% 100%)",
          });
          gsap.set([overlayBrandRef.current, closeRef.current].filter(Boolean), { y: "100%" });
          gsap.set(
            overlayTargets(overlayRef.current, ".ops-template-menu-items .ops-template-revealer a"),
            {
              y: "100%",
            },
          );
          gsap.set(
            overlayTargets(
              overlayRef.current,
              ".ops-template-menu-footer .ops-template-revealer span, .ops-template-menu-footer .ops-template-revealer button",
            ),
            { y: "100%" },
          );
        },
      },
      "+=.25",
    );
    timeline.to(
      [navBrandRef.current, triggerRef.current].filter(Boolean),
      { y: "0%", duration: 0.5, stagger: 0.1, ease: "power3.out" },
      "-=.35",
    );
  }, [animating, open]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && open && !animating) closeMenu();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [animating, open, closeMenu]);

  const navigateTo = (href: string, event: React.MouseEvent<HTMLAnchorElement>) => {
    if (animating) {
      event.preventDefault();
      return;
    }
    event.preventDefault();
    closeMenu();
    if (pathname === href.split("?")[0]) return;
    window.setTimeout(() => router.push(href), 750);
  };

  return (
    <div className="ops-template-menu">
      <div className="ops-template-nav" ref={navRef}>
        <div className="ops-template-nav-brand">
          <div className="ops-template-revealer">
            <Link href="/admin" ref={navBrandRef}>
              Arakkis / Ops
            </Link>
          </div>
        </div>
        <div className="ops-template-nav-items">
          <div className="ops-template-menu-trigger">
            <div className="ops-template-revealer">
              <DisclosureToggle
                ref={triggerRef}
                aria-label={open ? "Close operations menu" : "Open operations menu"}
                expanded={open}
                controls="admin-operations-menu"
                onClick={open ? closeMenu : openMenu}
              >
                Menu
              </DisclosureToggle>
            </div>
          </div>
        </div>
      </div>
      <div
        id="admin-operations-menu"
        ref={overlayRef}
        className="ops-template-overlay"
        role={open ? "dialog" : undefined}
        aria-modal="true"
        aria-label="Operations menu"
        aria-hidden={!open}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeMenu();
        }}
      >
        <div className="ops-template-overlay-nav">
          <div className="ops-template-overlay-brand">
            <div className="ops-template-revealer">
              <Link
                href="/admin"
                ref={overlayBrandRef}
                tabIndex={open ? 0 : -1}
                onClick={(event) => navigateTo("/admin", event)}
              >
                Arakkis / Ops
              </Link>
            </div>
          </div>
          <div className="ops-template-overlay-close">
            <div className="ops-template-revealer">
              <button
                className="admin-workspace-menu-close"
                ref={closeRef}
                type="button"
                tabIndex={open ? 0 : -1}
                onClick={closeMenu}
              >
                Close
              </button>
            </div>
          </div>
        </div>
        <nav className="ops-template-menu-items" aria-label="Operations menu links">
          {items.map((item, index) => (
            <div className="ops-template-revealer" key={item.href}>
              <Link
                ref={index === 0 ? firstItemRef : undefined}
                href={item.href}
                download={item.download}
                tabIndex={open ? 0 : -1}
                className={
                  isAdminWorkspaceItemActive(pathname, item.href) ? "is-active" : undefined
                }
                onClick={(event) => navigateTo(item.href, event)}
              >
                {item.label}
              </Link>
            </div>
          ))}
        </nav>
        <div className="ops-template-menu-footer">
          <div className="ops-template-menu-footer-col">
            <div className="ops-template-revealer">
              <span>{roleLabel}</span>
            </div>
          </div>
          <div className="ops-template-menu-footer-col">
            <div className="ops-template-revealer">
              <span>{scopeLabel}</span>
            </div>
          </div>
          {signOutAction ? (
            <div className="ops-template-menu-footer-col ops-template-menu-footer-action">
              <div className="ops-template-revealer">
                <form action={signOutAction}>
                  <button className="ops-template-signout" type="submit">
                    Sign out
                  </button>
                </form>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
