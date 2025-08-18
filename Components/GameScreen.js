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
} from 'react-native';
import * as Animatable from 'react-native-animatable';
import AsyncStorage from '@react-native-async-storage/async-storage';

const QUOTE_PROGRESS_KEY = 'quote_progress';
const QUOTE_TIMER_KEY = 'quote_timer';

const QuoteScreen = () => {
  const [quote, setQuote] = useState({
    q: "Do not spoil what you have by desiring what you have not.",
    a: "Epicurus",
  });

  const [loading, setLoading] = useState(true);
  const [guessedLetters, setGuessedLetters] = useState([]);
  const [guess, setGuess] = useState('');
  const [wrongGuesses, setWrongGuesses] = useState([]);
  const [shuffledAlphabet, setShuffledAlphabet] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [charMap, setCharMap] = useState([]);
  const [previewLetter, setPreviewLetter] = useState('');
  const [lastGuessFeedback, setLastGuessFeedback] = useState(null);
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const inputRef = useRef(null);
  const timerRef = useRef(null);

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
        const newTime = prev + 1;
        AsyncStorage.setItem(QUOTE_TIMER_KEY, JSON.stringify(newTime));
        return newTime;
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

  useEffect(() => {
    const loadProgress = async () => {
      try {
        const [savedProgress, savedTime] = await Promise.all([
          AsyncStorage.getItem(QUOTE_PROGRESS_KEY),
          AsyncStorage.getItem(QUOTE_TIMER_KEY),
        ]);

        if (savedProgress) {
          const parsed = JSON.parse(savedProgress);
          setGuessedLetters(parsed.guessedLetters || []);
          setWrongGuesses(parsed.wrongGuesses || []);
        }

        if (savedTime) {
          setSecondsElapsed(parseInt(savedTime));
        }

        startTimer();
      } catch (e) {
        console.error('Failed to load progress:', e);
      }
    };

    const setupQuote = () => {
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
      setCharMap(mapped);

      // Prefill 10% letters, min 3
      const letters = mapped.filter(c => c.isLetter);
      const numToPrefill = Math.max(3, Math.floor(letters.length * 0.1));
      const chosenIndices = new Set();

      while (chosenIndices.size < numToPrefill) {
        const randomIndex = Math.floor(Math.random() * letters.length);
        chosenIndices.add(letters[randomIndex].index);
      }

      const prefilled = Array.from(chosenIndices).map(index => ({
        index,
        letter: quote.q[index],
      }));

      setGuessedLetters(prev => [...prev, ...prefilled]);
    };

    setShuffledAlphabet(shuffleAlphabet());
    setupQuote();
    loadProgress().finally(() => setLoading(false));

    return stopTimer;
  }, [quote.q]);

  const handleConfirmGuess = async () => {
    if (!previewLetter || selectedIndex === null) return;

    const lowerGuess = previewLetter.trim().toLowerCase();
    const targetChar = quote.q[selectedIndex];

    if (guessedLetters.find(g => g.index === selectedIndex)) {
      setPreviewLetter('');
      return;
    }

    let newGuessedLetters = [...guessedLetters];
    let newWrongGuesses = [...wrongGuesses];

    if (lowerGuess === targetChar.toLowerCase()) {
      newGuessedLetters.push({ index: selectedIndex, letter: targetChar });
      setGuessedLetters(newGuessedLetters);
      setLastGuessFeedback({ index: selectedIndex, type: 'correct' });
    } else {
      newWrongGuesses.push({ index: selectedIndex, letter: lowerGuess });
      setWrongGuesses(newWrongGuesses);
      setLastGuessFeedback({ index: selectedIndex, type: 'wrong' });
    }

    await AsyncStorage.setItem(QUOTE_PROGRESS_KEY, JSON.stringify({
      guessedLetters: newGuessedLetters,
      wrongGuesses: newWrongGuesses
    }));

    setPreviewLetter('');
    setSelectedIndex(null);
  };

  if (loading) {
    return <ActivityIndicator size="large" color="#0000ff" />;
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <TouchableWithoutFeedback onPress={Platform.OS !== 'web' ? Keyboard.dismiss : null}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

          <Text style={styles.timer}>
            Time: {Math.floor(secondsElapsed / 60).toString().padStart(2, '0')}:
            {(secondsElapsed % 60).toString().padStart(2, '0')}
          </Text>

          <Text style={styles.wrongCounter}>Wrong guesses: {wrongGuesses.length}</Text>

          <View style={styles.quoteRow}>
            {Array.from(new Set(charMap.map(c => c.wordIndex))).map(wordIndex => (
              <View key={wordIndex} style={styles.wordBox}>
                {charMap.filter(c => c.wordIndex === wordIndex).map((c) => {
                  const guessedObj = guessedLetters.find(g => g.index === c.index);
                  let displayChar = '_';
                  if (!c.isLetter) displayChar = c.char;
                  else if (guessedObj) displayChar = guessedObj.letter;
                  else if (selectedIndex === c.index && previewLetter) displayChar = previewLetter;

                  const isSelected = selectedIndex === c.index;
                  const alphabetIndex = c.isLetter ? shuffledAlphabet.indexOf(c.char.toLowerCase()) + 1 : null;

                  return (
                    <Pressable
                      key={c.index}
                      onPress={() => {
                        if (c.isLetter) {
                          setSelectedIndex(c.index);
                          setGuess('');
                          inputRef.current?.focus();
                        }
                      }}
                    >
                      <Animatable.View
                        animation={lastGuessFeedback?.index === c.index ? 'bounceIn' : undefined}
                        duration={1500}
                        style={[
                          c.char !== " " && styles.charBox,
                          isSelected && styles.selectedCharBox,
                        ]}
                      >
                        {lastGuessFeedback?.index === c.index && (
                          <Animatable.View
                            animation="fadeOut"
                            duration={1500}
                            onAnimationEnd={() => {
                              if (lastGuessFeedback?.index === c.index) {
                                setLastGuessFeedback(null);
                              }
                            }}
                            style={[
                              StyleSheet.absoluteFill,
                              lastGuessFeedback.type === 'correct' ? styles.correctFade : styles.wrongFade
                            ]}
                          />
                        )}
                        <Text style={styles.charText}>{displayChar}</Text>
                        {c.isLetter && (
                          <Text style={styles.clueText}>{alphabetIndex}</Text>
                        )}
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
};

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

export default QuoteScreen;
