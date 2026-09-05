"use client";
import React from 'react';
import { AccountView } from '@neondatabase/auth/react';

export default function SettingsPage() {
  return (
    <div style={{ maxWidth: '900px', width: '100%', margin: '0 0' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--foreground)', marginBottom: '0.4rem' }}>Settings</h1>
        <p style={{ color: 'var(--muted-foreground)' }}>Manage your account, authentication and preferences.</p>
      </div>
      
      <AccountView path="account" />
    </div>
  );
}
