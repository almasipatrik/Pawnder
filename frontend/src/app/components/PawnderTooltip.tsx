'use client';

import React from 'react';
import Tooltip, { TooltipProps, tooltipClasses } from '@mui/material/Tooltip';
import { styled } from '@mui/material/styles';

/**
 * Custom styled MUI Tooltip matching Pawnder's dark purple & rounded aesthetics.
 */
export const PawnderTooltip = styled(({ className, ...props }: TooltipProps) => (
  <Tooltip {...props} classes={{ popper: className }} arrow enterDelay={250} leaveDelay={100} />
))(() => ({
  [`& .${tooltipClasses.arrow}`]: {
    color: '#231942',
  },
  [`& .${tooltipClasses.tooltip}`]: {
    backgroundColor: '#231942',
    color: '#ffffff',
    fontSize: '11px',
    fontWeight: 700,
    borderRadius: '10px',
    padding: '5px 10px',
    boxShadow: '0 8px 22px -3px rgba(35, 25, 66, 0.35)',
    letterSpacing: '0.01em',
    fontFamily: 'inherit',
  },
}));

export default PawnderTooltip;

