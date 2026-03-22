import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { colors } from '../constants/colors';
import { AIMessage } from '../data/mockMessages';

interface AICompanionPanelProps {
  messages: AIMessage[];
}

const AI_INDIGO = '#4F46E5';

export default function AICompanionPanel({ messages }: AICompanionPanelProps) {
  const formatTime = (date: Date) =>
    date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  return (
    <ScrollView
      style={styles.list}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
    >
      {messages.map((message) => {
        const isAI = message.sender === 'ai';
        return (
          <View key={message.id} style={[styles.row, isAI ? styles.aiRow : styles.userRow]}>
            {isAI && (
              <View style={styles.miniAvatar}>
                <Text style={styles.miniAvatarText}>AI</Text>
              </View>
            )}
            <View style={styles.bubbleWrap}>
              <View style={[styles.bubble, isAI ? styles.aiBubble : styles.userBubble]}>
                <Text style={[styles.bubbleText, !isAI && styles.userBubbleText]}>
                  {message.text}
                </Text>
              </View>
              <Text style={[styles.timestamp, !isAI && styles.userTimestamp]}>
                {formatTime(message.timestamp)}
              </Text>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
  },
  listContent: {
    paddingVertical: 6,
    gap: 12,
  },

  // ── Message rows ─────────────────────────────────────────────────
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  aiRow: {
    justifyContent: 'flex-start',
    gap: 8,
  },
  userRow: {
    justifyContent: 'flex-end',
  },

  // ── Mini avatar (AI only) ────────────────────────────────────────
  miniAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: AI_INDIGO,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  miniAvatarText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // ── Bubble wrapper + bubble ──────────────────────────────────────
  bubbleWrap: {
    maxWidth: '82%',
  },
  bubble: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  aiBubble: {
    backgroundColor: '#EEF2FF',
    borderBottomLeftRadius: 4,
  },
  userBubble: {
    backgroundColor: AI_INDIGO,
    borderBottomRightRadius: 4,
  },
  bubbleText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  userBubbleText: {
    color: '#FFFFFF',
  },

  // ── Timestamps ───────────────────────────────────────────────────
  timestamp: {
    fontSize: 11,
    color: colors.textLight,
    marginTop: 3,
    marginLeft: 2,
  },
  userTimestamp: {
    textAlign: 'right',
    marginLeft: 0,
    marginRight: 2,
  },
});
