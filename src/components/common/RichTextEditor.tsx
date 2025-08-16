// Rich text editor component using TipTap
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Quote,
  Undo,
  Redo,
  Type,
  Heading1,
  Heading2,
} from 'lucide-react';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function RichTextEditor({
  content,
  onChange,
  placeholder = 'Start typing...',
  className = '',
  disabled = false,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder,
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
      className={`border border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden ${className}`}
    >
      {/* Toolbar */}
      <div className='border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2 flex flex-wrap gap-1'>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive('bold')}
          disabled={disabled}
          title='Bold'
        >
          <Bold className='w-4 h-4' />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive('italic')}
          disabled={disabled}
          title='Italic'
        >
          <Italic className='w-4 h-4' />
        </ToolbarButton>

        <div className='w-px h-6 bg-slate-300 dark:bg-slate-600 mx-1' />

        <ToolbarButton
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
          isActive={editor.isActive('heading', { level: 1 })}
          disabled={disabled}
          title='Heading 1'
        >
          <Heading1 className='w-4 h-4' />
        </ToolbarButton>

        <ToolbarButton
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
          isActive={editor.isActive('heading', { level: 2 })}
          disabled={disabled}
          title='Heading 2'
        >
          <Heading2 className='w-4 h-4' />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().setParagraph().run()}
          isActive={editor.isActive('paragraph')}
          disabled={disabled}
          title='Paragraph'
        >
          <Type className='w-4 h-4' />
        </ToolbarButton>

        <div className='w-px h-6 bg-slate-300 dark:bg-slate-600 mx-1' />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive('bulletList')}
          disabled={disabled}
          title='Bullet List'
        >
          <List className='w-4 h-4' />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive('orderedList')}
          disabled={disabled}
          title='Numbered List'
        >
          <ListOrdered className='w-4 h-4' />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          isActive={editor.isActive('blockquote')}
          disabled={disabled}
          title='Quote'
        >
          <Quote className='w-4 h-4' />
        </ToolbarButton>

        <div className='w-px h-6 bg-slate-300 dark:bg-slate-600 mx-1' />

        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={disabled || !editor.can().undo()}
          title='Undo'
        >
          <Undo className='w-4 h-4' />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={disabled || !editor.can().redo()}
          title='Redo'
        >
          <Redo className='w-4 h-4' />
        </ToolbarButton>
      </div>

      {/* Editor Content */}
      <div className='p-4'>
        <EditorContent
          editor={editor}
          className='prose prose-slate dark:prose-invert max-w-none focus:outline-none'
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
        p-1.5 rounded transition-colors duration-200
        ${
          isActive
            ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300'
            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
        }
        ${
          disabled
            ? 'opacity-50 cursor-not-allowed'
            : 'hover:text-slate-900 dark:hover:text-slate-100'
        }
      `}
    >
      {children}
    </button>
  );
}
