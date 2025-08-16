import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { Button } from '@heroui/react';
import { Copy, Check } from 'lucide-react';
import { useClipboard } from '../../hooks/useClipboard';
import 'highlight.js/styles/github.css';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

interface CodeBlockProps {
  children?: React.ReactNode;
  className?: string;
  inline?: boolean;
}

function CodeBlock({ children, className, inline }: CodeBlockProps) {
  const { copied, copy } = useClipboard();
  const language = className?.replace('language-', '') || '';
  const codeContent =
    typeof children === 'string' ? children : String(children || '');

  if (inline) {
    return (
      <code className='bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-sm font-mono'>
        {children}
      </code>
    );
  }

  return (
    <div className='relative group'>
      <div className='flex items-center justify-between bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-t-lg border-b border-gray-200 dark:border-gray-700'>
        <span className='text-xs font-medium text-gray-600 dark:text-gray-400'>
          {language || 'code'}
        </span>
        <Button
          isIconOnly
          size='sm'
          variant='light'
          className='opacity-0 group-hover:opacity-100 transition-opacity'
          onPress={() => copy(codeContent)}
        >
          {copied ? (
            <Check className='w-3 h-3 text-green-500' />
          ) : (
            <Copy className='w-3 h-3' />
          )}
        </Button>
      </div>
      <pre className='bg-gray-50 dark:bg-gray-900 p-3 rounded-b-lg overflow-x-auto'>
        <code className={className}>{children}</code>
      </pre>
    </div>
  );
}

export const MarkdownRenderer = memo(
  ({ content, className = '' }: MarkdownRendererProps) => {
    return (
      <div
        className={`prose prose-sm dark:prose-invert max-w-none ${className}`}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeHighlight]}
          components={{
            code: CodeBlock,
            h1: ({ children }) => (
              <h1 className='text-lg font-bold mb-2 text-gray-900 dark:text-gray-100'>
                {children}
              </h1>
            ),
            h2: ({ children }) => (
              <h2 className='text-base font-semibold mb-2 text-gray-900 dark:text-gray-100'>
                {children}
              </h2>
            ),
            h3: ({ children }) => (
              <h3 className='text-sm font-semibold mb-1 text-gray-900 dark:text-gray-100'>
                {children}
              </h3>
            ),
            p: ({ children }) => (
              <p className='mb-2 text-gray-700 dark:text-gray-300 leading-relaxed'>
                {children}
              </p>
            ),
            ul: ({ children }) => (
              <ul className='list-disc list-inside mb-2 space-y-1 text-gray-700 dark:text-gray-300'>
                {children}
              </ul>
            ),
            ol: ({ children }) => (
              <ol className='list-decimal list-inside mb-2 space-y-1 text-gray-700 dark:text-gray-300'>
                {children}
              </ol>
            ),
            li: ({ children }) => <li className='text-sm'>{children}</li>,
            blockquote: ({ children }) => (
              <blockquote className='border-l-4 border-blue-400 pl-3 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-sm italic'>
                {children}
              </blockquote>
            ),
            a: ({ href, children }) => (
              <a
                href={href}
                target='_blank'
                rel='noopener noreferrer'
                className='text-blue-500 hover:text-blue-600 underline'
              >
                {children}
              </a>
            ),
            table: ({ children }) => (
              <div className='overflow-x-auto'>
                <table className='min-w-full border border-gray-200 dark:border-gray-700 text-sm'>
                  {children}
                </table>
              </div>
            ),
            th: ({ children }) => (
              <th className='border border-gray-200 dark:border-gray-700 px-2 py-1 bg-gray-100 dark:bg-gray-800 font-semibold text-left'>
                {children}
              </th>
            ),
            td: ({ children }) => (
              <td className='border border-gray-200 dark:border-gray-700 px-2 py-1'>
                {children}
              </td>
            ),
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    );
  }
);

MarkdownRenderer.displayName = 'MarkdownRenderer';
