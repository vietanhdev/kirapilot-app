// Tag input component
import { useState, KeyboardEvent } from 'react';
import { X, Plus } from 'lucide-react';

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  maxTags?: number;
}

export function TagInput({
  tags,
  onChange,
  placeholder = 'Add tags...',
  disabled = false,
  className = '',
  maxTags = 10,
}: TagInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [isInputFocused, setIsInputFocused] = useState(false);

  const addTag = (tag: string) => {
    const trimmedTag = tag.trim().toLowerCase();
    if (trimmedTag && !tags.includes(trimmedTag) && tags.length < maxTags) {
      onChange([...tags, trimmedTag]);
      setInputValue('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    onChange(tags.filter(tag => tag !== tagToRemove));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === 'Backspace' && inputValue === '' && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  };

  const handleInputBlur = () => {
    setIsInputFocused(false);
    if (inputValue.trim()) {
      addTag(inputValue);
    }
  };

  return (
    <div className={className}>
      <div
        className={`
          flex flex-wrap items-center gap-2 p-3 min-h-[42px]
          border border-slate-300 dark:border-slate-600 rounded-lg
          bg-white dark:bg-slate-800
          transition-all duration-200
          ${
            isInputFocused
              ? 'ring-2 ring-primary-500 border-transparent'
              : 'hover:border-slate-400 dark:hover:border-slate-500'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        {/* Existing Tags */}
        {tags.map(tag => (
          <TagChip
            key={tag}
            tag={tag}
            onRemove={() => removeTag(tag)}
            disabled={disabled}
          />
        ))}

        {/* Input Field */}
        {!disabled && tags.length < maxTags && (
          <input
            type='text'
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsInputFocused(true)}
            onBlur={handleInputBlur}
            placeholder={tags.length === 0 ? placeholder : ''}
            className='flex-1 min-w-[120px] bg-transparent border-none outline-none text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400'
          />
        )}

        {/* Add Button (when input is not empty) */}
        {inputValue.trim() && !disabled && (
          <button
            type='button'
            onClick={() => addTag(inputValue)}
            className='p-1 text-primary-500 hover:text-primary-600 transition-colors duration-200'
            title='Add tag'
          >
            <Plus className='w-4 h-4' />
          </button>
        )}
      </div>

      {/* Tag Count Indicator */}
      {tags.length > 0 && (
        <div className='mt-1 text-xs text-slate-500 dark:text-slate-400'>
          {tags.length} / {maxTags} tags
        </div>
      )}
    </div>
  );
}

interface TagChipProps {
  tag: string;
  onRemove: () => void;
  disabled?: boolean;
}

function TagChip({ tag, onRemove, disabled = false }: TagChipProps) {
  return (
    <span className='inline-flex items-center gap-1 px-2 py-1 bg-primary-100 dark:bg-primary-900 text-primary-800 dark:text-primary-200 text-sm rounded-full'>
      <span className='font-medium'>{tag}</span>
      {!disabled && (
        <button
          type='button'
          onClick={onRemove}
          className='p-0.5 hover:bg-primary-200 dark:hover:bg-primary-800 rounded-full transition-colors duration-200'
          title={`Remove ${tag} tag`}
        >
          <X className='w-3 h-3' />
        </button>
      )}
    </span>
  );
}
