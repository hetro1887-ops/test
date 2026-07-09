import React from 'react';
import Link from 'next/link';
import { Shield, Sparkles, RefreshCw, ArrowRight, Zap } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="landing-page">
      {/* Animated background */}
      <div className="landing-bg">
        <div className="landing-bg-orb landing-bg-orb-1" />
        <div className="landing-bg-orb landing-bg-orb-2" />
        <div className="landing-bg-orb landing-bg-orb-3" />
        <div className="landing-bg-grid" />
      </div>

      {/* Navigation */}
      <nav className="landing-nav animate-fade-in">
        <div className="landing-nav-brand">
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 'var(--radius-md)',
              background: 'var(--gradient-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Zap size={20} color="#0a0e1a" strokeWidth={2.5} />
          </div>
          FinanceFlow
        </div>
        <div className="landing-nav-actions">
          <Link href="/login" className="btn btn-ghost">
            Sign In
          </Link>
          <Link href="/register" className="btn btn-primary">
            Get Started
            <ArrowRight size={16} />
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="landing-hero">
        <div
          className="badge badge-primary animate-fade-in"
          style={{ marginBottom: 'var(--space-xl)', animationDelay: '100ms' }}
        >
          <Sparkles size={12} />
          Now with AI-powered insights
        </div>

        <h1 className="animate-fade-in" style={{ animationDelay: '200ms' }}>
          Your finances,{' '}
          <span className="text-gradient">beautifully organized</span>
        </h1>

        <p className="animate-fade-in" style={{ animationDelay: '300ms' }}>
          Connect your bank accounts, track spending automatically, and gain crystal-clear
          insights into your financial life. Secure, private, and stunningly designed.
        </p>

        <div className="landing-hero-actions animate-fade-in" style={{ animationDelay: '400ms' }}>
          <Link href="/register" className="btn btn-primary btn-lg">
            Start for Free
            <ArrowRight size={18} />
          </Link>
          <Link href="/login" className="btn btn-secondary btn-lg">
            Sign In
          </Link>
        </div>

        {/* Dashboard Preview Mock */}
        <div
          className="glass-card-static animate-fade-in"
          style={{
            animationDelay: '500ms',
            width: '100%',
            maxWidth: 900,
            padding: 'var(--space-2xl)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 3,
              background: 'var(--gradient-hero)',
            }}
          />
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 'var(--space-lg)',
              marginBottom: 'var(--space-xl)',
            }}
          >
            {[
              { label: 'Total Balance', value: '$47,832.50', change: '+12.5%', positive: true },
              { label: 'Monthly Income', value: '$8,420.00', change: '+3.2%', positive: true },
              { label: 'Monthly Expenses', value: '$3,214.80', change: '-8.1%', positive: true },
            ].map((stat) => (
              <div
                key={stat.label}
                style={{
                  background: 'var(--bg-glass)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-lg)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: 6 }}>
                  {stat.label}
                </div>
                <div
                  style={{
                    fontSize: '1.25rem',
                    fontWeight: 800,
                    letterSpacing: '-0.03em',
                    marginBottom: 4,
                  }}
                >
                  {stat.value}
                </div>
                <div
                  style={{
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    color: stat.positive ? 'var(--success-light)' : 'var(--danger-light)',
                  }}
                >
                  {stat.change} from last month
                </div>
              </div>
            ))}
          </div>
          {/* Mock chart bars */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: 8,
              height: 100,
              padding: '0 var(--space-lg)',
            }}
          >
            {[40, 65, 45, 80, 55, 90, 70, 85, 60, 75, 50, 95].map((h, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: `${h}%`,
                  borderRadius: '4px 4px 0 0',
                  background:
                    i === 11
                      ? 'var(--gradient-primary)'
                      : 'rgba(6, 182, 212, 0.15)',
                  transition: 'height 0.5s ease',
                }}
              />
            ))}
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 8,
              padding: '0 var(--space-lg)',
            }}
          >
            {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map(
              (m) => (
                <span
                  key={m}
                  style={{ fontSize: '0.625rem', color: 'var(--text-muted)', flex: 1, textAlign: 'center' }}
                >
                  {m}
                </span>
              )
            )}
          </div>
        </div>
      </section>

      {/* Features */}
      <section style={{ padding: 'var(--space-4xl) 0' }}>
        <div className="landing-features stagger-children">
          <div className="glass-card feature-card">
            <div
              className="feature-card-icon"
              style={{ background: 'rgba(6, 182, 212, 0.1)', color: 'var(--accent-primary)' }}
            >
              <Shield size={24} />
            </div>
            <h3>Bank-Grade Security</h3>
            <p>
              256-bit AES encryption protects your data. We never store credentials — Plaid handles
              the secure connection to your banks.
            </p>
          </div>

          <div className="glass-card feature-card">
            <div
              className="feature-card-icon"
              style={{ background: 'rgba(139, 92, 246, 0.1)', color: 'var(--accent-secondary)' }}
            >
              <Sparkles size={24} />
            </div>
            <h3>Smart Categorization</h3>
            <p>
              Transactions are automatically categorized using intelligent pattern matching. Customize
              categories to match your financial goals.
            </p>
          </div>

          <div className="glass-card feature-card">
            <div
              className="feature-card-icon"
              style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)' }}
            >
              <RefreshCw size={24} />
            </div>
            <h3>Real-Time Sync</h3>
            <p>
              Your transactions sync automatically as they happen. Webhooks keep your data fresh
              without lifting a finger.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          textAlign: 'center',
          padding: 'var(--space-3xl)',
          borderTop: '1px solid var(--border-subtle)',
          fontSize: '0.8125rem',
          color: 'var(--text-muted)',
          position: 'relative',
          zIndex: 5,
        }}
      >
        © {new Date().getFullYear()} FinanceFlow. Built with precision and care.
      </footer>
    </div>
  );
}
