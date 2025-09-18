
'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

export type B2Status = 'idle' | 'in-progress' | 'success' | 'error';

interface B2ConnectionContextType {
  status: B2Status;
  setStatus: (status: B2Status) => void;
  operationTime: number;
  setOperationTime: (time: number) => void;
  startTimer: () => void;
  stopTimer: () => void;
}

const B2ConnectionContext = createContext<B2ConnectionContextType | undefined>(undefined);

export const B2ConnectionProvider = ({ children }: { children: ReactNode }) => {
  const [status, setStatus] = useState<B2Status>('idle');
  const [operationTime, setOperationTime] = useState(0);
  const [timerInterval, setTimerInterval] = useState<NodeJS.Timeout | null>(null);

  const startTimer = () => {
    if (timerInterval) clearInterval(timerInterval);
    setStatus('in-progress');
    setOperationTime(0);
    const interval = setInterval(() => {
      setOperationTime(prevTime => prevTime + 1);
    }, 1000);
    setTimerInterval(interval);
  };

  const stopTimer = () => {
    if (timerInterval) {
      clearInterval(timerInterval);
      setTimerInterval(null);
    }
  };

  return (
    <B2ConnectionContext.Provider value={{ status, setStatus, operationTime, setOperationTime, startTimer, stopTimer }}>
      {children}
    </B2ConnectionContext.Provider>
  );
};

export const useB2Connection = () => {
  const context = useContext(B2ConnectionContext);
  if (context === undefined) {
    throw new Error('useB2Connection must be used within a B2ConnectionProvider');
  }
  return context;
};
