import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { colors } from '../constants/colors';
import { AIMessage } from '../data/mockMessages';

interface AICompanionPanelProps {
  messages: AIMessage[];
}

export default function AICompanionPanel({ messages }: AICompanionPanelProps) {
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerIcon}>🤖</Text>
        <Text style={styles.headerText}>AI Companion</Text>
      </View>
      
      <ScrollView 
        style={styles.messageList}
        contentContainerStyle={styles.messageListContent}
        showsVerticalScrollIndicator={false}
      >
        {messages.map((message) => (
          <View key={message.id} style={styles.messageBubble}>
            <Text style={styles.messageText}>{message.text}</Text>
            <Text style={styles.messageTime}>{formatTime(message.timestamp)}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.gray[50],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 8,
  },
  headerIcon: {
    fontSize: 20,
  },
  headerText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  messageList: {
    maxHeight: 200,
  },
  messageListContent: {
    padding: 16,
    gap: 12,
  },
  messageBubble: {
    backgroundColor: '#F0F8FF',
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  messageText: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
    marginBottom: 6,
  },
  messageTime: {
    fontSize: 12,
    color: colors.textLight,
  },
});
