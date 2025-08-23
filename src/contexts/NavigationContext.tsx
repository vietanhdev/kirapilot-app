import React, { createContext, useContext, ReactNode } from 'react';

interface NavigationContextType {
  currentView: string;
  viewParams: Record<string, unknown>;
  navigateTo: (view: string, params?: Record<string, unknown>) => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(
  undefined
);

interface NavigationProviderProps {
  children: ReactNode;
  currentView: string;
  viewParams?: Record<string, unknown>;
  onViewChange: (view: string, params?: Record<string, unknown>) => void;
}

export const NavigationProvider: React.FC<NavigationProviderProps> = ({
  children,
  currentView,
  viewParams = {},
  onViewChange,
}) => {
  const value: NavigationContextType = {
    currentView,
    viewParams,
    navigateTo: onViewChange,
  };

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
};

export const useNavigation = (): NavigationContextType => {
  const context = useContext(NavigationContext);
  if (context === undefined) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
};
