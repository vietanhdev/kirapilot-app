import React from 'react';

interface ReactMarkdownProps {
  children: string;
  className?: string;
}

const ReactMarkdown: React.FC<ReactMarkdownProps> = ({
  children,
  className,
}) => {
  return (
    <div className={className} data-testid='markdown-content'>
      {children}
    </div>
  );
};

export default ReactMarkdown;
