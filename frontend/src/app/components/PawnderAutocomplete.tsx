'use client';

import React from 'react';
import Autocomplete, { createFilterOptions } from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import { styled } from '@mui/material/styles';

export interface AutocompleteOption {
  value: string;
  label: string;
  zip?: string;
  city?: string;
}

export interface PawnderAutocompleteProps {
  label?: string | React.ReactNode;
  value: string;
  options: AutocompleteOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  emptyValue?: string;
  disableClearable?: boolean;
  limit?: number;
  freeSolo?: boolean;
  openOnFocus?: boolean;
  selectOnFocus?: boolean;
  autoHighlight?: boolean;
  autoComplete?: boolean;
  autoSelect?: boolean;
  clearOnBlur?: boolean;
}

const StyledTextField = styled(TextField)(() => ({
  '& .MuiOutlinedInput-root': {
    borderRadius: '12px',
    backgroundColor: 'rgba(250, 245, 255, 0.75)',
    fontSize: '16px',
    '@media (min-width: 640px)': {
      fontSize: '11.5px',
    },
    fontWeight: 700,
    color: '#231942',
    fontFamily: 'inherit',
    padding: '2px 6px',
    transition: 'all 0.15s ease-in-out',
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
    '& input': {
      padding: '4px 6px',
      fontSize: '16px',
      '@media (min-width: 640px)': {
        fontSize: '11.5px',
      },
      fontWeight: 700,
      color: '#231942',
      fontFamily: 'inherit',
    },
  },
  '& .MuiAutocomplete-popupIndicator, & .MuiAutocomplete-clearIndicator': {
    color: '#7c3aed',
    padding: '3px',
    '&:hover': {
      backgroundColor: 'rgba(124, 58, 237, 0.08)',
    },
  },
}));

const filterOptions = createFilterOptions<AutocompleteOption>({
  matchFrom: 'any',
  stringify: (option) => `${option.label} ${option.value}`,
});

export default function PawnderAutocomplete({
  label,
  value,
  options,
  onChange,
  placeholder = 'Keresés gépeléssel...',
  className = '',
  disabled = false,
  emptyValue = 'Any',
  disableClearable = false,
  limit = 100,
  freeSolo = false,
  openOnFocus = true,
  selectOnFocus = true,
  autoHighlight = true,
  autoComplete = true,
  autoSelect = true,
  clearOnBlur = false,
}: PawnderAutocompleteProps) {
  const customFilter = React.useMemo(() => {
    return createFilterOptions<AutocompleteOption>({
      matchFrom: 'any',
      limit,
      stringify: (option) =>
        typeof option === 'string'
          ? option
          : `${option.label} ${option.value} ${option.zip || ''} ${option.city || ''}`,
    });
  }, [limit]);

  const selectedOption = React.useMemo(() => {
    return (
      options.find((o) => o.value.toLowerCase() === (value || '').toLowerCase()) ||
      (value && value !== emptyValue
        ? { value, label: value }
        : options[0] || { value: emptyValue, label: 'mindegy' })
    );
  }, [options, value, emptyValue]);

  return (
    <div className={`flex flex-col min-w-0 ${className}`}>
      {label && (
        <label className="block font-bold text-gray-700 mb-0.5 text-[11px] truncate">
          {label}
        </label>
      )}
      <Autocomplete
        size="small"
        freeSolo={freeSolo}
        disabled={disabled}
        options={options}
        value={selectedOption}
        filterOptions={customFilter}
        autoHighlight={autoHighlight}
        autoComplete={autoComplete}
        autoSelect={autoSelect}
        openOnFocus={openOnFocus}
        selectOnFocus={selectOnFocus}
        clearOnBlur={clearOnBlur}
        disableClearable={disableClearable}
        getOptionLabel={(opt) => {
          if (!opt) return '';
          if (typeof opt === 'string') return opt;
          return opt.label || opt.value || '';
        }}
        isOptionEqualToValue={(opt, val) => {
          if (!opt || !val) return false;
          const optVal = typeof opt === 'string' ? opt : opt.value;
          const valVal = typeof val === 'string' ? val : val.value;
          return optVal.toLowerCase() === valVal.toLowerCase();
        }}
        onChange={(_, newValue) => {
          if (!newValue) {
            onChange(emptyValue);
          } else if (typeof newValue === 'string') {
            onChange(newValue);
          } else {
            onChange(newValue.value);
          }
        }}
        onInputChange={(_, newInputValue, reason) => {
          if (freeSolo && reason === 'input') {
            onChange(newInputValue);
          }
        }}
        slotProps={{
          paper: {
            className: 'custom-scrollbar',
            sx: {
              borderRadius: '16px',
              marginTop: '6px',
              backgroundColor: '#ffffff',
              boxShadow:
                '0 16px 36px -6px rgba(35, 25, 66, 0.2), 0 4px 14px rgba(109, 40, 217, 0.12)',
              border: '1px solid rgba(221, 214, 254, 0.85)',
              padding: '4px',
              '& .MuiAutocomplete-listbox': {
                maxHeight: 260,
                padding: 0,
                '& .MuiAutocomplete-option': {
                  fontSize: '14px',
                  fontWeight: 600,
                  borderRadius: '10px',
                  margin: '2px 0',
                  padding: '8px 12px',
                  color: '#231942',
                  fontFamily: 'inherit',
                  transition: 'all 0.12s ease',
                  '@media (min-width: 640px)': {
                    fontSize: '11.5px',
                    padding: '6px 10px',
                  },
                  '&:hover, &.Mui-focused': {
                    backgroundColor: 'rgba(124, 58, 237, 0.08)',
                    color: '#5b21b6',
                  },
                  '&[aria-selected="true"]': {
                    backgroundColor: 'rgba(124, 58, 237, 0.14) !important',
                    color: '#5b21b6',
                    fontWeight: 800,
                  },
                },
              },
            },
          },
        }}
        renderInput={(params) => (
          <StyledTextField
            {...params}
            placeholder={placeholder}
            variant="outlined"
            onFocus={(e) => {
              if (selectOnFocus && e.target instanceof HTMLInputElement) {
                e.target.select();
              }
            }}
          />
        )}
      />
    </div>
  );
}

