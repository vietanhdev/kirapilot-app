import React, { useState } from 'react';
import CodeBlock from '@theme/CodeBlock';
import clsx from 'clsx';

export interface CodeExampleProps {
  language: string;
  code: string;
  title?: string;
  showLineNumbers?: boolean;
  highlightLines?: number[];
  className?: string;
}

export default function CodeExample({
  language,
  code,
  title,
  showLineNumbers = false,
  highlightLines = [],
  className,
}: CodeExampleProps): React.JSX.Element {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  const metastring = [
    showLineNumbers && 'showLineNumbers',
    highlightLines.length > 0 && `{${highlightLines.join(',')}}`,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={clsx('kira-code-example', className)}>
      {title && (
        <div className='kira-code-example__header'>
          <h4 className='kira-code-example__title'>{title}</h4>
          <button
            className={clsx(
              'kira-code-example__copy-button',
              copied && 'kira-code-example__copy-button--copied'
            )}
            onClick={handleCopy}
            aria-label='Copy code to clipboard'
            type='button'
          >
            {copied ? '✓ Copied!' : '📋 Copy'}
          </button>
        </div>
      )}
      <div className='kira-code-example__content'>
        <CodeBlock
          language={language}
          metastring={metastring}
          showLineNumbers={showLineNumbers}
        >
          {code}
        </CodeBlock>
        {!title && (
          <button
            className={clsx(
              'kira-code-example__copy-button',
              'kira-code-example__copy-button--floating',
              copied && 'kira-code-example__copy-button--copied'
            )}
            onClick={handleCopy}
            aria-label='Copy code to clipboard'
            type='button'
            style={{
              position: 'absolute',
              top: '0.5rem',
              right: '0.5rem',
              zIndex: 1,
            }}
          >
            {copied ? '✓' : '📋'}
          </button>
        )}
      </div>
    </div>
  );
}
