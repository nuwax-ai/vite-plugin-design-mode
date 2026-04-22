import React, { useState, useEffect } from 'react';
import { useDesignMode } from './DesignModeContext';

// Tailwind Presets (Copied from InteractiveDemo)
const TAILWIND_PRESETS = {
  bgColors: [
    { label: 'White', value: 'bg-white' },
    { label: 'Slate 50', value: 'bg-slate-50' },
    { label: 'Blue 50', value: 'bg-blue-50' },
    { label: 'Blue 100', value: 'bg-blue-100' },
    { label: 'Blue 600', value: 'bg-blue-600' },
    { label: 'Red 50', value: 'bg-red-50' },
    { label: 'Green 50', value: 'bg-green-50' },
  ],
  textColors: [
    { label: 'Slate 900', value: 'text-slate-900' },
    { label: 'Slate 600', value: 'text-slate-600' },
    { label: 'Blue 600', value: 'text-blue-600' },
    { label: 'White', value: 'text-white' },
    { label: 'Red 600', value: 'text-red-600' },
  ],
  fontSizes: [
    { label: 'Small', value: 'text-sm' },
    { label: 'Base', value: 'text-base' },
    { label: 'Large', value: 'text-lg' },
    { label: 'XL', value: 'text-xl' },
    { label: '2XL', value: 'text-2xl' },
    { label: '4XL', value: 'text-4xl' },
  ],
  paddings: [
    { label: '0', value: 'p-0' },
    { label: '2', value: 'p-2' },
    { label: '4', value: 'p-4' },
    { label: '6', value: 'p-6' },
    { label: '8', value: 'p-8' },
    { label: '12', value: 'p-12' },
  ],
  rounded: [
    { label: 'None', value: 'rounded-none' },
    { label: 'Small', value: 'rounded-sm' },
    { label: 'Medium', value: 'rounded-md' },
    { label: 'Large', value: 'rounded-lg' },
    { label: 'Full', value: 'rounded-full' },
  ]
};

export const DesignModeUI: React.FC = () => {
  const { isDesignMode, toggleDesignMode, selectedElement, modifyElementClass, modifications, resetModifications } = useDesignMode();
  const [currentClasses, setCurrentClasses] = useState<string>('');

  useEffect(() => {
    if (selectedElement) {
      setCurrentClasses(selectedElement.className);
    } else {
      setCurrentClasses('');
    }
  }, [selectedElement, modifications]);

  const modifyClass = (newClass: string) => {
    if (!selectedElement) return;
    modifyElementClass(selectedElement, newClass);
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      zIndex: 99999,
      fontFamily: 'system-ui, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
      gap: '10px',
      pointerEvents: 'none' // Allow clicking through the container area
    }}>
      {/* Main Toggle */}
      <div style={{
        pointerEvents: 'auto',
        backgroundColor: 'white',
        padding: '10px',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        border: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
      }}>
        <label style={{ fontSize: '14px', fontWeight: 500, color: '#1e293b' }}>
          Design Mode
        </label>
        <button
          onClick={toggleDesignMode}
          style={{
            width: '40px',
            height: '24px',
            borderRadius: '12px',
            backgroundColor: isDesignMode ? '#2563eb' : '#e2e8f0',
            border: 'none',
            position: 'relative',
            cursor: 'pointer',
            transition: 'background-color 0.2s'
          }}
        >
          <span style={{
            position: 'absolute',
            top: '2px',
            left: isDesignMode ? '18px' : '2px',
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            backgroundColor: 'white',
            transition: 'left 0.2s',
            boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
          }} />
        </button>
      </div>

      {/* Edit Panel */}
      {isDesignMode && selectedElement && (
        <div style={{
          pointerEvents: 'auto',
          backgroundColor: 'white',
          padding: '16px',
          borderRadius: '12px',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
          border: '1px solid #e2e8f0',
          width: '320px',
          maxHeight: '80vh',
          overflowY: 'auto'
        }}>
          <div style={{ marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#0f172a' }}>
              Edit Element
            </h3>
            <code style={{ fontSize: '12px', backgroundColor: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', color: '#64748b' }}>
              {selectedElement.tagName.toLowerCase()}{selectedElement.id ? `#${selectedElement.id}` : ''}
            </code>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Background */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#64748b', marginBottom: '8px' }}>Background</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {TAILWIND_PRESETS.bgColors.map(preset => (
                  <button
                    key={preset.value}
                    onClick={() => modifyClass(preset.value)}
                    title={preset.label}
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '4px',
                      border: '1px solid #e2e8f0',
                      cursor: 'pointer',
                      backgroundColor: preset.value === 'bg-white' ? '#ffffff' :
                                     preset.value === 'bg-slate-50' ? '#f8fafc' :
                                     preset.value === 'bg-blue-50' ? '#eff6ff' :
                                     preset.value === 'bg-blue-100' ? '#dbeafe' :
                                     preset.value === 'bg-blue-600' ? '#2563eb' :
                                     preset.value === 'bg-red-50' ? '#fef2f2' :
                                     preset.value === 'bg-green-50' ? '#f0fdf4' : '#eee',
                      boxShadow: currentClasses.includes(preset.value) ? '0 0 0 2px #3b82f6' : 'none'
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Text Color */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#64748b', marginBottom: '8px' }}>Text Color</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {TAILWIND_PRESETS.textColors.map(preset => (
                  <button
                    key={preset.value}
                    onClick={() => modifyClass(preset.value)}
                    title={preset.label}
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '4px',
                      border: '1px solid #e2e8f0',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 'bold',
                      fontSize: '12px',
                      backgroundColor: '#f8fafc',
                      color: preset.value === 'text-white' ? '#000' : // Show black 'A' for white text option for visibility
                             preset.value === 'text-slate-900' ? '#0f172a' :
                             preset.value === 'text-slate-600' ? '#475569' :
                             preset.value === 'text-blue-600' ? '#2563eb' :
                             preset.value === 'text-red-600' ? '#dc2626' : '#000',
                      boxShadow: currentClasses.includes(preset.value) ? '0 0 0 2px #3b82f6' : 'none'
                    }}
                  >
                    A
                  </button>
                ))}
              </div>
            </div>

            {/* Padding */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#64748b', marginBottom: '8px' }}>Padding</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {TAILWIND_PRESETS.paddings.map(preset => (
                  <button
                    key={preset.value}
                    onClick={() => modifyClass(preset.value)}
                    style={{
                      padding: '4px 8px',
                      fontSize: '11px',
                      borderRadius: '4px',
                      border: '1px solid #e2e8f0',
                      cursor: 'pointer',
                      backgroundColor: currentClasses.includes(preset.value) ? '#eff6ff' : 'white',
                      color: currentClasses.includes(preset.value) ? '#1d4ed8' : '#64748b',
                      borderColor: currentClasses.includes(preset.value) ? '#93c5fd' : '#e2e8f0'
                    }}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

             {/* Rounded */}
             <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#64748b', marginBottom: '8px' }}>Rounded</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {TAILWIND_PRESETS.rounded.map(preset => (
                  <button
                    key={preset.value}
                    onClick={() => modifyClass(preset.value)}
                    style={{
                      padding: '4px 8px',
                      fontSize: '11px',
                      borderRadius: '4px',
                      border: '1px solid #e2e8f0',
                      cursor: 'pointer',
                      backgroundColor: currentClasses.includes(preset.value) ? '#eff6ff' : 'white',
                      color: currentClasses.includes(preset.value) ? '#1d4ed8' : '#64748b',
                      borderColor: currentClasses.includes(preset.value) ? '#93c5fd' : '#e2e8f0'
                    }}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
               <button
                onClick={resetModifications}
                disabled={modifications.length === 0}
                style={{
                  width: '100%',
                  padding: '8px',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: modifications.length === 0 ? '#94a3b8' : '#dc2626',
                  backgroundColor: modifications.length === 0 ? '#f1f5f9' : '#fef2f2',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: modifications.length === 0 ? 'not-allowed' : 'pointer',
                }}
              >
                Reset All Modifications
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
