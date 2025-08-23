// Minimal rich text editor for TaskCard notes
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Bold, Italic, List, ListOrdered } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';

interface MinimalRichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function MinimalRichTextEditor({
  content,
  onChange,
  placeholder,
  className = '',
  disabled = false,
}: MinimalRichTextEditorProps) {
  const { t } = useTranslation();
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: placeholder || t('common.richTextEditor.placeholder'),
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editable: !disabled,
  });

  if (!editor) {
    return null;
  }

  return (
    <div
      className={`flex flex-col h-full border-2 border-divider rounded-lg overflow-hidden bg-content2 hover:bg-content3 focus-within:bg-content2 focus-within:border-primary transition-colors ${className}`}
      onMouseDown={e => e.stopPropagation()}
      onPointerDown={e => e.stopPropagation()}
      onTouchStart={e => e.stopPropagation()}
    >
      {/* Minimal Toolbar */}
      <div className='flex-shrink-0 border-b border-divider bg-content2 px-2 py-1 flex items-center gap-0.5'>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive('bold')}
          disabled={disabled}
          title={t('common.richTextEditor.bold')}
        >
          <Bold className='w-3 h-3' />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive('italic')}
          disabled={disabled}
          title={t('common.richTextEditor.italic')}
        >
          <Italic className='w-3 h-3' />
        </ToolbarButton>

        <div className='w-px h-4 bg-divider mx-1' />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive('bulletList')}
          disabled={disabled}
          title={t('common.richTextEditor.bulletList')}
        >
          <List className='w-3 h-3' />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive('orderedList')}
          disabled={disabled}
          title={t('common.richTextEditor.numberedList')}
        >
          <ListOrdered className='w-3 h-3' />
        </ToolbarButton>
      </div>

      {/* Editor Content - fills remaining space */}
      <div className='flex-1 p-2 overflow-auto min-h-0 bg-content2'>
        <EditorContent
          editor={editor}
          className='prose prose-sm prose-slate dark:prose-invert max-w-none focus:outline-none h-full [&_.ProseMirror]:min-h-full [&_.ProseMirror]:outline-none [&_.ProseMirror]:p-0 [&_.ProseMirror_p]:my-1 [&_.ProseMirror_p]:leading-relaxed [&_.ProseMirror]:text-foreground [&_.ProseMirror]:caret-primary'
        />
      </div>
    </div>
  );
}

interface ToolbarButtonProps {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}

function ToolbarButton({
  onClick,
  isActive = false,
  disabled = false,
  title,
  children,
}: ToolbarButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`
        p-1 rounded transition-colors duration-150
        ${
          isActive
            ? 'bg-primary text-primary-foreground'
            : 'text-foreground-600 hover:bg-content3 hover:text-foreground'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
    >
      {children}
    </button>
  );
}
