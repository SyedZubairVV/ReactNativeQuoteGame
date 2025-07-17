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

const QuoteScreen = () => {
  const [quote, setQuote] = useState({
    q: "Do not spoil what you have by desiring what you have not.",
    a: "Epicurus",
  });
  const [loading, setLoading] = useState(true);
  const [guessedLetters, setGuessedLetters] = useState([]);
  const [guess, setguess] = useState('');
  const [wrongGuesses, setWrongGuesses] = useState([]);
  const [shuffledAlphabet, setShuffledAlphabet] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [charMap, setCharMap] = useState([]);
  const inputRef = useRef(null);
  const [previewLetter, setPreviewLetter] = useState('');
  const [lastGuessFeedback, setLastGuessFeedback] = useState(null); // shape: { index: number, type: 'correct' | 'wrong' }



  // Setup quote
  useEffect(() => {
    setLoading(false);
    setShuffledAlphabet(shuffleAlphabet());
    setGuessedLetters([]);
    setWrongGuesses([]);
    setSelectedIndex(null);

    // Build charMap once on load or when quote changes
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
  }, [quote.q]);

  const shuffleAlphabet = () => {
    const alphabet = 'abcdefghijklmnopqrstuvwxyz'.split('');
    for (let i = alphabet.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [alphabet[i], alphabet[j]] = [alphabet[j], alphabet[i]];
    }
    return alphabet;
  };

  const handleConfirmGuess = () => {
    if (!previewLetter || selectedIndex === null) return;
  
    const lowerGuess = previewLetter.trim().toLowerCase();
    const targetChar = quote.q[selectedIndex];
  
    if (guessedLetters.find(g => g.index === selectedIndex)) {
      setPreviewLetter('');
      return;
    }
  
    if (lowerGuess === targetChar.toLowerCase()) {
      setGuessedLetters([...guessedLetters, { index: selectedIndex, letter: targetChar }]);
      setLastGuessFeedback({ index: selectedIndex, type: 'correct' });
    } else {
      setWrongGuesses([...wrongGuesses, { index: selectedIndex, letter: lowerGuess }]);
      setLastGuessFeedback({ index: selectedIndex, type: 'wrong' });
    }
    
    setPreviewLetter('');
    setSelectedIndex(null);
    
  };
  
  

  if (loading) {
    return <ActivityIndicator size="large" color="#0000ff" />;
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <TouchableWithoutFeedback onPress={Platform.OS !== 'web' ? Keyboard.dismiss : null}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Animatable.View animation="bounceIn" duration={2500}>
  <Text>Nice!</Text>
</Animatable.View>

          <View style={styles.quoteRow}>
            {/* Group by wordIndex to preserve word layout */}
            {Array.from(new Set(charMap.map(c => c.wordIndex))).map(wordIndex => (
              <View key={wordIndex} style={styles.wordBox}>
                {charMap
                  .filter(c => c.wordIndex === wordIndex)
                  .map((c) => {
                    const guessedObj = guessedLetters.find(g => g.index === c.index);
                    let displayChar = '_';
                    if (!c.isLetter) {
                      displayChar = c.char;
                    } else if (guessedObj) {
                      displayChar = guessedObj.letter;
                    } else if (selectedIndex === c.index && previewLetter) {
                      displayChar = previewLetter;
                    }
                    const isSelected = selectedIndex === c.index;
                    const alphabetIndex = c.isLetter ? shuffledAlphabet.indexOf(c.char.toLowerCase()) + 1 : null;

                    return (
                      <Pressable
                        key={c.index}
                        onPress={() => {
                          if (c.isLetter) {
                            setSelectedIndex(c.index);
                            setguess('');
                            inputRef.current?.focus();
                          }
                        }}
                      >
<Animatable.View
  animation={
    lastGuessFeedback?.index === c.index ? 'bounceIn' : undefined
  }
  duration={1500}
  key={`box-${c.index}`}
  style={[
    c.char !== " " && styles.charBox,
    isSelected && styles.selectedCharBox,
  ]}
  
>
  {/* ✅ Fading overlay color (green/red) */}
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
            onChangeText={(text) => {
              setPreviewLetter(text); // Show in selected spot
            }}
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
  authorText: {
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
    marginTop: 12,
  },
  input: {
    height: 40,
    margin: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    width: 120,
    textAlign: 'center',
    fontSize: 18,
    borderRadius: 6,
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
    overflow: 'hidden', // to clip fading color nicely
  },
  selectedCharBox: {
    borderBottomWidth: 2,
    borderColor: '#007BFF',
  },
  correctFade: {
    backgroundColor: 'rgba(40, 167, 69, 0.3)', // soft green
    borderRadius: 4,
  },
  
  wrongFade: {
    backgroundColor: 'rgba(220, 53, 69, 0.3)', // soft red
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