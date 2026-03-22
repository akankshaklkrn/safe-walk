import { generateVoicePrompt } from '../services/p3';
import { SafetyStatus } from '../types';

export interface AIMessage {
  id: string;
  text: string;
  timestamp: Date;
  sender: 'ai' | 'user';
}

export const getMockAIMessages = (
  destination = 'your destination',
  routeName = 'your selected route',
  safetyStatus: SafetyStatus = 'safe'
): AIMessage[] => {
  const now = new Date();
  const openingPrompt = generateVoicePrompt({
    destination,
    routeName,
    eta: '12 min',
    safetyStatus,
  });
  
  return [
    {
      id: '1',
      text: openingPrompt.script,
      timestamp: new Date(now.getTime() - 120000), // 2 min ago
      sender: 'ai',
    },
    {
      id: '2',
      text: "You're on the right path. I'll keep talking while you make progress.",
      timestamp: new Date(now.getTime() - 60000), // 1 min ago
      sender: 'ai',
    },
    {
      id: '3',
      text: "Everything looks good. About 10 minutes until you arrive.",
      timestamp: new Date(now.getTime() - 30000), // 30 sec ago
      sender: 'ai',
    },
  ];
};
