import React from 'react';

// Simple test wrapper component without HeroUI provider to avoid import issues
export const TestWrapper: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return <div id='test-root'>{children}</div>;
};

// Custom render function that includes the test wrapper
export const renderWithProviders = (ui: React.ReactElement, options = {}) => {
  const { render } = require('@testing-library/react');

  return render(ui, {
    wrapper: TestWrapper,
    ...options,
  });
};

export default TestWrapper;
