import React from 'react';
import { Switch, Slider, Button } from '@heroui/react';
import { Volume2, VolumeX, TestTube } from 'lucide-react';

import { useSettings } from '../../contexts/SettingsContext';

interface SoundSettingsProps {
  className?: string;
}

export const SoundSettings: React.FC<SoundSettingsProps> = ({
  className = '',
}) => {
  const { preferences, updateNestedPreference } = useSettings();

  const handleHapticFeedbackChange = (enabled: boolean) => {
    updateNestedPreference('soundSettings', 'hapticFeedback', enabled);
  };

  const handleCompletionSoundChange = (enabled: boolean) => {
    updateNestedPreference('soundSettings', 'completionSound', enabled);
  };

  const handleVolumeChange = (value: number | number[]) => {
    const volume = Array.isArray(value) ? value[0] : value;
    updateNestedPreference('soundSettings', 'soundVolume', volume);
  };

  const testSound = () => {
    if (!preferences.soundSettings.completionSound) {
      return;
    }

    try {
      // @ts-ignore - webkit audio context fallback
      const audioContext = new (window.AudioContext ||
        window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Single pleasant tone
      oscillator.frequency.setValueAtTime(660, audioContext.currentTime); // E5
      oscillator.type = 'sine';

      const volume = preferences.soundSettings.soundVolume / 100;
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(
        volume * 0.1,
        audioContext.currentTime + 0.01
      );
      gainNode.gain.exponentialRampToValueAtTime(
        0.001,
        audioContext.currentTime + 0.3
      );

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
      console.debug('Web Audio API not supported:', error);
    }
  };

  const testHaptic = () => {
    if (!preferences.soundSettings.hapticFeedback) {
      return;
    }

    // Test haptic feedback for mobile devices
    if ('vibrate' in navigator) {
      navigator.vibrate(50); // Single short pulse
    }
  };

  return (
    <div className={className}>
      <h3 className='text-lg font-semibold text-foreground mb-4 flex items-center gap-2'>
        <Volume2 className='w-5 h-5' />
        Sound & Haptic Settings
      </h3>

      <div className='space-y-4'>
        {/* Completion Sound */}
        <div className='flex items-center justify-between'>
          <div>
            <label className='text-sm font-medium text-foreground'>
              Completion Sound
            </label>
            <p className='text-xs text-foreground-600'>
              Play a sound when tasks are completed
            </p>
          </div>
          <Switch
            isSelected={preferences.soundSettings.completionSound}
            onValueChange={handleCompletionSoundChange}
          />
        </div>

        {/* Sound Volume */}
        {preferences.soundSettings.completionSound && (
          <div className='space-y-3 pl-6'>
            <div className='flex items-center justify-between'>
              <label className='text-sm font-medium text-foreground'>
                Volume
              </label>
              <Button
                size='sm'
                variant='light'
                startContent={<TestTube className='w-4 h-4' />}
                onPress={testSound}
                className='text-primary'
              >
                Test
              </Button>
            </div>
            <div className='flex items-center gap-3'>
              <VolumeX className='w-4 h-4 text-foreground-400' />
              <Slider
                size='sm'
                step={5}
                minValue={0}
                maxValue={100}
                value={preferences.soundSettings.soundVolume}
                onChange={handleVolumeChange}
                className='flex-1'
                classNames={{
                  track: 'border-s-primary-100',
                  filler: 'bg-gradient-to-r from-primary-100 to-primary-500',
                  thumb: [
                    'transition-size',
                    'bg-gradient-to-r from-primary-100 to-primary-500',
                    'data-[dragging=true]:shadow-lg data-[dragging=true]:shadow-black/20',
                    'data-[dragging=true]:w-7 data-[dragging=true]:h-7 data-[dragging=true]:after:h-6 data-[dragging=true]:after:w-6',
                  ],
                }}
              />
              <Volume2 className='w-4 h-4 text-foreground-400' />
              <span className='text-sm text-foreground-600 min-w-[3rem] text-right'>
                {preferences.soundSettings.soundVolume}%
              </span>
            </div>
          </div>
        )}

        {/* Haptic Feedback */}
        <div className='flex items-center justify-between'>
          <div>
            <label className='text-sm font-medium text-foreground'>
              Haptic Feedback
            </label>
            <p className='text-xs text-foreground-600'>
              Vibrate on task completion (mobile devices)
            </p>
          </div>
          <div className='flex items-center gap-2'>
            <Button
              size='sm'
              variant='light'
              startContent={<TestTube className='w-4 h-4' />}
              onPress={testHaptic}
              className='text-primary'
              isDisabled={!preferences.soundSettings.hapticFeedback}
            >
              Test
            </Button>
            <Switch
              isSelected={preferences.soundSettings.hapticFeedback}
              onValueChange={handleHapticFeedbackChange}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
