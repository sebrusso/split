/**
 * Mock for expo-linear-gradient
 */

import React from 'react';

export const LinearGradient = ({ children, style, colors, ...props }: {
  children?: React.ReactNode;
  style?: any;
  colors?: string[];
  start?: { x: number; y: number };
  end?: { x: number; y: number };
}) => {
  const { View } = require('react-native');
  return React.createElement(View, { style, ...props }, children);
};

export default { LinearGradient };
