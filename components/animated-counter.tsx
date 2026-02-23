import { useEffect, useState } from 'react';
import { StyleProp, TextStyle } from 'react-native';
import {
    Easing,
    runOnJS,
    useAnimatedReaction,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';
import { ThemedText } from './themed-text';

interface AnimatedCounterProps {
  value: number;
  style?: StyleProp<TextStyle>;
  prefix?: string;
  suffix?: string;
  duration?: number;
  formatValue?: (value: number) => string;
}

// Default formatter that abbreviates large numbers
const defaultFormat = (value: number): string => {
  const num = Math.floor(value);
  if (num >= 1_000_000_000) {
    return (num / 1_000_000_000).toFixed(1) + 'B';
  }
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1) + 'M';
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(1) + 'K';
  }
  return num.toLocaleString();
};

export function AnimatedCounter({
  value,
  style,
  prefix = '',
  suffix = '',
  duration = 500,
  formatValue = defaultFormat,
}: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const animatedValue = useSharedValue(value);

  useEffect(() => {
    animatedValue.value = withTiming(value, {
      duration,
      easing: Easing.out(Easing.cubic),
    });
  }, [value, duration, animatedValue]);

  // Update the display value on every frame during animation
  useAnimatedReaction(
    () => animatedValue.value,
    (currentValue) => {
      runOnJS(setDisplayValue)(currentValue);
    },
    [animatedValue]
  );

  return (
    <ThemedText style={style}>
      {`${prefix}${formatValue(displayValue)}${suffix}`}
    </ThemedText>
  );
}
