import React, { useMemo, useState } from 'react';
import { PUBLIC_DIGESTION_CURRICULUM_MANIFEST } from './backend/answerKeyVault';
import { createBackendAdapter } from './backend/backendFactory';
import { loadEnvironmentConfig } from './config/env';
import type { AppOperatingMode } from './domain/types';
import { LocalStoragePersistenceAdapter } from './persistence/localStorageAdapter';
import { AppShell } from './ui/layout/AppShell';

export const App: React.FC = () => {
  const [modeVersion, setModeVersion] = useState<number>(0);

  const env = useMemo(() => {
    void modeVersion;
    return loadEnvironmentConfig();
  }, [modeVersion]);

  const persistence = useMemo(
    () => new LocalStoragePersistenceAdapter(env.storageNamespace),
    [env.storageNamespace]
  );

  const backend = useMemo(() => createBackendAdapter(env), [env]);

  const handleModeChange = (_nextMode: AppOperatingMode) => {
    setModeVersion((v) => v + 1);
  };

  return (
    <AppShell
      env={env}
      manifest={PUBLIC_DIGESTION_CURRICULUM_MANIFEST}
      persistence={persistence}
      backend={backend}
      onModeChange={handleModeChange}
    />
  );
};
