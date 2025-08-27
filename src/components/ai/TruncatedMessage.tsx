import { useState } from 'react';
import {
  Button,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from '@heroui/react';
import { Eye, Copy, Check } from 'lucide-react';

interface TruncatedMessageProps {
  content: string;
  maxLength?: number;
  title: string;
  className?: string;
}

export function TruncatedMessage({
  content,
  maxLength = 100,
  title,
  className = '',
}: TruncatedMessageProps) {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [copied, setCopied] = useState(false);

  const shouldTruncate = content.length > maxLength;
  const truncatedContent = shouldTruncate
    ? content.substring(0, maxLength) + '...'
    : content;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy text:', error);
      // Fallback for browsers that don't support clipboard API
      try {
        const textArea = document.createElement('textarea');
        textArea.value = content;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (fallbackError) {
        console.error('Fallback copy also failed:', fallbackError);
      }
    }
  };

  if (!content || content.trim() === '') {
    return (
      <span className={`text-default-400 text-sm ${className}`}>
        No content
      </span>
    );
  }

  return (
    <>
      <div className={`w-full min-w-0 ${className}`}>
        <p className='text-sm text-default-700 whitespace-normal break-words leading-relaxed'>
          {truncatedContent}
        </p>
        {shouldTruncate && (
          <Button
            size='sm'
            variant='light'
            color='primary'
            className='mt-1 h-6 px-2 min-w-0'
            startContent={<Eye className='w-3 h-3' />}
            onPress={onOpen}
          >
            Show
          </Button>
        )}
      </div>

      <Modal
        isOpen={isOpen}
        onClose={onClose}
        size='2xl'
        scrollBehavior='inside'
        classNames={{
          base: 'max-h-[90vh]',
          body: 'py-4',
        }}
      >
        <ModalContent>
          <ModalHeader className='flex flex-col gap-1'>
            <h3 className='text-lg font-semibold'>{title}</h3>
            <p className='text-sm text-default-500 font-normal'>
              {content.length} characters
            </p>
          </ModalHeader>
          <ModalBody>
            <div className='bg-default-50 rounded-lg p-4 max-h-96 overflow-auto'>
              <pre className='whitespace-pre-wrap text-sm text-default-700 font-mono leading-relaxed'>
                {content}
              </pre>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              variant='flat'
              startContent={
                copied ? (
                  <Check className='w-4 h-4' />
                ) : (
                  <Copy className='w-4 h-4' />
                )
              }
              onPress={handleCopy}
              color={copied ? 'success' : 'default'}
            >
              {copied ? 'Copied!' : 'Copy'}
            </Button>
            <Button color='primary' onPress={onClose}>
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
