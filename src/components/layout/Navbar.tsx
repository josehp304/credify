"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import styles from "./Navbar.module.css";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Menu, X, LogOut, User } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { authClient } from "@/lib/auth/client";

const NAV_LINKS = [
  { name: "Features", href: "/#features" },
  { name: "Trust Database", href: "/trust-database" },
  { name: "Dashboard", href: "/dashboard" },
];

function UserMenu() {
  const [open, setOpen] = useState(false);
  const { data } = authClient.useSession();
  const user = data?.user;

  const handleSignOut = async () => {
    await authClient.signOut();
    setOpen(false);
    window.location.href = "/";
  };

  const avatarUrl = user?.image;
  const initials = user?.name
    ? user.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
    : "U";

  return (
    <div className={styles.userMenuWrapper}>
      <button
        className={styles.avatarBtn}
        onClick={() => setOpen((v) => !v)}
        aria-label="User menu"
      >
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt={user?.name ?? "User"}
            width={34}
            height={34}
            className={styles.avatarImg}
          />
        ) : (
          <div className={styles.avatarFallback}>{initials}</div>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className={styles.userDropdown}
            initial={{ opacity: 0, scale: 0.95, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            <div className={styles.dropdownHeader}>
              <p className={styles.dropdownName}>{user?.name}</p>
              <p className={styles.dropdownEmail}>{user?.email}</p>
            </div>
            <div className={styles.dropdownDivider} />
            <Link href="/account/settings" className={styles.dropdownItem} onClick={() => setOpen(false)}>
              <User size={15} />
              Account Settings
            </Link>
            <button className={cn(styles.dropdownItem, styles.dropdownItemDanger)} onClick={handleSignOut}>
              <LogOut size={15} />
              Sign Out
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Backdrop to close on outside click */}
      {open && (
        <div className={styles.dropdownBackdrop} onClick={() => setOpen(false)} />
      )}
    </div>
  );
}

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hoveredPath, setHoveredPath] = useState<string | null>(null);
  const pathname = usePathname();
  const { data, isPending } = authClient.useSession();
  const isAuthenticated = !!data?.session;

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Hide Navbar on dashboard, settings, and onboarding routes
  if (pathname?.startsWith("/dashboard") || pathname?.startsWith("/account/settings") || pathname?.startsWith("/profile-setup")) {
    return null;
  }

  return (
    <header
      className={cn(
        styles.navbar,
        scrolled ? styles.navbarScrolled : styles.navbarTransparent
      )}
    >
      <div className={styles.container}>
        {/* Logo */}
        <Link href="/" className={styles.logo}>
          <Image
            src="/logo.png"
            alt="Credify"
            width={1473}
            height={271}
            priority
            className={styles.logoImg}
          />
        </Link>

        {/* Desktop Nav */}
        <nav className={styles.desktopNav} onMouseLeave={() => setHoveredPath(null)}>
          {NAV_LINKS.map((link) => (
            <Link
              key={link.name}
              href={link.href}
              onMouseEnter={() => setHoveredPath(link.href)}
              className={cn(
                styles.navLink,
                pathname === link.href && styles.activeLink
              )}
            >
              {link.name}
              {hoveredPath === link.href && (
                <motion.div
                  layoutId="navbar-hover-pill"
                  className={styles.navHoverPill}
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
            </Link>
          ))}
          <div className={styles.authGroup}>
            {isPending ? (
              <div className={styles.avatarSkeleton} />
            ) : isAuthenticated ? (
              <UserMenu />
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost" size="sm">
                    Sign In
                  </Button>
                </Link>
                <Link href="/signup">
                  <Button variant="primary" size="sm">
                    Get Started
                  </Button>
                </Link>
              </>
            )}
          </div>
        </nav>

        {/* Mobile Toggle */}
        <button
          className={styles.mobileToggle}
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Mobile Nav */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.nav
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className={styles.mobileNav}
          >
            {NAV_LINKS.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                className={cn(
                  styles.mobileNavLink,
                  pathname === link.href && styles.activeLink
                )}
                onClick={() => setMobileOpen(false)}
              >
                {link.name}
              </Link>
            ))}
            <div className={styles.mobileNavAction}>
              {isPending ? (
                <div className={styles.avatarSkeleton} style={{ width: "100%", height: 40 }} />
              ) : isAuthenticated ? (
                <UserMenu />
              ) : (
                <>
                  <Link href="/login" onClick={() => setMobileOpen(false)}>
                    <Button variant="outline" className="w-full" style={{ marginBottom: "1rem" }}>
                      Sign In
                    </Button>
                  </Link>
                  <Link href="/signup" onClick={() => setMobileOpen(false)}>
                    <Button variant="primary" className="w-full">
                      Get Started
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
