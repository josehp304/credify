"use client";
import React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import styles from "./Sidebar.module.css";
import {
  LayoutDashboard,
  Settings,
  LifeBuoy,
  LogOut,
  ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { authClient } from "@/lib/auth/client";

const NAV_ITEMS = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
  { label: "Support", href: "/dashboard/support", icon: LifeBuoy },
];

export function Sidebar({ isOpen, onClose }: { isOpen?: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const { data: session } = authClient.useSession();

  const userName = session?.user?.name || "User";
  const userEmail = session?.user?.email || "";
  const initials = userName.substring(0, 2).toUpperCase();

  return (
    <>
      <div 
        className={cn(styles.mobileOverlay, isOpen && styles.open)} 
        onClick={onClose} 
      />
      <aside className={cn(styles.sidebar, isOpen && styles.open)}>
        <Link href="/" className={styles.logoArea} style={{ textDecoration: 'none', color: 'inherit' }} onClick={onClose}>
          <Image
            src="/logo.png"
            alt="Credify"
            width={1473}
            height={271}
            className={styles.logoImg}
          />
        </Link>

        <nav className={styles.navSection}>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={cn(styles.navItem, isActive && styles.activeNavItem)}
                onClick={onClose}
              >
              <Icon className={styles.navIcon} />
              <span>{item.label}</span>
              {isActive && <ChevronRight size={16} style={{ marginLeft: 'auto' }} />}
            </Link>
          );
        })}
      </nav>

      <div className={styles.footer}>
        <div className={styles.profileCard}>
          <div className={styles.avatar}>
            {session?.user?.image ? (
              <img 
                src={session.user.image} 
                alt={userName} 
                style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} 
              />
            ) : (
              initials
            )}
          </div>
          <div className={styles.profileInfo}>
            <p className={styles.profileName}>{userName}</p>
            <p className={styles.profileEmail}>{userEmail}</p>
          </div>
        </div>
        
        <Link href="/login" className={styles.logoutBtn}>
          <LogOut size={16} />
          <span>Sign Out</span>
        </Link>
      </div>
    </aside>
    </>
  );
}
