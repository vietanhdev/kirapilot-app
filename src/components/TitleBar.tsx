import { Minus, X, Maximize2, Minimize2 } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useWindowState } from '../hooks/useWindowState';

/**
 * Custom title bar component that provides window controls for the Tauri app.
 * Uses z-index: 9999 to ensure it always stays above HeroUI modals.
 */
export default function TitleBar() {
  const { isMaximized, toggleMaximize } = useWindowState();

  const handleMinimize = async () => {
    try {
      const appWindow = getCurrentWindow();
      await appWindow.minimize();
    } catch (error) {
      console.error('Error minimizing window:', error);
    }
  };

  const handleMaximize = () => {
    toggleMaximize();
  };

  const handleClose = async () => {
    try {
      const appWindow = getCurrentWindow();
      await appWindow.close();
    } catch (error) {
      console.error('Error closing window:', error);
    }
  };

  return (
    <div
      className={`title-bar flex items-center justify-between h-8 bg-content2 border-b border-divider select-none shadow-sm relative z-[9999] ${
        isMaximized ? '' : 'rounded-t-xl'
      }`}
    >
      {/* Draggable area */}
      <div
        data-tauri-drag-region
        className='flex-1 h-full flex items-center px-4 cursor-move drag-region'
        onDoubleClick={handleMaximize}
      >
        <span className='text-sm font-medium text-foreground-600'>
          KiraPilot
        </span>
      </div>

      {/* Window controls */}
      <div className='flex items-center h-full no-drag-region'>
        <button
          onClick={handleMinimize}
          className='h-full px-4 hover:bg-content3 transition-colors duration-150 flex items-center justify-center group'
          title='Minimize'
        >
          <Minus
            size={14}
            className='text-foreground-600 group-hover:text-foreground'
          />
        </button>

        <button
          onClick={handleMaximize}
          className='h-full px-4 hover:bg-content3 transition-colors duration-150 flex items-center justify-center group'
          title={isMaximized ? 'Restore' : 'Maximize'}
        >
          {isMaximized ? (
            <Minimize2
              size={14}
              className='text-foreground-600 group-hover:text-foreground'
            />
          ) : (
            <Maximize2
              size={14}
              className='text-foreground-600 group-hover:text-foreground'
            />
          )}
        </button>

        <button
          onClick={handleClose}
          className='h-full px-4 hover:bg-red-500 transition-colors duration-150 flex items-center justify-center group'
          title='Close'
        >
          <X size={14} className='text-foreground-600 group-hover:text-white' />
        </button>
      </div>
    </div>
  );
}
