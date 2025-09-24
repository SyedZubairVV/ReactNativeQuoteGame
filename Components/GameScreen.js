import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
  Pressable,
  Alert,
} from 'react-native';
import * as Animatable from 'react-native-animatable';
import AsyncStorage from '@react-native-async-storage/async-storage';
import quotes from '../assets/quotes_500.json';

const QUOTE_LEVEL_KEY = 'quote_level';       // <- current active level
const QUOTE_PROGRESS_KEY = 'quote_progress'; // <- single active save (guesses for current level)
const QUOTE_TIMER_KEY = 'quote_timer';       // <- single active timer (for current level)
const QUOTE_UNLOCK_KEY = 'quote_unlocked';   // <- highest unlocked level { unlockedLevel: number }

export default function GameScreen({ route, navigation }) {
  // Safe default to level 0 if params not provided
  const levelIndex = route?.params?.levelIndex ?? 0;
  const quote = quotes[levelIndex];

  // Count only letters for fairness
  const letterCount = (quote.q.match(/[a-zA-Z]/g) || []).length;
  const MAX_WRONG = Math.max(5, Math.floor(letterCount * 0.15)); // ~15% of letters, min 5

  const [loading, setLoading] = useState(true);
  const [charMap, setCharMap] = useState([]);

  const [guessedLetters, setGuessedLetters] = useState([]); // [{index, letter}]
  const [wrongGuesses, setWrongGuesses] = useState([]);     // [{index, letter}]
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [previewLetter, setPreviewLetter] = useState('');
  const [lastGuessFeedback, setLastGuessFeedback] = useState(null);

  const [shuffledAlphabet, setShuffledAlphabet] = useState([]);
  const [secondsElapsed, setSecondsElapsed] = useState(0);

  const inputRef = useRef(null);
  const timerRef = useRef(null);

  // ---------- utils ----------
  const shuffleAlphabet = () => {
    const alphabet = 'abcdefghijklmnopqrstuvwxyz'.split('');
    for (let i = alphabet.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [alphabet[i], alphabet[j]] = [alphabet[j], alphabet[i]];
    }
    return alphabet;
  };

  const startTimer = () => {
    if (timerRef.current) return;
    timerRef.current = setInterval(() => {
      setSecondsElapsed(prev => {
        const t = prev + 1;
        // single active save → always save under one key
        AsyncStorage.setItem(QUOTE_TIMER_KEY, JSON.stringify(t));
        return t;
      });
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const resetTimer = async () => {
    stopTimer();
    setSecondsElapsed(0);
    await AsyncStorage.removeItem(QUOTE_TIMER_KEY);
  };

  const clearActiveSave = async () => {
    await AsyncStorage.multiRemove([QUOTE_PROGRESS_KEY, QUOTE_TIMER_KEY]);
  };

  const persistProgress = async (newGuessed, newWrong) => {
    await AsyncStorage.setItem(
      QUOTE_PROGRESS_KEY,
      JSON.stringify({
        levelIndex,
        guessedLetters: newGuessed,
        wrongGuesses: newWrong,
      })
    );
  };

  // ---------- initial setup / level switching ----------
  useEffect(() => {
    let mounted = true;

    const setup = async () => {
      try {
        // Build char map for the current quote
        const mapped = [];
        let globalIndex = 0;
        const words = quote.q.split(' ');
        words.forEach((word, wordIndex) => {
          word.split('').forEach((char) => {
            mapped.push({
              char,
              index: globalIndex,
              wordIndex,
              isLetter: /[a-zA-Z]/.test(char),
            });
            globalIndex++;
          });
          if (wordIndex < words.length - 1) {
            mapped.push({ char: ' ', index: globalIndex, isLetter: false, wordIndex });
            globalIndex++;
          }
        });
        if (!mounted) return;
        setCharMap(mapped);

        // Check current active level
        const storedLevel = await AsyncStorage.getItem(QUOTE_LEVEL_KEY);
        const storedLevelIndex = storedLevel !== null ? Number(storedLevel) : null;

        if (storedLevelIndex === levelIndex) {
          // Same level as the one saved → restore progress + timer
          const [savedProgress, savedTime] = await Promise.all([
            AsyncStorage.getItem(QUOTE_PROGRESS_KEY),
            AsyncStorage.getItem(QUOTE_TIMER_KEY),
          ]);

          if (savedProgress) {
            const parsed = JSON.parse(savedProgress);
            // Safety: ensure the saved slot is indeed for this level
            if (parsed.levelIndex === levelIndex) {
              setGuessedLetters(parsed.guessedLetters || []);
              setWrongGuesses(parsed.wrongGuesses || []);
            } else {
              // Mismatch (rare) → clear and start fresh
              await clearActiveSave();
            }
          }

          if (savedTime) {
            setSecondsElapsed(parseInt(savedTime, 10) || 0);
          }
        } else {
          // Different level selected → clear the single active save
          await clearActiveSave();
          await AsyncStorage.setItem(QUOTE_LEVEL_KEY, String(levelIndex));

          // Prefill 10% (min 3) for a fresh run and immediately persist so it resumes after relaunch
          const letters = mapped.filter(c => c.isLetter);
          const numToPrefill = Math.max(3, Math.floor(letters.length * 0.1));
          const chosen = new Set();
          while (chosen.size < numToPrefill) {
            const r = Math.floor(Math.random() * letters.length);
            chosen.add(letters[r].index);
          }
          const prefilled = Array.from(chosen).map(index => ({
            index,
            letter: quote.q[index],
          }));

          setGuessedLetters(prefilled);
          setWrongGuesses([]);
          await persistProgress(prefilled, []);
        }

        // Start / resume timer
        startTimer();

        setShuffledAlphabet(shuffleAlphabet());
      } catch (e) {
        console.error('setup error:', e);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    setup();
    return () => {
      mounted = false;
      stopTimer();
    };
  }, [levelIndex, quote.q]);

  // ---------- guessing ----------
  const handleConfirmGuess = async () => {
    if (!previewLetter || selectedIndex === null) return;

    const lowerGuess = previewLetter.trim().toLowerCase();
    const targetChar = quote.q[selectedIndex];

    // already guessed correctly at this index
    if (guessedLetters.find(g => g.index === selectedIndex)) {
      setPreviewLetter('');
      return;
    }

    let newGuessed = [...guessedLetters];
    let newWrong = [...wrongGuesses];

    if (lowerGuess === targetChar.toLowerCase()) {
      newGuessed.push({ index: selectedIndex, letter: targetChar });
      setGuessedLetters(newGuessed);
      setLastGuessFeedback({ index: selectedIndex, type: 'correct' });
    } else {
      newWrong.push({ index: selectedIndex, letter: lowerGuess });
      setWrongGuesses(newWrong);
      setLastGuessFeedback({ index: selectedIndex, type: 'wrong' });
    }

    // Persist the single active save (for current level only)
    await persistProgress(newGuessed, newWrong);

    setPreviewLetter('');
    setSelectedIndex(null);

    // ---- Win / Lose checks ----
    const allLetterIndices = charMap.filter(c => c.isLetter).map(c => c.index);
    const guessedIndices = newGuessed.map(g => g.index);
    const won = allLetterIndices.every(i => guessedIndices.includes(i));

    if (won) {
      stopTimer();
      await clearActiveSave(); // clear single active save on win

      // Update highest unlocked
      const saved = await AsyncStorage.getItem(QUOTE_UNLOCK_KEY);
      let progress = saved ? JSON.parse(saved) : { unlockedLevel: 0 };
      if (progress.unlockedLevel < levelIndex + 1) {
        progress.unlockedLevel = levelIndex + 1;
        await AsyncStorage.setItem(QUOTE_UNLOCK_KEY, JSON.stringify(progress));
      }

      Alert.alert('🎉 Correct! Level Complete', '', [
        { text: 'OK', onPress: () => navigation?.goBack?.() },
      ]);
      return;
    }

    if (newWrong.length >= MAX_WRONG) {
      stopTimer();
      await clearActiveSave(); // clear single active save on lose
      Alert.alert('❌ Too many wrong guesses', 'Try again!', [
        { text: 'OK' },
      ]);
      // Reset UI state but keep on same level
      setGuessedLetters([]);
      setWrongGuesses([]);
      setPreviewLetter('');
      setSelectedIndex(null);
      await resetTimer();
      startTimer();
    }
  };

  if (loading) {
    return <ActivityIndicator size="large" color="#0000ff" />;
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <TouchableWithoutFeedback onPress={Platform.OS !== 'web' ? Keyboard.dismiss : null}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

          <Text style={styles.timer}>
            Time: {Math.floor(secondsElapsed / 60).toString().padStart(2, '0')}:
            {(secondsElapsed % 60).toString().padStart(2, '0')}
          </Text>

          <Text style={styles.wrongCounter}>
            Wrong guesses: {wrongGuesses.length}/{MAX_WRONG}
          </Text>

          <View style={styles.quoteRow}>
            {Array.from(new Set(charMap.map(c => c.wordIndex))).map(wordIndex => (
              <View key={wordIndex} style={styles.wordBox}>
                {charMap
                  .filter(c => c.wordIndex === wordIndex)
                  .map((c) => {
                    const guessedObj = guessedLetters.find(g => g.index === c.index);

                    let displayChar = '_';
                    if (!c.isLetter) displayChar = c.char;
                    else if (guessedObj) displayChar = guessedObj.letter;
                    else if (selectedIndex === c.index && previewLetter) displayChar = previewLetter;

                    const isSelected = selectedIndex === c.index;
                    const alphabetIndex = c.isLetter
                      ? shuffledAlphabet.indexOf(c.char.toLowerCase()) + 1
                      : null;

                    return (
                      <Pressable
                        key={c.index}
                        onPress={() => {
                          if (c.isLetter) {
                            setSelectedIndex(c.index);
                            inputRef.current?.focus();
                          }
                        }}
                      >
                        <Animatable.View
                          animation={lastGuessFeedback?.index === c.index ? 'bounceIn' : undefined}
                          duration={1500}
                          style={[
                            c.char !== ' ' && styles.charBox,
                            isSelected && styles.selectedCharBox,
                          ]}
                        >
                          {lastGuessFeedback?.index === c.index && (
                            <Animatable.View
                              animation="fadeOut"
                              duration={1500}
                              onAnimationEnd={() => {
                                if (lastGuessFeedback?.index === c.index) setLastGuessFeedback(null);
                              }}
                              style={[
                                StyleSheet.absoluteFill,
                                lastGuessFeedback.type === 'correct' ? styles.correctFade : styles.wrongFade,
                              ]}
                            />
                          )}
                          <Text style={styles.charText}>{displayChar}</Text>
                          {c.isLetter && <Text style={styles.clueText}>{alphabetIndex}</Text>}
                        </Animatable.View>
                      </Pressable>
                    );
                  })}
                <View style={{ width: 10 }} />
              </View>
            ))}
          </View>

          <Text style={styles.authorText}>— {quote.a}</Text>

          <TextInput
            ref={inputRef}
            value={previewLetter}
            onChangeText={setPreviewLetter}
            onSubmitEditing={handleConfirmGuess}
            maxLength={1}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
          />
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timer: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  wrongCounter: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#d9534f',
    marginBottom: 12,
    textAlign: 'center',
  },
  authorText: {
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
    marginTop: 12,
  },
  quoteRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 20,
  },
  charBox: {
    margin: 3,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 5,
    borderColor: '#ccc',
    padding: 5,
    overflow: 'hidden',
  },
  selectedCharBox: {
    borderBottomWidth: 2,
    borderColor: '#007BFF',
  },
  correctFade: {
    backgroundColor: 'rgba(40, 167, 69, 0.3)',
    borderRadius: 4,
  },
  wrongFade: {
    backgroundColor: 'rgba(220, 53, 69, 0.3)',
    borderRadius: 4,
  },
  charText: {
    fontSize: 24,
    textAlign: 'center',
  },
  clueText: {
    fontSize: 10,
    color: '#999',
  },
  wordBox: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    marginBottom: 6,
    flexShrink: 0,
  },
});
