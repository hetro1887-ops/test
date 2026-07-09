'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import {
  LayoutDashboard,
  ArrowUpDown,
  CreditCard,
  Settings,
  LogOut,
  User as UserIcon,
  Menu,
  X,
  Zap,
  Sparkles,
  PiggyBank,
  RefreshCw,
} from 'lucide-react';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, status } = useSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Redirect if not authenticated (next-auth should handle, but just in case)
  React.useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div style={{ display: 'flex', height: '100vh', width: '100vw', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-primary)' }}>
        <div className="loading-spinner" />
      </div>
    );
  }

  if (!session) return null;

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Transactions', href: '/transactions', icon: ArrowUpDown },
    { name: 'Accounts', href: '/accounts', icon: CreditCard },
    { name: 'Subscriptions', href: '/subscriptions', icon: RefreshCw },
    { name: 'Savings & Transfers', href: '/savings', icon: PiggyBank },
    { name: 'AI Copilot', href: '/copilot', icon: Sparkles },
  ];

  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/' });
  };

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        backgroundColor: 'var(--bg-primary)',
        position: 'relative',
      }}
    >
      {/* Background gradients */}
      <div className="landing-bg" style={{ opacity: 0.4 }}>
        <div className="landing-bg-orb landing-bg-orb-1" style={{ width: '40vw', height: '40vw' }} />
        <div className="landing-bg-orb landing-bg-orb-2" style={{ width: '30vw', height: '30vw', right: '10%' }} />
      </div>

      {/* Mobile Top Bar */}
      <header
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 64,
          background: 'var(--bg-sidebar)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'none', // Overridden by media queries in layout css
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 var(--space-lg)',
          zIndex: 10,
        }}
        className="mobile-header"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
          <Zap size={20} className="text-gradient-primary" />
          FinanceFlow
        </div>
        <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ color: 'var(--text-primary)' }}>
          {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </header>

      {/* Sidebar Navigation */}
      <aside
        style={{
          width: 'var(--sidebar-width)',
          height: '100%',
          background: 'var(--bg-sidebar)',
          borderRight: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 'var(--space-xl) var(--space-md)',
          zIndex: 15,
          transition: 'transform var(--transition-base)',
        }}
        className={`sidebar ${sidebarOpen ? 'open' : ''}`}
      >
        <div>
          {/* Logo */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              fontWeight: 800,
              fontSize: '1.25rem',
              padding: '0 var(--space-md)',
              marginBottom: 'var(--space-3xl)',
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 'var(--radius-sm)',
                background: 'var(--gradient-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Zap size={18} color="#0a0e1a" strokeWidth={2.5} />
            </div>
            FinanceFlow
          </div>

          {/* Navigation Links */}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: 'var(--space-md)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.9rem',
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                    background: isActive ? 'var(--bg-glass-strong)' : 'transparent',
                    border: isActive ? '1px solid var(--border-default)' : '1px solid transparent',
                    transition: 'all var(--transition-fast)',
                  }}
                  className="nav-link"
                  onClick={() => setSidebarOpen(false)}
                >
                  <Icon size={18} style={{ color: isActive ? 'var(--accent-primary-light)' : 'inherit' }} />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer User Info / Sign Out */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-lg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '0 var(--space-md)' }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: 'var(--gradient-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <UserIcon size={16} color="var(--text-primary)" />
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontWeight: 600, fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {session.user?.name || 'User'}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {session.user?.email}
              </div>
            </div>
          </div>

          <button
            onClick={handleSignOut}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: 'var(--space-md)',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.9rem',
              fontWeight: 500,
              color: 'var(--danger)',
              width: '100%',
              textAlign: 'left',
              transition: 'background var(--transition-fast)',
            }}
            className="sign-out-btn"
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main
        style={{
          flex: 1,
          height: '100%',
          overflowY: 'auto',
          padding: 'var(--space-2xl)',
          position: 'relative',
        }}
        className="main-content"
      >
        {children}
      </main>
    </div>
  );
}
