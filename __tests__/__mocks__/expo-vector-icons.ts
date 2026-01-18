/**
 * Mock for @expo/vector-icons
 */

import React from 'react';

const createIconMock = (name: string) => {
  return ({ size, color, style, ...props }: {
    name?: string;
    size?: number;
    color?: string;
    style?: any;
  }) => {
    const { Text } = require('react-native');
    return React.createElement(Text, { style, ...props }, `[${name}]`);
  };
};

export const Ionicons = createIconMock('Ionicons');
export const MaterialIcons = createIconMock('MaterialIcons');
export const FontAwesome = createIconMock('FontAwesome');
export const Feather = createIconMock('Feather');
export const AntDesign = createIconMock('AntDesign');
export const Entypo = createIconMock('Entypo');
export const EvilIcons = createIconMock('EvilIcons');
export const FontAwesome5 = createIconMock('FontAwesome5');
export const Foundation = createIconMock('Foundation');
export const MaterialCommunityIcons = createIconMock('MaterialCommunityIcons');
export const Octicons = createIconMock('Octicons');
export const SimpleLineIcons = createIconMock('SimpleLineIcons');
export const Zocial = createIconMock('Zocial');

export default {
  Ionicons,
  MaterialIcons,
  FontAwesome,
  Feather,
  AntDesign,
  Entypo,
  EvilIcons,
  FontAwesome5,
  Foundation,
  MaterialCommunityIcons,
  Octicons,
  SimpleLineIcons,
  Zocial,
};
