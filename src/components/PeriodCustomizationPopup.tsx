import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { getTheme } from '../theme';

interface PeriodCustomizationPopupProps {
  provider: string;
  metricLabel: string;
  apiDefaultMinutes: number | undefined;
  currentCustomMinutes: number | undefined;
  onClose: () => void;
  onSave: (durationMinutes: number | null) => void;
}

export const PeriodCustomizationPopup: React.FC<
  PeriodCustomizationPopupProps
> = ({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  provider,
  metricLabel,
  apiDefaultMinutes,
  currentCustomMinutes,
  onClose,
  onSave,
}) => {
  const [localValue, setLocalValue] = useState<number>(
    currentCustomMinutes ?? apiDefaultMinutes ?? 300
  );
  const [inputValue, setInputValue] = useState<string>('');
  const [unit, setUnit] = useState<'minutes' | 'hours' | 'days'>('hours');
  const glassMode = true;
  const theme = getTheme(glassMode);

  useEffect(() => {
    const updateUnitAndInput = () => {
      if (localValue < 120) {
        setUnit('minutes');
        setInputValue(localValue.toString());
      } else if (localValue < 10080) {
        setUnit('hours');
        setInputValue((localValue / 60).toString());
      } else {
        setUnit('days');
        setInputValue((localValue / 1440).toString());
      }
    };
    const timer = setTimeout(updateUnitAndInput, 0);
    return () => clearTimeout(timer);
  }, [localValue]);

  const presets = [
    { label: '30m', value: 30 },
    { label: '1h', value: 60 },
    { label: '6h', value: 360 },
    { label: '12h', value: 720 },
    { label: '24h', value: 1440 },
    { label: '48h', value: 2880 },
    { label: '72h', value: 4320 },
    { label: '168h', value: 10080 },
    { label: '240h', value: 14400 },
  ];

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    setLocalValue(value);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleInputBlur = () => {
    const numValue = parseFloat(inputValue);
    if (!isNaN(numValue)) {
      let minutes: number;
      switch (unit) {
        case 'hours':
          minutes = Math.round(numValue * 60);
          break;
        case 'days':
          minutes = Math.round(numValue * 1440);
          break;
        default:
          minutes = Math.round(numValue);
      }
      setLocalValue(minutes);
    }
  };

  const handlePresetClick = (value: number) => {
    setLocalValue(value);
  };

  const handleUseDefault = () => {
    if (apiDefaultMinutes) {
      setLocalValue(apiDefaultMinutes);
    } else {
      setLocalValue(300);
    }
  };

  const handleClearCustomization = () => {
    onSave(null);
    onClose();
  };

  const handleSave = () => {
    onSave(localValue);
    onClose();
  };

  const getSliderMin = () => 30;
  const getSliderMax = () => 14400;

  const formatDisplayDuration = (minutes: number): string => {
    if (minutes < 120) {
      return `${minutes} minutes`;
    } else if (minutes < 10080) {
      const hours = Math.round(minutes / 60);
      return `${hours} hour${hours !== 1 ? 's' : ''}`;
    } else {
      const days = Math.round(minutes / 1440);
      return `${days} day${days !== 1 ? 's' : ''}`;
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        backgroundColor: theme.card,
        backdropFilter: 'blur(100px)',
        WebkitBackdropFilter: 'blur(100px)',
        border: `1px solid ${theme.glassBorder}`,
        borderRadius: '12px',
        padding: '20px',
        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.5)',
        zIndex: 1000,
        minWidth: '320px',
        fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: '14px',
            fontWeight: 600,
            color: theme.textMain,
          }}
        >
          Customize Period
        </h3>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: theme.textSec,
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <X size={16} />
        </button>
      </div>

      <div
        style={{ marginBottom: '16px', fontSize: '12px', color: theme.textSec }}
      >
        <div style={{ marginBottom: '4px' }}>
          <strong>{metricLabel}</strong>
        </div>
        {apiDefaultMinutes && (
          <div>API default: {formatDisplayDuration(apiDefaultMinutes)}</div>
        )}
        {currentCustomMinutes && currentCustomMinutes !== apiDefaultMinutes && (
          <div style={{ color: theme.accentYellow }}>
            Current custom: {formatDisplayDuration(currentCustomMinutes)}
          </div>
        )}
      </div>

      <div style={{ marginBottom: '16px' }}>
        <input
          type="range"
          min={getSliderMin()}
          max={getSliderMax()}
          step={30}
          value={localValue}
          onChange={handleSliderChange}
          style={{
            width: '100%',
            marginBottom: '8px',
            accentColor: theme.accentGreen,
          }}
        />
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '10px',
            color: theme.textSec,
          }}
        >
          {presets.map((preset) => (
            <button
              key={preset.label}
              onClick={() => handlePresetClick(preset.value)}
              style={{
                background:
                  localValue === preset.value
                    ? theme.accentGreen
                    : 'transparent',
                color: localValue === preset.value ? '#000' : theme.textSec,
                border: `1px solid ${theme.border}`,
                borderRadius: '4px',
                padding: '2px 6px',
                fontSize: '9px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            type="number"
            value={inputValue}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            min="1"
            style={{
              flex: 1,
              backgroundColor: theme.glassBg,
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              color: theme.textMain,
              border: `1px solid ${theme.glassBorder}`,
              borderRadius: '6px',
              padding: '8px',
              fontSize: '13px',
              outline: 'none',
            }}
          />
          <select
            value={unit}
            onChange={(e) =>
              setUnit(e.target.value as 'minutes' | 'hours' | 'days')
            }
            style={{
              backgroundColor: theme.card,
              color: theme.textMain,
              border: `1px solid ${theme.glassBorder}`,
              borderRadius: '6px',
              padding: '8px',
              fontSize: '13px',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="minutes">minutes</option>
            <option value="hours">hours</option>
            <option value="days">days</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button
          onClick={handleUseDefault}
          style={{
            flex: '1 1 auto',
            padding: '8px 12px',
            borderRadius: '6px',
            border: `1px solid ${theme.border}`,
            backgroundColor: 'transparent',
            color: theme.textSec,
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 500,
          }}
        >
          Use API Default
        </button>
        <button
          onClick={handleClearCustomization}
          style={{
            flex: '1 1 auto',
            padding: '8px 12px',
            borderRadius: '6px',
            border: `1px solid ${theme.accentRed}`,
            backgroundColor: 'transparent',
            color: theme.accentRed,
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 500,
          }}
        >
          Clear Custom
        </button>
        <button
          onClick={handleSave}
          style={{
            flex: '2 1 auto',
            padding: '8px 16px',
            borderRadius: '6px',
            border: 'none',
            backgroundColor: theme.accentGreen,
            color: '#000',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 600,
          }}
        >
          Save ({formatDisplayDuration(localValue)})
        </button>
      </div>
    </div>
  );
};

export const PopupOverlay: React.FC<{ onClick: () => void }> = ({
  onClick,
}) => (
  <div
    onClick={onClick}
    style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      backdropFilter: 'blur(4px)',
      WebkitBackdropFilter: 'blur(4px)',
      zIndex: 999,
    }}
  />
);
