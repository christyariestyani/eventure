import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

interface Props {
  onFinish: () => void;
}

export default function AppSplash({ onFinish }: Props) {
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const dotsOpacity = useRef(new Animated.Value(0)).current;
  const containerOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 7,
          tension: 60,
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(100),
      Animated.parallel([
        Animated.timing(taglineOpacity, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }),
        Animated.timing(dotsOpacity, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(900),
      Animated.timing(containerOpacity, {
        toValue: 0,
        duration: 350,
        useNativeDriver: true,
      }),
    ]).start(() => onFinish());
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: containerOpacity }]}>
      {/* Decorative circles */}
      <View style={[styles.circle, styles.circleTR]} />
      <View style={[styles.circle, styles.circleBL]} />
      <View style={[styles.circle, styles.circleMid]} />

      <Animated.View
        style={[
          styles.content,
          { opacity: logoOpacity, transform: [{ scale: logoScale }] },
        ]}
      >
        <Animated.Text style={[styles.dots, { opacity: dotsOpacity }]}>
          ✦  ✦  ✦
        </Animated.Text>

        <Text style={styles.logo}>eventure</Text>

        <Animated.Text style={[styles.tagline, { opacity: taglineOpacity }]}>
          Temukan Momen Terbaikmu
        </Animated.Text>
      </Animated.View>

      <Animated.Text style={[styles.footer, { opacity: taglineOpacity }]}>
        🎟  Tiket · Hotel · Transportasi
      </Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  circle: {
    position: 'absolute',
    borderRadius: 9999,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  circleTR: {
    width: 340,
    height: 340,
    top: -100,
    right: -100,
  },
  circleBL: {
    width: 260,
    height: 260,
    bottom: -60,
    left: -80,
  },
  circleMid: {
    width: 180,
    height: 180,
    top: height * 0.55,
    right: -40,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  content: {
    alignItems: 'center',
    gap: 10,
  },
  dots: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    letterSpacing: 4,
    marginBottom: 4,
  },
  logo: {
    fontSize: 52,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -1.5,
  },
  tagline: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: 0.4,
    marginTop: 2,
  },
  footer: {
    position: 'absolute',
    bottom: 60,
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 0.5,
  },
});
