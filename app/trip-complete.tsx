import { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors } from '../constants/colors';
import { deviationLevelLabel, formatDuration, type DeviationLevel } from '../services/api';
async function fetchElevenLabsConversationSummary(
  conversationId: string,
): Promise<string> {
  const apiKey = process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY;
  if (!apiKey) {
    return 'ElevenLabs API key not configured.';
  }

  if (!conversationId) {
    return 'No conversation ID available. The conversation may not have been established.';
  }

  try {
    console.log('[ElevenLabs] Fetching conversation summary for ID:', conversationId);
    const url = `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'xi-api-key': apiKey,
      },
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error('[ElevenLabs] API error:', res.status, res.statusText, errorText);
      return `Could not fetch conversation summary (${res.status}). The conversation may still be processing.`;
    }

    const data = (await res.json()) as {
      conversation_id?: string;
      agent_id?: string;
      status?: string;
      transcript?: Array<{
        role: 'agent' | 'user';
        message: string | null;
      }>;
      analysis?: {
        transcript_summary?: string;
        call_summary_title?: string;
      };
    };

    console.log('[ElevenLabs] Conversation status:', data.status);

    // Extract summary from analysis object
    const summaryTitle = data.analysis?.call_summary_title;
    const summaryText = data.analysis?.transcript_summary;
    
    if (summaryText) {
      console.log('[ElevenLabs] Found summary:', summaryTitle);
      // Format with title if available
      return summaryTitle 
        ? `**${summaryTitle}**\n\n${summaryText}`
        : summaryText;
    }

    // Fallback if no summary but transcript available
    if (data.transcript && data.transcript.length > 0) {
      const messageCount = data.transcript.length;
      const userMessages = data.transcript.filter(t => t.role === 'user').length;
      return `Your trip companion conversation included ${messageCount} messages (${userMessages} from you). The conversation summary is still being processed by ElevenLabs.`;
    }

    return 'Conversation summary is still being processed. Please try again in a few moments.';
  } catch (error) {
    console.error('[ElevenLabs] Error fetching summary:', error);
    return 'Could not fetch conversation summary. Check your connection.';
  }
}

export default function TripCompleteScreen() {
  const router = useRouter();
  const {
    tripId,
    completedAt,
    actualDurationSeconds,
    actualDurationMinutes,
    finalDistanceFromRouteMeters,
    finalDeviationLevel,
    destination,
    routeName,
    wasEscalated,
    elevenLabsConversationId,
  } = useLocalSearchParams<{
    tripId: string;
    completedAt: string;
    actualDurationSeconds: string;
    actualDurationMinutes: string;
    finalDistanceFromRouteMeters: string;
    finalDeviationLevel: DeviationLevel;
    destination: string;
    routeName: string;
    wasEscalated?: string;
    elevenLabsConversationId?: string;
  }>();

  const [feedback, setFeedback]         = useState<string | null>(null);
  const [loadingFeedback, setLoading]   = useState(false);

  const durationSec  = parseInt(actualDurationSeconds ?? '0', 10);
  const durationMin  = parseInt(actualDurationMinutes ?? '0', 10);
  const finalDistM   = parseInt(finalDistanceFromRouteMeters ?? '0', 10);
  const deviationLvl = (finalDeviationLevel ?? 'none') as DeviationLevel;
  const isEscalated  = wasEscalated === 'true';

  const arrivedAt = completedAt
    ? new Date(completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  const handleGetFeedback = async () => {
    setLoading(true);
    const result = await fetchElevenLabsConversationSummary(elevenLabsConversationId ?? '');
    setFeedback(result);
    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Hero ──────────────────────────────────────────────────── */}
        <View style={styles.hero}>
          <Text style={styles.heroEmoji}>{isEscalated ? '🚨' : '🎉'}</Text>
          <Text style={styles.heroTitle}>
            {isEscalated ? 'Alert was raised' : 'You arrived safely!'}
          </Text>
          <Text style={styles.heroDestination}>{destination}</Text>
          {arrivedAt ? (
            <Text style={[styles.heroTime, isEscalated && styles.heroTimeAlert]}>
              {isEscalated ? 'Trip ended at' : 'Arrived at'} {arrivedAt}
            </Text>
          ) : null}
          {isEscalated ? (
            <Text style={styles.heroAlert}>
              Your trusted contact was notified with your location
            </Text>
          ) : null}
        </View>

        {/* ── Summary cards ─────────────────────────────────────────── */}
        <View style={styles.cards}>

          <View style={styles.card}>
            <Text style={styles.cardIcon}>⏱</Text>
            <View style={styles.cardBody}>
              <Text style={styles.cardLabel}>Trip Duration</Text>
              <Text style={styles.cardValue}>{formatDuration(durationSec)}</Text>
              <Text style={styles.cardSub}>{durationMin} min total</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardIcon}>📍</Text>
            <View style={styles.cardBody}>
              <Text style={styles.cardLabel}>Route Accuracy</Text>
              <Text style={styles.cardValue}>{deviationLevelLabel(deviationLvl)}</Text>
              <Text style={styles.cardSub}>
                Final deviation: {finalDistM}m from route
              </Text>
            </View>
          </View>

          {routeName ? (
            <View style={styles.card}>
              <Text style={styles.cardIcon}>🗺</Text>
              <View style={styles.cardBody}>
                <Text style={styles.cardLabel}>Route Taken</Text>
                <Text style={styles.cardValue}>{routeName}</Text>
              </View>
            </View>
          ) : null}

          <View style={[styles.card, styles.cardDebug]}>
            <Text style={styles.cardIcon}>🔑</Text>
            <View style={styles.cardBody}>
              <Text style={styles.cardLabel}>Trip ID (for testing)</Text>
              <Text style={styles.cardValueMono}>{tripId}</Text>
            </View>
          </View>

        </View>

        {/* ── AI Feedback ───────────────────────────────────────────── */}
        <View style={styles.feedbackSection}>
          <Text style={styles.feedbackHeading}>Trip Feedback</Text>
          <Text style={styles.feedbackSub}>
            Get a summary of your trip companion conversation from ElevenLabs.
          </Text>

          {!feedback && !loadingFeedback && (
            <TouchableOpacity style={styles.feedbackButton} onPress={() => void handleGetFeedback()}>
              <Text style={styles.feedbackButtonText}>✨ Generate Trip Feedback</Text>
            </TouchableOpacity>
          )}

          {loadingFeedback && (
            <View style={styles.feedbackLoading}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.feedbackLoadingText}>Generating your trip summary…</Text>
            </View>
          )}

          {feedback && (
            <View style={styles.feedbackCard}>
              <Text style={styles.feedbackCardTitle}>🤖 Your Trip Summary</Text>
              <Text style={styles.feedbackCardText}>{feedback}</Text>
              <TouchableOpacity
                style={styles.feedbackRetry}
                onPress={() => { setFeedback(null); void handleGetFeedback(); }}
              >
                <Text style={styles.feedbackRetryText}>Regenerate</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── Actions ───────────────────────────────────────────────── */}
        <TouchableOpacity
          style={styles.homeButton}
          onPress={() => router.replace('/')}
        >
          <Text style={styles.homeButtonText}>Back to Home</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll:    { paddingHorizontal: 24, paddingTop: 40, paddingBottom: 48 },

  hero: { alignItems: 'center', marginBottom: 40, gap: 8 },
  heroEmoji:       { fontSize: 72 },
  heroTitle:       { fontSize: 30, fontWeight: '800', color: colors.text, marginTop: 8 },
  heroDestination: { fontSize: 16, color: colors.textLight, textAlign: 'center', paddingHorizontal: 32 },
  heroTime:        { fontSize: 14, color: colors.green, fontWeight: '600' },
  heroTimeAlert:   { color: colors.red },
  heroAlert:       { fontSize: 14, color: colors.red, fontWeight: '600', textAlign: 'center', paddingHorizontal: 32, marginTop: 4 },

  cards: { gap: 12, marginBottom: 24 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 18,
    gap: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardDebug:     { borderColor: colors.gray[200], backgroundColor: colors.gray[50] },
  cardIcon:      { fontSize: 28 },
  cardBody:      { flex: 1, gap: 2 },
  cardLabel:     { fontSize: 12, color: colors.textLight, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  cardValue:     { fontSize: 18, fontWeight: '700', color: colors.text },
  cardValueMono: { fontSize: 11, fontFamily: 'monospace', color: colors.gray[600], lineHeight: 18 },
  cardSub:       { fontSize: 12, color: colors.textLight, marginTop: 2 },

  feedbackSection: {
    marginBottom: 24,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    gap: 12,
  },
  feedbackHeading: { fontSize: 17, fontWeight: '700', color: colors.text },
  feedbackSub:     { fontSize: 13, color: colors.textLight, lineHeight: 18 },

  feedbackButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  feedbackButtonText: { color: colors.white, fontSize: 15, fontWeight: '700' },

  feedbackLoading: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  feedbackLoadingText: { fontSize: 14, color: colors.textLight },

  feedbackCard: {
    backgroundColor: '#F0F7FF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    gap: 10,
  },
  feedbackCardTitle: { fontSize: 14, fontWeight: '700', color: colors.primary },
  feedbackCardText:  { fontSize: 14, color: colors.text, lineHeight: 22 },
  feedbackRetry: { alignSelf: 'flex-end' },
  feedbackRetryText: { fontSize: 13, color: colors.primary, fontWeight: '600' },

  homeButton: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  homeButtonText: { color: colors.white, fontSize: 17, fontWeight: '700' },
});
