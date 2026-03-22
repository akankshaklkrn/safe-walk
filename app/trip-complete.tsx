import { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors } from '../constants/colors';
import { formatDuration } from '../services/api';

type SummaryResult =
  | { status: 'ready';   title: string; text: string }
  | { status: 'pending'; hint: string }
  | { status: 'error';   msg: string };

async function fetchConversationSummary(conversationId: string): Promise<SummaryResult> {
  const apiKey = process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY;

  if (!apiKey) {
    return { status: 'error', msg: 'ElevenLabs API key is not configured (EXPO_PUBLIC_ELEVENLABS_API_KEY).' };
  }
  if (!conversationId) {
    return { status: 'error', msg: 'No conversation ID was passed to this screen.' };
  }

  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}`,
      { method: 'GET', headers: { 'xi-api-key': apiKey } },
    );

    if (!res.ok) {
      return { status: 'error', msg: `ElevenLabs returned ${res.status}. The conversation may still be processing.` };
    }

    const data = (await res.json()) as {
      status?: string;
      transcript?: Array<{ role: 'agent' | 'user'; message: string | null }>;
      analysis?: {
        transcript_summary?: string;
        call_summary_title?: string;
      };
    };

    // Log the shape in dev so we can see what arrived — remove before production
    if (__DEV__) {
      console.log('[ElevenLabs] conversation status:', data.status);
      console.log('[ElevenLabs] analysis keys:', Object.keys(data.analysis ?? {}));
      console.log('[ElevenLabs] transcript_summary:', data.analysis?.transcript_summary?.slice(0, 80));
    }

    // Correct fields per ElevenLabs response structure
    const title   = data.analysis?.call_summary_title ?? '';
    const summary = data.analysis?.transcript_summary ?? '';

    if (summary) {
      return { status: 'ready', title: title || 'Trip Summary', text: summary };
    }

    // API responded but analysis not ready yet — caller should offer retry
    const hint = data.status
      ? `Conversation is "${data.status}". Analysis is still being prepared.`
      : 'Summary is still being prepared by ElevenLabs.';
    return { status: 'pending', hint };

  } catch (err) {
    console.error('[ElevenLabs] fetch error:', err);
    return { status: 'error', msg: 'Network error. Check your connection and try again.' };
  }
}

export default function TripCompleteScreen() {
  const router = useRouter();
  const {
    completedAt,
    actualDurationSeconds,
    finalDistanceFromRouteMeters,
    destination,
    wasEscalated,
    elevenLabsConversationId,
  } = useLocalSearchParams<{
    completedAt: string;
    actualDurationSeconds: string;
    finalDistanceFromRouteMeters: string;
    destination: string;
    wasEscalated?: string;
    elevenLabsConversationId?: string;
  }>();

  const durationSec = parseInt(actualDurationSeconds ?? '0', 10);
  const finalDistM  = parseInt(finalDistanceFromRouteMeters ?? '0', 10);
  const isEscalated = wasEscalated === 'true';

  type SummaryState =
    | { tag: 'idle' }
    | { tag: 'loading' }
    | { tag: 'ready';   title: string; text: string }
    | { tag: 'pending'; hint: string }
    | { tag: 'error';   msg: string };

  const [summary, setSummary] = useState<SummaryState>({ tag: 'idle' });

  const handleFetchSummary = async () => {
    setSummary({ tag: 'loading' });
    const result = await fetchConversationSummary(elevenLabsConversationId ?? '');
    if (result.status === 'ready')   setSummary({ tag: 'ready',   title: result.title, text: result.text });
    else if (result.status === 'pending') setSummary({ tag: 'pending', hint: result.hint });
    else                             setSummary({ tag: 'error',   msg: result.msg });
  };

  const arrivedAt = completedAt
    ? new Date(completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <SafeAreaView style={styles.container}>

      {/* ── Top app bar ───────────────────────────────────────────── */}
      <View style={styles.appBar}>
        <Text style={styles.appBarTitle}>Trip Summary</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Hero ──────────────────────────────────────────────────── */}
        <View style={styles.hero}>
          {/* Icon in soft colored circle */}
          <View style={[styles.heroIconWrap, isEscalated && styles.heroIconWrapAlert]}>
            <Text style={styles.heroEmoji}>{isEscalated ? '🚨' : '✅'}</Text>
          </View>

          {/* Title */}
          <Text style={styles.heroTitle}>
            {isEscalated ? 'Alert was raised' : 'You arrived safely!'}
          </Text>

          {/* Destination */}
          <Text style={styles.heroDestination}>{destination}</Text>

          {/* Arrival time pill */}
          {arrivedAt ? (
            <View style={[styles.heroTimePill, isEscalated && styles.heroTimePillAlert]}>
              <Text style={[styles.heroTime, isEscalated && styles.heroTimeAlert]}>
                {isEscalated ? 'Trip ended at' : 'Arrived at'} {arrivedAt}
              </Text>
            </View>
          ) : null}

          {/* Escalated notice */}
          {isEscalated ? (
            <Text style={styles.heroAlert}>
              Your trusted contact was notified with your location
            </Text>
          ) : null}
        </View>

        {/* ── Summary card ──────────────────────────────────────────── */}
        <View style={styles.summaryCard}>
          {/* Top row: label + mode pill */}
          <View style={styles.cardTopRow}>
            <Text style={styles.cardRouteLabel}>Verified Route</Text>
            <View style={styles.cardModePill}>
              <Text style={styles.cardModeText}>Safe Route</Text>
            </View>
          </View>

          <View style={styles.cardDivider} />

          {/* Stats row: duration + distance */}
          <View style={styles.cardStatsRow}>
            <View style={styles.cardStat}>
              <Text style={styles.cardStatValue}>{formatDuration(durationSec)}</Text>
              <Text style={styles.cardStatLabel}>Duration</Text>
            </View>
            <View style={styles.cardStatDivider} />
            <View style={styles.cardStat}>
              <Text style={styles.cardStatValue}>{finalDistM} m</Text>
              <Text style={styles.cardStatLabel}>Distance</Text>
            </View>
          </View>

          <View style={styles.cardDivider} />

          {/* Destination row */}
          <View style={styles.cardDestRow}>
            <Text style={styles.cardDestLabel}>To</Text>
            <Text style={styles.cardDestValue} numberOfLines={1}>{destination}</Text>
          </View>
        </View>

        {/* ── AI message ────────────────────────────────────────────── */}
        <View style={styles.aiCard}>
          <View style={styles.aiCardAvatar}>
            <Text style={styles.aiCardAvatarText}>AI</Text>
          </View>
          <View style={styles.aiCardBody}>
            <Text style={styles.aiCardName}>SafeWalk AI</Text>
            <Text style={styles.aiCardText}>
              {isEscalated
                ? 'Your trusted contact was notified. Please check in with them when you can.'
                : `Great trip to ${destination || 'your destination'}! You stayed safe throughout the journey.`}
            </Text>
          </View>
        </View>

        {/* ── AI summary (on-demand) ────────────────────────────────── */}
        {elevenLabsConversationId ? (
          summary.tag === 'idle' ? (
            <TouchableOpacity style={styles.summaryBtn} onPress={() => void handleFetchSummary()} activeOpacity={0.7}>
              <Text style={styles.summaryBtnText}>✦  View AI Trip Summary</Text>
            </TouchableOpacity>

          ) : summary.tag === 'loading' ? (
            <View style={styles.summaryLoading}>
              <ActivityIndicator size="small" color="#4F46E5" />
              <Text style={styles.summaryLoadingText}>Generating summary…</Text>
            </View>

          ) : summary.tag === 'ready' ? (
            <View style={styles.aiSummaryCard}>
              <View style={styles.aiSummaryHeader}>
                <View style={styles.aiSummaryDot} />
                <Text style={styles.aiSummaryLabel}>{summary.title}</Text>
              </View>
              <Text style={styles.aiSummaryText}>{summary.text}</Text>
            </View>

          ) : summary.tag === 'pending' ? (
            <View style={styles.summaryPending}>
              <Text style={styles.summaryPendingText}>{summary.hint}</Text>
              <TouchableOpacity style={styles.summaryRetryBtn} onPress={() => void handleFetchSummary()} activeOpacity={0.7}>
                <Text style={styles.summaryRetryText}>Try again</Text>
              </TouchableOpacity>
            </View>

          ) : (
            <View style={styles.summaryPending}>
              <Text style={styles.summaryPendingText}>{summary.msg}</Text>
              <TouchableOpacity style={styles.summaryRetryBtn} onPress={() => void handleFetchSummary()} activeOpacity={0.7}>
                <Text style={styles.summaryRetryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )
        ) : null}

        {/* ── Done ──────────────────────────────────────────────────── */}
        <TouchableOpacity
          style={styles.doneButton}
          onPress={() => router.replace('/')}
        >
          <Text style={styles.doneButtonText}>Done</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray[50] },

  // ── App bar ──────────────────────────────────────────────────────
  appBar: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  appBarTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },

  // ── Scroll ───────────────────────────────────────────────────────
  scroll: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 48 },

  // ── Hero ─────────────────────────────────────────────────────────
  hero: {
    alignItems: 'center',
    paddingTop: 36,
    paddingBottom: 8,
    marginBottom: 20,
  },
  heroIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(16,185,129,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  heroIconWrapAlert: {
    backgroundColor: 'rgba(239,68,68,0.10)',
  },
  heroEmoji: {
    fontSize: 42,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  heroDestination: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textLight,
    textAlign: 'center',
    paddingHorizontal: 32,
    marginBottom: 12,
  },
  heroTimePill: {
    backgroundColor: 'rgba(16,185,129,0.10)',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
  },
  heroTimePillAlert: {
    backgroundColor: 'rgba(239,68,68,0.10)',
  },
  heroTime: {
    fontSize: 13,
    color: '#10B981',
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  heroTimeAlert: {
    color: colors.red,
  },
  heroAlert: {
    fontSize: 14,
    color: colors.red,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 32,
    marginTop: 12,
  },

  // ── Summary card ─────────────────────────────────────────────────
  summaryCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    marginBottom: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.gray[200],
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  cardRouteLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textLight,
  },
  cardModePill: {
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  cardModeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4F46E5',
    letterSpacing: 0.3,
  },
  cardDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  cardStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  cardStat: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  cardStatValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.3,
  },
  cardStatLabel: {
    fontSize: 11,
    color: colors.textLight,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardStatDivider: {
    width: 1,
    height: 36,
    backgroundColor: colors.border,
    marginHorizontal: 8,
  },
  cardDestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 10,
  },
  cardDestLabel: {
    fontSize: 12,
    color: colors.textLight,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardDestValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },

  // ── AI message card ───────────────────────────────────────────────
  aiCard: {
    backgroundColor: '#F5F6FF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 28,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(79,70,229,0.18)',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  aiCardAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  aiCardAvatarText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  aiCardBody: {
    flex: 1,
    gap: 6,
  },
  aiCardName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4F46E5',
  },
  aiCardText: {
    fontSize: 14,
    color: colors.gray[600],
    lineHeight: 21,
  },

  // ── AI summary (on-demand) ───────────────────────────────────────
  summaryBtn: {
    borderWidth: 1,
    borderColor: 'rgba(79,70,229,0.35)',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 14,
    backgroundColor: 'rgba(79,70,229,0.04)',
  },
  summaryBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4F46E5',
    letterSpacing: 0.2,
  },
  summaryLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    marginBottom: 14,
  },
  summaryLoadingText: {
    fontSize: 14,
    color: colors.textLight,
    fontWeight: '500',
  },
  aiSummaryCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.gray[200],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
    gap: 12,
  },
  aiSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  aiSummaryDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#4F46E5',
  },
  aiSummaryLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4F46E5',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  aiSummaryText: {
    fontSize: 14,
    color: colors.gray[700],
    lineHeight: 22,
  },
  summaryPending: {
    backgroundColor: colors.gray[100],
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    gap: 10,
    alignItems: 'center',
  },
  summaryPendingText: {
    fontSize: 13,
    color: colors.textLight,
    textAlign: 'center',
    lineHeight: 19,
  },
  summaryRetryBtn: {
    borderWidth: 1,
    borderColor: colors.gray[300],
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  summaryRetryText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.gray[700],
  },

  // ── Done button ──────────────────────────────────────────────────
  doneButton: {
    backgroundColor: '#111827',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 4,
  },
  doneButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
