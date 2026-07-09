'use client';

import React, { useState, useRef, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Send, Bot, User as UserIcon, Loader2, Sparkles, HelpCircle } from 'lucide-react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export default function CopilotPage() {
  const [message, setMessage] = useState('');
  const [history, setHistory] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: `Hello! I am your FinanceFlow AI Copilot. I can inspect your transaction histories, simulate cash flow projections, and handle your subscriptions.

What can I help you check today?`,
    },
  ]);
  const [suggestedActions, setSuggestedActions] = useState<string[]>([
    'Show my transactions',
    'What is my 90-day forecast?',
    'List active subscriptions',
  ]);

  const chatEndRef = useRef<HTMLDivElement>(null);
  
  // scroll chat to bottom
  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [history]);

  // tRPC send message mutation
  const sendMutation = trpc.chat.send.useMutation({
    onSuccess: (data) => {
      setHistory((prev) => [
        ...prev,
        { role: 'assistant', content: data.reply },
      ]);
      if (data.suggestedActions) {
        setSuggestedActions(data.suggestedActions);
      } else {
        setSuggestedActions([]);
      }
    },
    onError: (err) => {
      setHistory((prev) => [
        ...prev,
        { role: 'assistant', content: `Sorry, I encountered an error: ${err.message}` },
      ]);
    },
  });

  const handleSend = async (textToSend?: string) => {
    const rawText = textToSend || message;
    if (!rawText.trim()) return;

    if (!textToSend) setMessage('');

    // Append user message
    setHistory((prev) => [...prev, { role: 'user', content: rawText }]);

    // Trigger API call
    sendMutation.mutate({
      message: rawText,
      history: history,
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 120px)',
        width: '100%',
        maxWidth: '800px',
        margin: '0 auto',
        gap: 'var(--space-md)',
      }}
    >
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={24} className="text-gradient-primary" />
          AI Copilot
        </h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>
          Chat with your personal AI analyst to manage your accounts and run simulations
        </p>
      </div>

      {/* Chat Messages Card */}
      <Card
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          padding: 0,
          background: 'var(--bg-card)',
          border: '1px solid var(--border-default)',
        }}
      >
        {/* Messages Body */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 'var(--space-xl)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-lg)',
          }}
        >
          {history.map((msg, index) => {
            const isBot = msg.role === 'assistant';
            return (
              <div
                key={index}
                style={{
                  display: 'flex',
                  gap: 'var(--space-md)',
                  alignItems: 'flex-start',
                  justifyContent: isBot ? 'flex-start' : 'flex-end',
                  width: '100%',
                }}
              >
                {isBot && (
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: 'var(--gradient-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Bot size={16} color="var(--bg-primary)" />
                  </div>
                )}

                <div
                  style={{
                    maxWidth: '80%',
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-lg)',
                    fontSize: '0.9rem',
                    lineHeight: '1.5',
                    whiteSpace: 'pre-wrap',
                    background: isBot ? 'var(--bg-glass-strong)' : 'var(--gradient-primary)',
                    color: isBot ? 'var(--text-primary)' : 'var(--text-inverse)',
                    border: isBot ? '1px solid var(--border-subtle)' : 'none',
                    borderTopLeftRadius: isBot ? '0' : 'var(--radius-lg)',
                    borderTopRightRadius: isBot ? 'var(--radius-lg)' : '0',
                  }}
                >
                  {msg.content}
                </div>

                {!isBot && (
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: 'var(--gradient-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <UserIcon size={16} color="var(--text-primary)" />
                  </div>
                )}
              </div>
            );
          })}
          {sendMutation.isPending && (
            <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'center' }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: 'var(--bg-glass-strong)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Loader2 size={16} className="animate-spin text-gradient-primary" />
              </div>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>Thinking...</span>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Suggestion Chips */}
        {suggestedActions.length > 0 && (
          <div
            style={{
              display: 'flex',
              gap: 'var(--space-sm)',
              padding: 'var(--space-md) var(--space-xl)',
              overflowX: 'auto',
              borderTop: '1px solid var(--border-subtle)',
              background: 'rgba(0,0,0,0.1)',
            }}
          >
            {suggestedActions.map((action, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(action)}
                disabled={sendMutation.isPending}
                style={{
                  padding: '6px 12px',
                  background: 'var(--bg-glass-strong)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '0.75rem',
                  color: 'var(--accent-primary-light)',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                }}
                className="suggestion-chip"
              >
                {action}
              </button>
            ))}
          </div>
        )}

        {/* Message Input Box */}
        <div
          style={{
            padding: 'var(--space-md) var(--space-xl)',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            gap: 'var(--space-md)',
            alignItems: 'center',
            background: 'var(--bg-secondary)',
          }}
        >
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Type a message or request a simulation..."
            disabled={sendMutation.isPending}
            style={{ flex: 1 }}
          />
          <Button
            onClick={() => handleSend()}
            disabled={sendMutation.isPending || !message.trim()}
            variant="primary"
            style={{ padding: '10px', height: '42px', width: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <Send size={18} />
          </Button>
        </div>
      </Card>
    </div>
  );
}
