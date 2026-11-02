'use client';

import React from 'react';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import { styled } from '@mui/material/styles';

export interface SelectOption {
  value: string;
  label: string;
}

export interface PawnderSelectProps {
  label?: string | React.ReactNode;
  value: string;
  options: (SelectOption | string)[];
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  size?: 'small' | 'medium';
  placeholder?: string;
  fullWidth?: boolean;
}

const StyledSelect = styled(Select)(() => ({
  borderRadius: '12px',
  backgroundColor: 'rgba(250, 245, 255, 0.75)',
  fontSize: '11.5px',
  fontWeight: 700,
  color: '#231942',
  transition: 'all 0.15s ease-in-out',
  fontFamily: 'inherit',
  '&:hover': {
    backgroundColor: '#ffffff',
  },
  '& .MuiOutlinedInput-notchedOutline': {
    borderColor: '#e9d5ff',
    borderWidth: '1.5px',
  },
  '&:hover .MuiOutlinedInput-notchedOutline': {
    borderColor: '#c4b5fd',
  },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
    borderColor: '#7c3aed',
    borderWidth: '2px',
    boxShadow: '0 0 0 3px rgba(124, 58, 237, 0.14)',
  },
  '& .MuiSelect-select': {
    padding: '6px 10px',
    paddingRight: '28px !important',
    display: 'flex',
    alignItems: 'center',
    lineHeight: 1.3,
    minHeight: 'auto',
  },
  '& .MuiSelect-icon': {
    color: '#7c3aed',
    right: 6,
    fontSize: '18px',
    transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  '&.Mui-focused .MuiSelect-icon': {
    transform: 'rotate(180deg)',
  },
}));

const MENU_PROPS = {
  disableScrollLock: true,
  PaperProps: {
    className: 'custom-scrollbar',
    sx: {
      borderRadius: '16px',
      marginTop: '6px',
      maxHeight: 260,
      backgroundColor: '#ffffff',
      boxShadow:
        '0 16px 36px -6px rgba(35, 25, 66, 0.2), 0 4px 14px rgba(109, 40, 217, 0.12)',
      border: '1px solid rgba(221, 214, 254, 0.85)',
      padding: '4px',
      '& .MuiMenuItem-root': {
        fontSize: '11.5px',
        fontWeight: 600,
        borderRadius: '10px',
        margin: '2px 0',
        padding: '6px 10px',
        color: '#231942',
        fontFamily: 'inherit',
        transition: 'all 0.12s ease',
        '&:hover': {
          backgroundColor: 'rgba(124, 58, 237, 0.08)',
          color: '#5b21b6',
        },
        '&.Mui-selected': {
          backgroundColor: 'rgba(124, 58, 237, 0.14)',
          color: '#5b21b6',
          fontWeight: 800,
          '&:hover': {
            backgroundColor: 'rgba(124, 58, 237, 0.2)',
          },
        },
      },
    },
  },
};

export default function PawnderSelect({
  label,
  value,
  options,
  onChange,
  className = '',
  disabled = false,
  fullWidth = true,
}: PawnderSelectProps) {
  const normalizedOptions: SelectOption[] = React.useMemo(() => {
    return options.map((opt) =>
      typeof opt === 'string' ? { value: opt, label: opt } : opt,
    );
  }, [options]);

  const handleChange = (e: SelectChangeEvent<unknown>) => {
    onChange(String(e.target.value));
  };

  return (
    <div className={`flex flex-col min-w-0 ${className}`}>
      {label && (
        <label className="block font-bold text-gray-700 mb-0.5 text-[11px] truncate">
          {label}
        </label>
      )}
      <FormControl size="small" fullWidth={fullWidth} disabled={disabled}>
        <StyledSelect
          value={value}
          onChange={handleChange}
          MenuProps={MENU_PROPS}
          displayEmpty
        >
          {normalizedOptions.map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>
              {opt.label}
            </MenuItem>
          ))}
        </StyledSelect>
      </FormControl>
    </div>
  );
}

