"use client";
import React from 'react';
import { AccountView } from '@neondatabase/auth/react';

export default function SettingsPage() {
  return (
    <div style={{ maxWidth: '900px', width: '100%', margin: '0 0' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2.25rem', fontWeight: 800, color: '#fff', marginBottom: '0.5rem' }}>Settings</h1>
        <p style={{ color: 'var(--muted-foreground)' }}>Manage your account, authentication and preferences.</p>
      </div>
      
      <AccountView path="account" />
    </div>
  );
}
