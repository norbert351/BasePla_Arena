import { useState, useEffect } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';

export interface MiniAppUser {
  fid: number;
  username?: string;
  displayName?: string;
  pfpUrl?: string;
}

export const useMiniAppContext = () => {
  const [user, setUser] = useState<MiniAppUser | null>(null);
  const [isInMiniApp, setIsInMiniApp] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadContext = async () => {
      try {
        const inMiniApp = await sdk.isInMiniApp();
        setIsInMiniApp(inMiniApp);

        if (inMiniApp) {
          const context = await sdk.context;
          if (context?.user) {
            setUser({
              fid: context.user.fid,
              username: context.user.username,
              displayName: context.user.displayName,
              pfpUrl: context.user.pfpUrl,
            });
          }
        }
      } catch (error) {
        console.error('Failed to load MiniApp context:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadContext();
  }, []);

  return { user, isInMiniApp, isLoading };
};
