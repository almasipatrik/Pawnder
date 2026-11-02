'use client';

import React from 'react';
import Slider, { type SliderProps } from '@mui/material/Slider';
import { styled } from '@mui/material/styles';

const StyledPawnderSlider = styled(Slider)({
  color: '#6d28d9',
  height: 8,
  padding: '13px 0',
  boxSizing: 'border-box',
  maxWidth: '100%',
  '& .MuiSlider-track': {
    border: 'none',
    height: 8,
    borderRadius: 999,
    background: 'linear-gradient(90deg, #5b21b6 0%, #7c3aed 60%, #e11d48 100%)',
  },
  '& .MuiSlider-rail': {
    color: '#e9d5ff',
    opacity: 1,
    height: 8,
    borderRadius: 999,
  },
  '& .MuiSlider-mark': {
    backgroundColor: '#c4b5fd',
    height: 5,
    width: 5,
    borderRadius: '50%',
    '&.MuiSlider-markActive': {
      opacity: 0.9,
      backgroundColor: '#ffffff',
    },
  },
  '& .MuiSlider-thumb': {
    touchAction: 'none',
    height: 22,
    width: 22,
    backgroundColor: '#ffffff',
    border: '4px solid #6d28d9',
    boxShadow: '0 4px 12px rgba(109, 40, 217, 0.32)',
    transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease',
    '&:focus, &:hover, &.Mui-active, &.Mui-focusVisible': {
      boxShadow: '0 0 0 7px rgba(124, 58, 237, 0.18), 0 4px 12px rgba(109, 40, 217, 0.35)',
      borderColor: '#5b21b6',
      // Keep MUI's centering translate, otherwise the thumb jumps down while active
      transform: 'translate(-50%, -50%) scale(1.06)',
    },
    '&::before': {
      display: 'none',
    },
  },
  '& .MuiSlider-valueLabel': {
    zIndex: 100,
    lineHeight: 1.2,
    fontSize: 11,
    fontWeight: 800,
    padding: '3px 8px',
    borderRadius: 8,
    backgroundColor: '#231942',
    color: '#ffffff',
    boxShadow: '0 4px 14px rgba(35, 25, 66, 0.35)',
    '&::before': {
      display: 'none',
    },
  },
});

export interface PawnderSliderProps {
  value: number | number[];
  min: number;
  max: number;
  step?: number;
  marks?: boolean | SliderProps['marks'];
  onChange: (newValue: number | number[]) => void;
  valueLabelFormat?: (value: number) => string;
  valueLabelDisplay?: 'auto' | 'on' | 'off';
  ariaLabel?: string;
}

export default function PawnderSlider({
  value,
  min,
  max,
  step = 1,
  marks = false,
  onChange,
  valueLabelFormat,
  valueLabelDisplay = 'auto',
  ariaLabel,
}: PawnderSliderProps) {
  return (
    <div className="w-full px-3.5 sm:px-4 pt-3 pb-1 flex items-center box-border overflow-visible touch-none select-none">
      <StyledPawnderSlider
        value={value}
        min={min}
        max={max}
        step={step}
        marks={marks}
        aria-label={ariaLabel}
        valueLabelDisplay={valueLabelDisplay}
        valueLabelFormat={valueLabelFormat}
        onChange={(_, val) => onChange(val)}
      />
    </div>
  );
}
