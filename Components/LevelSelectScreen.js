import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import quotes from '../assets/quotes_500.json';

const PROGRESS_KEY = 'quote_level_progress';

export default function LevelSelectScreen({ navigation }) {
  const [unlockedLevel, setUnlockedLevel] = useState(0);

// LevelSelectScreen.js
const QUOTE_UNLOCK_KEY = 'quote_unlocked';

useEffect(() => {
  const loadProgress = async () => {
    const saved = await AsyncStorage.getItem(QUOTE_UNLOCK_KEY);
    if (saved) setUnlockedLevel(JSON.parse(saved).unlockedLevel || 0);
  };
  loadProgress();
}, []);

  const handleSelect = (index) => {
    if (index <= unlockedLevel) {
      navigation.navigate('Game', { levelIndex: index });
    }
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={quotes}
        keyExtractor={(_, i) => i.toString()}
        numColumns={5}
        renderItem={({ item, index }) => {
          const locked = index > unlockedLevel;
          return (
            <Pressable
              style={[styles.levelBox, locked && styles.locked]}
              onPress={() => handleSelect(index)}
            >
              <Text style={styles.levelText}>{index + 1}</Text>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, justifyContent: 'center' },
  levelBox: {
    width: 60,
    height: 60,
    margin: 6,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#007BFF',
    borderRadius: 8,
  },
  levelText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  locked: { backgroundColor: '#999' },
});
