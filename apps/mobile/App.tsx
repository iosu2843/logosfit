import { View, Text } from 'react-native';
import { routines } from '@core';

export default function App() {
  return (
    <View style={{ padding: 20 }}>
      <Text>LOGOSFIT</Text>

      {routines.push.map((ex, i) => (
        <Text key={i}>
          {ex.name} - {ex.sets}x{ex.reps}
        </Text>
      ))}
    </View>
  );
}
