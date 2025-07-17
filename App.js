import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MenuScreen from './Components/MenuScreen';
import GameScreen from './Components/GameScreen';


const Stack = createNativeStackNavigator();


export default function App() {



return (
  <NavigationContainer>
    <Stack.Navigator initialRouteName="Menu">
      <Stack.Screen name="Menu" component={MenuScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Game" component={GameScreen} options={{ headerShown: true }} />
    </Stack.Navigator>
  </NavigationContainer>
  
);
}