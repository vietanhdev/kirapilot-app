import React from 'react';
import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Button,
  Avatar,
} from '@heroui/react';
import { Languages, Check } from 'lucide-react';

import { useSettings } from '../../contexts/SettingsContext';
import { languages, type Language } from '../../i18n';

interface LanguageSwitcherProps {
  variant?: 'button' | 'minimal';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

// Language flag emojis for visual representation
const languageFlags: Record<Language, string> = {
  en: '🇺🇸',
  es: '🇪🇸',
  fr: '🇫🇷',
  de: '🇩🇪',
  vi: '🇻🇳',
  ja: '🇯🇵',
  pt: '🇵🇹',
};

// Language native names for better UX
const languageNativeNames: Record<Language, string> = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  vi: 'Tiếng Việt',
  ja: '日本語',
  pt: 'Português',
};

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  variant = 'button',
  size = 'md',
  showLabel = true,
  className = '',
}) => {
  const { preferences, updatePreference } = useSettings();
  const currentLanguage = preferences.language as Language;

  const handleLanguageChange = (language: Language) => {
    updatePreference('language', language);
  };

  const currentFlag = languageFlags[currentLanguage];
  const currentName = languageNativeNames[currentLanguage];

  if (variant === 'minimal') {
    return (
      <Dropdown placement='bottom-end'>
        <DropdownTrigger>
          <Button
            variant='light'
            size={size}
            isIconOnly={!showLabel}
            className={className}
            startContent={
              <span className='text-lg' role='img' aria-label={currentName}>
                {currentFlag}
              </span>
            }
          >
            {showLabel && (
              <span className='hidden sm:inline text-sm'>
                {currentLanguage.toUpperCase()}
              </span>
            )}
          </Button>
        </DropdownTrigger>
        <DropdownMenu
          aria-label='Language selection'
          selectedKeys={[currentLanguage]}
          selectionMode='single'
          onSelectionChange={keys => {
            const selectedLanguage = Array.from(keys)[0] as Language;
            if (selectedLanguage) {
              handleLanguageChange(selectedLanguage);
            }
          }}
        >
          {Object.entries(languages).map(([code, name]) => (
            <DropdownItem
              key={code}
              startContent={
                <span className='text-base' role='img' aria-label={name}>
                  {languageFlags[code as Language]}
                </span>
              }
              endContent={
                currentLanguage === code ? (
                  <Check className='w-4 h-4 text-success' />
                ) : null
              }
            >
              <div className='flex flex-col'>
                <span className='text-sm font-medium'>
                  {languageNativeNames[code as Language]}
                </span>
                <span className='text-xs text-foreground-500'>{name}</span>
              </div>
            </DropdownItem>
          ))}
        </DropdownMenu>
      </Dropdown>
    );
  }

  return (
    <Dropdown placement='bottom-end'>
      <DropdownTrigger>
        <Button
          variant='bordered'
          size={size}
          className={className}
          startContent={<Languages className='w-4 h-4' />}
          endContent={
            <div className='flex items-center gap-1'>
              <span className='text-base' role='img' aria-label={currentName}>
                {currentFlag}
              </span>
              {showLabel && (
                <span className='text-sm font-medium'>
                  {currentLanguage.toUpperCase()}
                </span>
              )}
            </div>
          }
        >
          {showLabel ? 'Language' : ''}
        </Button>
      </DropdownTrigger>
      <DropdownMenu
        aria-label='Language selection'
        selectedKeys={[currentLanguage]}
        selectionMode='single'
        onSelectionChange={keys => {
          const selectedLanguage = Array.from(keys)[0] as Language;
          if (selectedLanguage) {
            handleLanguageChange(selectedLanguage);
          }
        }}
        className='min-w-[200px]'
      >
        {Object.entries(languages).map(([code, name]) => (
          <DropdownItem
            key={code}
            startContent={
              <Avatar
                size='sm'
                name={languageFlags[code as Language]}
                className='w-6 h-6 text-base bg-transparent'
              />
            }
            endContent={
              currentLanguage === code ? (
                <Check className='w-4 h-4 text-success' />
              ) : null
            }
            className='py-2'
          >
            <div className='flex flex-col'>
              <span className='text-sm font-medium'>
                {languageNativeNames[code as Language]}
              </span>
              <span className='text-xs text-foreground-500'>{name}</span>
            </div>
          </DropdownItem>
        ))}
      </DropdownMenu>
    </Dropdown>
  );
};

// Quick language switcher for development/testing
export const DevLanguageSwitcher: React.FC = () => {
  const { preferences, updatePreference } = useSettings();
  const currentLanguage = preferences.language as Language;

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className='fixed bottom-4 right-4 z-50'>
      <div className='bg-content1 border border-divider rounded-lg p-2 shadow-lg'>
        <div className='flex items-center gap-2 mb-2'>
          <Languages className='w-4 h-4 text-foreground-600' />
          <span className='text-xs font-medium text-foreground-600'>
            Dev: Language
          </span>
        </div>
        <div className='flex flex-wrap gap-1'>
          {Object.entries(languages).map(([code, name]) => (
            <Button
              key={code}
              size='sm'
              variant={currentLanguage === code ? 'solid' : 'bordered'}
              color={currentLanguage === code ? 'primary' : 'default'}
              onPress={() => updatePreference('language', code)}
              className='min-w-0 px-2'
            >
              <span className='text-xs' role='img' aria-label={name}>
                {languageFlags[code as Language]}
              </span>
              <span className='text-xs font-mono'>{code.toUpperCase()}</span>
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
};
