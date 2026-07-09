import { useState, useCallback } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { trpc } from '@/lib/trpc';

interface UsePlaidOptions {
  onSuccess?: () => void;
  onExit?: () => void;
}

export function usePlaid({ onSuccess, onExit }: UsePlaidOptions = {}) {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // tRPC mutations
  const createLinkTokenMutation = trpc.plaid.createLinkToken.useMutation();
  const exchangePublicTokenMutation = trpc.plaid.exchangePublicToken.useMutation();

  const openPlaidLink = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await createLinkTokenMutation.mutateAsync({});
      setToken(response.linkToken);
    } catch (err: any) {
      console.error('Failed to create link token:', err);
      setError(err.message || 'Failed to initiate bank connection.');
      setLoading(false);
    }
  }, [createLinkTokenMutation]);

  const handlePlaidSuccess = useCallback(
    async (publicToken: string, metadata: any) => {
      setLoading(true);
      try {
        await exchangePublicTokenMutation.mutateAsync({
          publicToken,
          institutionId: metadata.institution?.institution_id || 'unknown',
          institutionName: metadata.institution?.name || 'Bank',
        });
        setLoading(false);
        if (onSuccess) onSuccess();
      } catch (err: any) {
        console.error('Failed to exchange public token:', err);
        setError(err.message || 'Failed to link account.');
        setLoading(false);
      }
    },
    [exchangePublicTokenMutation, onSuccess]
  );

  const config: Parameters<typeof usePlaidLink>[0] = {
    token,
    onSuccess: handlePlaidSuccess,
    onExit: (err, metadata) => {
      setLoading(false);
      setToken(null);
      if (err) {
        console.error('Plaid Link Exit Error:', err);
        setError(err.message || 'Bank connection exited.');
      }
      if (onExit) onExit();
    },
  };

  const { open, ready } = usePlaidLink(config);

  // Automatically trigger Plaid link when token is successfully fetched
  useState(() => {
    if (token && ready) {
      open();
    }
  });

  // Effect to open Link as soon as the token is generated
  useState(() => {
    if (token) {
      open();
    }
  });

  // Fallback to trigger open
  const triggerOpen = useCallback(() => {
    if (token) {
      open();
    } else {
      openPlaidLink();
    }
  }, [token, open, openPlaidLink]);

  return {
    openLink: triggerOpen,
    loading: loading || createLinkTokenMutation.isPending || exchangePublicTokenMutation.isPending,
    error,
    ready: ready || !!token,
  };
}
